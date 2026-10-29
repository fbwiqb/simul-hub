BEGIN;
INSERT INTO eco2026.sections(id,label,teacher_name) VALUES(99991,'검증 전용 A','검증'),(99992,'검증 전용 B','검증');
INSERT INTO eco2026.students(student_id,email,name,section_id) VALUES
 ('99991','99991@cnsa.hs.kr','검증 학생 A',99991),('99992','99992@cnsa.hs.kr','검증 학생 B',99992);
INSERT INTO eco2026.teachers(email,name,section_ids) VALUES('eco-test-teacher@example.test','검증 교사','{99991}');

DO $test$
DECLARE uid uuid:='00000000-0000-4000-8000-000000000001';
 r jsonb; before_case jsonb; c eco2026.cases; a eco2026.attempts; i integer;
 choice text; original text; attempts integer:=0;
BEGIN
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','state');
 IF r->>'status'<>'waiting' OR r?'case' THEN RAISE EXCEPTION 'Closed cohort content leakage'; END IF;
 BEGIN
  PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','teacher_export');
  RAISE EXCEPTION 'Student accessed teacher export';
 EXCEPTION WHEN SQLSTATE 'PT403' THEN NULL; END;
 INSERT INTO eco2026.windows(section_id,opens_at,closes_at,created_by)
 VALUES(99991,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour','test');
 r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','start');
 IF r?'frames' OR r?'model_chain' OR r?'question' THEN RAISE EXCEPTION 'Answers revealed before first chain'; END IF;
 before_case:=r->'case'->'id';
 r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','reroll',jsonb_build_object('revision',r->'revision'));
 IF r->'case'->'id'=before_case OR (r->>'rerolls')::int<>1 THEN RAISE EXCEPTION 'Reroll failed'; END IF;
 BEGIN
  PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','reroll',jsonb_build_object('revision',r->'revision'));
  RAISE EXCEPTION 'Second reroll accepted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
 r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','draft',
   jsonb_build_object('revision',r->'revision','draft',jsonb_build_object('reason',repeat('나',4000),'essay',repeat('가',12000))));
 IF length(r->'draft'->>'essay')<>12000 THEN RAISE EXCEPTION 'Korean draft byte boundary failed'; END IF;
 BEGIN
  PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','draft','{"revision":-1,"draft":{"essay":"stale"}}');
  RAISE EXCEPTION 'Stale revision accepted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;

 FOR c IN SELECT * FROM eco2026.cases ORDER BY id LOOP
  DELETE FROM eco2026.answers WHERE student_id='99991';
  DELETE FROM eco2026.attempts WHERE student_id='99991';
  r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','start');
  UPDATE eco2026.attempts SET case_id=c.id WHERE student_id='99991';
  r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','chain',
   jsonb_build_object('revision',0,'chain',(SELECT jsonb_agg(value->'id' ORDER BY ordinality) FROM jsonb_array_elements(c.solution->'chain') WITH ORDINALITY)));
  IF jsonb_array_length(r->'frames')<>2 OR r->'question'?'expectedChoice'
     OR (r->>'answered')::int<>0 OR (r->>'observed_step')::int<>1
     OR (r->'question'->>'step')::int<>2 OR jsonb_array_length(r->'answers')<>0
     OR r->'frames'->1<>c.solution->'frames'->1 THEN RAISE EXCEPTION 'Given first-stage boundary failed'; END IF;
  BEGIN
   PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','answer',jsonb_build_object('revision',r->'revision','step',1,'choice','stable','reason','제시된 상황을 답안으로 저장하려는 시도'));
   RAISE EXCEPTION 'Given first stage accepted as student response';
  EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL; END;
  BEGIN
   PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','submit',jsonb_build_object('revision',r->'revision','essay','예측을 건너뛴 제출'));
   RAISE EXCEPTION 'Skipped all predictions';
  EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL; END;
  BEGIN
   PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','chain',jsonb_build_object('revision',r->'revision','chain','[]'::jsonb));
   RAISE EXCEPTION 'First chain overwritten';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  BEGIN
   PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','answer',jsonb_build_object('revision',r->'revision','step',3,'choice','stable','reason','future'));
   RAISE EXCEPTION 'Skipped future stage';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  FOR i IN 2..6 LOOP
   BEGIN
    PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','answer',jsonb_build_object('revision',r->'revision','step',i,'choice','stable','reason',' '));
    RAISE EXCEPTION 'Blank reason accepted';
   EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL; END;
   choice:=c.solution->'frames'->i->>'expectedChoice';
   r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','answer',jsonb_build_object('revision',r->'revision','step',i,'choice',choice,'reason','먹이 관계를 바탕으로 작성한 검증 이유'));
   IF jsonb_array_length(r->'frames')<>i+1 OR (r->>'answered')::int<>i-1
      OR (r->>'observed_step')::int<>i THEN RAISE EXCEPTION 'Observed frame boundary failed'; END IF;
   IF i<6 AND r?'essay_prompt' THEN RAISE EXCEPTION 'Final prompt revealed before completion of inquiry'; END IF;
   IF i=6 AND length(coalesce(r->>'essay_prompt',''))<10 THEN RAISE EXCEPTION 'Final prompt missing after inquiry'; END IF;
   IF i<6 AND (r->'question'->>'step')::int<>i+1 THEN RAISE EXCEPTION 'Question sequence failed'; END IF;
   IF (c.solution->'frames'->i->>'phase')<>(CASE WHEN i<=3 THEN 'change' ELSE 'recovery' END) THEN RAISE EXCEPTION 'Phase contract failed'; END IF;
   BEGIN
    PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','answer',jsonb_build_object('revision',r->'revision','step',i,'choice',choice,'reason','수정 시도'));
    RAISE EXCEPTION 'Confirmed reason overwritten';
   EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;
  END LOOP;
  IF EXISTS(SELECT 1 FROM eco2026.answers WHERE student_id='99991' AND step=1) THEN RAISE EXCEPTION 'Fabricated first-stage response found'; END IF;
  r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','submit',jsonb_build_object('revision',r->'revision','essay',CASE WHEN attempts=0 THEN repeat('가',12000) ELSE '환경 변화의 사례와 근거를 연결한 검증 답안' END));
  IF r->>'status'<>'completed' OR r?'case' OR r?'frames' OR r?'answers' THEN RAISE EXCEPTION 'Completed content leakage'; END IF;
  r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','start');
  IF r->>'status'<>'completed' THEN RAISE EXCEPTION 'Completed attempt reopened'; END IF;
  attempts:=attempts+1;
 END LOOP;
 IF attempts<>60 THEN RAISE EXCEPTION 'Not all sixty cases tested'; END IF;

 r:=public.eco_gateway(uid,'eco-test-teacher@example.test','state');
 IF jsonb_array_length(r->'roster')<>1 OR jsonb_array_length(r->'sections')<>1 THEN RAISE EXCEPTION 'Teacher cohort isolation failed'; END IF;
 r:=public.eco_gateway(uid,'eco-test-teacher@example.test','teacher_export');
 IF r->>'format'<>'cnsa-ecosystem-assessment-v2' OR jsonb_array_length(r->'students')<>1
    OR jsonb_array_length(r->'answers')<>5 OR jsonb_array_length(r->'cases')<>60
    OR r->'workflow'->'given_steps'<>'[1]'::jsonb THEN
  RAISE EXCEPTION 'Scoped original export failed';
 END IF;
 BEGIN
  PERFORM public.eco_gateway(uid,'eco-test-teacher@example.test','teacher_record','{"student_id":"99992"}');
  RAISE EXCEPTION 'Teacher read foreign cohort';
 EXCEPTION WHEN SQLSTATE 'PT403' THEN NULL; END;
 BEGIN
  PERFORM public.eco_gateway(uid,'eco-test-teacher@example.test','teacher_window','{"section":99992,"start_now":true,"closes_at":"2099-01-01T00:00:00Z"}');
  RAISE EXCEPTION 'Teacher opened foreign cohort';
 EXCEPTION WHEN SQLSTATE 'PT403' THEN NULL; END;
 BEGIN
  PERFORM public.eco_gateway(uid,'eco-test-teacher@example.test','teacher_extend','{"student_id":"99991","until":"2099-01-01T00:00:00Z","reason":"검증"}');
  RAISE EXCEPTION 'Completed student extension allowed';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL; END;

 DELETE FROM eco2026.answers WHERE student_id='99991';
 DELETE FROM eco2026.attempts WHERE student_id='99991';
 r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','start');
 UPDATE eco2026.windows SET closed=true WHERE section_id=99991;
 r:=public.eco_gateway(uid,'99991@cnsa.hs.kr','state');
 IF r->>'status'<>'closed' OR r?'case' THEN RAISE EXCEPTION 'Closed attempt content leakage'; END IF;
 BEGIN
  PERFORM public.eco_gateway(uid,'99991@cnsa.hs.kr','draft','{"revision":0,"draft":{"essay":"late"}}');
  RAISE EXCEPTION 'Late write accepted';
 EXCEPTION WHEN SQLSTATE 'PT403' THEN NULL; END;
END;
$test$;
ROLLBACK;
SELECT 'passed' AS result,60 AS scenarios,60 AS given_first_stages,300 AS predictions,'all fixtures rolled back' AS isolation;
