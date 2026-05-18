
-- Replace the broad public read with one scoped to avatar files inside a user-id folder.
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read scoped" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND name LIKE '%/avatar-%'
  );
