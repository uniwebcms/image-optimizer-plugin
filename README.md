# @uniwebcms/image-optimizer

Image optimization plugin for @uniwebcms/site-content-collector. Automatically processes and optimizes images, generates responsive variants, and manages caching.

## Features

- Automatic image optimization
- WebP and AVIF support
- Responsive image variants
- Efficient caching
- Concurrent processing
- Metadata preservation

## Installation

```bash
npm install @uniwebcms/image-optimizer
```

## Usage

```javascript
import { createCollector } from "@uniwebcms/site-content-collector";
import { ImageOptimizerPlugin } from "@uniwebcms/image-optimizer";

const collector = createCollector({
  plugins: {
    imageOptimizer: {
      outputDir: ".image-cache",
      publicPath: "/images",
      formats: ["webp"],
      quality: 80,
    },
  },
});
```

Or in your site.yml:

```yaml
plugins:
  imageOptimizer:
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
```

## Configuration

| Option       | Type     | Default        | Description                    |
| ------------ | -------- | -------------- | ------------------------------ |
| outputDir    | string   | '.image-cache' | Directory for processed images |
| publicPath   | string   | '/images'      | Public URL path for images     |
| formats      | string[] | ['webp']       | Output formats to generate     |
| quality      | number   | 80             | Output image quality (1-100)   |
| sizes        | object[] | [...]          | Responsive image sizes         |
| concurrency  | number   | 4              | Number of concurrent processes |
| cacheTimeout | number   | 604800000      | Cache timeout in milliseconds  |

### Size Configuration

Each size object should have:

```javascript
{
  width: number; // Target width in pixels
  suffix: string; // Filename suffix (e.g., 'sm', 'md', 'lg')
}
```

## Output

The plugin transforms image nodes in your markdown content by:

1. Optimizing the original image
2. Generating responsive variants
3. Converting to modern formats
4. Adding srcset and sizes attributes

Example output:

```html
<img
  src="/images/photo-lg.webp"
  srcset="
    /images/photo-sm.webp  640w,
    /images/photo-md.webp 1024w,
    /images/photo-lg.webp 1920w
  "
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
  width="1920"
  height="1080"
  alt="Photo description"
/>
```

## Cache

The plugin implements caching to avoid reprocessing images:

- In-memory cache for processed results
- Disk cache for optimized images
- Configurable cache duration
- Automatic cache cleanup

## Debug

Enable debug logging:

```bash
DEBUG=uniweb:image-optimizer* node your-script.js
```

## Requirements

- Node.js >= 18.0.0
- Sharp library requirements (usually auto-installed)

## License

GPL-3.0-or-later
