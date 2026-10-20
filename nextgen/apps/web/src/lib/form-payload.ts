/**
 * What a form sends to the API.
 *
 * An input the user never touched is submitted as an empty string. The API
 * accepts `null` for an optional field and refuses `''` where it checks a
 * format (dates, times) or stores a date: every empty string goes as null.
 */
export function emptyToNull<T extends Record<string, unknown>>(values: T): { [K in keyof T]: T[K] | null } {
    const entries = Object.entries(values).map(([key, value]) => [key, value === '' ? null : value]);
    return Object.fromEntries(entries) as { [K in keyof T]: T[K] | null };
}

// Written out one by one, not built from the collection name: the contract
// test of the API (web-client-contract.test.ts) reads these paths.
const DAY_ITEM_ROUTES = {
    legs: {
        inDay: (tripId: string, dayId: string) => `/api/trips/${tripId}/days/${dayId}/legs`,
        noDay: (tripId: string) => `/api/trips/${tripId}/legs`,
    },
    accommodations: {
        inDay: (tripId: string, dayId: string) => `/api/trips/${tripId}/days/${dayId}/accommodations`,
        noDay: (tripId: string) => `/api/trips/${tripId}/accommodations`,
    },
};

/**
 * Route of an item that can hang from a day (legs, accommodations). Lists that
 * are not grouped by day (the bookings tab) open the drawers without one: the
 * day of the item itself is used, or the route without a day.
 */
export function dayItemPath(tripId: string, collection: keyof typeof DAY_ITEM_ROUTES, dayId: string | null | undefined, itemId?: string): string {
    const routes = DAY_ITEM_ROUTES[collection];
    const base = dayId ? routes.inDay(tripId, dayId) : routes.noDay(tripId);
    return itemId ? `${base}/${itemId}` : base;
}
