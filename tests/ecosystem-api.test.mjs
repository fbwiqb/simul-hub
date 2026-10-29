import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../api/ecosystem.mjs';
const origin='https://assessment.example.test';
const user={id:'00000000-0000-4000-8000-000000000001',email:'99991@cnsa.hs.kr',
 email_confirmed_at:'2026-01-01T00:00:00Z',identities:[{provider:'google'}]};
function fixture(overrides={}){
 const calls=[];
 const auth={getUser:async()=>({data:{user},error:null}),signOut:async args=>{calls.push(['logout',args]);},
  signInWithOAuth:async args=>{calls.push(['login',args]);return{data:{url:'https://accounts.google.com/example'}};},
  exchangeCodeForSession:async code=>{calls.push(['callback',code]);return{error:null};},...overrides.auth};
 const handler=createHandler({origin,auth,gateway:async args=>{calls.push(['gateway',args]);return overrides.result||{data:{status:'active'},error:null};}});
 return {handler,calls};
}
const request=(op,body,headers={})=>new Request(origin+'/api/ecosystem?op='+op,
 body===undefined?{headers}:{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('로그인 안 된 요청과 이메일 로그인 위장으로는 DB를 읽지 못한다',async()=>{
 for(const fake of [null,{...user,identities:[{provider:'email'}],app_metadata:{provider:'google'}},{...user,email_confirmed_at:null}]){
  const f=fixture({auth:{getUser:async()=>({data:{user:fake}})}});
  const r=await f.handler(request('state'));assert.equal(r.status,401);assert(!f.calls.some(c=>c[0]==='gateway'));
 }
});
test('본문의 학번·교사 역할 대신 검증된 Google 사용자만 전달한다',async()=>{
 const f=fixture(),r=await f.handler(request('answer',{p_user_id:'forged',p_email:'teacher@example.test',role:'teacher',step:1,choice:'increase',reason:'먹이 관계',revision:2}));
 assert.equal(r.status,200);const args=f.calls.find(c=>c[0]==='gateway')[1];
 assert.equal(args.p_user_id,user.id);assert.equal(args.p_email,user.email);assert.equal(args.p_action,'answer');
 assert.equal(r.headers.get('Cache-Control'),'private, no-store, max-age=0');
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});
test('다른 사이트의 POST, GET으로 답안 확정, 알 수 없는 작업을 거절한다',async()=>{
 const f=fixture();
 assert.equal((await f.handler(request('answer',{},{origin:'https://evil.example'}))).status,403);
 assert.equal((await f.handler(request('submit'))).status,405);
 assert.equal((await f.handler(request('teacher_close'))).status,405);
 assert.equal((await f.handler(request('drop_everything',{}))).status,400);
 assert.equal(f.calls.length,0);
});
test('DB 확정 실패는 성공 응답이나 해설로 바꾸지 않는다',async()=>{
 const f=fixture({result:{error:{code:'PT409',message:'이미 확정한 예측은 바꿀 수 없습니다.'}}});
 const r=await f.handler(request('answer',{step:1,reason:'변경',choice:'decrease'}));
 assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:'이미 확정한 예측은 바꿀 수 없습니다.'});
 const bad=fixture({result:{error:{code:'XX000',message:'private SQL and infrastructure details'}}});
 const body=await(await bad.handler(request('state'))).text();assert(!body.includes('private SQL'));
});
test('과도한 본문과 잘못된 JSON은 저장 요청 전에 차단한다',async()=>{
 const f=fixture();
 assert.equal((await f.handler(request('draft',{draft:{essay:'x'.repeat(140000)}}))).status,413);
 const r=await f.handler(new Request(origin+'/api/ecosystem?op=draft',{method:'POST',headers:{origin},body:'{'}));
 assert.equal(r.status,400);assert.equal(f.calls.length,0);
});
test('한글 12000자 정리글과 4000자 이유는 허용한 문자수까지 전송할 수 있다',async()=>{
 const f=fixture(),essay='가'.repeat(12000),reason='나'.repeat(4000);
 assert.equal((await f.handler(request('draft',{draft:{essay,reason},revision:1}))).status,200);
 assert.equal((await f.handler(request('submit',{essay,revision:2}))).status,200);
});
test('구글 OAuth 콜백은 고정된 앱 주소를 사용하고 로그아웃은 이 세션에만 적용한다',async()=>{
 const f=fixture();
 const login=await f.handler(request('login'));assert.equal(login.status,303);
 assert.equal(f.calls[0][1].options.redirectTo,origin+'/api/ecosystem?op=callback');
 const callback=await f.handler(new Request(origin+'/api/ecosystem?op=callback&code=test&next=https://evil.example'));
 assert.equal(callback.headers.get('location'),origin+'/ecosystem-equilibrium/');
 await f.handler(request('logout',{}));assert.deepEqual(f.calls.find(x=>x[0]==='logout')[1],{scope:'local'});
});
