import type { ResponsiveImageSet, TextOverlayOptions, ImageFilter, AspectRatio } from '@/lib/types';

// ─── Sharp lazy import ────────────────────────────────────────────────────────
async function getSharp() {
    return (await import('sharp')).default;
}

// ─── Filter Definitions ────────────────────────────────────────────────────────

const FILTER_PIPELINES: Record<ImageFilter, (img: ReturnType<Awaited<ReturnType<typeof getSharp>>['default']>) => ReturnType<Awaited<ReturnType<typeof getSharp>>['default']>> = {
    none: (img) => img,
    warm: (img) =>
        img.modulate({ brightness: 1.05, saturation: 1.1 }).tint({ r: 255, g: 230, b: 190 }),
    cool: (img) =>
        img.modulate({ brightness: 1.02, saturation: 0.95 }).tint({ r: 190, g: 210, b: 255 }),
    vintage: (img) =>
        img
            .modulate({ brightness: 0.95, saturation: 0.7 })
            .tint({ r: 240, g: 200, b: 150 })
            .gamma(1.3),
    bw: (img) => img.grayscale(),
    vivid: (img) => img.modulate({ brightness: 1.08, saturation: 1.4 }),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Applies an Instagram-style filter to an image buffer.
 * All processing is pure (input buffer → output buffer) for testability.
 *
 * @param buffer - Input image buffer
 * @param filter - Filter type to apply
 */
export async function applyFilter(buffer: Buffer, filter: ImageFilter): Promise<Buffer> {
    const sharp = await getSharp();
    const img = sharp(buffer).rotate();
    const pipeline = FILTER_PIPELINES[filter] ?? FILTER_PIPELINES.none;
    return (pipeline(img) as ReturnType<typeof sharp>).jpeg({ quality: 92 }).toBuffer() as Promise<Buffer>;
}

/**
 * Crops image to a specific aspect ratio.
 *
 * @param buffer - Input image buffer
 * @param ratio - Target aspect ratio
 */
export async function cropToAspect(buffer: Buffer, ratio: AspectRatio): Promise<Buffer> {
    const sharp = await getSharp();

    const RATIO_MAP: Record<AspectRatio, { width: number; height: number }> = {
        '1:1': { width: 1080, height: 1080 },
        '4:5': { width: 1080, height: 1350 },
        '9:16': { width: 1080, height: 1920 },
        '16:9': { width: 1920, height: 1080 },
    };

    const dims = RATIO_MAP[ratio];

    return sharp(buffer)
        .rotate()
        .resize(dims.width, dims.height, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 90 })
        .toBuffer() as Promise<Buffer>;
}

/**
 * Overlays text on an image at a specified position.
 * Uses SVG text rendering via sharp composite.
 *
 * @param buffer - Input image buffer
 * @param options - Text, position, font, color
 */
export async function overlayText(buffer: Buffer, options: TextOverlayOptions): Promise<Buffer> {
    const sharp = await getSharp();

    const img = sharp(buffer).rotate();
    const { width = 1080, height = 1080 } = await img.metadata();

    const { text, position, fontSize = 36, color = '#FFFFFF', backgroundColor } = options;
    const padding = 24;

    const bgRect = backgroundColor
        ? `<rect x="0" y="0" width="100%" height="${fontSize + padding * 2}" fill="${backgroundColor}" opacity="0.6" />`
        : '';

    const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${bgRect}
      <style>
        text { font-family: 'DM Sans', Arial, sans-serif; font-size: ${fontSize}px; fill: ${color}; }
      </style>
      <text
        x="${position.includes('right') ? width - padding : padding}"
        y="${position.includes('top') ? fontSize + padding : height - padding}"
        text-anchor="${position.includes('right') ? 'end' : 'start'}"
      >${escapeXml(text)}</text>
    </svg>`;

    return img
        .composite([{ input: Buffer.from(svgText), gravity: 'northwest' }])
        .jpeg({ quality: 90 })
        .toBuffer() as Promise<Buffer>;
}

/**
 * Generates responsive image sizes for blog post display.
 * Returns sm (640px), md (1080px), lg (1920px), and a LQIP placeholder.
 */
export async function generateResponsiveSizes(buffer: Buffer): Promise<ResponsiveImageSet> {
    const sharp = await getSharp();

    const [sm, md, lg, placeholder] = await Promise.all([
        sharp(buffer).rotate().resize(640).webp({ quality: 80 }).toBuffer(),
        sharp(buffer).rotate().resize(1080).webp({ quality: 85 }).toBuffer(),
        sharp(buffer).rotate().resize(1920).webp({ quality: 90 }).toBuffer(),
        // LQIP: 20px blurred placeholder → base64
        sharp(buffer).rotate().resize(20).blur(2).webp({ quality: 40 }).toBuffer(),
    ]);

    return {
        sm: `data:image/webp;base64,${sm.toString('base64')}`,
        md: `data:image/webp;base64,${md.toString('base64')}`,
        lg: `data:image/webp;base64,${lg.toString('base64')}`,
        placeholder: `data:image/webp;base64,${placeholder.toString('base64')}`,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(str: string) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
