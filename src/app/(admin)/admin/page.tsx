'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Map, Receipt, BookOpen, Cpu, Activity } from 'lucide-react';
import type { PlatformStats } from '@/lib/types';

interface StatCard {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/stats')
            .then(r => r.json())
            .then(setStats)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const cards: StatCard[] = stats
        ? [
              { label: 'Utenti totali', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
              { label: 'Attivi (30 gg)', value: stats.activeUsersLast30Days, icon: Activity, color: 'text-green-400' },
              { label: 'Viaggi', value: stats.totalTrips, icon: Map, color: 'text-violet-400' },
              { label: 'Spese', value: stats.totalExpenses, icon: Receipt, color: 'text-amber-400' },
              { label: 'Post', value: stats.totalPosts, icon: BookOpen, color: 'text-pink-400' },
              { label: 'Chiamate AI', value: stats.totalAiCalls, icon: Cpu, color: 'text-cyan-400' },
          ]
        : [];

    return (
        <div className="p-6 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-zinc-400 text-sm mt-1">Statistiche aggregate della piattaforma</p>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="bg-zinc-800 rounded-xl p-5 animate-pulse h-24" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {cards.map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="bg-zinc-800/60 rounded-xl p-5 border border-zinc-700/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-zinc-400 uppercase tracking-wide">{label}</span>
                                <Icon className={`w-4 h-4 ${color}`} />
                            </div>
                            <div className="text-3xl font-bold text-white">{value.toLocaleString('it-IT')}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
