'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowLeft, MapPin, Calendar, Users, Map, DollarSign, Images, BookOpen, ClipboardList, Wallet, CalendarDays } from 'lucide-react';
import type { TripWithDetails } from '@/lib/types';

// Tab imports are lazy-loaded to reduce initial bundle
import dynamic from 'next/dynamic';

const OverviewTab = dynamic(() => import('@/components/trip/OverviewTab'));
const ItineraryTab = dynamic(() => import('@/components/trip/ItineraryTab'));
const ExpensesTab = dynamic(() => import('@/components/expense/ExpensesTab'));
const MediaTab = dynamic(() => import('@/components/media/MediaTab'));
const BlogTab = dynamic(() => import('@/components/blog/BlogTab'));
const BookingsTab = dynamic(() => import('@/components/booking/BookingsTab'));
const TravelWallet = dynamic(() => import('@/components/wallet/TravelWallet'));
const TripCalendar = dynamic(() => import('@/components/calendar/TripCalendar'));

type TabId = 'overview' | 'itinerary' | 'bookings' | 'wallet' | 'calendar' | 'expenses' | 'media' | 'blog';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Panoramica', icon: Map },
    { id: 'itinerary', label: 'Itinerario', icon: Calendar },
    { id: 'bookings', label: 'Prenotazioni', icon: ClipboardList },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'calendar', label: 'Calendario', icon: CalendarDays },
    { id: 'expenses', label: 'Spese', icon: DollarSign },
    { id: 'media', label: 'Foto', icon: Images },
    { id: 'blog', label: 'Blog', icon: BookOpen },
];

/**
 * Trip detail page with 5 tabs: Overview, Itinerary, Expenses, Media, Blog.
 * Client component to support tab switching without page navigation.
 */
export default function TripPage() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabId>(
        (searchParams.get('tab') as TabId) ?? 'overview'
    );
    const [trip, setTrip] = useState<TripWithDetails | null>(null);
    const [loading, setLoading] = useState(true);

    const handleDaysChange = (days: TripWithDetails['days']) => {
        setTrip((prev) => prev ? { ...prev, days } : prev);
    };

    useEffect(() => {
        fetch(`/api/trips/${id}`)
            .then((r) => r.json())
            .then((data: TripWithDetails) => {
                setTrip(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) {
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
                <Link href="/dashboard" className="text-terracotta-400 underline text-sm">Torna alla home</Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero */}
            <div className="relative h-48 md:h-72 overflow-hidden flex-shrink-0">
                <img src={trip.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'} alt={trip.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 hero-gradient" />

                {/* Back button */}
                <Link
                    href="/dashboard"
                    className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white rounded-lg text-sm hover:bg-white/30 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Home
                </Link>

                {/* Trip info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 text-white">
                    <h1 className="font-display text-2xl md:text-3xl font-bold">{trip.title}</h1>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-white/80 text-sm">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{trip.destination}</span>
                        {trip.start_date && trip.end_date && (
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(new Date(trip.start_date), 'd MMM', { locale: it })} –{' '}
                                {format(new Date(trip.end_date), 'd MMM yyyy', { locale: it })}
                            </span>
                        )}
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{trip.members?.length} persone</span>
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
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-150 ${activeTab === tabId
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
                {activeTab === 'overview' && <OverviewTab trip={trip} onNavigate={(tab) => setActiveTab(tab as TabId)} />}
                {activeTab === 'itinerary' && <ItineraryTab trip={trip} onDaysChange={handleDaysChange} />}
                {activeTab === 'bookings' && <BookingsTab trip={trip} />}
                {activeTab === 'wallet' && <TravelWallet trip={trip} />}
                {activeTab === 'calendar' && <TripCalendar trip={trip} />}
                {activeTab === 'expenses' && <ExpensesTab tripId={trip.id} tripStartDate={trip.start_date} tripEndDate={trip.end_date} />}
                {activeTab === 'media' && <MediaTab tripId={trip.id} />}
                {activeTab === 'blog' && <BlogTab tripId={trip.id} />}
            </div>
        </div>
    );
}
