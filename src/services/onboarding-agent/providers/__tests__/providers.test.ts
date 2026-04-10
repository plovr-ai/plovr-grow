import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClaudeProvider } from "../claude.provider";
import { OpenAIProvider } from "../openai.provider";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: new Headers(),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== ClaudeProvider ====================

describe("ClaudeProvider", () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    provider = new ClaudeProvider();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getProviderName()", () => {
    it("should include claude in the name", () => {
      expect(provider.getProviderName()).toContain("claude");
    });
  });

  describe("isConfigured()", () => {
    it("should return true when API key is set", () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it("should return false when API key is empty", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      const unconfigured = new ClaudeProvider();
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe("extractStructuredData()", () => {
    it("should return error when not configured", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      const unconfigured = new ClaudeProvider();

      const result = await unconfigured.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "Extract: {{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("ANTHROPIC_API_KEY");
    });

    it("should call Claude API and return parsed data", async () => {
      const responseData = { name: "Test Restaurant" };
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: JSON.stringify(responseData) }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 100, output_tokens: 50 },
        })
      );

      const result = await provider.extractStructuredData<{ name: string }>(
        "restaurant content",
        { type: "restaurant_info", fields: [] },
        "Extract from: {{CONTENT}}"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseData);
      expect(result.tokensUsed).toBe(150);
      expect(result.model).toBe("claude-sonnet-4-20250514");

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-api-key": "test-key",
            "anthropic-version": "2023-06-01",
          }),
        })
      );
    });

    it("should parse JSON from markdown code blocks", async () => {
      const responseData = { name: "Test" };
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "```json\n" + JSON.stringify(responseData) + "\n```" }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 30 },
        })
      );

      const result = await provider.extractStructuredData<{ name: string }>(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseData);
    });

    it("should return error when API returns non-OK status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: vi.fn().mockResolvedValue("Rate limited"),
      } as unknown as Response);

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("429");
    });

    it("should return error when response text is not valid JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "I cannot extract the data" }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });

    it("should return error when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce("string error");

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown error");
    });

    it("should handle empty content array", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 0 },
        })
      );

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });

    it("should replace {{CONTENT}} placeholder in instructions", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"result": true}' }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      await provider.extractStructuredData(
        "MY CONTENT HERE",
        { type: "test", fields: [] },
        "Process this: {{CONTENT}}"
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toBe("Process this: MY CONTENT HERE");
    });
  });

  describe("extractRestaurantInfo()", () => {
    it("should use google_business prompt for google_business source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"name": "Test"}' }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      await provider.extractRestaurantInfo("content", "google_business");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain("Google Business");
    });

    it("should use default prompt for website source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"name": "Test"}' }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      await provider.extractRestaurantInfo("content", "website");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain("restaurant information");
    });
  });

  describe("extractMenu()", () => {
    it("should use doordash prompt for doordash source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"categories": []}' }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      await provider.extractMenu("content", "doordash");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain("DoorDash");
    });

    it("should use ubereats prompt for ubereats source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"categories": []}' }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      await provider.extractMenu("content", "ubereats");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain("Uber Eats");
    });

    it("should use default menu prompt for website source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "msg-1",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: '{"categories": []}' }],
          model: "claude-sonnet-4-20250514",
          usage: { input_tokens: 50, output_tokens: 20 },
        })
      );

      await provider.extractMenu("content", "website");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[0].content).toContain("menu data");
    });
  });
});

// ==================== OpenAIProvider ====================

describe("OpenAIProvider", () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    provider = new OpenAIProvider();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getProviderName()", () => {
    it("should include openai in the name", () => {
      expect(provider.getProviderName()).toContain("openai");
    });
  });

  describe("isConfigured()", () => {
    it("should return true when API key is set", () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it("should return false when API key is empty", () => {
      vi.stubEnv("OPENAI_API_KEY", "");
      const unconfigured = new OpenAIProvider();
      expect(unconfigured.isConfigured()).toBe(false);
    });
  });

  describe("extractStructuredData()", () => {
    it("should return error when not configured", async () => {
      vi.stubEnv("OPENAI_API_KEY", "");
      const unconfigured = new OpenAIProvider();

      const result = await unconfigured.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "Extract: {{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("OPENAI_API_KEY");
    });

    it("should call OpenAI API and return parsed data", async () => {
      const responseData = { name: "Test Restaurant" };
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: JSON.stringify(responseData) },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        })
      );

      const result = await provider.extractStructuredData<{ name: string }>(
        "restaurant content",
        { type: "restaurant_info", fields: [] },
        "Extract from: {{CONTENT}}"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseData);
      expect(result.tokensUsed).toBe(150);
      expect(result.model).toBe("gpt-4o");

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-openai-key",
          }),
        })
      );

      // Verify request body includes response_format
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.response_format).toEqual({ type: "json_object" });
      expect(callBody.temperature).toBe(0.1);
    });

    it("should return error when API returns non-OK status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue("Server error"),
      } as unknown as Response);

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("should return error when response is not valid JSON", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "I cannot extract data" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        })
      );

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });

    it("should parse JSON from markdown code blocks as fallback", async () => {
      const responseData = { name: "Parsed" };
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "```json\n" + JSON.stringify(responseData) + "\n```",
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
        })
      );

      const result = await provider.extractStructuredData<{ name: string }>(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseData);
    });

    it("should return error when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection refused");
    });

    it("should handle non-Error throws", async () => {
      mockFetch.mockRejectedValueOnce(42);

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown error");
    });

    it("should handle empty choices array", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [],
          usage: { prompt_tokens: 50, completion_tokens: 0, total_tokens: 50 },
        })
      );

      const result = await provider.extractStructuredData(
        "content",
        { type: "test", fields: [] },
        "{{CONTENT}}"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to parse JSON");
    });

    it("should replace {{CONTENT}} placeholder in instructions", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"ok": true}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        })
      );

      await provider.extractStructuredData(
        "MY CONTENT",
        { type: "test", fields: [] },
        "Process: {{CONTENT}}"
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[1].content).toBe("Process: MY CONTENT");
    });
  });

  describe("extractRestaurantInfo()", () => {
    it("should use google_business prompt for google_business source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"name": "Test"}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        })
      );

      await provider.extractRestaurantInfo("content", "google_business");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[1].content).toContain("Google Business");
    });

    it("should use default prompt for website source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"name": "Test"}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        })
      );

      await provider.extractRestaurantInfo("content", "website");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[1].content).toContain("restaurant information");
    });
  });

  describe("extractMenu()", () => {
    it("should use doordash prompt for doordash source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"categories": []}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        })
      );

      await provider.extractMenu("content", "doordash");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[1].content).toContain("DoorDash");
    });

    it("should use ubereats prompt for ubereats source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"categories": []}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        })
      );

      await provider.extractMenu("content", "ubereats");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[1].content).toContain("Uber Eats");
    });

    it("should use default menu prompt for website source", async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          id: "chatcmpl-1",
          object: "chat.completion",
          created: 1234567890,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"categories": []}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        })
      );

      await provider.extractMenu("content", "website");

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.messages[1].content).toContain("menu data");
    });
  });
});
