import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MapPin, Calendar, PlusCircle, ArrowRight, Plane } from 'lucide-react';
import type { Trip } from '@/lib/types';
import DeleteTripButton from '@/components/trip/DeleteTripButton';

export const metadata: Metadata = { title: 'I Tuoi Viaggi' };

/**
 * TripsPage — Full list of user's trips.
 */
export default async function TripsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch all user's trips via trip_members join
    const { data: memberRows } = await supabase
        .from('trip_members')
        .select('trips(*)')
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: false });

    const trips: Trip[] = (memberRows ?? [])
        .map((row) => row.trips as unknown as Trip)
        .filter((t) => t && t.status !== 'archived');

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-fade-in pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
                <div>
                    <h1 className="text-5xl font-bold tracking-tight text-neutral-900 mb-3">I vostri viaggi</h1>
                    <p className="text-neutral-500 font-medium max-w-lg">
                        Tutte le vostre avventure passate, presenti e future raccolte in un unico posto.
                    </p>
                </div>
                <Link 
                    href="/trips/new"
                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl text-sm font-bold shadow-panel hover:bg-black transition-all active:scale-95"
                >
                    <PlusCircle className="w-5 h-5" />
                    Crea nuovo viaggio
                </Link>
            </div>

            {/* Trips Grid */}
            {trips.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {trips.map((trip) => (
                        <div key={trip.id} className="relative group">
                            <DeleteTripButton tripId={trip.id} tripTitle={trip.title} />
                            <Link href={`/trips/${trip.id}`} className="block h-full">
                                <div className="card h-full flex flex-col overflow-hidden border-none shadow-soft hover:shadow-panel transition-all duration-500 rounded-[32px]">
                                    {/* Cover Image */}
                                    <div className="h-56 relative overflow-hidden">
                                        <img
                                            src={trip.cover_image ?? 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1'}
                                            alt={trip.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        />
                                        <div className="absolute top-4 right-4">
                                            <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-white border border-white/20">
                                                {trip.status === 'active' ? '🌍 In corso' : '✅ Completato'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-8 flex-1 flex flex-col justify-between">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {trip.destination}
                                            </div>
                                            <h3 className="text-2xl font-bold text-neutral-900 group-hover:text-ink-900 transition-colors">
                                                {trip.title}
                                            </h3>
                                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                                                <Calendar className="w-4 h-4" />
                                                {trip.start_date ? format(new Date(trip.start_date), "d MMM yyyy", { locale: it }) : 'Prossimamente'}
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-6 border-t border-neutral-50 flex items-center justify-between text-neutral-300 group-hover:text-neutral-900 transition-colors">
                                            <span className="text-xs font-bold uppercase tracking-widest">Dettagli viaggio</span>
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card p-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-neutral-100 bg-white/50 min-h-[500px] rounded-[48px]">
                    <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mb-8">
                        <Plane className="w-10 h-10 text-neutral-200" />
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900 mb-4">Ancora nessun viaggio?</h3>
                    <p className="text-neutral-500 text-sm max-w-sm mx-auto mb-10 leading-relaxed font-medium">
                        Il mondo è troppo grande per restare a casa. Inizia a pianificare la vostra prossima avventura di coppia.
                    </p>
                    <Link href="/trips/new" className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold shadow-panel hover:bg-black transition-all">
                        Crea il tuo Primo Viaggio
                    </Link>
                </div>
            )}
        </div>
    );
}
