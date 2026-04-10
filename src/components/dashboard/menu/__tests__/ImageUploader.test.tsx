import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageUploader } from "../ImageUploader";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DataTransfer for drag-and-drop tests
class MockDataTransfer {
  items: { add: (file: File) => void };
  files: FileList | null = null;
  constructor() {
    const addedFiles: File[] = [];
    this.items = {
      add: (file: File) => addedFiles.push(file),
    };
    // Create a proxy that returns addedFiles as FileList-like
    Object.defineProperty(this, "files", {
      get: () => addedFiles,
      set: () => {},
    });
  }
}
Object.defineProperty(global, "DataTransfer", { value: MockDataTransfer });

describe("ImageUploader", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Empty State (no image)", () => {
    it("should display upload placeholder when no value", () => {
      render(<ImageUploader {...defaultProps} />);

      expect(
        screen.getByText("Click or drag image to upload")
      ).toBeInTheDocument();
      expect(screen.getByText("PNG, JPG up to 5MB")).toBeInTheDocument();
    });

    it("should have a hidden file input", () => {
      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveClass("hidden");
      expect(fileInput).toHaveAttribute("accept", "image/*");
    });

    it("should trigger file input click when upload area is clicked", () => {
      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      const uploadArea = screen.getByText("Click or drag image to upload")
        .closest("div[class*='cursor-pointer']") as HTMLElement;
      fireEvent.click(uploadArea);

      expect(clickSpy).toHaveBeenCalled();
    });

    it("should not trigger file input click when disabled", () => {
      const { container } = render(
        <ImageUploader {...defaultProps} disabled />
      );

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      const uploadArea = screen
        .getByText("Click or drag image to upload")
        .closest("div") as HTMLElement;
      fireEvent.click(uploadArea);

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe("Image Preview", () => {
    it("should display image preview when value is set", () => {
      render(
        <ImageUploader
          {...defaultProps}
          value="https://example.com/image.jpg"
        />
      );

      const img = screen.getByAltText("Preview");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
    });

    it("should display remove button when image is present", () => {
      render(
        <ImageUploader
          {...defaultProps}
          value="https://example.com/image.jpg"
        />
      );

      const removeButton = screen.getByRole("button");
      expect(removeButton).toBeInTheDocument();
    });

    it("should call onChange with empty string when remove is clicked", () => {
      const onChange = vi.fn();
      render(
        <ImageUploader
          value="https://example.com/image.jpg"
          onChange={onChange}
        />
      );

      const removeButton = screen.getByRole("button");
      fireEvent.click(removeButton);

      expect(onChange).toHaveBeenCalledWith("");
    });

    it("should disable remove button when disabled prop is true", () => {
      render(
        <ImageUploader
          {...defaultProps}
          value="https://example.com/image.jpg"
          disabled
        />
      );

      const removeButton = screen.getByRole("button");
      expect(removeButton).toBeDisabled();
    });
  });

  describe("File Validation", () => {
    it("should show error for non-image files", async () => {
      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const textFile = new File(["hello"], "test.txt", {
        type: "text/plain",
      });

      fireEvent.change(fileInput, { target: { files: [textFile] } });

      await waitFor(() => {
        expect(
          screen.getByText("Please select an image file")
        ).toBeInTheDocument();
      });
    });

    it("should show error for files larger than 5MB", async () => {
      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const largeFile = new File(["x".repeat(6 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(largeFile, "size", { value: 6 * 1024 * 1024 });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(
          screen.getByText("Image size must be less than 5MB")
        ).toBeInTheDocument();
      });
    });

    it("should not call fetch for invalid files", async () => {
      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const textFile = new File(["hello"], "test.txt", {
        type: "text/plain",
      });

      fireEvent.change(fileInput, { target: { files: [textFile] } });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("File Upload", () => {
    it("should upload valid image and call onChange with URL", async () => {
      const onChange = vi.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://cdn.example.com/uploaded.jpg" }),
      });

      const { container } = render(
        <ImageUploader value="" onChange={onChange} />
      );

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          "https://cdn.example.com/uploaded.jpg"
        );
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/dashboard/upload", {
        method: "POST",
        body: expect.any(FormData),
      });
    });

    it("should show uploading state during upload", async () => {
      let resolveUpload: (value: unknown) => void;
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });

      mockFetch.mockReturnValue(uploadPromise);

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      expect(screen.getByText("Uploading...")).toBeInTheDocument();

      resolveUpload!({
        ok: true,
        json: () => Promise.resolve({ url: "https://cdn.example.com/photo.jpg" }),
      });

      await waitFor(() => {
        expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
      });
    });

    it("should show error when upload fails with response error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "File too large" }),
      });

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByText("File too large")).toBeInTheDocument();
      });
    });

    it("should show generic error when response has no error message", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByText("Upload failed")).toBeInTheDocument();
      });
    });

    it("should show error when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should show generic error when non-Error is thrown", async () => {
      mockFetch.mockRejectedValue("string error");

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByText("Upload failed")).toBeInTheDocument();
      });
    });

    it("should do nothing when no file is selected", () => {
      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [] } });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reset file input after upload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://cdn.example.com/photo.jpg" }),
      });

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(fileInput.value).toBe("");
      });
    });
  });

  describe("Drag and Drop", () => {
    it("should handle dragOver event", () => {
      render(<ImageUploader {...defaultProps} />);

      const uploadArea = screen
        .getByText("Click or drag image to upload")
        .closest("div[class*='cursor-pointer']") as HTMLElement;

      const dragOverEvent = new Event("dragover", { bubbles: true });
      Object.defineProperty(dragOverEvent, "preventDefault", {
        value: vi.fn(),
      });

      fireEvent.dragOver(uploadArea);
      // Should not crash
    });

    it("should not process drop when disabled", () => {
      render(<ImageUploader {...defaultProps} disabled />);

      const uploadArea = screen
        .getByText("Click or drag image to upload")
        .closest("div") as HTMLElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [imageFile] },
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not process drop when no file is present", () => {
      render(<ImageUploader {...defaultProps} />);

      const uploadArea = screen
        .getByText("Click or drag image to upload")
        .closest("div[class*='cursor-pointer']") as HTMLElement;

      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [] },
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Drag and Drop Upload", () => {
    it("should not process drop while upload is in progress", async () => {
      let resolveUpload: (value: unknown) => void;
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });
      mockFetch.mockReturnValue(uploadPromise);

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      // Start an upload
      fireEvent.change(fileInput, { target: { files: [imageFile] } });
      expect(screen.getByText("Uploading...")).toBeInTheDocument();

      // Try to drop another file while uploading - the guard at top of handleDrop returns early
      const uploadArea = screen.getByText("Uploading...").closest("div[class*='border-dashed']") as HTMLElement;
      const droppedFile = new File(["more-data"], "another.jpg", {
        type: "image/jpeg",
      });
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [droppedFile] },
      });

      // Only the first upload should have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveUpload!({
        ok: true,
        json: () => Promise.resolve({ url: "https://cdn.example.com/photo.jpg" }),
      });

      await waitFor(() => {
        expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
      });
    });

    it("should not trigger click on upload area while uploading", async () => {
      let resolveUpload: (value: unknown) => void;
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });
      mockFetch.mockReturnValue(uploadPromise);

      const { container } = render(<ImageUploader {...defaultProps} />);

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, "click");

      const imageFile = new File(["image-data"], "photo.jpg", {
        type: "image/jpeg",
      });

      // Start an upload
      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      // Click upload area while uploading
      const uploadArea = screen.getByText("Uploading...").closest("div[class*='border-dashed']") as HTMLElement;
      fireEvent.click(uploadArea);

      // Should not trigger click because isUploading is true
      expect(clickSpy).not.toHaveBeenCalled();

      resolveUpload!({
        ok: true,
        json: () => Promise.resolve({ url: "https://cdn.example.com/photo.jpg" }),
      });

      await waitFor(() => {
        expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
      });
    });
  });

  describe("Disabled State", () => {
    it("should apply disabled styles to upload area", () => {
      render(<ImageUploader {...defaultProps} disabled />);

      const uploadArea = screen
        .getByText("Click or drag image to upload")
        .closest("div[class*='border-dashed']") as HTMLElement;

      expect(uploadArea?.className).toContain("cursor-not-allowed");
    });

    it("should disable file input when disabled", () => {
      const { container } = render(
        <ImageUploader {...defaultProps} disabled />
      );

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      expect(fileInput).toBeDisabled();
    });
  });
});
