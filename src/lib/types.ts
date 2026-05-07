/**
 * motonui — Domain Types
 * Single source of truth for all TypeScript types used across the application.
 */

// =============================================================================
// ENUMS
// =============================================================================

export type TripStatus = 'planning' | 'active' | 'completed' | 'archived';

export type LegType = 'flight' | 'train' | 'car' | 'ferry' | 'walk' | 'bus' | 'other';

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'activity'
  | 'shopping'
  | 'other';

export type PostStatus = 'draft' | 'published';

export type InstagramExportType = 'carousel' | 'story' | 'reel';

export type InstagramType = InstagramExportType;

export type InstagramExportStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type CarouselStyle = 'minimal' | 'editorial' | 'vintage';

export type ImageFilter = 'none' | 'warm' | 'cool' | 'vintage' | 'bw' | 'vivid';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';

export type BlogCommand =
  | 'write-intro'
  | 'describe-place'
  | 'add-transition'
  | 'travel-tips'
  | 'finish'
  | 'improve';

export type ContentLanguage = 'it' | 'en';

export type CaptionTone = 'poetic' | 'casual' | 'informative';

export type MemberRole = 'owner' | 'member';

export type AICallType = 'blog' | 'seo' | 'caption' | 'destination' | 'category';

export type ActivityType = 'museum' | 'tour' | 'excursion' | 'show' | 'sport' | 'other';

export type DocumentType =
  | 'boarding_pass'
  | 'hotel_voucher'
  | 'ticket'
  | 'reservation_confirmation'
  | 'insurance'
  | 'visa'
  | 'other';

export type DocumentEntityType = 'leg' | 'accommodation' | 'restaurant' | 'activity' | 'trip';

export type DocumentFileType = 'pdf' | 'image';

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
  boarding_pass_url: string | null;   // uploaded boarding pass image URL
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
  file_url: string;
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
  url: string;
  thumbnail_url: string | null;
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

// =============================================================================
// ENRICHED / VIEW TYPES (used in API responses)
// =============================================================================

/** User profile (from Supabase auth.users) */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

/** Trip with additional aggregated data */
export interface TripWithDetails extends Trip {
  members: (TripMember & { profile: UserProfile })[];
  days: (Day & { legs: Leg[]; accommodations: Accommodation[] })[];
  restaurants: Restaurant[];
  activities: Activity[];
  documents: Document[];
  media_count: number;
  expense_total_eur: number;
}

/** Trip card data for the dashboard grid */
export interface TripCard extends Trip {
  member_count: number;
  expense_total_eur: number;
  media_count: number;
}

// =============================================================================
// BUSINESS LOGIC TYPES
// =============================================================================

/** Expense breakdown and summary for a trip */
export interface ExpenseSummary {
  total_eur: number;
  by_category: Record<ExpenseCategory, number>;
  by_user: Record<string, number>;            // user_id → total EUR
  by_day: Record<string, number>;             // date string → total EUR
  currency_breakdown: Record<string, number>; // original currency → total
}

/** Result of split calculation */
export interface SplitResult {
  /** Who owes whom and how much (in EUR) */
  settlements: Settlement[];
  /** Is the split already even? */
  is_even: boolean;
}

/** A single debt settlement instruction */
export interface Settlement {
  from_user_id: string;
  to_user_id: string;
  amount_eur: number;
}

/** Aggregated stats for a trip */
export interface TripStats {
  total_days: number;
  total_km_traveled: number;
  countries_visited: string[];
  total_spent_eur: number;
  avg_per_day_eur: number;
  transport_breakdown: Record<LegType, number>; // leg type → km
  budget_eur: number | null;
}

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

/** Result of the upload pipeline */
export interface UploadResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  metadata: ImageMetadata;
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

// =============================================================================
// AI TYPES
// =============================================================================

