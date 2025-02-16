// src/processor.js
import { join, parse } from "node:path";
import sharp from "sharp";
import { fileTypeFromFile } from "file-type";
import debug from "debug";

const log = debug("uniweb:image-optimizer:processor");

export class ImageProcessor {
  constructor(options = {}) {
    this.options = options;
  }

  async process(imagePath, outputDir) {
    // Get image type and validate
    const type = await fileTypeFromFile(imagePath);
    if (!type || !["jpg", "jpeg", "png", "webp", "avif"].includes(type.ext)) {
      throw new Error(`Unsupported image type: ${type?.ext || "unknown"}`);
    }

    // Load image
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    // Generate variants for each size and format
    const variants = await this.#generateVariants(
      image,
      metadata,
      imagePath,
      outputDir
    );

    // Generate srcset string
    const srcset = this.#generateSrcset(variants);

    return {
      srcset,
      sizes: this.#generateSizes(variants),
      width: metadata.width,
      height: metadata.height,
      format: type.ext,
      variants,
    };
  }

  async #generateVariants(image, metadata, imagePath, outputDir) {
    const { name } = parse(imagePath);
    const variants = [];

    for (const size of this.options.sizes) {
      for (const format of this.options.formats) {
        const variant = await this.#createVariant(image, metadata, {
          name,
          size,
          format,
          outputDir,
        });
        variants.push(variant);
      }
    }

    return variants;
  }

  async #createVariant(image, metadata, { name, size, format, outputDir }) {
    const { width: targetWidth, suffix } = size;

    // Calculate dimensions maintaining aspect ratio
    const width = Math.min(targetWidth, metadata.width);
    const height = Math.round((metadata.height * width) / metadata.width);

    // Create variant filename
    const filename = `${name}-${suffix}.${format}`;
    const outputPath = join(outputDir, filename);

    // Process image
    let processor = image.clone().resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    });

    // Apply format-specific optimization
    switch (format) {
      case "webp":
        processor = processor.webp({
          quality: this.options.quality,
          effort: 6,
        });
        break;

      case "avif":
        processor = processor.avif({
          quality: this.options.quality,
          effort: 6,
        });
        break;

      case "jpeg":
      case "jpg":
        processor = processor.jpeg({
          quality: this.options.quality,
          mozjpeg: true,
        });
        break;

      case "png":
        processor = processor.png({
          quality: this.options.quality,
          effort: 6,
          palette: true,
        });
        break;
    }

    // Save variant
    await processor.toFile(outputPath);

    log("Created variant:", {
      size: targetWidth,
      format,
      output: outputPath,
    });

    return {
      width,
      height,
      format,
      path: outputPath,
      url: `${this.options.publicPath}/${filename}`,
    };
  }

  #generateSrcset(variants) {
    return variants
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(", ");
  }

  #generateSizes(variants) {
    // Generate sizes attribute based on available widths
    const breakpoints = [
      { max: 640, size: "100vw" },
      { max: 1024, size: "50vw" },
      { max: 1920, size: "33vw" },
    ];

    return breakpoints
      .map(({ max, size }) => `(max-width: ${max}px) ${size}`)
      .concat(["100vw"])
      .join(", ");
  }
}
