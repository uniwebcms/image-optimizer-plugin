// src/index.js
export { ImageOptimizerPlugin } from "./plugin.js";
export { ImageProcessor } from "./processor.js";

// Create a preconfigured plugin (convenience function)
export function createImageOptimizer(options = {}) {
  return new ImageOptimizerPlugin(options);
}
