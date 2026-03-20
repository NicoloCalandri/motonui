import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth/get-user';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
};

/** POST /api/profile/avatar — uploads a new profile picture */
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const user = await getAuthUser(supabase);

        const formData = await request.formData();
        const file = formData.get('avatar');

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: 'Nessun file allegato.', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: 'Formato non supportato. Usa JPEG, PNG, WebP o HEIC.', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: 'Immagine troppo grande. Massimo 5 MB.', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        const ext = MIME_TO_EXT[file.type] ?? 'jpg';
        const storagePath = `${user.id}/avatar.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const admin = await createAdminClient();
        const { error: uploadError } = await admin.storage
            .from('avatars')
            .upload(storagePath, buffer, { contentType: file.type, upsert: true });

        if (uploadError) {
            return NextResponse.json(
                { error: 'Errore durante il caricamento dell\'immagine.', code: 'STORAGE_ERROR' },
                { status: 500 }
            );
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        // Append a cache-busting timestamp so the browser reloads the image
        const avatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${storagePath}?t=${Date.now()}`;

        const { error: dbError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', user.id);

        if (dbError) {
            return NextResponse.json(
                { error: 'Immagine caricata ma profilo non aggiornato.', code: 'DB_ERROR' },
                { status: 500 }
            );
        }

        return NextResponse.json({ avatarUrl });
    } catch (e: any) {
        return NextResponse.json(
            { error: e.message ?? 'Errore server.', code: e.code ?? 'INTERNAL_ERROR' },
            { status: e.status ?? 500 }
        );
    }
}
