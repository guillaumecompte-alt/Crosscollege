CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  bib TEXT NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('M','F')),
  class_name TEXT NOT NULL,
  source_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX students_owner_bib_idx ON public.students (owner_id, bib);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their roster"
ON public.students FOR SELECT TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Owners can insert their roster"
ON public.students FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their roster"
ON public.students FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.replace_roster(p_students JSONB, p_source_file TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted INTEGER := 0;
BEGIN
  IF jsonb_typeof(p_students) <> 'array' THEN
    RAISE EXCEPTION 'students must be a JSON array';
  END IF;

  DELETE FROM public.students WHERE owner_id = auth.uid();

  INSERT INTO public.students (owner_id, bib, last_name, first_name, sex, class_name, source_file)
  SELECT
    auth.uid(),
    trim(t.bib),
    trim(t.last_name),
    trim(t.first_name),
    upper(trim(t.sex)),
    trim(t.class_name),
    p_source_file
  FROM jsonb_to_recordset(p_students) AS t(
    bib TEXT, last_name TEXT, first_name TEXT, sex TEXT, class_name TEXT
  )
  WHERE t.bib ~ '^[0-9]{1,10}$'
    AND length(trim(coalesce(t.last_name, ''))) BETWEEN 1 AND 120
    AND length(trim(coalesce(t.first_name, ''))) BETWEEN 1 AND 120
    AND length(trim(coalesce(t.class_name, ''))) BETWEEN 1 AND 40
    AND upper(trim(coalesce(t.sex, ''))) IN ('M','F');

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_roster(JSONB, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.replace_roster(JSONB, TEXT) TO authenticated;