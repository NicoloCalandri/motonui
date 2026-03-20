'use client';

import { useEffect, useRef, useState } from 'react';
import { User, Mail, Camera, Save, Loader2, Shield, Globe, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<{ id: string; email: string | null; fullName: string; avatarUrl: string | null } | null>(null);
    const [fullName, setFullName] = useState('');
    const [stats, setStats] = useState({ trips: 0, posts: 0 });
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setFullName(data.fullName || '');

                // Fetch stats via supabase client (RLS not involved for counts via server)
                const statsRes = await fetch('/api/profile/stats');
                if (statsRes.ok) {
                    const s = await statsRes.json();
                    setStats({ trips: s.trips ?? 0, posts: s.posts ?? 0 });
                }
            }
            setLoading(false);
        };
        fetchUserData();
    }, []);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarUploading(true);
        setAvatarError(null);
        const form = new FormData();
        form.append('avatar', file);
        const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
        const data = await res.json();
        if (res.ok) {
            setProfile(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev);
        } else {
            setAvatarError(data.error ?? 'Errore durante l\'upload.');
        }
        setAvatarUploading(false);
        // Reset so the same file can be re-selected
        e.target.value = '';
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const res = await fetch('/api/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setMessage({ type: 'error', text: 'Errore durante l\'aggiornamento: ' + (data.error ?? res.statusText) });
        } else {
            setProfile(prev => prev ? { ...prev, fullName } : prev);
            setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-900" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-12 pb-24">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="font-display text-5xl font-bold text-neutral-900 tracking-tight mb-2">Profilo</h1>
                    <p className="text-neutral-400 font-medium text-lg italic">Personalizza la tua esperienza di viaggio</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                        Premium Member
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left Col: Avatar & Stats */}
                <div className="space-y-8">
                    <div className="bg-white rounded-[40px] p-8 shadow-soft border border-neutral-100 flex flex-col items-center">
                        <div className="relative group mb-6">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-neutral-50 shadow-inner bg-neutral-100">
                                {profile?.avatarUrl ? (
                                    <img
                                        src={profile.avatarUrl}
                                        alt="Foto profilo"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-400 flex items-center justify-center text-white text-4xl font-bold">
                                        {fullName?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/heic"
                                className="hidden"
                                title="Carica foto profilo"
                                onChange={handleAvatarChange}
                            />
                            <button
                                type="button"
                                onClick={() => avatarInputRef.current?.click()}
                                disabled={avatarUploading}
                                className="absolute bottom-0 right-0 p-3 bg-neutral-900 text-white rounded-full shadow-lg hover:scale-110 transition-all border-4 border-white disabled:opacity-60"
                                title="Cambia foto profilo"
                                aria-label="Cambia foto profilo"
                            >
                                {avatarUploading
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Camera className="w-4 h-4" />}
                            </button>
                        </div>
                        {avatarError && (
                            <p className="text-xs text-red-500 font-medium text-center mb-2">{avatarError}</p>
                        )}
                        <h2 className="text-xl font-bold text-neutral-900 text-center">{fullName || 'Viaggiatore'}</h2>
                        <p className="text-neutral-400 text-sm font-medium mb-6">{profile?.email}</p>
                        
                        <div className="grid grid-cols-2 w-full gap-4 pt-6 border-t border-neutral-50">
                            <div className="text-center">
                                <p className="text-xl font-bold text-neutral-900">{stats.trips}</p>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center">Viaggi</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-bold text-neutral-900">{stats.posts}</p>
                                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider text-center">Post</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Settings */}
                    <div className="bg-neutral-900 rounded-[40px] p-8 text-white space-y-6">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] opacity-50">Quick Settings</h3>
                        <nav className="space-y-2">
                            {[
                                { icon: Shield, label: 'Privacy' },
                                { icon: Bell, label: 'Notifiche' },
                                { icon: Globe, label: 'Lingua' }
                            ].map((item, i) => (
                                <button key={i} className="flex items-center gap-4 w-full p-4 hover:bg-white/10 rounded-2xl transition-all group">
                                    <item.icon className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
                                    <span className="font-bold text-sm tracking-tight">{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Right Col: Forms */}
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-white rounded-[40px] p-8 md:p-12 shadow-soft border border-neutral-100">
                        <div className="mb-8 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-neutral-900 tracking-tight">Informazioni Personali</h3>
                            <User className="w-6 h-6 text-neutral-200" />
                        </div>

                        {message && (
                            <div className={`mb-8 p-4 rounded-2xl text-sm font-medium border animate-in fade-in slide-in-from-top-4 ${
                                message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                                {message.text}
                            </div>
                        )}

                        <form onSubmit={handleUpdateProfile} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="full_name" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">
                                        Nome Completo
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300 group-focus-within:text-neutral-900 transition-colors" />
                                        <input
                                            id="full_name"
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Il tuo nome"
                                            className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-neutral-200 transition-all tracking-tight"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 opacity-60">
                                    <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">
                                        Email (non modificabile)
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-300" />
                                        <input
                                            id="email"
                                            type="email"
                                            value={profile?.email || ''}
                                            disabled
                                            className="w-full pl-12 pr-4 py-4 bg-neutral-50/50 border-none rounded-2xl text-sm font-bold cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-neutral-50/50 p-6 rounded-[30px] border border-dashed border-neutral-200">
                                <p className="text-xs text-neutral-400 font-medium leading-relaxed italic">
                                    Questi dati verranno visualizzati dal tuo partner durante la pianificazione dei viaggi. 
                                    La tua email rimane privata e sicura.
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center justify-center gap-3 px-8 py-5 bg-neutral-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl shadow-neutral-200 active:scale-[0.98] disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
                            </button>
                        </form>
                    </section>

                    {/* Subscription Preview Card */}
                    <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-[40px] p-8 md:p-12 border border-neutral-200/50 overflow-hidden relative">
                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold text-neutral-900 tracking-tight leading-tight">Motonui Passport</h3>
                                <p className="text-neutral-400 font-medium text-sm max-w-sm">
                                    Sblocca mappe offline, esportazioni AI illimitate e backup cloud avanzato.
                                </p>
                                <button className="text-neutral-900 font-black uppercase tracking-[0.2em] text-[10px] border-b-2 border-neutral-900 py-1 inline-block">
                                    Vedi Piani
                                </button>
                            </div>
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-soft">
                                <Globe className="w-12 h-12 text-neutral-900" />
                            </div>
                        </div>
                        {/* Abstract Decor */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/40 rounded-full blur-3xl -z-0" />
                    </div>
                </div>
            </div>
        </div>
    );
}

