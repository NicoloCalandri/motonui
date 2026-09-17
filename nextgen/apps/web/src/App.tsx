import { useQuery } from '@tanstack/react-query';

/**
 * Scaffold placeholder — proves the Vite dev proxy reaches the Hono API.
 * Replaced by the real router (AuthProvider + route tree) in phase 4/5.
 */
function useApiHealth() {
    return useQuery({
        queryKey: ['health'],
        queryFn: async () => {
            const res = await fetch('/api/health');
            if (!res.ok) throw new Error('API not reachable');
            return res.json() as Promise<{ ok: boolean }>;
        },
    });
}

export default function App() {
    const { data, isLoading, isError } = useApiHealth();

    return (
        <div className="min-h-screen flex items-center justify-center bg-sand-50 font-sans">
            <div className="text-center">
                <h1 className="font-display text-3xl font-bold text-ink-900 mb-2">motonui nextgen</h1>
                <p className="text-ink-400 text-sm">
                    {isLoading && 'Verifico la connessione con l\'API…'}
                    {isError && 'API non raggiungibile — avvia apps/api (npm run dev:api).'}
                    {data?.ok && 'Scaffold OK — web ↔ API connessi.'}
                </p>
            </div>
        </div>
    );
}
