-- Create a public storage bucket for user profile avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload/replace only inside their own folder ({user_id}/...)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_insert_own') THEN
        CREATE POLICY "avatars_insert_own"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (
                bucket_id = 'avatars'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_update_own') THEN
        CREATE POLICY "avatars_update_own"
            ON storage.objects FOR UPDATE
            TO authenticated
            USING (
                bucket_id = 'avatars'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
END $$;

-- Public read for everyone (avatars are public)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_select_public') THEN
        CREATE POLICY "avatars_select_public"
            ON storage.objects FOR SELECT
            TO public
            USING (bucket_id = 'avatars');
    END IF;
END $$;

