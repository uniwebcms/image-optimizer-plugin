// tests/processor.test.js
import { jest } from "@jest/globals";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ImageProcessor } from "../src/processor.js";

// Mock sharp and file-type modules
jest.mock("sharp");
jest.mock("file-type", () => ({
  fileTypeFromFile: jest
    .fn()
    .mockResolvedValue({ ext: "jpg", mime: "image/jpeg" }),
}));

describe("ImageProcessor", () => {
  let processor;
  let testDir;
  let imagePath;

  beforeEach(async () => {
    testDir = join(tmpdir(), "processor-test-" + Date.now());
    await mkdir(testDir);

    imagePath = join(testDir, "test.jpg");
    await writeFile(imagePath, "mock image data");

    processor = new ImageProcessor({
      publicPath: "/images",
      formats: ["webp"],
      quality: 80,
      sizes: [
        { width: 640, suffix: "sm" },
        { width: 1024, suffix: "md" },
      ],
    });

    // Reset and setup sharp mock
    const sharp = require("sharp");
    sharp.mockClear();
    sharp.mockImplementation(() => ({
      metadata: jest.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        format: "jpeg",
      }),
      clone: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      avif: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({ size: 1024 }),
    }));
  });

  test("processes image and generates variants", async () => {
    const result = await processor.process(imagePath, testDir);

    expect(result).toMatchObject({
      width: 1920,
      height: 1080,
      format: "jpg",
      srcset: expect.stringContaining("webp"),
      sizes: expect.stringContaining("vw"),
      variants: expect.arrayContaining([
        expect.objectContaining({
          width: 640,
          format: "webp",
        }),
        expect.objectContaining({
          width: 1024,
          format: "webp",
        }),
      ]),
    });
  });

  test("maintains aspect ratio when resizing", async () => {
    const sharp = require("sharp");
    sharp.mockImplementationOnce(() => ({
      metadata: jest.fn().mockResolvedValue({
        width: 1000,
        height: 500,
        format: "jpeg",
      }),
      clone: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({ size: 1024 }),
    }));

    const result = await processor.process(imagePath, testDir);
    const smallVariant = result.variants.find((v) => v.width === 640);

    // Check if aspect ratio is maintained
    expect(smallVariant.height).toBe(320); // 640 * (500/1000)
  });

  test("handles multiple output formats", async () => {
    processor = new ImageProcessor({
      publicPath: "/images",
      formats: ["webp", "avif"],
      quality: 80,
      sizes: [{ width: 640, suffix: "sm" }],
    });

    const result = await processor.process(imagePath, testDir);

    // Should have variants for both formats
    expect(result.variants).toHaveLength(2);
    expect(result.variants.map((v) => v.format)).toContain("webp");
    expect(result.variants.map((v) => v.format)).toContain("avif");
  });

  test("applies correct optimization options per format", async () => {
    const sharp = require("sharp");
    const mockSharp = {
      metadata: jest.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        format: "jpeg",
      }),
      clone: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn(),
      avif: jest.fn(),
      jpeg: jest.fn(),
      png: jest.fn(),
      toFile: jest.fn().mockResolvedValue({ size: 1024 }),
    };

    sharp.mockImplementation(() => mockSharp);

    processor = new ImageProcessor({
      publicPath: "/images",
      formats: ["webp", "avif", "jpeg", "png"],
      quality: 80,
      sizes: [{ width: 640, suffix: "sm" }],
    });

    await processor.process(imagePath, testDir);

    // Verify format-specific options were applied
    expect(mockSharp.webp).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 80,
        effort: 6,
      })
    );

    expect(mockSharp.avif).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 80,
        effort: 6,
      })
    );

    expect(mockSharp.jpeg).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 80,
        mozjpeg: true,
      })
    );

    expect(mockSharp.png).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 80,
        effort: 6,
        palette: true,
      })
    );
  });

  test("prevents upscaling images", async () => {
    const sharp = require("sharp");
    sharp.mockImplementationOnce(() => ({
      metadata: jest.fn().mockResolvedValue({
        width: 500, // Smaller than target sizes
        height: 300,
        format: "jpeg",
      }),
      clone: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue({ size: 1024 }),
    }));

    const result = await processor.process(imagePath, testDir);

    // Should not generate variants larger than original
    expect(result.variants.every((v) => v.width <= 500)).toBe(true);
  });

  test("handles unsupported image types", async () => {
    const { fileTypeFromFile } = require("file-type");
    fileTypeFromFile.mockResolvedValueOnce({ ext: "gif", mime: "image/gif" });

    await expect(processor.process(imagePath, testDir)).rejects.toThrow(
      /Unsupported image type/
    );
  });
});
