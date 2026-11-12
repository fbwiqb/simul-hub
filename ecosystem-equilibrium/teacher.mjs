import {el,button,field,formatTime,download,csvCell,directionNames} from './ui.mjs';
export const periods=[['1','1교시','08:40','09:30'],['2','2교시','09:40','10:30'],['3','3교시','10:40','11:30'],['4A','4교시 A','11:40','12:30'],['4B','4교시 B','12:30','13:20'],['5','5교시','13:30','14:20'],['6','6교시','14:30','15:20'],['7','7교시','15:30','16:20']];
export function periodWindow(date,period,minutes){
 const p=periods.find(x=>x[0]===period);if(!date||!p||!(minutes>0))return null;
 const end=new Date(date+'T'+p[3]+':00+09:00'),start=new Date(end.getTime()-minutes*60000);
 return {opens_at:start.toISOString(),closes_at:end.toISOString()};
}
const todayKst=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export const sectionSchedule={1:'화1 수1 목1 금1',2:'월2 화2 수2 금2',3:'월4A 수4A 목4A 금4A',4:'월5 화5 수5 목5',5:'화1 수1 목1 금1',6:'월1 화2 목2 금2',7:'월5 수5 목5 금5',8:'월1 수1 목1 금1',9:'월2 화2 수2 목2',10:'월4A 화4A 목4A 금4A',11:'화2 수2 목2 금2',12:'월4A 화4A 수4A 목4A',13:'월5 화5 수5 금5',14:'화6 수6 목6 금6',15:'화2 수2 목2 금2'};
const weekdays='일월화수목금토';
export function classSlots(section,nowMs,days=21){
 const plan=(sectionSchedule[section]||'').split(' ').filter(Boolean).map(x=>({day:weekdays.indexOf(x[0]),period:x.slice(1)}));
 const out=[],base=new Date(nowMs+9*3600000);
 for(let i=0;i<days;i++){
  const d=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()+i)),date=d.toISOString().slice(0,10);
  for(const x of plan.filter(x=>x.day===d.getUTCDay())){
   const p=periods.find(q=>q[0]===x.period);if(!p||new Date(date+'T'+p[3]+':00+09:00').getTime()<=nowMs)continue;
   out.push({date,period:x.period,label:(d.getUTCMonth()+1)+'/'+d.getUTCDate()+'('+weekdays[d.getUTCDay()]+') '+p[1]+' '+p[2]+'~'+p[3]});
  }
 }
 return out;
}
const table=(headers,rows)=>el('table',{},el('thead',{},el('tr',{},headers.map(h=>el('th',{},h)))),
 el('tbody',{},rows.map(cells=>el('tr',{},cells.map(c=>el('td',{},c))))));

export function progressLabel(x,closed){
 if(x.submitted_at)return '제출 완료';
 if(!x.started_at)return '미응시';
 if(!closed)return '진행 중 · 예측 '+x.answered+'/5';
 if(x.answered===5)return '예측 완료 · 미제출';
 return '미완료 · '+(x.chain_confirmed?'예측 '+x.answered+'/5':'먹이사슬 미확정');
}

