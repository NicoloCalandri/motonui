'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function DeleteTripButton({ tripId, tripTitle }: { tripId: string, tripTitle: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigating to the trip since it's inside a Link
        e.stopPropagation();

        if (confirm(`Sei sicuro di voler eliminare il viaggio "${tripTitle}"?\nL'operazione è irreversibile.`)) {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/trips/${tripId}`, {
                    method: 'DELETE',
                });
                
                if (res.ok) {
                    router.refresh();
                } else {
                    alert("Errore durante l'eliminazione del viaggio.");
                }
            } catch (error) {
                alert("Si è verificato un errore.");
            } finally {
                setIsLoading(false);
            }
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
