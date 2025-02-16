// tests/plugin.test.js
import { jest } from "@jest/globals";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ImageOptimizerPlugin } from "../src/plugin.js";

// Mock external modules
jest.mock("sharp", () => {
  return jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      format: "jpeg",
    }),
    clone: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    avif: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({ size: 1024 }),
  }));
});

describe("ImageOptimizerPlugin", () => {
  let plugin;
  let testDir;
  let context;

  beforeEach(async () => {
    // Create temp test directory
    testDir = join(tmpdir(), "image-optimizer-test-" + Date.now());
    await mkdir(testDir);

    // Create test image
    const imagePath = join(testDir, "test.jpg");
    await writeFile(imagePath, "mock image data");

    // Initialize plugin with test options
    plugin = new ImageOptimizerPlugin({
      outputDir: join(testDir, "cache"),
      publicPath: "/images",
      formats: ["webp"],
      quality: 80,
      sizes: [{ width: 640, suffix: "sm" }],
    });

    // Mock context
    context = {
      resourcePath: testDir,
      errors: [],
      currentFile: join(testDir, "content.md"),
      cache: new Map(),
    };
  });

  test("processes image nodes correctly", async () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/test.jpg",
            alt: "Test image",
          },
        },
      ],
    };

    await plugin.beforeCollect(context);
    const result = await plugin.processContent(content, context);
    await plugin.afterCollect(context);

    // Verify that image node was processed
    const imageNode = result.content[0];
    expect(imageNode.attrs).toMatchObject({
      srcset: expect.stringContaining("webp"),
      sizes: expect.stringContaining("vw"),
      width: 1920,
      height: 1080,
      originalSrc: "/test.jpg",
    });

    // Verify no errors occurred
    expect(context.errors).toHaveLength(0);
  });

  test("handles invalid images gracefully", async () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/nonexistent.jpg",
            alt: "Missing image",
          },
        },
      ],
    };

    await plugin.processContent(content, context);

    // Verify error was recorded
    expect(context.errors).toHaveLength(1);
    expect(context.errors[0].message).toMatch(/Failed to process image/);

    // Verify original content was preserved
    expect(content.content[0].attrs.src).toBe("/nonexistent.jpg");
  });

  test("caches processed images", async () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "/test.jpg" },
        },
      ],
    };

    // Process image first time
    await plugin.processContent(content, context);

    // Mock sharp to verify it's not called again
    const sharp = require("sharp");
    sharp.mockClear();

    // Process same image again
    await plugin.processContent(content, context);

    // Verify sharp wasn't called for the second processing
    expect(sharp).not.toHaveBeenCalled();
  });

  test("handles concurrent processing correctly", async () => {
    const content = {
      type: "doc",
      content: Array(5).fill({
        type: "image",
        attrs: { src: "/test.jpg" },
      }),
    };

    // Process multiple images concurrently
    await plugin.processContent(content, context);

    // Verify all images were processed
    content.content.forEach((node) => {
      expect(node.attrs.srcset).toBeDefined();
      expect(node.attrs.sizes).toBeDefined();
    });
  });

  test("respects plugin options", async () => {
    plugin = new ImageOptimizerPlugin({
      outputDir: join(testDir, "cache"),
      publicPath: "/custom",
      formats: ["webp", "avif"],
      quality: 90,
      sizes: [{ width: 800, suffix: "custom" }],
    });

    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "/test.jpg" },
        },
      ],
    };

    await plugin.processContent(content, context);

    // Verify custom options were used
    const imageNode = content.content[0];
    expect(imageNode.attrs.srcset).toContain("/custom/");
    expect(imageNode.attrs.srcset).toContain("800w");
  });

  test("validates options", () => {
    expect(() => {
      new ImageOptimizerPlugin({
        formats: ["invalid-format"],
      });
    }).toThrow(/Invalid formats/);

    expect(() => {
      new ImageOptimizerPlugin({
        quality: 101,
      });
    }).toThrow(/Quality must be/);
  });
});
