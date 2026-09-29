/** motonui domain types — Media processing and Instagram export options. */

import type { CarouselStyle, ImageFilter } from './enums';

// =============================================================================
// MEDIA TYPES
// =============================================================================

/** EXIF metadata extracted from a photo */
export interface ImageMetadata {
  dateTaken?: string;   // ISO date string
  gps?: { lat: number; lng: number };
  camera?: string;
  orientation: number;
}

/** Set of responsive image URLs for a photo */
export interface ResponsiveImageSet {
  sm: string;
  md: string;
  lg: string;
  placeholder: string;  // base64 LQIP
}

/** Options for overlaying text on an image */
export interface TextOverlayOptions {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  fontSize: number;
  color: string;
  backgroundColor?: string;
}

// =============================================================================
// INSTAGRAM EXPORT OPTIONS
// =============================================================================

export interface CarouselOptions {
  style: CarouselStyle;
  overlayText?: {
    tripName: string;
    location: string;
    date: string;
  };
  brandingColor?: string;
  filter?: ImageFilter;
  textOverlay?: TextOverlayOptions;
}

export interface StoryOptions {
  stickerType?: 'location' | 'date' | 'weather';
  stickerText?: string;
  gradientColor?: string;
  filter?: ImageFilter;
  textOverlay?: TextOverlayOptions;
}

export interface ReelOptions {
  transition: 'fade' | 'slide' | 'zoom';
  durations?: Record<string, number>; // media_id → seconds
  filter?: ImageFilter;
  textOverlay?: TextOverlayOptions;
}

export type InstagramExportOptions = CarouselOptions | StoryOptions | ReelOptions;

/** The result of an Instagram export operation */
export interface ExportPackage {
  exportId: string;
  downloadUrl: string;
  expiresAt: string;
}
