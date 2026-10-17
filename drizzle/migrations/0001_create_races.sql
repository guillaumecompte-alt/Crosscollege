CREATE TABLE public.races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  distance text NOT NULL DEFAULT '',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.races TO authenticated;
GRANT ALL ON public.races TO service_role;
ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage races" ON public.races FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.finishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  race_id uuid NOT NULL REFERENCES public.races(id) ON DELETE CASCADE,
  position integer NOT NULL,
  elapsed_ms bigint NOT NULL,
  bib text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (race_id, position)
);
CREATE INDEX finishes_race_idx ON public.finishes(race_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finishes TO authenticated;
GRANT ALL ON public.finishes TO service_role;
ALTER TABLE public.finishes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage finishes" ON public.finishes FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());