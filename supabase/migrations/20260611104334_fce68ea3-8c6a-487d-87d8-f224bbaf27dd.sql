
CREATE TABLE public.import_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('account','asset')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, alias)
);
CREATE INDEX import_aliases_user_alias_idx ON public.import_aliases(user_id, alias);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_aliases TO authenticated;
GRANT ALL ON public.import_aliases TO service_role;

ALTER TABLE public.import_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own import aliases"
  ON public.import_aliases FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
