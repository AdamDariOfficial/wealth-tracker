
-- profile prefs
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications jsonb NOT NULL DEFAULT '{"weekly_email":true,"goal_alerts":true,"drawdown_warnings":true,"dca_reminders":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en-US';

-- buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('weekly-screenshots', 'weekly-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- avatars policies (public read, owner write)
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
CREATE POLICY "avatars owner insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- weekly-screenshots (private, owner only)
DROP POLICY IF EXISTS "screens owner select" ON storage.objects;
CREATE POLICY "screens owner select" ON storage.objects
  FOR SELECT USING (bucket_id = 'weekly-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "screens owner insert" ON storage.objects;
CREATE POLICY "screens owner insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'weekly-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "screens owner update" ON storage.objects;
CREATE POLICY "screens owner update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'weekly-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "screens owner delete" ON storage.objects;
CREATE POLICY "screens owner delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'weekly-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
