'use client';

import { useEffect, useRef, useState } from 'react';
import type { Leg } from '@/lib/types';

interface TripMapProps {
    legs: Leg[];
    height?: number;
}

/**
 * Mapbox GL map showing trip legs as animated lines with markers.
 * Dynamically imports mapbox-gl to avoid SSR issues.
 */
export default function TripMap({ legs, height = 350 }: TripMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) {
            setError('Mapbox token non configurato');
            return;
        }

        let map: mapboxgl.Map | undefined;

        const initMap = async () => {
            const mapboxgl = (await import('mapbox-gl')).default;
            await import('mapbox-gl/dist/mapbox-gl.css');

            mapboxgl.accessToken = token;

            map = new mapboxgl.Map({
                container: containerRef.current!,
                style: 'mapbox://styles/mapbox/outdoors-v12',
                center: [12.4964, 41.9028], // default: Rome
                zoom: 4,
            });

            map.on('load', () => {
                setLoaded(true);

                const legsWithCoords = legs.filter(
                    (l) => l.from_lat && l.from_lng && l.to_lat && l.to_lng
                );

                if (legsWithCoords.length === 0) return;

                const now = new Date();

                // Build GeoJSON from legs — mark if departure has already passed
                const features = legsWithCoords.map((leg) => ({
                    type: 'Feature' as const,
                    geometry: {
                        type: 'LineString' as const,
                        coordinates: [
                            [leg.from_lng!, leg.from_lat!],
                            [leg.to_lng!, leg.to_lat!],
                        ],
                    },
                    properties: {
                        type: leg.type,
                        isPast: leg.departure_at ? new Date(leg.departure_at) < now : false,
                    },
                }));

                map!.addSource('legs', { type: 'geojson', data: { type: 'FeatureCollection', features } });

                // Past legs — solid green line
                map!.addLayer({
                    id: 'legs-line-past',
                    type: 'line',
                    source: 'legs',
                    filter: ['==', ['get', 'isPast'], true],
                    paint: {
                        'line-color': '#22c55e',
                        'line-width': 3,
                        'line-opacity': 0.9,
                    },
                });

                // Future / unscheduled legs — dashed terracotta line
                map!.addLayer({
                    id: 'legs-line-future',
                    type: 'line',
                    source: 'legs',
                    filter: ['!=', ['get', 'isPast'], true],
                    paint: {
                        'line-color': '#C4622D',
                        'line-width': 2.5,
                        'line-opacity': 0.8,
                        'line-dasharray': [2, 2],
                    },
                });

                // Add markers for unique points
                const allPoints = legsWithCoords.flatMap((l) => [
                    { lng: l.from_lng!, lat: l.from_lat!, name: l.from_name },
                    { lng: l.to_lng!, lat: l.to_lat!, name: l.to_name },
                ]);

                const seen = new Set<string>();
                allPoints.forEach(({ lng, lat, name }) => {
                    const key = `${lng},${lat}`;
                    if (seen.has(key)) return;
                    seen.add(key);

                    const el = document.createElement('div');
                    el.className = 'w-3 h-3 rounded-full border-2 border-white bg-terracotta-400 shadow';

                    new mapboxgl.Marker(el)
                        .setLngLat([lng, lat])
                        .setPopup(new mapboxgl.Popup({ offset: 8 }).setText(name))
                        .addTo(map!);
                });

                // Fit bounds
                const bounds = new mapboxgl.LngLatBounds();
                allPoints.forEach(({ lng, lat }) => bounds.extend([lng, lat]));
                map!.fitBounds(bounds, { padding: 60, maxZoom: 10 });
            });
        };

        initMap().catch((err) => {
            console.error('[motonui][TripMap]', err);
            setError('Impossibile caricare la mappa');
        });

        return () => { map?.remove(); };
    }, [legs]);

    if (error) {
        return (
            <div className="flex items-center justify-center bg-sand-100 rounded-2xl text-ink-400 text-sm" style={{ height }}>
                {error}
            </div>
        );
    }

    return (
        <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
            {!loaded && (
                <div className="absolute inset-0 bg-sand-100 flex items-center justify-center z-10">
                    <div className="w-6 h-6 border-2 border-terracotta-400 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
}
