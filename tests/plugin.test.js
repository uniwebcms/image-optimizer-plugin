// tests/plugin.test.js
import { jest } from "@jest/globals";
import { join, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { ImageOptimizerPlugin } from "../src/plugin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_PATH = join(__dirname, "fixtures", "sample-site");

jest.unstable_mockModule("sharp", () => {
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

// Import sharp **after** the mock
const sharp = await import("sharp");

describe("ImageOptimizerPlugin", () => {
  let plugin;
  let testDir;
  let context;

  beforeEach(async () => {
    // Clear sharp mock before each test
    sharp.mockClear();

    // Create temp test directory
    // testDir = join(tmpdir(), "image-optimizer-test-" + Date.now());
    // await mkdir(testDir);
    testDir = FIXTURES_PATH;

    // Create test image
    // const imagePath = join(testDir, "test.jpg");
    // await writeFile(imagePath, "mock image data");
    // console.log("testDir", testDir);
    // Initialize plugin with test options
    plugin = new ImageOptimizerPlugin({
      outputDir: "./cache", // for processed images
      publicPath: "/images", // path used when generating the srcset
      formats: ["webp"],
      quality: 80,
      sizes: [{ width: 640, suffix: "sm" }],
    });

    // Mock context
    context = {
      resourcePath: join(testDir, "pages"), // Root directory of the pages
      errors: [],
      currentFile: join(testDir, "home", "content.md"),
      cache: new Map(),
    };
  });

  test.only("processes image nodes correctly", async () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/img/test.png",
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
      width: 1792,
      height: 1024,
      originalSrc: "/img/test.png",
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

    // Clear mock to verify it's not called again
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
