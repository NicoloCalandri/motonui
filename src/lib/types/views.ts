/** motonui domain types — Enriched API responses and business-logic results. */

import type { ExpenseCategory, LegType } from './enums';
import type { Accommodation, Activity, Day, Document, Leg, Restaurant, Trip, TripMember } from './rows';

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
  days: (Day & { legs: Leg[]; accommodations: Accommodation[]; activities?: Activity[] })[];
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
  /** Foreign-currency expenses saved without a rate: left out of every EUR total (T-3.2) */
  unconverted: { count: number; by_currency: Record<string, number> };
}

/** Result of split calculation */
export interface SplitResult {
  /** Who owes whom and how much (in EUR) */
  settlements: Settlement[];
  /** Is the split already even? */
  is_even: boolean;
  /** Only one member so far: no balance to show until the partner joins (T-2.8) */
  awaiting_partner: boolean;
  /** Split expenses left out because they still need an exchange rate (T-3.2) */
  excluded_unconverted: number;
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
  /** Expenses left out of total_spent_eur because they still need a rate (T-3.2) */
  unconverted_expenses: number;
}
