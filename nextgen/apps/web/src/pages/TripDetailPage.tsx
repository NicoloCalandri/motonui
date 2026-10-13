import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Map,
  DollarSign,
  Images,
  BookOpen,
  ClipboardList,
  Wallet,
  CalendarDays,
  Backpack,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api-client';
import OverviewTab from '../components/trip/OverviewTab';
import InvitePartnerCard from '../components/trip/InvitePartnerCard';
import PackingTab from '../components/trip/PackingTab';
import TripCalendar from '../components/calendar/TripCalendar';
import ExpensesTab from '../components/expense/ExpensesTab';
import ItineraryTab from '../components/trip/ItineraryTab';
import BookingsTab from '../components/booking/BookingsTab';
import type { TripWithDetails } from '@motonui/shared-types';
import { calendarDate } from '../lib/calendar-date';

const FALLBACK_COVER = 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1';

type TabId =
  | 'overview'
  | 'itinerary'
  | 'bookings'
  | 'wallet'
  | 'calendar'
  | 'packing'
  | 'expenses'
  | 'media'
  | 'blog';

// Tab id -> the task that replaces its placeholder with the real component.
const TABS: { id: TabId; label: string; icon: React.ElementType; task: string }[] = [
  { id: 'overview', label: 'Panoramica', icon: Map, task: '4.9.1' },
  { id: 'itinerary', label: 'Itinerario', icon: Calendar, task: '4.9.2' },
  { id: 'bookings', label: 'Prenotazioni', icon: ClipboardList, task: '4.9.3' },
  { id: 'wallet', label: 'Wallet', icon: Wallet, task: '4.9.4' },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays, task: '4.9.5' },
  { id: 'packing', label: 'Bagagli', icon: Backpack, task: '4.9.6' },
  { id: 'expenses', label: 'Spese', icon: DollarSign, task: '4.9.7' },
  { id: 'media', label: 'Foto', icon: Images, task: '4.9.8' },
  { id: 'blog', label: 'Blog', icon: BookOpen, task: '4.9.9' },
];

function useTrip(id: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: async () => {
      // The API returns the members under `trip_members`; the pages read `members`.
      const trip = await apiFetch<TripWithDetails & { trip_members?: TripWithDetails['members'] }>(`/api/trips/${id}`, {}, token);
      return { ...trip, members: trip.members ?? trip.trip_members ?? [] };
    },
    enabled: !!id && !!token,
  });
}

/**
 * Trip detail page shell ("/trips/:id") — hero header, 9-tab tab bar, and a
 * placeholder for each tab's content. Ported from
 * src/app/(app)/trips/[id]/page.tsx (Task 4.9.0).
 *
 * Task 4.9.0 ONLY ported the shell: hero, tab bar, tab-switching state, and
 * the trip fetch, with every tab rendering a placeholder. Tasks 4.9.1-4.9.9
 * each replace exactly one placeholder with its real component
 * (OverviewTab, ItineraryTab, BookingsTab, TravelWallet, TripCalendar,
 * PackingTab, ExpensesTab, MediaTab, BlogTab) — do not add tab content
 * beyond your own task's placeholder here. Task 4.9.1 wired in the real
 * `OverviewTab` for the `overview` slot; Task 4.9.2 wired in the real
 * `ItineraryTab` for the `itinerary` slot; Task 4.9.3 wired in the real
 * `BookingsTab` for the `bookings` slot; the other 6 are still placeholders.
 *
 * Touchpoint changes from the old page:
 * - `useParams<{ id }>()` from `next/navigation` -> `react-router-dom`.
 * - Raw `fetch('/api/trips/${id}')` + local `trip`/`loading` state ->
 *   `useQuery(['trips', id], ...)` via `apiFetch`, matching
 *   DashboardPage/TripsListPage's pattern. The old page's `fetchTrip`
 *   refetch-after-mutation callback (passed to ItineraryTab/BookingsTab/
 *   TravelWallet as `onDataChange`) becomes each of those later tasks'
 *   responsibility to call `queryClient.invalidateQueries(['trips', id])`
 *   instead. The old page's `onTripUpdate={(updates) => setTrip(prev => ({
 *   ...prev, ...updates }))}` (passed only to `OverviewTab`) becomes
 *   `queryClient.setQueryData(['trips', id], ...)` below, merged the same
 *   way, so the hero/other tabs see the same cached trip object.
 * - `next/link`'s `Link` -> `react-router-dom`'s `Link`.
 * - The old page read the initial active tab from `useSearchParams().get('tab')`
 *   (set once, never written back to the URL); that one-way read is
 *   preserved via `useSearchParams()` here too.
 *
 * Members: `TripWithDetails` declares `members`, but `GET /api/trips/:id`
 * returns them as `trip_members` (in the Next.js app too, where the hero
 * shows "undefined persone" and the invite card never hides). useTrip maps
 * one onto the other, so the count and the invite card are right here.
 *
 * Known gaps ported unchanged from the old page (not introduced here):
 * - The `hero-gradient` and `scrollbar-hide` classes on the hero/tab-bar
 *   have no definition anywhere in the old app's CSS (nor in the new
 *   index.css/tailwind.config.ts) and were already no-ops in the old page;
 *   ported as-is for visual parity rather than inventing new styles.
 * - `DeleteTripButton` is listed in the task brief's source inventory next
 *   to this page, but the old page.tsx never renders it — it's only used
 *   on the trips list page, and was already ported there in Task 4.8 as
 *   `nextgen/apps/web/src/components/DeleteTripButton.tsx`. Not duplicated
 *   here; see the task report for detail.
 */
