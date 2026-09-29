/** motonui domain types — Reminders, baggage and packing checklist. */

import type { BaggageCategory } from './enums';

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
// PACKING / BAGGAGE
// =============================================================================

/** A piece of luggage registered for a trip, optionally tied to a flight leg */
export interface BaggageItem {
  id: string;
  created_at: string;
  updated_at: string;
  trip_id: string;
  leg_id: string | null;
  category: BaggageCategory;
  label: string | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  notes: string | null;
}

/** Request body for creating/updating a baggage item */
export interface CreateBaggageItemInput {
  leg_id?: string | null;
  category: BaggageCategory;
  label?: string;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  weight_kg?: number;
  notes?: string;
}

/** A single clothing/gear item within a packing checklist category */
export interface PackingItem {
  id: string;
  category: string;
  label: string;
  qty: number;
  note?: string;
}

/** A category grouping of packing items, as produced by the AI */
export interface PackingCategoryGroup {
  name: string;
  items: PackingItem[];
}

/** Normalized daily weather forecast/climate-average entry */
export interface DailyWeather {
  date: string;             // ISO date string
  temp_max_c: number;
  temp_min_c: number;
  precipitation_probability: number; // 0-100
  condition: string;        // short human-readable summary (Italian)
}

/** AI-generated packing checklist for a trip */
export interface PackingChecklist {
  trip_id: string;
  categories: PackingCategoryGroup[];
  weather_snapshot: DailyWeather[] | null;
  input_hash: string | null;
  generated_at: string | null;
  checked_item_ids: string[];
  updated_at: string;
}
