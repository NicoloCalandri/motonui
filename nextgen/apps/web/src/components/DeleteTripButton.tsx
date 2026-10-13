import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { apiFetch } from '../lib/api-client';

/**
 * Delete (archive) button overlaid on a trip card in TripsListPage.
 * Ported from src/components/trip/DeleteTripButton.tsx.
 *
 * The old version called `fetch('/api/trips/:id', { method: 'DELETE' })`
 * directly and used `router.refresh()` (a Next.js Server Component
 * revalidation) to re-fetch the trip list after a successful delete. Here
 * that becomes `apiFetch` + `queryClient.invalidateQueries(['trips'])`,
 * which re-runs TripsListPage's `useQuery(['trips'], ...)`.
 *
 * `DELETE /api/trips/:id` (nextgen/apps/api/src/routes/trips.ts) is a soft
 * delete — it sets status to 'archived' rather than removing the row — and
 * TripsListPage already filters archived trips out client-side, mirroring
 * the old page's `.filter((t) => t.status !== 'archived')`.
 */
export function DeleteTripButton({ tripId, tripTitle }: { tripId: string; tripTitle: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to the trip since it's inside a Link
    e.stopPropagation();

    if (!confirm(`Sei sicuro di voler eliminare il viaggio "${tripTitle}"?\nL'operazione è irreversibile.`)) {
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch(`/api/trips/${tripId}`, { method: 'DELETE' }, session?.access_token);
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
    } catch {
      alert('Ops! Non riusciamo a eliminare il viaggio. Riprova tra poco 🏝️');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isLoading}
      className="absolute top-4 left-4 z-10 p-2 bg-white/20 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white border border-white/20 transition-colors"
      title="Elimina viaggio"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