/** Result of AI caption generation */
export interface CaptionResult {
  caption: string;          // 150-200 chars for carousel / 50-80 for story
  captionLong?: string;     // 400-600 chars for blog
  hashtags: string[];       // 30 suggested tags (without '#')
  altText?: string;         // accessibility description
}

/** SEO metadata generated by AI */
export interface SEOMetadata {
  seoTitle: string;         // max 60 chars
  seoDescription: string;   // max 160 chars
  ogDescription: string;
  slug: string;
  focusKeyphrase: string;
}

/** Destination briefing from AI research */
export interface DestinationBriefing {
  summary: string;
  bestTimeToVisit: string;
  mustSee: string[];
  localTips: string[];
  currencyTip: string;
  languageTip: string;
}

/** Context passed to the blog AI assistant */
export interface TripContext {
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  memberNames: string[];
}

// =============================================================================
// TIPTAP DOCUMENT TYPES
// =============================================================================

export interface TiptapDoc {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

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

/** Request body for Instagram export */
export interface InstagramGenerateInput {
  tripId: string;
  mediaIds: string[];
  type: InstagramExportType;
  options: CarouselOptions | StoryOptions | ReelOptions;
  generateCaption: boolean;
  language: ContentLanguage;
}

/** Response from Instagram export endpoint */
export interface InstagramGenerateResponse {
  exportId: string;
  downloadUrl: string;
  caption?: CaptionResult;
  expiresAt: string;
}

// =============================================================================
// REMINDERS
// =============================================================================

export type ReminderType =
  | 'flight_checkin'
  | 'payment_deadline'
  | 'cancellation_deadline'
  | 'restaurant_reservation'
  | 'activity_ticket'
  | 'visa_expiry'
  | 'insurance_expiry'
  | 'custom';
export type ReminderEntityType = 'leg' | 'accommodation' | 'restaurant' | 'activity';

/** A scheduled email reminder for a trip event */
export interface Reminder {
  id: string;
  created_at: string;
  trip_id: string;
  user_id: string;
  entity_type: ReminderEntityType;
  entity_id: string;
  type: ReminderType;
  remind_at: string;        // ISO timestamp
  sent_at: string | null;
  title: string;
  message: string | null;
}

// =============================================================================
// ADMIN TYPES
// =============================================================================

export type UserRole = 'user' | 'admin';
export type UserPlan = 'free' | 'premium';
export type PremiumFeatureKey = 'ai_blog' | 'ai_generate_post' | 'ai_destination' | 'instagram_caption' | 'advanced_reminders';

/** Admin action types recorded in the audit log */
export type AdminAction = 'impersonate' | 'suspend' | 'unsuspend' | 'delete' | 'view_profile';

/** Public profile row in public.profiles */
export interface Profile {
  id: string;
  created_at: string;
  updated_at: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  plan: UserPlan;
  premium_until: string | null;
  premium_enabled_by: string | null;
  premium_enabled_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface FeatureEntitlement {
  id: string;
  user_id: string;
  feature_key: PremiumFeatureKey;
  enabled: boolean;
  daily_limit: number | null;
  monthly_limit: number | null;
  created_at: string;
  updated_at: string;
}

/** Admin audit log entry */
export interface AdminAuditLog {
  id: string;
  adminId: string;
  action: AdminAction;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** User summary used in admin user list */
export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  premiumUntil: string | null;
  suspendedAt: string | null;
  tripsCount: number;
  expensesCount: number;
  postsCount: number;
  createdAt: string;
  lastSignInAt: string | null;
}

/** Aggregate platform statistics */
export interface PlatformStats {
  totalUsers: number;
  activeUsersLast30Days: number;
  totalTrips: number;
  totalExpenses: number;
  totalPosts: number;
  totalAiCalls: number;
}

/** JWT payload for admin impersonation tokens */
export interface ImpersonationPayload {
  adminId: string;
  targetId: string;
  expiresAt: number;
  type: 'impersonation';
}
