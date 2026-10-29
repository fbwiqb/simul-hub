import {el,button,formatTime} from './ui.mjs';
import {StudentWorkspace} from './student.mjs';
import {TeacherWorkspace} from './teacher.mjs';

const main=document.querySelector('#main'),identity=document.querySelector('#identity'),noticeBox=document.querySelector('#notice');
let state,workspace,mode,serial=Promise.resolve(),seenTime=0,endAt=0,demo=false,noticeTimer,authEpoch=0;
function notice(message,error=false){
 noticeBox.textContent=message;noticeBox.className='notice'+(error?' error':'');noticeBox.hidden=false;
 clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{noticeBox.hidden=true;},7000);
}
window.addEventListener('eco-ui-error',event=>notice(event.detail||'요청을 완료하지 못했습니다.',true));

async function api(op,payload){
 const epoch=authEpoch;
 const write=payload!==undefined&&!['teacher_demo','teacher_record','teacher_export'].includes(op);
 const url=new URL('/api/ecosystem',location.origin);url.searchParams.set('op',op);
 if(!write)for(const [key,value] of Object.entries(payload||{}))url.searchParams.set(key,String(value));
 const body=write?JSON.stringify(payload):null;
 const response=await fetch(url,{method:write?'POST':'GET',credentials:'same-origin',cache:'no-store',
  keepalive:write&&new TextEncoder().encode(body).byteLength<60000,signal:AbortSignal.timeout(25000),
  ...(write?{headers:{'Content-Type':'application/json'},body}:{})});
 const data=await response.json();
 if(epoch!==authEpoch){const error=new Error('로그인 상태가 변경되었습니다.');error.status=401;throw error;}
 if(!response.ok){const error=new Error(data.error||'연결을 확인하고 다시 시도해 주세요.');error.status=response.status;throw error;}
 return data;
}
function dispose(){workspace?.dispose();workspace=null;mode=null;}
function login(message){
 dispose();state=null;identity.replaceChildren();endAt=0;
 const link=el('a',{class:'btn primary',href:'/api/ecosystem?op=login'},'구글 계정으로 로그인');
 main.replaceChildren(el('section',{class:'login'},el('p',{class:'eyebrow'},'2026학년도 2학기 · 통합과학2 수행평가'),
  el('h2',{},'먹이 관계로 연결된 생태계,\n변화와 회복을 예측해 봅시다.'),
  el('div',{class:'steps'},['상황 읽고 먹이사슬 작성','변화·회복 예측','정리하기'].map(x=>el('span',{},x))),
  el('p',{},'학생은 학교 구글 계정으로 로그인하세요. 담당 분반의 응시 시간이 열리면 시작할 수 있습니다.'),
  el('p',{class:'help'},'승인된 교사 계정은 같은 버튼으로 교사용 화면에 들어갑니다.'),
  message?el('p',{role:'alert'},message):null,el('div',{class:'actions'},link)));
}
function waiting(title,message,extra){
 dispose();endAt=0;
 main.replaceChildren(el('section',{class:'waiting'},el('p',{class:'eyebrow'},'통합과학2 · 생태계 평형'),
  el('h2',{},title),el('p',{},message),extra||null));
}
function clock(){
 const node=document.querySelector('[data-clock]');
 if(!node)return;
 const ms=Math.max(0,endAt-performance.now());
 const seconds=Math.ceil(ms/1000);
 node.textContent=demo?'교사용 데모':Math.floor(seconds/60)+'분 '+String(seconds%60).padStart(2,'0')+'초 남음';
 if(!demo&&ms<=0&&state?.status==='active'){
  seenTime=Math.max(seenTime,Date.parse(state.deadline));
  state={role:'student',student:state.student,status:'closed',server_time:state.deadline};
  waiting('응시 시간이 종료되었습니다.','서버에 저장된 답안은 보관됩니다. 선생님에게 안내를 받아 주세요.');
  void reload();
 }
}
function apply(next,action){
 const stamp=Date.parse(next.server_time||'');
 if(Number.isFinite(stamp)&&stamp<seenTime)return;
 const sameStudent=state?.role==='student'&&next.role==='student'&&state.student.id===next.student.id;
 if(sameStudent&&state.status==='completed'&&next.status!=='completed')return;
 if(sameStudent&&state.status==='closed'&&next.status==='active'&&action)return;
 if(Number.isFinite(stamp))seenTime=stamp;
 state=next;
 if(next.role==='teacher'){
  identity.replaceChildren(el('span',{},next.teacher.name+' 선생님'),button('로그아웃',logout,'quiet'));
  if(demo)return;
  if(mode==='teacher')workspace.update(next,action);
  else{dispose();mode='teacher';workspace=new TeacherWorkspace(main,next,api,command,{notice,reload,demo:startDemo});}
  return;
 }
 identity.replaceChildren(el('span',{},next.student.section+'팩 · '+next.student.id+' '+next.student.name),button('로그아웃',logout,'quiet'));
 if(document.hidden&&next.status==='active'){dispose();return;}
 if(next.status==='active'){
  endAt=performance.now()+Math.max(0,Date.parse(next.deadline)-Date.parse(next.server_time));
  if(mode==='student')workspace.update(next,action);
  else{dispose();mode='student';workspace=new StudentWorkspace(main,next,command,{clock});}
  clock();return;
 }
 if(next.status==='completed'){
  waiting('제출이 완료되었습니다.','최종 제출한 답안은 수정하거나 다시 열 수 없습니다.',
   el('p',{class:'help'},'접수 시각 '+formatTime(next.receipt.submitted_at)+' · 접수 번호 '+next.receipt.id.slice(0,8)));return;
 }
 if(next.status==='ready'){
  waiting('수행평가를 시작할 수 있습니다.','시작하면 상황 하나가 무작위로 배정됩니다. 먹이사슬 확정 전에 상황을 한 번 바꿀 수 있습니다.',
   el('div',{class:'actions'},button('수행평가 시작하기',()=>command('start',{}),'primary')));
  return;
 }
 waiting(next.status==='closed'?'응시 시간이 종료되었습니다.':'응시 시간을 기다려 주세요.',next.message,
  el('div',{class:'actions'},button('응시 시간 다시 확인',reload)));
}
async function reload(reason){
 if(demo)return;
 try{apply(await api('state'),reason==='conflict'?'conflict':undefined);}
 catch(error){
  if(error.status===401){login(new URLSearchParams(location.search).get('login')==='failed'?'로그인을 완료하지 못했습니다. 계정을 다시 선택해 주세요.':null);return;}
  if(error.status===403){
   waiting('계정을 확인해 주세요.',error.message,el('div',{class:'actions'},button('다른 구글 계정으로 로그인',async()=>{await logout();location.href='/api/ecosystem?op=login';},'primary')));return;
  }
  if(!state)login('연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  else notice(error.message,true);
 }
}
function command(op,payload={}){
 const job=serial.catch(()=>{}).then(async()=>{
  try{
   const data=await api(op,{...payload,revision:payload.revision??state?.revision});
   apply(data,op);return data;
  }catch(error){notice(error.message,true);if([401,403,409].includes(error.status))await reload(error.status===409?'conflict':undefined);return null;}
 });
 serial=job;return job;
}
async function logout(){
 authEpoch++;demo=false;dispose();seenTime=0;state=null;
 try{await api('logout',{});}catch(error){notice(error.message,true);}
 login();
}
function startDemo(data){
 demo=true;dispose();
 const initial=()=>({role:'student',student:{id:'DEMO',name:'교사용 체험',section:'데모'},status:'active',
  case:data.case,rerolls:0,revision:0,chain:null,answered:0,draft:{},frames:[],answers:[],essay_prompt:data.essay_prompt,
  deadline:new Date(Date.now()+3600000).toISOString(),server_time:new Date().toISOString()});
 let sample=initial();
 function derive(){
  if(sample.chain){
   sample.observed_step=sample.answered+1;sample.prediction_total=5;
   sample.model_chain=data.solution.chain;sample.frames=data.solution.frames.slice(0,sample.answered+2);
   sample.question=sample.answered<5?{step:sample.answered+2,phase:sample.answered<2?'change':'recovery',
    target:data.solution.frames[sample.answered+2].targetRole,target_name:data.solution.role_names[data.solution.frames[sample.answered+2].targetRole]}:null;
  }
  return sample;
 }
 const back=()=>{demo=false;dispose();if(state?.role==='teacher')apply(state,'return');void reload();};
 const reset=()=>{workspace?.dispose();sample=initial();mount();};
 const reveal=()=>{
  sample.chain=data.solution.chain.map(o=>o.id);sample.answered=5;
  sample.answers=data.solution.frames.slice(2).map((f,i)=>({step:i+2,choice:f.expectedChoice,reason:f.explanation}));
  derive();workspace.update(sample,'answer');workspace.view='explore';workspace.stage=1;workspace.render();
 };
 const send=async(op,payload={})=>{
  if(op==='draft')sample.draft=payload.draft;
  else if(op==='chain'){sample.chain=[...payload.chain];sample.draft={};}
  else if(op==='answer'){sample.answers.push({step:payload.step,choice:payload.choice,reason:payload.reason});sample.answered++;sample.draft={};}
  else if(op==='reroll'){notice('다른 상황은 교사 화면의 전체 상황에서 선택하세요.');return sample;}
  else if(op==='submit'){notice('데모 체험을 마쳤습니다. 실제 답안은 저장되지 않았습니다.');back();return null;}
  derive();workspace.update(sample,op);return sample;
 };
 function mount(){mode='demo';workspace=new StudentWorkspace(main,derive(),send,{demo:true,back,reset,showAnswers:reveal,clock});}
 mount();
}
document.addEventListener('visibilitychange',()=>{
 if(demo||state?.role!=='student')return;
 if(document.hidden&&state.status==='active'){
  void workspace?.flushDraft();dispose();
  main.replaceChildren(el('section',{class:'waiting'},'화면으로 돌아오면 응시 상태를 다시 확인합니다.'));
 }else if(!document.hidden)void reload();
});
window.addEventListener('pageshow',event=>{if(event.persisted){dispose();main.replaceChildren(el('div',{class:'waiting'},'응시 상태를 다시 확인합니다.'));void reload();}});
window.addEventListener('online',()=>void reload());
setInterval(()=>{if(!document.hidden&&!demo)void reload();},6000);
setInterval(clock,1000);
void reload();
