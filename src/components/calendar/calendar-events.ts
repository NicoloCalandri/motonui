import { Plane, Hotel, Utensils, Ticket, AlertTriangle, CreditCard } from 'lucide-react';
import type { TripWithDetails, Restaurant, Activity } from '@/lib/types';

export interface CalendarEvent {
    id: string;
    date: Date;
    title: string;
    subtitle?: string;
    type: 'flight' | 'hotel_checkin' | 'hotel_checkout' | 'restaurant' | 'activity' | 'payment_deadline' | 'cancellation_deadline' | 'reminder';
    icon: React.ElementType;
    color: string;     // tailwind bg color
    textColor: string; // tailwind text color
}

/** Every dated item of a trip as a calendar event (flights, stays, bookings, deadlines). */
export function buildCalendarEvents(trip: TripWithDetails, restaurants: Restaurant[], activities: Activity[]): CalendarEvent[] {
    const evts: CalendarEvent[] = [];

    // Flights
    const allLegs = trip.days?.flatMap(d => d.legs ?? []) ?? [];
    for (const leg of allLegs) {
        if (leg.type === 'flight' && leg.departure_at) {
            evts.push({
                id: `flight-dep-${leg.id}`,
                date: new Date(leg.departure_at),
                title: `${leg.from_name?.split(',')[0]} → ${leg.to_name?.split(',')[0]}`,
                subtitle: leg.carrier ?? undefined,
                type: 'flight',
                icon: Plane,
                color: 'bg-blue-100',
                textColor: 'text-blue-600',
            });
        }
    }

    // Accommodations
    const allAccs = trip.days?.flatMap(d => d.accommodations ?? []) ?? [];
    for (const acc of allAccs) {
        if (acc.check_in) {
            evts.push({
                id: `hotel-in-${acc.id}`,
                date: new Date(acc.check_in),
                title: `Check-in: ${acc.name}`,
                type: 'hotel_checkin',
                icon: Hotel,
                color: 'bg-emerald-100',
                textColor: 'text-emerald-600',
            });
        }
        if (acc.check_out) {
            evts.push({
                id: `hotel-out-${acc.id}`,
                date: new Date(acc.check_out),
                title: `Check-out: ${acc.name}`,
                type: 'hotel_checkout',
                icon: Hotel,
                color: 'bg-emerald-50',
                textColor: 'text-emerald-500',
            });
        }
        if (acc.payment_deadline) {
            evts.push({
                id: `pay-${acc.id}`,
                date: new Date(acc.payment_deadline),
                title: `💳 Pagamento: ${acc.name}`,
                type: 'payment_deadline',
                icon: CreditCard,
                color: 'bg-amber-100',
                textColor: 'text-amber-700',
            });
        }
        if (acc.cancellation_deadline) {
            evts.push({
                id: `cancel-${acc.id}`,
                date: new Date(acc.cancellation_deadline),
                title: `⚠️ Cancellazione: ${acc.name}`,
                type: 'cancellation_deadline',
                icon: AlertTriangle,
                color: 'bg-red-100',
                textColor: 'text-red-600',
            });
        }
    }

    // Restaurants
    for (const rest of restaurants) {
        if (rest.date) {
            evts.push({
                id: `rest-${rest.id}`,
                date: new Date(rest.date),
                title: rest.name,
                subtitle: rest.time ? `Ore ${rest.time}` : undefined,
                type: 'restaurant',
                icon: Utensils,
                color: 'bg-orange-100',
                textColor: 'text-orange-600',
            });
        }
    }

    // Activities
    for (const act of activities) {
        if (act.date) {
            evts.push({
                id: `act-${act.id}`,
                date: new Date(act.date),
                title: act.name,
                subtitle: act.time ? `Ore ${act.time}` : undefined,
                type: 'activity',
                icon: Ticket,
                color: 'bg-purple-100',
                textColor: 'text-purple-600',
            });
        }
    }

    return evts;
}
