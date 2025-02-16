// tests/integration.test.js
import { jest } from "@jest/globals";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ContentCollector } from "@uniwebcms/site-content-collector";
import { ImageOptimizerPlugin } from "../src/plugin.js";

describe("Integration Tests", () => {
  let testDir;
  let collector;

  beforeEach(async () => {
    testDir = join(tmpdir(), "integration-test-" + Date.now());
    await mkdir(testDir);

    // Create test content structure
    await mkdir(join(testDir, "public"));
    await mkdir(join(testDir, "content"));
    await mkdir(join(testDir, "content/home"));

    // Create test image
    await writeFile(join(testDir, "public/test.jpg"), "mock image data");

    // Create test markdown
    await writeFile(
      join(testDir, "content/home/content.md"),
      `---
component: Hero
---
# Welcome

![Test Image](/test.jpg)
`
    );

    // Setup collector with plugin
    collector = new ContentCollector();
    collector.use(
      new ImageOptimizerPlugin({
        outputDir: join(testDir, "cache"),
        publicPath: "/images",
        formats: ["webp"],
        quality: 80,
      })
    );
  });

  test("processes images in markdown content", async () => {
    const result = await collector.collect(join(testDir, "content"));

    // Verify content was processed
    const homePage = result.pages.find((p) => p.route === "/");
    expect(homePage).toBeDefined();

    // Find processed image in content
    const findImage = (node) => {
      if (node.type === "image") return node;
      if (node.content) {
        for (const child of node.content) {
          const found = findImage(child);
          if (found) return found;
        }
      }
      return null;
    };

    const imageNode = findImage(homePage.sections[0].content);
    expect(imageNode).toBeDefined();
    expect(imageNode.attrs).toMatchObject({
      srcset: expect.stringContaining("webp"),
      sizes: expect.stringContaining("vw"),
    });
  });

  test("handles multiple images in content", async () => {
    // Create content with multiple images
    await writeFile(
      join(testDir, "content/home/content.md"),
      `---
component: Gallery
---
# Image Gallery

![Image 1](/test.jpg)
![Image 2](/test.jpg)
![Image 3](/test.jpg)
`
    );

    const result = await collector.collect(join(testDir, "content"));

    // Count processed images
    let imageCount = 0;
    const countImages = (node) => {
      if (node.type === "image") {
        imageCount++;
        expect(node.attrs.srcset).toBeDefined();
      }
      if (node.content) {
        node.content.forEach(countImages);
      }
    };

    countImages(result.pages[0].sections[0].content);
    expect(imageCount).toBe(3);
  });

  test("integrates with site configuration", async () => {
    // Create site.yml with plugin config
    await writeFile(
      join(testDir, "content/site.yml"),
      `
plugins:
  imageOptimizer:
    formats:
      - webp
      - avif
    quality: 90
    `
    );

    const result = await collector.collect(join(testDir, "content"));

    // Verify plugin config was applied
    expect(result.config.plugins.imageOptimizer).toBeDefined();
    expect(result.config.plugins.imageOptimizer.formats).toContain("avif");
  });
});
