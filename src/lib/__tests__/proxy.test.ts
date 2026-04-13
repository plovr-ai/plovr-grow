import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getProxyDispatcher", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.https_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTP_PROXY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns undefined when no proxy env vars are set", async () => {
    const { getProxyDispatcher } = await import("../proxy");
    expect(getProxyDispatcher()).toBeUndefined();
  });

  it("returns a dispatcher when https_proxy is set", async () => {
    process.env.https_proxy = "http://127.0.0.1:7890";
    const { getProxyDispatcher } = await import("../proxy");
    const dispatcher = getProxyDispatcher();
    expect(dispatcher).toBeDefined();
  });

  it("returns a dispatcher when HTTPS_PROXY is set", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7890";
    const { getProxyDispatcher } = await import("../proxy");
    const dispatcher = getProxyDispatcher();
    expect(dispatcher).toBeDefined();
  });

  it("returns a dispatcher when http_proxy is set", async () => {
    process.env.http_proxy = "http://127.0.0.1:7890";
    const { getProxyDispatcher } = await import("../proxy");
    const dispatcher = getProxyDispatcher();
    expect(dispatcher).toBeDefined();
  });

  it("returns a dispatcher when HTTP_PROXY is set", async () => {
    process.env.HTTP_PROXY = "http://127.0.0.1:7890";
    const { getProxyDispatcher } = await import("../proxy");
    const dispatcher = getProxyDispatcher();
    expect(dispatcher).toBeDefined();
  });

  it("prefers https_proxy over http_proxy", async () => {
    process.env.https_proxy = "http://127.0.0.1:8888";
    process.env.http_proxy = "http://127.0.0.1:9999";
    const { getProxyDispatcher } = await import("../proxy");
    const dispatcher = getProxyDispatcher();
    expect(dispatcher).toBeDefined();
  });
});
