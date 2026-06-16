
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS isin text;

CREATE INDEX IF NOT EXISTS idx_assets_user_isin
  ON public.assets (user_id, isin)
  WHERE isin IS NOT NULL;
