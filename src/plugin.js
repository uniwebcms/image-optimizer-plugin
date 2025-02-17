// src/plugin.js
import { join, dirname, relative } from "node:path";
import { mkdir } from "node:fs/promises";
import { ProcessorPlugin } from "@uniwebcms/site-content-collector";
import PQueue from "p-queue";
import debug from "debug";
import { ImageProcessor } from "./processor.js";
import { Cache } from "./cache.js";
import { isImageNode, resolvePublicPath, validateOptions } from "./utils.js";

const log = debug("uniweb:image-optimizer");

export class ImageOptimizerPlugin extends ProcessorPlugin {
  #processor;
  #cache;
  #queue;
  #processed;

  constructor(options = {}) {
    super(options);

    this.options = {
      // Output configuration
      outputDir: ".image-cache",
      publicPath: "/images",

      // Processing options
      formats: ["webp"],
      quality: 80,

      // Responsive image sizes
      sizes: [
        { width: 640, suffix: "sm" },
        { width: 1024, suffix: "md" },
        { width: 1920, suffix: "lg" },
      ],

      // Performance
      concurrency: 4,
      cacheTimeout: 7 * 24 * 60 * 60 * 1000, // 1 week

      ...options,
    };

    validateOptions(this.options);

    this.#processor = new ImageProcessor(this.options);
    this.#cache = new Cache(this.options.cacheTimeout);
    this.#queue = new PQueue({ concurrency: this.options.concurrency });
    this.#processed = new Set();
  }

  async beforeCollect(context) {
    // Ensure output directory exists
    const outputDir = join(context.resourcePath, "..", this.options.outputDir);
    await mkdir(outputDir, { recursive: true });

    log("Initialized with options:", this.options);
  }

  async afterCollect(context) {
    // Wait for all processing to complete
    await this.#queue.onIdle();

    // Report processing results
    log("Processing completed:", {
      processed: this.#processed.size,
      cached: this.#cache.size,
      errors: context.errors.length,
    });
  }

  async processContent(content, context) {
    if (!content || content.type !== "doc") return content;

    try {
      await this.#processNode(content, context);
      return content;
    } catch (err) {
      this.addError(context, err);
      return content;
    }
  }

  async #processNode(node, context) {
    if (isImageNode(node)) {
      await this.#processImage(node, context);
    }

    if (node.content) {
      for (const child of node.content) {
        await this.#processNode(child, context);
      }
    }
  }

  async #processImage(node, context) {
    const { src } = node.attrs;
    if (!src || this.#processed.has(src)) return;

    try {
      // Resolve image path
      const imagePath = resolvePublicPath(src, context);
      const cacheKey = `image:${imagePath}`;

      // Check cache
      const hasCached = await this.#cache.has(cacheKey);
      if (hasCached) {
        const cachedData = await this.#cache.get(cacheKey);
        node.attrs = {
          ...node.attrs,
          ...cachedData,
        };
        return;
      }

      // Queue processing
      const result = await this.#queue.add(async () => {
        log("Processing image:", src);

        const variants = await this.#processor.process(
          imagePath,
          join(context.resourcePath, "..", this.options.outputDir)
        );

        // Update node attributes
        const attrs = {
          ...node.attrs,
          srcset: variants.srcset,
          sizes: variants.sizes,
          width: variants.width,
          height: variants.height,
          originalSrc: src,
        };

        // Cache results - await the set operation
        await this.#cache.set(cacheKey, attrs);
        this.#processed.add(src);

        return attrs;
      });

      node.attrs = result;
    } catch (err) {
      log("Error found:", err.message);
      this.addError(context, `Failed to process image ${src}: ${err.message}`);
    }
  }
}

// Configuration example:
/*
images:
  outputDir: .image-cache
  publicPath: /images
  formats:
    - webp
    - avif
  quality: 80
  sizes:
    - width: 640
      suffix: sm
    - width: 1024
      suffix: md
    - width: 1920
      suffix: lg
  concurrency: 4
*/
