CREATE SCHEMA eco2026;
REVOKE ALL ON SCHEMA eco2026 FROM PUBLIC, anon, authenticated;

CREATE TABLE eco2026.sections (
 id integer PRIMARY KEY, label text NOT NULL, teacher_name text NOT NULL
);
CREATE TABLE eco2026.students (
 student_id text PRIMARY KEY CHECK(student_id ~ '^[0-9]{5}$'),
 email text NOT NULL UNIQUE, name text NOT NULL,
 section_id integer NOT NULL REFERENCES eco2026.sections,
 user_id uuid UNIQUE, roster_note text NOT NULL DEFAULT ''
);
CREATE TABLE eco2026.teachers (
 email text PRIMARY KEY, name text NOT NULL, admin boolean NOT NULL DEFAULT false,
 section_ids integer[] NOT NULL DEFAULT '{}', enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE eco2026.cases (
 id text PRIMARY KEY, bank_version text NOT NULL, title text NOT NULL,
 public_data jsonb NOT NULL, solution jsonb NOT NULL
);
CREATE TABLE eco2026.settings (
 key text PRIMARY KEY, value jsonb NOT NULL
);
CREATE TABLE eco2026.windows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), section_id integer NOT NULL REFERENCES eco2026.sections,
 opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL,
 closed boolean NOT NULL DEFAULT false, created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(closes_at>opens_at)
);
CREATE TABLE eco2026.attempts (
 student_id text PRIMARY KEY REFERENCES eco2026.students,
 id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 window_id uuid NOT NULL REFERENCES eco2026.windows,
 case_id text NOT NULL REFERENCES eco2026.cases,
 rerolls integer NOT NULL DEFAULT 0 CHECK(rerolls BETWEEN 0 AND 1),
 chain jsonb, chain_at timestamptz, draft jsonb NOT NULL DEFAULT '{}',
 essay text, submitted_at timestamptz, extension_until timestamptz,
 revision bigint NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE eco2026.answers (
 student_id text NOT NULL REFERENCES eco2026.attempts,
 step integer NOT NULL CHECK(step BETWEEN 1 AND 6),
 choice text NOT NULL CHECK(choice IN('increase','decrease','stable')),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 4000),
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(student_id,step)
);
CREATE TABLE eco2026.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor text NOT NULL, action text NOT NULL, student_id text,
 detail jsonb NOT NULL DEFAULT '{}', at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX eco_windows_section_time ON eco2026.windows(section_id,opens_at,closes_at);
CREATE INDEX eco_audit_student ON eco2026.audit(student_id,at);

ALTER TABLE eco2026.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE eco2026.audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA eco2026 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA eco2026 FROM PUBLIC,anon,authenticated;

CREATE FUNCTION eco2026.fail(code integer,message text) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='PT'||code::text, MESSAGE=message; END;
$$;

CREATE FUNCTION eco2026.payload(student text) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s eco2026.students; a eco2026.attempts; w eco2026.windows; c eco2026.cases;
 n integer; expiry timestamptz; result jsonb; target jsonb;