export class TeacherWorkspace{
 constructor(container,state,api,command,options){
  this.container=container;this.state=state;this.api=api;this.command=command;this.options=options;this.filter='all';this.render();
 }
 dispose(){this.disposed=true;this.container.replaceChildren();}
 update(state,action){this.state=state;if(action)this.render();else this.live();}
 render(){
  if(this.disposed)return;
  const s=this.state;
  const heading=el('div',{class:'teacher-head'},el('div',{},el('h2',{},'교사용 수행평가 관리'),el('p',{class:'help'},'한국 시간 기준 · 확정 답안은 학생이 수정할 수 없습니다.')),
   el('div',{class:'actions'},button('새로고침',()=>this.options.reload()),button('원본 백업 내려받기',()=>this.export('json')),button('채점용 CSV',()=>this.export('csv'))));
  this.statBox=el('div',{class:'stat-list'});
  this.tableBox=el('div',{class:'table-wrap'});
  const filter=el('select',{'aria-label':'진행 현황 분반 선택',onChange:event=>{this.filter=event.target.value;this.live();}},
   el('option',{value:'all',selected:this.filter==='all'},'담당 분반 전체'),
   s.sections.map(x=>el('option',{value:String(x.id),selected:this.filter===String(x.id)},x.label)));
  const progress=el('section',{class:'card full'},el('div',{class:'teacher-head'},el('h2',{},'학생 진행 현황'),filter),this.statBox,this.tableBox);
  this.windowsBox=el('div',{class:'windows'});
  const section=el('select',{'aria-label':'응시 시간을 열 분반'},s.sections.map(x=>el('option',{value:x.id},x.label+' · '+x.teacher_name)));
  const slot=el('select',{'aria-label':'수업 시간'});
  const minutes=el('input',{type:'number',min:1,max:50,value:20,required:true,'aria-label':'응시 시간(분)'});
  const preview=el('p',{class:'help'});
  const hm=iso=>new Date(new Date(iso).getTime()+9*3600000).toISOString().slice(11,16);
  const chosen=()=>{const [date,period]=slot.value.split('|');return periodWindow(date,period,Number(minutes.value));};
  const showPreview=()=>{const w=chosen();preview.textContent=w?'학생 접속 가능: '+slot.value.split('|')[0]+' '+hm(w.opens_at)+' ~ '+hm(w.closes_at)+' (교시 끝에서 '+minutes.value+'분)':'앞으로 3주 안에 이 분반 수업이 없습니다. 지금부터 열기를 쓰세요.';};
  const fillSlots=()=>{slot.replaceChildren(...classSlots(Number(section.value),Date.now()).map(x=>el('option',{value:x.date+'|'+x.period},x.label)));showPreview();};
  section.addEventListener('change',fillSlots);slot.addEventListener('change',showPreview);minutes.addEventListener('input',showPreview);fillSlots();
  const open=async startNow=>{
   if(startNow){if(!Number(minutes.value)){this.options.notice('응시 시간(분)을 입력해 주세요.',true);return;}
    await this.command('teacher_window',{section:Number(section.value),start_now:true,minutes:Number(minutes.value)});return;}
   const w=chosen();
   if(!w){this.options.notice('수업 시간과 응시 시간(분)을 골라 주세요.',true);return;}
   await this.command('teacher_window',{section:Number(section.value),start_now:false,...w});
  };
  const scheduling=el('section',{class:'card'},el('h2',{},'분반별 응시 시간'),
   field('분반',section),el('div',{class:'form-row'},field('수업 시간',slot),field('응시 시간(분)',minutes)),preview,
   el('div',{class:'actions'},button('이 수업 시간에 열기',()=>open(false),'primary'),button('지금부터 열기',()=>open(true))),
   el('p',{class:'help'},'제출한 학생은 다시 응시할 수 없습니다. 결시나 기기 고장은 진행 현황의 보충 열기로 그 학생만 다시 엽니다.'),
   this.windowsBox);
  const demoSelect=el('select',{'aria-label':'교사용 데모 상황'},s.cases.map(c=>el('option',{value:c.id},c.title)));
  const demo=el('section',{class:'card'},el('h2',{},'전체 상황 · 데모'),
   el('p',{},'10개 생태계, 60개 상황을 자유롭게 확인할 수 있습니다. 학생처럼 예측하거나 전체 과정의 해설을 볼 수 있습니다.'),
   field('상황 선택',demoSelect),el('div',{class:'actions'},button('이 상황 체험하기',async()=>{
    const data=await this.api('teacher_demo',{case_id:demoSelect.value});this.options.demo(data);
   },'primary')),el('p',{class:'help'},'데모는 학생 응시 기록을 만들지 않습니다.'));
  const children=[heading,el('div',{class:'teacher-grid'},scheduling,demo,progress)];
  if(s.teacher.admin)children.push(this.teacherApproval());
  children.push(el('p',{class:'help'},'원본 백업에는 분반 명부, 문제·모형 버전, 확정 답안, 작성 중인 내용, 접수 시각과 관리 기록이 포함됩니다. Supabase 밖의 선생님 PC에 보관하세요.'));
  this.container.replaceChildren(...children);this.live();
 }
 live(){
  if(this.disposed)return;
  const s=this.state,students=s.roster.filter(x=>this.filter==='all'||x.section===Number(this.filter));
  const done=students.filter(x=>x.submitted_at).length,started=students.filter(x=>x.started_at&&!x.submitted_at).length;
  this.statBox.replaceChildren(...[['대상',students.length],['미응시',students.length-started-done],['진행·시간 종료',started],['제출 완료',done]].map(([name,n])=>el('div',{class:'stat'},name,el('b',{},n))));
  this.tableBox.replaceChildren(table(['분반','학번','이름','진행','마지막 저장','기록'],students.map(x=>{
   const closed=x.started_at&&!x.submitted_at&&(x.window_closed||new Date(x.deadline)<=new Date(s.server_time));
   const status=progressLabel(x,closed);
   return [x.section+'팩',x.id,el('span',{},x.name,x.note?el('small',{class:'help'},' · 명부 확인'):null),status,formatTime(x.updated_at),
    el('div',{class:'actions'},button('답안 보기',()=>this.record(x.id),'',!x.started_at),
     x.submitted_at?null:button('보충 열기',()=>this.makeup(x)))];
  })));
  this.windowsBox.replaceChildren(...s.windows.map(w=>el('div',{class:'window-item'},
   el('span',{},w.section_id+'팩 · '+(w.student_id?w.student_id+' 보충 · ':'')+formatTime(w.opens_at)+' ~ '+formatTime(w.closes_at),
    el('small',{class:'help'},w.closed?' · 종료 처리됨':new Date(w.closes_at)<=new Date(s.server_time)?' · 시간 종료':' · 예약/진행')),
   button('종료',()=>this.command('teacher_close',{window_id:w.id}),'danger',w.closed||new Date(w.closes_at)<=new Date(s.server_time)))));
 }
 makeup(x){
  const dialog=el('dialog',{class:'record','aria-label':x.name+' 보충 열기'});
  dialog.addEventListener('close',()=>dialog.remove());
  const minutes=el('input',{type:'number',min:1,max:180,value:20,required:true});
  const reason=el('input',{required:true,minLength:2,placeholder:'결시, 기기 고장 등'});
  dialog.append(el('div',{class:'record-head'},el('h2',{},x.section+'팩 · '+x.id+' '+x.name+' 보충'),button('닫기',()=>dialog.close())),
   el('p',{class:'help'},'지금부터 이 학생만 응시할 수 있습니다. 확정한 답은 유지되고 못 한 단계부터 이어서 합니다.'),
   el('form',{onSubmit:async event=>{event.preventDefault();await this.command('teacher_makeup',{student_id:x.id,minutes:Number(minutes.value),reason:reason.value});dialog.close();}},
    el('div',{class:'form-row'},field('응시 시간(분)',minutes),field('사유',reason)),
    el('button',{class:'btn primary',type:'submit'},'이 학생만 열기')));
  document.body.append(dialog);dialog.showModal();
 }
 teacherApproval(){
  const s=this.state;
  const email=el('input',{type:'email',required:true,placeholder:'teacher@cnsa.hs.kr','aria-label':'승인할 교사 구글 계정'});
  const name=el('input',{required:true,placeholder:'교사 이름','aria-label':'교사 이름'});
  const enabled=el('input',{type:'checkbox',checked:true,'aria-label':'로그인 허용'});
  const checks=s.sections.map(section=>({section,input:el('input',{type:'checkbox',value:section.id})}));
  const form=el('form',{onSubmit:async event=>{
   event.preventDefault();await this.command('teacher_approve',{email:email.value.trim().toLowerCase(),name:name.value.trim(),
    sections:checks.filter(x=>x.input.checked).map(x=>x.section.id),enabled:enabled.checked});
  }},el('div',{class:'form-row'},field('교사 구글 계정',email),field('이름',name)),
   el('p',{class:'help'},'허용할 담당 분반을 선택하세요. 이미 등록한 계정은 같은 이메일로 변경할 수 있습니다.'),
   el('div',{class:'checks'},checks.map(x=>el('label',{},x.input,x.section.id+'팩'))),
   el('div',{class:'actions'},el('label',{},enabled,' 로그인 허용'),el('button',{type:'submit',class:'btn primary'},'교사 승인·변경')));
  return el('section',{class:'card',style:'margin-top:22px'},el('h2',{},'교사 계정 승인'),form,
   el('div',{class:'table-wrap'},table(['이름','구글 계정','담당','상태'],(s.teachers||[]).map(t=>[
    t.name,t.email,t.admin?'관리자 · 전체':t.section_ids.map(n=>n+'팩').join(', '),t.enabled?'허용':'중지'
   ]))));
 }
 async record(studentId){
  const data=await this.api('teacher_record',{student_id:studentId});
  const a=data.attempt,c=data.case,s=data.student;
  const close=()=>dialog.close();
  const dialog=el('dialog',{class:'record','aria-label':s.name+' 답안'});
  dialog.addEventListener('close',()=>dialog.remove());
  dialog.append(el('div',{class:'record-head'},el('h2',{},s.section_id+'팩 · '+s.student_id+' '+s.name),button('닫기',close)));
  if(!a){dialog.append(el('p',{},'아직 응시하지 않았습니다.'));document.body.append(dialog);dialog.showModal();return;}
  const labels=new Map(c.public.organisms.map(o=>[o.id,o.label]));
  dialog.append(el('p',{},c.public.title+' · '+(a.submitted_at?'최종 제출 '+formatTime(a.submitted_at):'미제출')),
   el('h3',{},'먹이사슬 · 첫 확정 답안'),el('p',{},a.chain?a.chain.map(id=>labels.get(id)||id).join(' → '):'미확정'),
   el('p',{class:'help'},'모형: '+c.solution.chain.map(o=>o.label).join(' → ')));
  dialog.append(el('h3',{},'1단계 · 제시된 상황'),el('p',{},c.solution.frames[1].explanation));
  for(const answer of data.answers||[]){
   const frame=c.solution.frames[answer.step];
   dialog.append(el('h3',{},(answer.step<=3?'변화':'회복')+' '+answer.step+'단계 · '+directionNames[answer.choice]),
    el('pre',{},answer.reason),el('p',{class:'help'},'모형: '+directionNames[frame.expectedChoice]+' · '+frame.explanation),
    el('p',{class:'help'},'확정 시각 '+formatTime(answer.confirmed_at)));
  }
  if(!a.submitted_at){
   if(a.draft?.reason)dialog.append(el('h3',{},'작성 중인 이유 · 미확정'),el('pre',{},a.draft.reason));
  }
  dialog.append(el('div',{class:'actions'},button('인쇄 / PDF로 저장',()=>window.print(),'quiet')));
  document.body.append(dialog);dialog.showModal();
 }
 async export(format){
  const data=await this.api('teacher_export');
  const now=new Date().toISOString().slice(0,10);
  if(format==='json'){
   const encoded=JSON.stringify(data,null,2),verified=JSON.parse(encoded);
   if(verified.format!=='cnsa-ecosystem-assessment-v2'||!Array.isArray(verified.students||[]))throw new Error('백업 자료를 확인하지 못했습니다.');
   download(encoded,'통합과학2_생태계_원본백업_'+now+'.json');
   this.options.notice('원본 백업을 내려받았습니다. 학생 명부와 답안 수를 확인해 보관하세요.');return;
  }
  const cases=new Map(data.cases.map(c=>[c.id,c]));
  const attempts=new Map((data.attempts||[]).map(a=>[a.student_id,a]));
  const headers=['분반','학번','이름','상황','먹이사슬 첫 답안','1단계 제시 상황',...Array.from({length:5},(_,i)=>[(i+2)+'단계 선택',(i+2)+'단계 이유',(i+2)+'단계 확정시각']).flat(),'상태','최종 제출시각'];
  const rows=(data.students||[]).map(s=>{
   const a=attempts.get(s.student_id),c=a?cases.get(a.case_id):null;
   const labels=new Map((c?.public_data.organisms||[]).map(o=>[o.id,o.label]));
   const answers=(data.answers||[]).filter(x=>x.student_id===s.student_id);
   return [s.section_id,s.student_id,s.name,c?.title||'',a?.chain?.map(id=>labels.get(id)||id).join(' → ')||'',c?.public_data.article.event||'',
    ...Array.from({length:5},(_,i)=>{const r=answers.find(x=>x.step===i+2);return[r?directionNames[r.choice]:'',r?.reason||'',r?.confirmed_at||''];}).flat(),
    progressLabel({submitted_at:a?.submitted_at,started_at:a?.started_at,answered:answers.length,chain_confirmed:!!a?.chain},true),a?.submitted_at||''];
  });
  download('\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n'),'통합과학2_생태계_채점자료_'+now+'.csv','text/csv;charset=utf-8');
 }
}
