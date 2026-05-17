export type TripStatus = 'planning' | 'active' | 'completed' | 'archived';
export type LegType = 'flight' | 'train' | 'car' | 'ferry' | 'walk' | 'bus' | 'other';
export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'activity' | 'shopping' | 'other';
export type PostStatus = 'draft' | 'published';
export type ActivityType = 'museum' | 'tour' | 'excursion' | 'show' | 'sport' | 'other';
export type DocumentType = 'boarding_pass' | 'hotel_voucher' | 'ticket' | 'reservation_confirmation' | 'insurance' | 'visa' | 'other';

export interface Trip {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  destination: string;
  cover_image: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  description: string | null;
  owner_id: string;
  budget_eur: number | null;
}

export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'owner' | 'member';
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  plan: string;
}

export interface Day {
  id: string;
  trip_id: string;
  date: string;
  title: string | null;
  notes: string | null;
  sort_order: number;
}

export interface Leg {
  id: string;
  trip_id: string;
  day_id: string | null;
  type: LegType;
  from_name: string;
  to_name: string;
  departure_at: string | null;
  arrival_at: string | null;
  duration_min: number | null;
  cost: number | null;
  currency: string;
  carrier: string | null;
  booking_ref: string | null;
  notes: string | null;
  sort_order: number;
}

export interface Accommodation {
  id: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  address: string | null;
  check_in: string | null;
  check_out: string | null;
  cost: number | null;
  currency: string;
  booking_ref: string | null;
  notes: string | null;
  url: string | null;
}

export interface Expense {
  id: string;
  trip_id: string;
  day_id: string | null;
  description: string;
  amount: number;
  currency: string;
  amount_eur: number | null;
  category: ExpenseCategory;
  paid_by: string;
  split: boolean;
  date: string | null;
  notes: string | null;
}

export interface Media {
  id: string;
  trip_id: string;
  day_id: string | null;
  uploaded_by: string;
  url: string;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  taken_at: string | null;
  sort_order: number;
}

export interface Restaurant {
  id: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  cuisine_type: string | null;
  address: string | null;
  date: string | null;
  time: string | null;
  covers: number;
  cost: number | null;
  currency: string;
  booking_ref: string | null;
  notes: string | null;
}

export interface Activity {
  id: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  type: ActivityType;
  address: string | null;
  date: string | null;
  time: string | null;
  duration_min: number | null;
  cost: number | null;
  currency: string;
  booking_ref: string | null;
  notes: string | null;
}

export interface Post {
  id: string;
  trip_id: string | null;
  author_id: string;
  title: string;
  slug: string;
  cover_image: string | null;
  status: PostStatus;
  published_at: string | null;
  reading_time: number | null;
  seo_description: string | null;
}

export interface Document {
  id: string;
  trip_id: string;
  type: DocumentType;
  title: string;
  file_url: string;
  file_type: 'pdf' | 'image';
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
}

export interface DayWithDetails extends Day {
  legs: Leg[];
  accommodations: Accommodation[];
}
