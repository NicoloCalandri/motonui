import type { SupabaseClient } from '@supabase/supabase-js';
import { Errors } from '@/lib/errors';
import type { AppDatabase } from '@/lib/supabase/server';

type SupabaseLike = SupabaseClient<AppDatabase>;

/**
 * Confirms that the current user belongs to the requested trip.
 * This prevents cross-tenant access even when routes accidentally use elevated clients.
 */
export async function requireTripMember(
  supabase: SupabaseLike,
  tripId: string,
  userId: string
): Promise<void> {
  // First, check if the user is a member of the trip
  const { data, error } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[motonui][authz][trip_member] ${error.message}`);
  }

  if (data) {
    // User is a member; allow
    return;
  }

  // If not a member, check if the user is the trip owner
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('owner_id')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    throw new Error(`[motonui][authz][trip_owner] ${tripError.message}`);
  }

  if (trip && trip.owner_id === userId) {
    return; // owner can access
  }

  // Not a member nor owner => forbidden
  throw Errors.forbidden();
}

/**
 * Confirms that a nested day belongs to the expected trip.
 */
export async function requireDayInTrip(
  supabase: SupabaseLike,
  tripId: string,
  dayId: string | null | undefined
): Promise<void> {
  if (!dayId) return;

  const { data, error } = await supabase
    .from('days')
    .select('id')
    .eq('id', dayId)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) {
    throw new Error(`[motonui][authz][day_in_trip] ${error.message}`);
  }

  if (!data) {
    throw Errors.validation('Il giorno selezionato non appartiene al viaggio richiesto.');
  }
}

/**
 * Ensures that the payer is a member of the same trip.
 */
export async function requireTripPayer(
  supabase: SupabaseLike,
  tripId: string,
  payerUserId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .eq('user_id', payerUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`[motonui][authz][trip_payer] ${error.message}`);
  }

  if (!data) {
    throw Errors.validation('Il pagatore deve essere un membro del viaggio.');
  }
}