export function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>(
    (searchParams.get('tab') as TabId | null) ?? 'overview'
  );

  const { data: trip, isLoading } = useTrip(id, token);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <div className="w-8 h-8 border-2 border-terracotta-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Caricamento viaggio...</span>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-ink-400">
        <MapPin className="w-12 h-12" />
        <p>Viaggio non trovato</p>
        <Link to="/dashboard" className="text-terracotta-400 underline text-sm">
          Torna alla home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <div className="relative h-48 md:h-72 overflow-hidden flex-shrink-0">
        <img
          src={trip.cover_image ?? FALLBACK_COVER}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-gradient" />

        {/* Back button */}
        <Link
          to="/dashboard"
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm hover:bg-white/30 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Home
        </Link>

        {/* Trip info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
          <h1 className="font-display text-2xl md:text-3xl font-bold">{trip.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-white/80 text-sm">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {trip.destination}
            </span>
            {trip.start_date && trip.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(calendarDate(trip.start_date), 'd MMM', { locale: itLocale })} –{' '}
                {format(calendarDate(trip.end_date), 'd MMM yyyy', { locale: itLocale })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {trip.members.length === 1 ? '1 persona' : `${trip.members.length} persone`}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="sticky top-0 z-30 bg-sand-50/95 backdrop-blur-sm border-b border-sand-200 flex-shrink-0">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${
                activeTab === tabId
                  ? 'border-terracotta-400 text-terracotta-400'
                  : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="flex-1 pb-24 md:pb-8">
        {TABS.map(({ id: tabId, task }) => {
          if (activeTab !== tabId) return null;

          if (tabId === 'overview') {
            return (
              <div key={tabId}>
                {trip.members.length < 2 && <InvitePartnerCard tripId={trip.id} />}
                <OverviewTab
                  trip={trip}
                  onNavigate={(tab) => setActiveTab(tab as TabId)}
                  onTripUpdate={(updates) =>
                    queryClient.setQueryData<TripWithDetails>(['trips', id], (old) =>
                      old ? { ...old, ...updates } : old
                    )
                  }
                />
              </div>
            );
          }

          if (tabId === 'itinerary') {
            return (
              <ItineraryTab
                key={tabId}
                trip={trip}
                onDataChange={() => queryClient.invalidateQueries({ queryKey: ['trips', id] })}
              />
            );
          }

          if (tabId === 'bookings') {
            return (
              <BookingsTab
                key={tabId}
                trip={trip}
                onDataChange={() => queryClient.invalidateQueries({ queryKey: ['trips', id] })}
              />
            );
          }

          // Copied from the Next.js app (scripts/port-lib.mjs): they read the API themselves, with SWR.
          if (tabId === 'calendar') return <TripCalendar key={tabId} trip={trip} />;
          if (tabId === 'packing') return <PackingTab key={tabId} trip={trip} />;
          if (tabId === 'expenses') {
            return <ExpensesTab key={tabId} tripId={trip.id} tripStartDate={trip.start_date} tripEndDate={trip.end_date} />;
          }

          return (
            <div key={tabId} className="p-4 md:p-6 text-sm text-ink-400">
              Tab in arrivo — Task {task}
            </div>
          );
        })}
      </div>
    </div>
  );
}
