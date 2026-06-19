-- =============================================================================
-- AESkolar Storage: buckets + RLS (run in Supabase SQL Editor after rls_policies.sql)
-- =============================================================================

-- Buckets (re-run safe)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Optional profile column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- Drop policies if re-running this script
DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_delete_own" ON storage.objects;

-- documents: authenticated users read/upload in their own folder ({userId}/...)
CREATE POLICY "documents_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "documents_storage_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "documents_storage_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- avatars: public read; authenticated users manage files under {userId}/...
CREATE POLICY "avatars_storage_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_storage_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_storage_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_storage_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
