/** motonui domain types — Enums shared by rows, API and UI. */

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

export type BaggageCategory = 'cabin_bag' | 'cabin_trolley' | 'checked' | 'other';