BEGIN
 SELECT * INTO STRICT s FROM eco2026.students WHERE student_id=student;
 result:=jsonb_build_object('role','student','student',jsonb_build_object('id',s.student_id,'name',s.name,'section',s.section_id),
   'server_time',clock_timestamp());
 SELECT * INTO a FROM eco2026.attempts WHERE student_id=student;
 IF FOUND THEN
  IF a.submitted_at IS NOT NULL THEN
   RETURN result||jsonb_build_object('status','completed','receipt',jsonb_build_object('id',a.id,'submitted_at',a.submitted_at));
  END IF;
  SELECT * INTO STRICT w FROM eco2026.windows WHERE id=a.window_id;
  expiry:=coalesce(a.extension_until,w.closes_at);
  IF w.closed OR clock_timestamp()<w.opens_at OR clock_timestamp()>=expiry THEN
   RETURN result||jsonb_build_object('status','closed','message','응시 시간이 종료되었습니다. 저장된 답안은 선생님이 확인할 수 있습니다.');
  END IF;
  SELECT * INTO STRICT c FROM eco2026.cases WHERE id=a.case_id;
  SELECT count(*) INTO n FROM eco2026.answers WHERE student_id=student;
  result:=result||jsonb_build_object('status','active','deadline',expiry,'revision',a.revision,'rerolls',a.rerolls,
    'case',c.public_data,'chain',a.chain,'chain_at',a.chain_at,'draft',a.draft,'answered',n);
  IF a.chain IS NOT NULL THEN
   result:=result||jsonb_build_object('model_chain',c.solution->'chain',
    'frames',(SELECT jsonb_agg(value ORDER BY ordinality) FROM jsonb_array_elements(c.solution->'frames') WITH ORDINALITY WHERE ordinality<=n+1),
    'answers',(SELECT coalesce(jsonb_agg(jsonb_build_object('step',step,'choice',choice,'reason',reason,'confirmed_at',confirmed_at) ORDER BY step),'[]'::jsonb) FROM eco2026.answers WHERE student_id=student));
   IF n<6 THEN
    target:=c.solution->'frames'->(n+1);
    result:=result||jsonb_build_object('question',jsonb_build_object('step',n+1,'phase',CASE WHEN n<3 THEN 'change' ELSE 'recovery' END,
       'target',target->>'targetRole','target_name',c.solution->'role_names'->>(target->>'targetRole')));
   ELSE
    result:=result||jsonb_build_object('essay_prompt',(SELECT value->>'text' FROM eco2026.settings WHERE key='essay_prompt'));
   END IF;
  END IF;
  RETURN result;
 END IF;
 SELECT * INTO w FROM eco2026.windows
 WHERE section_id=s.section_id AND NOT closed AND opens_at<=clock_timestamp() AND closes_at>clock_timestamp()
 ORDER BY opens_at DESC LIMIT 1;
 IF FOUND THEN RETURN result||jsonb_build_object('status','ready','deadline',w.closes_at); END IF;
 RETURN result||jsonb_build_object('status','waiting','message','아직 이 분반의 수행평가 시간이 열리지 않았습니다.');
END;
$$;

CREATE FUNCTION eco2026.teacher_state(email_address text) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE t eco2026.teachers;
BEGIN
 SELECT * INTO STRICT t FROM eco2026.teachers WHERE email=email_address AND enabled;
 RETURN jsonb_build_object('role','teacher','teacher',to_jsonb(t),'server_time',clock_timestamp(),
 'sections',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) FROM eco2026.sections s WHERE t.admin OR s.id=ANY(t.section_ids)),
 'windows',(SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.opens_at DESC),'[]'::jsonb) FROM eco2026.windows w WHERE t.admin OR w.section_id=ANY(t.section_ids)),
 'roster',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.student_id,'name',s.name,'section',s.section_id,'note',s.roster_note,
   'started_at',a.started_at,'submitted_at',a.submitted_at,'updated_at',a.updated_at,'revision',a.revision,
   'answered',(SELECT count(*) FROM eco2026.answers ans WHERE ans.student_id=s.student_id),
   'chain_confirmed',a.chain IS NOT NULL,'deadline',coalesce(a.extension_until,w.closes_at),'window_closed',w.closed,
   'case_title',c.title) ORDER BY s.section_id,s.student_id),'[]'::jsonb)
 FROM eco2026.students s LEFT JOIN eco2026.attempts a USING(student_id)
 LEFT JOIN eco2026.windows w ON w.id=a.window_id LEFT JOIN eco2026.cases c ON c.id=a.case_id
 WHERE t.admin OR s.section_id=ANY(t.section_ids)),
 'cases',(SELECT jsonb_agg(jsonb_build_object('id',id,'title',title) ORDER BY id) FROM eco2026.cases),
 'teachers',CASE WHEN t.admin THEN (SELECT jsonb_agg(to_jsonb(x) ORDER BY email) FROM eco2026.teachers x) ELSE '[]'::jsonb END,
 'essay_prompt',(SELECT value->>'text' FROM eco2026.settings WHERE key='essay_prompt'));
END;
$$;

