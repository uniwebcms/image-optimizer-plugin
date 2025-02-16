// src/utils.js
import { join, resolve, dirname } from "node:path";

export function isImageNode(node) {
  return node.type === "image" && node.attrs?.src;
}

export function resolvePublicPath(src, context) {
  // Handle absolute paths (starting with /)
  if (src.startsWith("/")) {
    return resolve(context.resourcePath, "..", "public", src.slice(1));
  }

  // Handle relative paths
  const currentDir = dirname(context.currentFile);
  return resolve(currentDir, src);
}

export function generateImageId(imagePath) {
  // Create a unique ID for the image based on its path
  return Buffer.from(imagePath).toString("base64url");
}

export function validateOptions(options) {
  const { outputDir, publicPath, formats, quality, sizes, concurrency } =
    options;

  // Required options
  if (!outputDir) throw new Error("outputDir is required");
  if (!publicPath) throw new Error("publicPath is required");

  // Validate formats
  if (!formats || !formats.length) {
    throw new Error("At least one output format is required");
  }

  const validFormats = ["webp", "avif", "jpeg", "png"];
  const invalidFormats = formats.filter((f) => !validFormats.includes(f));
  if (invalidFormats.length) {
    throw new Error(`Invalid formats: ${invalidFormats.join(", ")}`);
  }

  // Validate quality
  if (quality !== undefined) {
    if (typeof quality !== "number" || quality < 1 || quality > 100) {
      throw new Error("Quality must be a number between 1 and 100");
    }
  }

  // Validate sizes
  if (sizes) {
    if (!Array.isArray(sizes)) {
      throw new Error("Sizes must be an array");
    }

    sizes.forEach((size) => {
      if (!size.width || !size.suffix) {
        throw new Error("Each size must have width and suffix");
      }
      if (typeof size.width !== "number" || size.width < 1) {
        throw new Error("Size width must be a positive number");
      }
    });
  }

  // Validate concurrency
  if (concurrency !== undefined) {
    if (typeof concurrency !== "number" || concurrency < 1) {
      throw new Error("Concurrency must be a positive number");
    }
  }
}

export function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
