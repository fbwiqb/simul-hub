BEGIN;
CREATE FUNCTION pg_temp.plain(t text) RETURNS text LANGUAGE sql AS $$
 SELECT replace(replace(replace(replace(replace(replace(t,
  '푸른바다거북(해초를 먹는 개체)가','푸른바다거북이'),
  '푸른바다거북(해초를 먹는 개체)','푸른바다거북'),
  '들쥐(Meadow vole)','들쥐'),
  '뱀상어(Tiger shark)','뱀상어'),
  '대왕고래(남극 개체군)','대왕고래'),
  '해초류(seagrasses)','해초류')
$$;
UPDATE eco2026.cases SET public_data=pg_temp.plain(public_data::text)::jsonb,solution=pg_temp.plain(solution::text)::jsonb,title=pg_temp.plain(title)
 WHERE public_data::text||solution::text||title ~ '\(';
COMMIT;
