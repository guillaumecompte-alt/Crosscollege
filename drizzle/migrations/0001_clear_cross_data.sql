-- Delete only the signed-in account's cross data, atomically.
CREATE OR REPLACE FUNCTION public.clear_cross_data()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.finishes WHERE owner_id = auth.uid();
  DELETE FROM public.races WHERE owner_id = auth.uid();
  DELETE FROM public.students WHERE owner_id = auth.uid();

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_cross_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_cross_data() TO authenticated;
