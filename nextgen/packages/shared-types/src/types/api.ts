/** motonui domain types — API request and response shapes. */

import type { ActivityType, DocumentEntityType, DocumentFileType, DocumentType, ExpenseCategory, InstagramExportStatus, LegType } from './enums';

// =============================================================================
// API REQUEST / RESPONSE SHAPES
// =============================================================================

/** Standard API error response */
export interface ApiError {
  error: string;
  code: string;
  status: number;
}

/** Pagination params */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/** Request body for creating a trip */
export interface CreateTripInput {
  title: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  cover_image?: string;
}

/** Request body for creating an expense */
export interface CreateExpenseInput {
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paid_by: string;
  split: boolean;
  date?: string;
  day_id?: string;
  notes?: string;
}

/** Request body for creating a day */
export interface CreateDayInput {
  date: string;
  title?: string;
  notes?: string;
  sort_order?: number;
}

/** Request body for creating a leg */
export interface CreateLegInput {
  day_id?: string;
  type: LegType;
  from_name: string;
  to_name: string;
  departure_at?: string;
  arrival_at?: string;
  duration_min?: number;
  cost?: number;
  currency?: string;
  notes?: string;
}

/** Request body for creating an accommodation */
export interface CreateAccommodationInput {
  day_id?: string;
  name: string;
  address?: string;
  check_in?: string;
  check_out?: string;
  cost?: number;
  currency?: string;
  booking_ref?: string;
  notes?: string;
  url?: string;
}

/** Request body for creating a restaurant reservation */
export interface CreateRestaurantInput {
  day_id?: string;
  name: string;
  cuisine_type?: string;
  address?: string;
  date?: string;
  time?: string;
  covers?: number;
  cost?: number;
  currency?: string;
  booking_ref?: string;
  confirmation_url?: string;
  phone?: string;
  notes?: string;
}

/** Request body for creating an activity */
export interface CreateActivityInput {
  day_id?: string;
  name: string;
  type?: ActivityType;
  address?: string;
  date?: string;
  time?: string;
  duration_min?: number;
  cost?: number;
  currency?: string;
  booking_ref?: string;
  ticket_url?: string;
  notes?: string;
}

/** Request body for creating a document (wallet) */
export interface CreateDocumentInput {
  entity_type?: DocumentEntityType;
  entity_id?: string;
  type: DocumentType;
  title: string;
  file_url: string;
  file_type?: DocumentFileType;
  valid_from?: string;
  valid_until?: string;
  barcode_data?: string;
  notes?: string;
}

/** Instagram export job as returned by GET /api/trips/[id]/instagram/exports/[exportId] */
export type InstagramExportStatusResponse = {
  id: string;
  status: InstagramExportStatus;
  error: string | null;
  caption: string | null;
  hashtags: string[];
  expires_at: string | null;
  /** Signed URL of the ZIP, only when status is 'ready' (valid until expires_at, max 24 h) */
  download_url: string | null;
};