CREATE FUNCTION public.eco_gateway(p_user_id uuid,p_email text,p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t eco2026.teachers; s eco2026.students; a eco2026.attempts; w eco2026.windows; c eco2026.cases;
 section integer; ids integer[]; n integer; chosen text; expected jsonb; existing eco2026.answers;
 start_time timestamptz; end_time timestamptz; old_teacher eco2026.teachers;
BEGIN
 IF coalesce(current_setting('request.jwt.claims',true)::jsonb->>'role','')<>'service_role' THEN
  PERFORM eco2026.fail(403,'허용되지 않은 접근입니다.');
 END IF;
 IF p_user_id IS NULL OR length(p_email)>254 OR p_email<>lower(trim(p_email)) THEN PERFORM eco2026.fail(403,'계정을 확인해 주세요.'); END IF;
 SELECT * INTO t FROM eco2026.teachers WHERE email=p_email AND enabled;
 IF FOUND THEN
  IF p_action='state' THEN RETURN eco2026.teacher_state(p_email); END IF;
  IF p_action='teacher_demo' THEN
   SELECT * INTO c FROM eco2026.cases WHERE id=p_payload->>'case_id';
   IF NOT FOUND THEN PERFORM eco2026.fail(404,'상황을 찾을 수 없습니다.'); END IF;
   RETURN jsonb_build_object('case',c.public_data,'solution',c.solution,'demo',true,
    'essay_prompt',(SELECT value->>'text' FROM eco2026.settings WHERE key='essay_prompt'));
  END IF;
  IF p_action='teacher_approve' THEN
   IF NOT t.admin THEN PERFORM eco2026.fail(403,'관리자만 교사를 승인할 수 있습니다.'); END IF;
   IF coalesce(p_payload->>'email','') !~ '^[^ @]+@[^ @]+[.][^ @]+$'
      OR lower(p_payload->>'email') ~ '^[0-9]{5}@cnsa[.]hs[.]kr$'
      OR length(trim(coalesce(p_payload->>'name','')))=0 THEN PERFORM eco2026.fail(400,'교사 이름과 구글 계정을 확인해 주세요.'); END IF;
   SELECT coalesce(array_agg(value::integer),'{}'::integer[]) INTO ids FROM jsonb_array_elements_text(coalesce(p_payload->'sections','[]'));
   IF EXISTS(SELECT 1 FROM unnest(ids) v WHERE NOT EXISTS(SELECT 1 FROM eco2026.sections WHERE id=v)) THEN PERFORM eco2026.fail(400,'분반을 확인해 주세요.'); END IF;
   SELECT * INTO old_teacher FROM eco2026.teachers WHERE email=lower(p_payload->>'email');
   IF FOUND AND old_teacher.admin THEN PERFORM eco2026.fail(403,'관리자 계정은 이 화면에서 변경할 수 없습니다.'); END IF;
   INSERT INTO eco2026.teachers(email,name,section_ids,enabled)
    VALUES(lower(p_payload->>'email'),trim(p_payload->>'name'),ids,coalesce((p_payload->>'enabled')::boolean,true))
   ON CONFLICT(email) DO UPDATE SET name=excluded.name,section_ids=excluded.section_ids,enabled=excluded.enabled;
  ELSIF p_action='teacher_window' THEN
   section:=(p_payload->>'section')::integer;
   IF NOT t.admin AND NOT section=ANY(t.section_ids) THEN PERFORM eco2026.fail(403,'담당 분반만 열 수 있습니다.'); END IF;
   PERFORM pg_advisory_xact_lock(section::bigint+202610290000);
   start_time:=CASE WHEN coalesce((p_payload->>'start_now')::boolean,false) THEN clock_timestamp() ELSE (p_payload->>'opens_at')::timestamptz END;
   end_time:=(p_payload->>'closes_at')::timestamptz;
   IF start_time IS NULL OR end_time IS NULL OR end_time<=start_time THEN PERFORM eco2026.fail(400,'시작·종료 시간을 확인해 주세요.'); END IF;
   IF EXISTS(SELECT 1 FROM eco2026.windows WHERE section_id=section AND NOT closed AND opens_at<end_time AND closes_at>start_time) THEN
    PERFORM eco2026.fail(409,'겹치는 응시 시간이 있습니다. 기존 시간을 먼저 종료해 주세요.');
   END IF;
   INSERT INTO eco2026.windows(section_id,opens_at,closes_at,created_by) VALUES(section,start_time,end_time,p_email);
  ELSIF p_action='teacher_close' THEN
   SELECT * INTO w FROM eco2026.windows WHERE id=(p_payload->>'window_id')::uuid FOR UPDATE;
   IF NOT FOUND OR (NOT t.admin AND NOT w.section_id=ANY(t.section_ids)) THEN PERFORM eco2026.fail(403,'담당 분반의 시간만 종료할 수 있습니다.'); END IF;
   UPDATE eco2026.windows SET closed=true WHERE id=w.id;
  ELSIF p_action='teacher_extend' THEN
   SELECT * INTO s FROM eco2026.students WHERE student_id=p_payload->>'student_id';
   IF NOT FOUND OR (NOT t.admin AND NOT s.section_id=ANY(t.section_ids)) THEN PERFORM eco2026.fail(403,'담당 학생만 변경할 수 있습니다.'); END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(s.email,0));
   SELECT * INTO a FROM eco2026.attempts WHERE student_id=s.student_id FOR UPDATE;
   IF NOT FOUND OR a.submitted_at IS NOT NULL THEN PERFORM eco2026.fail(409,'제출 완료 답안은 다시 열 수 없습니다.'); END IF;
   end_time:=(p_payload->>'until')::timestamptz;
   IF end_time IS NULL OR end_time<=clock_timestamp() THEN PERFORM eco2026.fail(400,'연장 종료 시간을 확인해 주세요.'); END IF;
   IF length(trim(coalesce(p_payload->>'reason','')))<2 THEN PERFORM eco2026.fail(400,'연장 사유를 기록해 주세요.'); END IF;
   SELECT * INTO w FROM eco2026.windows WHERE section_id=s.section_id AND NOT closed
    AND opens_at<=clock_timestamp() AND closes_at>=end_time ORDER BY opens_at DESC LIMIT 1;
   IF NOT FOUND THEN PERFORM eco2026.fail(409,'먼저 해당 분반에 연장 시간을 열어 주세요.'); END IF;
   UPDATE eco2026.attempts SET window_id=w.id,extension_until=end_time,revision=revision+1,updated_at=clock_timestamp() WHERE student_id=s.student_id;
  ELSIF p_action IN('teacher_record','teacher_export') THEN
   IF p_action='teacher_record' THEN
    SELECT * INTO s FROM eco2026.students WHERE student_id=p_payload->>'student_id';
    IF NOT FOUND OR (NOT t.admin AND NOT s.section_id=ANY(t.section_ids)) THEN PERFORM eco2026.fail(403,'담당 학생만 볼 수 있습니다.'); END IF;
    RETURN jsonb_build_object('student',to_jsonb(s),'attempt',(SELECT to_jsonb(x) FROM eco2026.attempts x WHERE student_id=s.student_id),
      'answers',(SELECT jsonb_agg(to_jsonb(x) ORDER BY step) FROM eco2026.answers x WHERE student_id=s.student_id),
      'case',(SELECT jsonb_build_object('public',public_data,'solution',solution,'version',bank_version) FROM eco2026.cases WHERE id=(SELECT case_id FROM eco2026.attempts WHERE student_id=s.student_id)));
   END IF;
   INSERT INTO eco2026.audit(actor,action,detail) VALUES(p_email,'teacher_export',p_payload);
   RETURN jsonb_build_object('format','cnsa-ecosystem-assessment-v1','exported_at',clock_timestamp(),'exported_by',p_email,
    'sections',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.sections x WHERE t.admin OR x.id=ANY(t.section_ids)),
    'teachers',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.teachers x WHERE t.admin OR x.email=p_email),
    'students',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.students x WHERE t.admin OR x.section_id=ANY(t.section_ids)),
    'windows',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.windows x WHERE t.admin OR x.section_id=ANY(t.section_ids)),
    'attempts',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.attempts x JOIN eco2026.students roster USING(student_id) WHERE t.admin OR roster.section_id=ANY(t.section_ids)),
    'answers',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.student_id,x.step) FROM eco2026.answers x JOIN eco2026.students roster USING(student_id) WHERE t.admin OR roster.section_id=ANY(t.section_ids)),
    'cases',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.cases x),
    'audit',(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM eco2026.audit x WHERE t.admin OR x.actor=p_email OR x.student_id IN(SELECT student_id FROM eco2026.students WHERE section_id=ANY(t.section_ids))),
    'rubric',jsonb_build_object('food_chain',15,'change',15,'recovery',15,'environment',55),
    'settings',(SELECT jsonb_agg(to_jsonb(x)) FROM eco2026.settings x),
    'essay_prompt',(SELECT value->>'text' FROM eco2026.settings WHERE key='essay_prompt'));
  ELSE PERFORM eco2026.fail(400,'지원하지 않는 교사 작업입니다.');
  END IF;
  INSERT INTO eco2026.audit(actor,action,student_id,detail) VALUES(p_email,p_action,p_payload->>'student_id',p_payload);
  RETURN eco2026.teacher_state(p_email);
 END IF;

 IF p_action LIKE 'teacher_%' THEN PERFORM eco2026.fail(403,'교사 전용 기능입니다.'); END IF;
 SELECT * INTO s FROM eco2026.students WHERE email=p_email;
 IF NOT FOUND THEN PERFORM eco2026.fail(403,'이번 통합과학2 수행평가 명부에 없는 계정입니다.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,0));
 SELECT * INTO s FROM eco2026.students WHERE email=p_email FOR UPDATE;
 IF s.user_id IS NOT NULL AND s.user_id<>p_user_id THEN PERFORM eco2026.fail(403,'연결된 구글 계정을 확인해 주세요.'); END IF;
 IF s.user_id IS NULL THEN UPDATE eco2026.students SET user_id=p_user_id WHERE student_id=s.student_id; END IF;
 IF p_action='state' THEN RETURN eco2026.payload(s.student_id); END IF;
 SELECT * INTO a FROM eco2026.attempts WHERE student_id=s.student_id FOR UPDATE;
 IF p_action='start' AND NOT FOUND THEN
  SELECT * INTO w FROM eco2026.windows WHERE section_id=s.section_id AND NOT closed
   AND opens_at<=clock_timestamp() AND closes_at>clock_timestamp() ORDER BY opens_at DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND THEN PERFORM eco2026.fail(403,'지금은 응시 시간이 아닙니다.'); END IF;
  SELECT id INTO chosen FROM eco2026.cases ORDER BY random() LIMIT 1;
  IF chosen IS NULL THEN PERFORM eco2026.fail(503,'상황을 준비 중입니다.'); END IF;
  INSERT INTO eco2026.attempts(student_id,window_id,case_id) VALUES(s.student_id,w.id,chosen);
  INSERT INTO eco2026.audit(actor,action,student_id) VALUES(p_email,'start',s.student_id);
  RETURN eco2026.payload(s.student_id);
 END IF;
 IF a.student_id IS NULL THEN PERFORM eco2026.fail(409,'수행평가를 먼저 시작해 주세요.'); END IF;
 IF a.submitted_at IS NOT NULL THEN RETURN eco2026.payload(s.student_id); END IF;
 SELECT * INTO STRICT w FROM eco2026.windows WHERE id=a.window_id FOR SHARE;
 IF w.closed OR clock_timestamp()<w.opens_at OR clock_timestamp()>=coalesce(a.extension_until,w.closes_at) THEN
  PERFORM eco2026.fail(403,'응시 시간이 종료되어 변경할 수 없습니다.');
 END IF;
 SELECT * INTO STRICT c FROM eco2026.cases WHERE id=a.case_id;
 SELECT count(*) INTO n FROM eco2026.answers WHERE student_id=s.student_id;

 IF p_action='chain' AND a.chain IS NOT NULL THEN
  IF a.chain=p_payload->'chain' THEN RETURN eco2026.payload(s.student_id); END IF;
  PERFORM eco2026.fail(409,'이미 확정한 먹이사슬은 바꿀 수 없습니다.');
 END IF;
 IF p_action='answer' THEN
  SELECT * INTO existing FROM eco2026.answers WHERE student_id=s.student_id AND step=(p_payload->>'step')::integer;
  IF FOUND THEN
   IF existing.choice=p_payload->>'choice' AND existing.reason=trim(p_payload->>'reason') THEN RETURN eco2026.payload(s.student_id); END IF;
   PERFORM eco2026.fail(409,'이미 확정한 예측은 바꿀 수 없습니다.');
  END IF;
 END IF;
 IF p_action='draft' AND a.draft=p_payload->'draft' THEN RETURN eco2026.payload(s.student_id); END IF;
 IF p_action<>'start' AND coalesce((p_payload->>'revision')::bigint,-1)<>a.revision THEN
  PERFORM eco2026.fail(409,'다른 화면에서 저장된 내용이 있습니다. 최신 상태를 다시 불러옵니다.');
 END IF;
 IF p_action='reroll' THEN
  IF a.rerolls>=1 OR a.chain IS NOT NULL OR n>0 THEN PERFORM eco2026.fail(409,'상황 바꾸기는 답안 작성 전 한 번만 가능합니다.'); END IF;
  SELECT id INTO chosen FROM eco2026.cases WHERE id<>a.case_id ORDER BY random() LIMIT 1;
  UPDATE eco2026.attempts SET case_id=chosen,rerolls=1,draft='{}' WHERE student_id=s.student_id;
 ELSIF p_action='chain' THEN
  IF jsonb_typeof(p_payload->'chain')<>'array' OR jsonb_array_length(p_payload->'chain')<>3
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_payload->'chain') AS picked(value))<>3
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_payload->'chain') AS picked(value)
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.public_data->'organisms') AS organism(value) WHERE organism.value->>'id'=picked.value)) THEN
   PERFORM eco2026.fail(400,'생물 세 가지를 한 번씩 사용해 먹이사슬을 작성해 주세요.');
  END IF;
  UPDATE eco2026.attempts SET chain=p_payload->'chain',chain_at=clock_timestamp(),draft='{}' WHERE student_id=s.student_id;
 ELSIF p_action='answer' THEN
  IF a.chain IS NULL OR (p_payload->>'step')::integer<>n+1 OR n>=6 THEN PERFORM eco2026.fail(409,'현재 단계의 예측만 확정할 수 있습니다.'); END IF;
  IF coalesce(p_payload->>'choice','') NOT IN('increase','decrease','stable')
     OR length(trim(coalesce(p_payload->>'reason',''))) NOT BETWEEN 1 AND 4000 THEN
   PERFORM eco2026.fail(400,'증감 방향을 선택하고 먹이 관계를 바탕으로 이유를 써 주세요.');
  END IF;
  INSERT INTO eco2026.answers(student_id,step,choice,reason) VALUES(s.student_id,n+1,p_payload->>'choice',trim(p_payload->>'reason'));
  UPDATE eco2026.attempts SET draft=draft-'choice'-'reason' WHERE student_id=s.student_id;
 ELSIF p_action='draft' THEN
  IF jsonb_typeof(p_payload->'draft')<>'object' OR octet_length((p_payload->'draft')::text)>98304 THEN PERFORM eco2026.fail(400,'저장할 내용을 확인해 주세요.'); END IF;
  UPDATE eco2026.attempts SET draft=p_payload->'draft' WHERE student_id=s.student_id;
 ELSIF p_action='submit' THEN
  IF a.chain IS NULL OR n<>6 OR length(trim(coalesce(p_payload->>'essay',''))) NOT BETWEEN 1 AND 12000 THEN
   PERFORM eco2026.fail(400,'먹이사슬과 여섯 단계 예측을 완료하고 정리하기를 작성해 주세요.');
  END IF;
  UPDATE eco2026.attempts SET essay=trim(p_payload->>'essay'),submitted_at=clock_timestamp(),draft='{}' WHERE student_id=s.student_id;
 ELSIF p_action<>'start' THEN PERFORM eco2026.fail(400,'지원하지 않는 작업입니다.');
 END IF;
 UPDATE eco2026.attempts SET revision=revision+1,updated_at=clock_timestamp() WHERE student_id=s.student_id;
 INSERT INTO eco2026.audit(actor,action,student_id,detail) VALUES(p_email,p_action,s.student_id,jsonb_build_object('step',p_payload->'step','revision',a.revision+1));
 RETURN eco2026.payload(s.student_id);
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA eco2026 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.eco_gateway(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eco_gateway(uuid,text,text,jsonb) TO service_role;
