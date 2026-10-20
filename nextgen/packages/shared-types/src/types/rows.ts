/** motonui domain types — Row types mirroring the Supabase schema. */

import type { TiptapDoc } from './content';
import type { ActivityType, DocumentEntityType, DocumentFileType, DocumentType, ExpenseCategory, InstagramExportStatus, InstagramExportType, LegType, MemberRole, PostStatus, TripStatus } from './enums';
import type { CarouselOptions, ReelOptions, StoryOptions } from './media';

// =============================================================================
// DATABASE ROW TYPES (mirror Supabase schema)
// =============================================================================

/** A travel trip */
export interface Trip {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  destination: string;
  cover_image: string | null;
  start_date: string | null;    // ISO date string
  end_date: string | null;      // ISO date string
  status: TripStatus;
  description: string | null;
  owner_id: string;
  budget_eur: number | null;    // optional total budget in EUR
}

/** Join table linking users to trips */
export interface TripMember {
  id: string;
  created_at: string;
  trip_id: string;
  user_id: string;
  role: MemberRole;
}

/** A single day within a trip */
export interface Day {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  date: string;                 // ISO date string
  title: string | null;
  notes: string | null;
  sort_order: number;
}

/** A transport leg within a day */
export interface Leg {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  day_id: string | null;
  type: LegType;
  from_name: string;
  to_name: string;
  from_lat: number | null;
  from_lng: number | null;
  to_lat: number | null;
  to_lng: number | null;
  departure_at: string | null;  // ISO timestamp
  arrival_at: string | null;    // ISO timestamp
  duration_min: number | null;
  cost: number | null;
  currency: string;
  carrier: string | null;             // airline / rail operator / ferry company
  booking_ref: string | null;         // booking confirmation code
  pnr: string | null;                 // Passenger Name Record (flights)
  boarding_pass_url: string | null;   // deprecated: legacy public URL, cleared by the T-0.9 migration script
  boarding_pass_path: string | null;  // path in the private trip-documents bucket
  checkin_opens_at: string | null;    // when online check-in opens (ISO timestamp)
  notes: string | null;
  sort_order: number;
}

/** Accommodation for a stay */
export interface Accommodation {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  check_in: string | null;                // ISO date string
  check_out: string | null;               // ISO date string
  cost: number | null;
  currency: string;
  booking_ref: string | null;
  payment_deadline: string | null;        // ISO date — when payment is due
  cancellation_deadline: string | null;   // ISO date — free cancellation until
  notes: string | null;
  url: string | null;
}

/** Restaurant reservation */
export interface Restaurant {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  cuisine_type: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  date: string | null;          // ISO date string
  time: string | null;          // HH:mm
  covers: number;
  cost: number | null;
  currency: string;
  booking_ref: string | null;
  confirmation_url: string | null;
  phone: string | null;
  notes: string | null;
  sort_order: number;
}

/** Activity / excursion / visit */
export interface Activity {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  type: ActivityType;
  address: string | null;
  lat: number | null;
  lng: number | null;
  date: string | null;          // ISO date string
  time: string | null;          // HH:mm
  duration_min: number | null;
  cost: number | null;
  currency: string;
  booking_ref: string | null;
  ticket_url: string | null;
  notes: string | null;
  sort_order: number;
}

/** Travel wallet document (boarding pass, voucher, ticket, etc.) */
export interface Document {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  uploaded_by: string;
  entity_type: DocumentEntityType | null;
  entity_id: string | null;
  type: DocumentType;
  title: string;
  /** External https link, when no file was uploaded */
  file_url: string | null;
  /** trips/{trip_id}/documents/... in the private trip-documents bucket */
  file_path: string | null;
  file_type: DocumentFileType;
  valid_from: string | null;    // ISO date string
  valid_until: string | null;   // ISO date string
  barcode_data: string | null;
  notes: string | null;
}

/** Individual expense entry */
export interface Expense {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  day_id: string | null;
  description: string;
  amount: number;
  currency: string;
  amount_eur: number | null;    // cached EUR equivalent
  category: ExpenseCategory;
  paid_by: string;              // user_id
  split: boolean;
  date: string | null;          // ISO date string
  notes: string | null;
}

/** Blog post (stored with Tiptap JSON content) */
export interface Post {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string | null;
  author_id: string;
  title: string;
  slug: string;
  content_json: TiptapDoc | null;
  cover_image: string | null;
  status: PostStatus;
  published_at: string | null;
  reading_time: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_description: string | null;
}

/** Photo or video uploaded per trip */
export interface Media {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  day_id: string | null;
  uploaded_by: string;
  /** External link only; uploaded files use storage_path (private bucket). */
  url: string | null;
  thumbnail_url: string | null;
  /** trips/{trip_id}/original/... in the private trip-media bucket */
  storage_path: string | null;
  /** trips/{trip_id}/thumbs/... in the private trip-media bucket */
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  size: number | null;
  mime_type: string | null;
  caption: string | null;
  tags: string[];
  taken_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  camera: string | null;
  sort_order: number;
}

/** Media as returned by the API: signed URLs (1 h) instead of storage paths. */
export type MediaWithUrls = Media & {
  signed_url: string | null;
  signed_thumb_url: string | null;
};

/** Generated Instagram export job */
export interface InstagramExport {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  created_by: string;
  type: InstagramExportType;
  media_ids: string[];
  template: string | null;
  options: CarouselOptions | StoryOptions | ReelOptions | null;
  status: InstagramExportStatus;
  zip_url: string | null;
  expires_at: string | null;
  caption: string | null;
  hashtags: string[];
}

/** Cached currency exchange rates */
export interface CurrencyRates {
  id: string;
  created_at: string;
  base_currency: string;
  rates: Record<string, number>;
  fetched_at: string;
}
