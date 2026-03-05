/**
 * Supabase Database TypeScript types — hand-authored to match migrations/0001_initial.sql
 * For use with the typed Supabase client.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            trips: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    title: string;
                    destination: string;
                    cover_image: string | null;
                    start_date: string | null;
                    end_date: string | null;
                    status: 'planning' | 'active' | 'completed' | 'archived';
                    description: string | null;
                    owner_id: string;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    title: string;
                    destination: string;
                    cover_image?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    status?: 'planning' | 'active' | 'completed' | 'archived';
                    description?: string | null;
                    owner_id: string;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    title?: string;
                    destination?: string;
                    cover_image?: string | null;
                    start_date?: string | null;
                    end_date?: string | null;
                    status?: 'planning' | 'active' | 'completed' | 'archived';
                    description?: string | null;
                    owner_id?: string;
                };
            };
            trip_members: {
                Row: {
                    id: string;
                    created_at: string;
                    trip_id: string;
                    user_id: string;
                    role: 'owner' | 'member';
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    trip_id: string;
                    user_id: string;
                    role?: 'owner' | 'member';
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    trip_id?: string;
                    user_id?: string;
                    role?: 'owner' | 'member';
                };
            };
            days: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    trip_id: string;
                    date: string;
                    title: string | null;
                    notes: string | null;
                    sort_order: number;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id: string;
                    date: string;
                    title?: string | null;
                    notes?: string | null;
                    sort_order?: number;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string;
                    date?: string;
                    title?: string | null;
                    notes?: string | null;
                    sort_order?: number;
                };
            };
            legs: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    trip_id: string;
                    day_id: string | null;
                    type: 'flight' | 'train' | 'car' | 'ferry' | 'walk' | 'bus' | 'other';
                    from_name: string;
                    to_name: string;
                    from_lat: number | null;
                    from_lng: number | null;
                    to_lat: number | null;
                    to_lng: number | null;
                    departure_at: string | null;
                    arrival_at: string | null;
                    duration_min: number | null;
                    cost: number | null;
                    currency: string;
                    notes: string | null;
                    sort_order: number;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id: string;
                    day_id?: string | null;
                    type: 'flight' | 'train' | 'car' | 'ferry' | 'walk' | 'bus' | 'other';
                    from_name: string;
                    to_name: string;
                    from_lat?: number | null;
                    from_lng?: number | null;
                    to_lat?: number | null;
                    to_lng?: number | null;
                    departure_at?: string | null;
                    arrival_at?: string | null;
                    duration_min?: number | null;
                    cost?: number | null;
                    currency?: string;
                    notes?: string | null;
                    sort_order?: number;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string;
                    day_id?: string | null;
                    type?: 'flight' | 'train' | 'car' | 'ferry' | 'walk' | 'bus' | 'other';
                    from_name?: string;
                    to_name?: string;
                    from_lat?: number | null;
                    from_lng?: number | null;
                    to_lat?: number | null;
                    to_lng?: number | null;
                    departure_at?: string | null;
                    arrival_at?: string | null;
                    duration_min?: number | null;
                    cost?: number | null;
                    currency?: string;
                    notes?: string | null;
                    sort_order?: number;
                };
            };
            accommodations: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    trip_id: string;
                    day_id: string | null;
                    name: string;
                    address: string | null;
                    lat: number | null;
                    lng: number | null;
                    check_in: string | null;
                    check_out: string | null;
                    cost: number | null;
                    currency: string;
                    booking_ref: string | null;
                    notes: string | null;
                    url: string | null;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id: string;
                    day_id?: string | null;
                    name: string;
                    address?: string | null;
                    lat?: number | null;
                    lng?: number | null;
                    check_in?: string | null;
                    check_out?: string | null;
                    cost?: number | null;
                    currency?: string;
                    booking_ref?: string | null;
                    notes?: string | null;
                    url?: string | null;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string;
                    day_id?: string | null;
                    name?: string;
                    address?: string | null;
                    lat?: number | null;
                    lng?: number | null;
                    check_in?: string | null;
                    check_out?: string | null;
                    cost?: number | null;
                    currency?: string;
                    booking_ref?: string | null;
                    notes?: string | null;
                    url?: string | null;
                };
            };
            expenses: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    trip_id: string;
                    day_id: string | null;
                    description: string;
                    amount: number;
                    currency: string;
                    amount_eur: number | null;
                    category: 'food' | 'transport' | 'accommodation' | 'activity' | 'shopping' | 'other';
                    paid_by: string;
                    split: boolean;
                    date: string | null;
                    notes: string | null;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id: string;
                    day_id?: string | null;
                    description: string;
                    amount: number;
                    currency?: string;
                    amount_eur?: number | null;
                    category: 'food' | 'transport' | 'accommodation' | 'activity' | 'shopping' | 'other';
                    paid_by: string;
                    split?: boolean;
                    date?: string | null;
                    notes?: string | null;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string;
                    day_id?: string | null;
                    description?: string;
                    amount?: number;
                    currency?: string;
                    amount_eur?: number | null;
                    category?: 'food' | 'transport' | 'accommodation' | 'activity' | 'shopping' | 'other';
                    paid_by?: string;
                    split?: boolean;
                    date?: string | null;
                    notes?: string | null;
                };
            };
            posts: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    trip_id: string | null;
                    author_id: string;
                    title: string;
                    slug: string;
                    content_json: Json | null;
                    cover_image: string | null;
                    status: 'draft' | 'published';
                    published_at: string | null;
                    reading_time: number | null;
                    seo_title: string | null;
                    seo_description: string | null;
                    og_description: string | null;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string | null;
                    author_id: string;
                    title: string;
                    slug: string;
                    content_json?: Json | null;
                    cover_image?: string | null;
                    status?: 'draft' | 'published';
                    published_at?: string | null;
                    reading_time?: number | null;
                    seo_title?: string | null;
                    seo_description?: string | null;
                    og_description?: string | null;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string | null;
                    author_id?: string;
                    title?: string;
                    slug?: string;
                    content_json?: Json | null;
                    cover_image?: string | null;
                    status?: 'draft' | 'published';
                    published_at?: string | null;
                    reading_time?: number | null;
                    seo_title?: string | null;
                    seo_description?: string | null;
                    og_description?: string | null;
                };
            };
            media: {
                Row: {
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
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id: string;
                    day_id?: string | null;
                    uploaded_by: string;
                    url: string;
                    thumbnail_url?: string | null;
                    width?: number | null;
                    height?: number | null;
                    size?: number | null;
                    mime_type?: string | null;
                    caption?: string | null;
                    tags?: string[];
                    taken_at?: string | null;
                    gps_lat?: number | null;
                    gps_lng?: number | null;
                    camera?: string | null;
                    sort_order?: number;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string;
                    day_id?: string | null;
                    uploaded_by?: string;
                    url?: string;
                    thumbnail_url?: string | null;
                    width?: number | null;
                    height?: number | null;
                    size?: number | null;
                    mime_type?: string | null;
                    caption?: string | null;
                    tags?: string[];
                    taken_at?: string | null;
                    gps_lat?: number | null;
                    gps_lng?: number | null;
                    camera?: string | null;
                    sort_order?: number;
                };
            };
            instagram_exports: {
                Row: {
                    id: string;
                    created_at: string;
                    updated_at: string;
                    trip_id: string;
                    created_by: string;
                    type: 'carousel' | 'story' | 'reel';
                    media_ids: string[];
                    template: string | null;
                    options: Json | null;
                    status: 'pending' | 'processing' | 'ready' | 'failed';
                    zip_url: string | null;
                    expires_at: string | null;
                    caption: string | null;
                    hashtags: string[];
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id: string;
                    created_by: string;
                    type: 'carousel' | 'story' | 'reel';
                    media_ids: string[];
                    template?: string | null;
                    options?: Json | null;
                    status?: 'pending' | 'processing' | 'ready' | 'failed';
                    zip_url?: string | null;
                    expires_at?: string | null;
                    caption?: string | null;
                    hashtags?: string[];
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    updated_at?: string;
                    trip_id?: string;
                    created_by?: string;
                    type?: 'carousel' | 'story' | 'reel';
                    media_ids?: string[];
                    template?: string | null;
                    options?: Json | null;
                    status?: 'pending' | 'processing' | 'ready' | 'failed';
                    zip_url?: string | null;
                    expires_at?: string | null;
                    caption?: string | null;
                    hashtags?: string[];
                };
            };
            currency_rates: {
                Row: {
                    id: string;
                    created_at: string;
                    base_currency: string;
                    rates: Json;
                    fetched_at: string;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    base_currency?: string;
                    rates: Json;
                    fetched_at?: string;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    base_currency?: string;
                    rates?: Json;
                    fetched_at?: string;
                };
            };
            ai_usage: {
                Row: {
                    id: string;
                    created_at: string;
                    user_id: string;
                    date: string;
                    call_type: string;
                    tokens: number | null;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    user_id: string;
                    date?: string;
                    call_type: string;
                    tokens?: number | null;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    user_id?: string;
                    date?: string;
                    call_type?: string;
                    tokens?: number | null;
                };
            };
            destination_cache: {
                Row: {
                    id: string;
                    created_at: string;
                    destination: string;
                    briefing: Json;
                    fetched_at: string;
                };
                Insert: {
                    id?: string;
                    created_at?: string;
                    destination: string;
                    briefing: Json;
                    fetched_at?: string;
                };
                Update: {
                    id?: string;
                    created_at?: string;
                    destination?: string;
                    briefing?: Json;
                    fetched_at?: string;
                };
            };
        };
        Views: Record<string, never>;
        Functions: {
            is_trip_member: {
                Args: { trip_id: string };
                Returns: boolean;
            };
        };
        Enums: Record<string, never>;
    };
}
