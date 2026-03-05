# 📸 Agent: Media & Instagram

## Role
You are the **Media Agent** for *motonui*. You build the complete photo/video pipeline: upload handling, processing, storage, and Instagram-ready export generation. You work downstream of the Backend and Frontend agents.

---

## Context

motonui users upload photos and videos from their travels. They want to:
1. Store and organize media by trip and day
2. Export Instagram-ready carousels, stories, and reel-ready packages
3. Get AI-suggested captions and hashtags for their posts

---

## Your Tasks

### 1. Upload Pipeline (`src/lib/media/upload.ts`)

Implement a robust upload handler:

```typescript
interface UploadResult {
  id: string
  url: string
  thumbnailUrl: string
  width: number
  height: number
  size: number
  mimeType: string
  metadata: ImageMetadata
}

interface ImageMetadata {
  dateTaken?: Date
  gps?: { lat: number; lng: number }
  camera?: string
  orientation: number
}
```

Steps:
1. Accept file (browser File object or server-side buffer)
2. Extract EXIF metadata using `exifr` library (GPS, date taken, camera model)
3. Generate thumbnail (400x400 cover crop) using `sharp`
4. Convert to WebP for storage efficiency (keep original too)
5. Upload both to Supabase Storage: `trips/{tripId}/original/{filename}` and `trips/{tripId}/thumbs/{filename}`
6. Return `UploadResult`

If GPS data is found in EXIF, automatically suggest the nearest `day_id` based on trip dates.

### 2. Image Processing (`src/lib/media/process.ts`)

```typescript
// Generate responsive sizes for blog posts
generateResponsiveSizes(url: string): Promise<ResponsiveImageSet>
// Returns: { sm: url, md: url, lg: url, placeholder: base64 }

// Apply Instagram-style filters
applyFilter(buffer: Buffer, filter: FilterType): Promise<Buffer>
// FilterType: 'none' | 'warm' | 'cool' | 'vintage' | 'bw' | 'vivid'

// Overlay text on image
overlayText(buffer: Buffer, options: TextOverlayOptions): Promise<Buffer>
// Options: text, position, font, size, color, background

// Crop to aspect ratio
cropToAspect(buffer: Buffer, ratio: '1:1' | '4:5' | '9:16' | '16:9'): Promise<Buffer>
```

Use `sharp` for all processing. All functions should be pure (input buffer → output buffer) for testability.

### 3. Instagram Export Engine (`src/lib/media/instagram-export.ts`)

#### Carousel Export
```typescript
async function generateCarousel(
  mediaIds: string[],
  options: CarouselOptions
): Promise<ExportPackage>
```

`CarouselOptions`:
- `style`: `'minimal'` | `'editorial'` | `'vintage'`
- `overlayText`: optional `{ tripName, location, date }`
- `brandingColor`: hex color for minimal style border/text

For each image:
- Crop to 1080x1080 (1:1 square)
- Apply style filter
- If `overlayText` set: add text in bottom-left corner using `@vercel/og` or canvas
- Output as JPEG at 85% quality

Package into ZIP using `jszip`:
```
carousel_export_{timestamp}/
  01.jpg
  02.jpg
  ...
  caption.txt        ← AI-generated caption
  hashtags.txt       ← 30 suggested hashtags
  README.txt         ← instructions for posting
```

#### Story Export
```typescript
async function generateStory(
  mediaIds: string[],
  options: StoryOptions
): Promise<ExportPackage>
```

- Crop to 1080x1920 (9:16 portrait)
- Add optional colored gradient bar at bottom with location text
- Keep safe zones (top 250px, bottom 250px) free of important content

#### Reel Package
```typescript
async function generateReelPackage(
  mediaIds: string[],
  options: ReelOptions
): Promise<ExportPackage>
```

Note: motonui does NOT edit video (too complex for web). Instead, generate:
- All selected images/clips renamed in sequence: `01_clip.mp4`, `02_photo.jpg`
- A `reel_manifest.json` with: order, suggested duration per clip, transition suggestion
- A `capcut_import.json` formatted for CapCut's import format (if possible)
- `caption.txt` and `hashtags.txt`

### 4. AI Caption Generator (`src/lib/media/captions.ts`)

Use the Anthropic Claude API to generate captions and hashtags.

```typescript
async function generateCaption(options: {
  destination: string
  tripName: string
  photos: Array<{ url: string; exifDate?: Date }>
  tone: 'poetic' | 'casual' | 'informative'
  language: 'it' | 'en'
}): Promise<CaptionResult>
```

System prompt:
```
You are a travel content creator helping a couple document their adventures. 
Generate Instagram captions that are authentic, warm, and evoke the feeling of the place.
Avoid clichés like "wanderlust", "adventure awaits", "living my best life".
The couple's names are Nicolò and Sara.
```

For hashtags: generate 15 location-specific + 10 niche travel + 5 couple-specific hashtags. Never use banned hashtags. Keep total under 30.

Return:
```typescript
{
  caption: string        // 150-200 chars for carousel, 50-80 for story
  captionLong: string    // 400-600 chars version for blog
  hashtags: string[]     // array of 30 tags without #
  altText: string        // accessibility alt text for the image
}
```

### 5. API Route (`src/app/api/instagram/generate/route.ts`)

```
POST /api/instagram/generate
Body: {
  tripId: string
  mediaIds: string[]
  type: 'carousel' | 'story' | 'reel'
  options: CarouselOptions | StoryOptions | ReelOptions
  generateCaption: boolean
  language: 'it' | 'en'
}

Response: {
  exportId: string
  downloadUrl: string  // signed URL, expires in 1 hour
  caption?: CaptionResult
  expiresAt: string
}
```

Store export job in `instagram_exports` table. Clean up ZIP files after 24h (use a Supabase Edge Function cron).

---

## Dependencies to Install
```json
"sharp": "^0.33",
"exifr": "^7.1",
"jszip": "^3.10",
"@anthropic-ai/sdk": "^0.27"
```

## Constraints
- All image processing must happen server-side (API routes), never in the browser
- Never store generated ZIPs longer than 24h
- Respect EXIF orientation when processing images
- Add watermark option (optional, off by default): small `motonui` text in corner
- All exports should be under 50MB total
