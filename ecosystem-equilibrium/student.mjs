import {el,button,roleNames,directionNames} from './ui.mjs';
import {pyramidSvg} from './pyramid.mjs';
const roles=['producer','primary','secondary'];
const roleLabel=role=>roleNames[role].replace(' 자원량','');
const layerNames=['맨 아래층','가운데 층','맨 위층'];
const observedStep=state=>state.observed_step??(state.chain?Math.min(6,(state.answered||0)+1):0);
const backupPrefix='eco2026-unsaved:';
const sameDraft=(a={},b={})=>JSON.stringify([a.chain||[],a.choice||'',a.reason||'',a.essay||''])===JSON.stringify([b.chain||[],b.choice||'',b.reason||'',b.essay||'']);
export function clearUnsaved(studentId){
 try{
  if(studentId){localStorage.removeItem(backupPrefix+studentId);return;}
  const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
  for(const key of keys)if(key?.startsWith(backupPrefix))localStorage.removeItem(key);
 }catch{}
}

export class StudentWorkspace {
 constructor(container,state,command,options={}){
  this.container=container;this.command=command;this.options=options;this.view='situation';this.stage=0;this.busy=false;
  this.adopt(state,true);this.render();
  if(this.dirty)this.saveTimer=setTimeout(()=>void this.saveDraft(),650);
 }
 adopt(state,reset=false){
  const changed=this.state?.case?.id!==state.case?.id;
  if(reset||changed){
   this.view=state.chain?'explore':'situation';
   this.stage=(state.draft?.reason||state.draft?.choice)&&state.question?state.question.step:observedStep(state);
   this.chainDraft=[...(state.chain||state.draft?.chain||[])];this.resetPlacement();
   this.reason=state.draft?.reason||'';this.choice=state.draft?.choice||'';this.essay=state.draft?.essay||'';
   this.draftBaseRevision=state.revision;this.dirty=false;this.draftGeneration=0;
   this.restoreBackup(state);
  }
  if(state.chain)this.chainDraft=[...state.chain];
  this.state=state;
 }
 update(state,action){
  const previous=this.state;
  const sameActivity=previous?.case?.id===state.case?.id&&previous?.answered===state.answered&&
   Boolean(previous?.chain)===Boolean(state.chain)&&previous?.deadline===state.deadline;
  this.adopt(state);
  if(action==='draft'){this.draftBaseRevision=state.revision;return;}
  if(action==='conflict'){
   if(this.dirty)this.conflictDraft={reason:this.reason,essay:this.essay};
   this.syncDraft(state);this.clearBackup();this.render();return;
  }
  if(!action&&sameActivity){
   if(!this.dirty&&!this.saving&&previous.revision!==state.revision){this.syncDraft(state);this.patchDraft();}
   else if(this.dirty&&this.saveFailed&&!this.saving){this.saveFailed=false;void this.saveDraft();}
   return;
  }
  if(action&&['answer','chain','reroll'].includes(action)){this.dirty=false;this.draftBaseRevision=state.revision;this.saveStatus='';this.clearBackup();}
  if(action==='answer'||state.answered>(previous?.answered||0)){
   clearTimeout(this.saveTimer);this.dirty=false;this.draftBaseRevision=state.revision;
   this.reason='';this.choice='';this.stage=observedStep(state);this.view='explore';
  }
  if(action==='chain'||(state.chain&&!previous?.chain)){this.chainDraft=[...state.chain];this.stage=1;this.view='explore';}
  this.render();
 }
 syncDraft(state){
  const chain=[...(state.chain||state.draft?.chain||[])];
  if(JSON.stringify(chain)!==JSON.stringify(this.chainDraft))this.resetPlacement();
  this.chainDraft=chain;
  this.reason=state.draft?.reason||'';this.choice=state.draft?.choice||'';this.essay=state.draft?.essay||'';
  this.draftBaseRevision=state.revision;this.dirty=false;
 }
 patchDraft(){
  for(const [id,value] of [['prediction-reason',this.reason],['interpretation',this.essay]]){
   const input=this.container.querySelector('#'+id);
   if(input&&input.value!==value){
    const focused=document.activeElement===input,start=input.selectionStart,end=input.selectionEnd;
    input.value=value;if(focused)input.setSelectionRange(Math.min(start,value.length),Math.min(end,value.length));
   }
  }
  for(const b of this.container.querySelectorAll('[data-choice]')){
   const selected=b.dataset.choice===this.choice;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
  }
  if(this.confirmButton?.isConnected)this.confirmButton.disabled=!this.choice||!this.reason.trim()||this.busy;
  if(this.view==='situation'&&!this.state.chain)this.render();
 }
 conflictNotice(){
  if(!this.conflictDraft)return document.createDocumentFragment();
  return el('details',{class:'feedback'},el('summary',{},'다른 창의 최신 초안을 불러왔습니다. 이 창의 미저장 글 보기'),
   el('pre',{style:'white-space:pre-wrap'},[this.conflictDraft.reason,this.conflictDraft.essay].filter(Boolean).join('\n\n')));
 }
 dispose(){this.disposed=true;clearTimeout(this.saveTimer);this.container.replaceChildren();}
 async send(action,payload={}){
  if(this.busy)return;
  clearTimeout(this.saveTimer);this.busy=true;this.render();
  try{await this.command(action,payload);}
  finally{this.busy=false;if(this.state.status==='active'&&this.container.isConnected)this.render();}
 }
 backupKey(state=this.state){return this.options?.demo||!state?.student?.id?null:backupPrefix+state.student.id;}
 writeBackup(){
  const key=this.backupKey();if(!key)return;
  try{localStorage.setItem(key,JSON.stringify({case:this.state.case?.id,answered:this.state.answered||0,chained:Boolean(this.state.chain),
   base:this.draftBaseRevision,draft:{chain:[...this.chainDraft],choice:this.choice,reason:this.reason,essay:this.essay}}));}catch{}
 }
 clearBackup(state=this.state){if(this.backupKey(state))clearUnsaved(state.student.id);}
 restoreBackup(state){
  const key=this.backupKey(state);if(!key)return;
  let backup;try{backup=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(!backup?.draft)return;
  if(backup.case!==state.case?.id||backup.answered!==(state.answered||0)||backup.chained!==Boolean(state.chain)||sameDraft(backup.draft,state.draft)){
   this.clearBackup(state);return;
  }
  if(backup.base!==state.revision){
   if(backup.draft.reason||backup.draft.essay)this.conflictDraft={reason:backup.draft.reason,essay:backup.draft.essay};
   return;
  }
  if(!state.chain)this.chainDraft=[...(backup.draft.chain||[])];
  this.reason=backup.draft.reason||'';this.choice=backup.draft.choice||'';this.essay=backup.draft.essay||'';
  if(state.chain&&state.question&&(this.reason||this.choice))this.stage=state.question.step;
  this.dirty=true;this.draftGeneration=1;this.saveStatus='이 기기에 보관한 글을 불러왔습니다. 서버에 저장하는 중…';
 }
 setStatus(text){this.saveStatus=text;if(this.saved)this.saved.textContent=text;}
 queueDraft(){
  this.dirty=true;this.draftGeneration++;this.writeBackup();
  this.setStatus('저장 중…');
  clearTimeout(this.saveTimer);
  this.saveTimer=setTimeout(()=>void this.saveDraft(),650);
 }
 async saveDraft(force=false){
  if(!this.dirty||(this.disposed&&!force))return null;
  if(this.saving){
   if(force)return this.inFlight.then(()=>this.saveDraft(true));
   this.saveTimer=setTimeout(()=>void this.saveDraft(),650);return null;
  }
  const generation=this.draftGeneration,revision=this.draftBaseRevision;
  const draft={chain:[...this.chainDraft],choice:this.choice,reason:this.reason,essay:this.essay};
  this.saving=true;
  this.inFlight=(async()=>{
   try{
    const result=await this.command('draft',{draft,revision});
    if(!result)throw new Error('Draft was not saved');
    if(result.status!=='active')return result;
    this.draftBaseRevision=result.revision;
    if(this.draftGeneration===generation){this.dirty=false;this.clearBackup();}
    this.saveFailed=false;this.setStatus(this.dirty?'저장 중…':'서버에 임시 저장됨');
    if(this.dirty&&!this.disposed)this.saveTimer=setTimeout(()=>void this.saveDraft(),650);
    return result;
   }catch{
    this.saveFailed=true;
    this.setStatus(this.backupKey()?'연결이 끊겨 이 기기에 임시 보관했습니다. 연결되면 자동으로 저장합니다. 이 창을 닫지 마세요.':'아직 저장되지 않았습니다. 연결 후 다시 입력하거나 확정해 주세요.');
    return null;
   }
   finally{this.saving=false;}
  })();
  return this.inFlight;
 }
 flushDraft(){
  clearTimeout(this.saveTimer);
  if(!this.dirty)return null;
  return this.saveDraft(true);
 }
 chooseView(view){this.view=view;this.render();}
 render(){
  const s=this.state;if(this.disposed||s.status!=='active')return;
  const article=s.case.article;
  const tabs=el('nav',{class:'tabs','aria-label':'수행평가 활동',role:'tablist'});
  for(const [view,label,disabled] of [
   ['situation','상황 페이지',false],['explore','탐구 '+(s.answered||0)+'/5',!s.chain]]){
   const b=button(label,()=>this.chooseView(view),'',disabled);
   b.className='';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(this.view===view));
   b.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const available=[...tabs.querySelectorAll('button:not(:disabled)')];
    let i=available.indexOf(b);i=event.key==='Home'?0:event.key==='End'?available.length-1:(i+(event.key==='ArrowRight'?1:-1)+available.length)%available.length;
    available[i].click();available[i].focus();
   });tabs.append(b);
  }
  const context=el('section',{class:'context'},
   el('div',{},el('h2',{},s.case.title),el('p',{},article.event)),
   el('div',{class:'clock','data-clock':true},'응시 시간 확인 중…'));
  const body=this.view==='explore'&&s.chain?this.explore():this.situation();
  const nodes=[];
  if(this.options.demo)nodes.push(el('aside',{class:'demo-note'},
   el('span',{},'교사용 데모 · 체험 내용은 학생 답안으로 저장되지 않습니다.'),
   button('처음부터 체험',this.options.reset,'quiet'),button('전체 과정 해설',this.options.showAnswers),button('교사 화면으로',this.options.back)));
  nodes.push(context,tabs,body);
  this.container.replaceChildren(...nodes);
  this.options.clock?.();
 }
 situation(){
  const s=this.state,a=s.case.article;
  const story=el('article',{class:'card article'},
   el('p',{class:'eyebrow'},'개체군 관찰 자료 · 학습용 가상 사례'),
   el('h2',{},a.headline),el('p',{},a.lead),
   el('img',{src:s.case.image,alt:s.case.title+'의 서식환경과 생물을 표현한 삽화',loading:'eager'}),
   el('p',{class:'help'},'서식환경을 표현한 개념 삽화입니다. 생물의 크기와 수는 실측 비율이 아닙니다.'),
   el('div',{class:'profiles','aria-label':'사례 속 생물'},s.case.organisms.map(o=>el('figure',{class:'profile'},
    o.image?el('img',{src:o.image,alt:o.label,loading:'lazy'}):null,el('figcaption',{},o.label)))),
   el('h3',{},'변화 전의 관찰'),a.before.map(p=>el('p',{},p)),
   el('h3',{},'한 구역에서 생긴 변화'),el('p',{},a.change),
   el('h3',{},'변화 후의 관찰'),a.after.map(p=>el('p',{},p)),el('p',{},a.question));
  const sources=el('details',{class:'article-source'},el('summary',{},'자료 출처'));
  for(const source of s.case.sources)sources.append(el('p',{},el('a',{href:source.url,target:'_blank',rel:'noopener noreferrer'},source.title)));
  story.append(sources);
  const labels=new Map(s.case.organisms.map(o=>[o.id,o.label]));
  const work=el('section',{class:'card'},el('h2',{},'먹이사슬 작성하기'),this.conflictNotice());
  if(s.chain){
   const modelNames=Object.fromEntries(s.model_chain.map(o=>[o.role,o.label]));
   work.append(el('p',{class:'help'},'첫 답안을 확정했습니다. 내가 만든 피라미드와 모형을 비교해 보세요.'),
    el('div',{class:'chain-compare'},
     this.chainPyramid('내 피라미드',roles.map((_,i)=>labels.get(s.chain[i]))),
     this.chainPyramid('모형 피라미드',roles.map(role=>modelNames[role]))),
    el('div',{class:'actions'},button('탐구 시작하기',()=>this.chooseView('explore'),'primary')));
  }else{
   const candidates=el('div',{class:'organisms','aria-label':'사례 속 생물 목록'});
   for(const o of s.case.organisms){
    if(this.chainDraft.includes(o.id))continue;
    const b=button(o.label,()=>this.pickCard(o.id),this.picked===o.id?'selected':'',this.busy);
    b.setAttribute('aria-pressed',String(this.picked===o.id));candidates.append(b);
   }
   const chain=el('div',{class:'chain','aria-label':'역할별 생물'});
   roles.forEach((role,i)=>{
    const id=this.chainDraft[i];
    const b=button(id?roleLabel(role)+': '+labels.get(id):roleLabel(role),()=>this.assignRole(i),'',this.busy);
    b.className='slot'+(id?' filled':'');chain.append(b);
   });
   work.append(el('h3',{},'1. 역할 정하기'),
    el('p',{class:'help'},'사례의 행동과 먹이 단서를 연결해, 생물 카드를 누른 뒤 알맞은 역할 칸을 누르세요.'),candidates,chain);
   if(this.chainMatched)work.append(el('h3',{},'2. 피라미드에 놓기'),
    el('p',{class:'help'},'역할 카드를 누른 뒤 피라미드에서 알맞은 층을 누르세요.'),this.placementBoard(labels));
   if(this.chainNotice)work.append(el('p',{class:'help chain-notice',role:'status'},this.chainNotice));
   work.append(el('p',{class:'help'},'확정하면 첫 먹이사슬이 저장되고, 수정할 수 없습니다.'),
    el('div',{class:'actions'},button(this.busy?'저장 중…':'먹이사슬 확정',()=>this.send('chain',{chain:this.chainDraft}),'primary',!this.chainPlaced||this.busy),
     button('다시 놓기',()=>this.resetChain(),'quiet',this.busy)),
    el('div',{class:'actions'},button(s.rerolls?'상황 바꾸기 사용 완료':'상황 바꾸기 · 1회',()=>this.send('reroll'),'',!!s.rerolls||this.busy)));
  }
  this.saved=el('p',{class:'saved','aria-live':'polite'},this.saveStatus||'');work.append(this.saved);
  return el('div',{class:'two-col'},story,work);
 }
 get chainMatched(){return roles.every((_,i)=>this.chainDraft[i]);}
 get chainPlaced(){return this.chainMatched&&this.placed.length===3;}
 resetPlacement(){this.picked=null;this.pickedRole=null;this.placed=[];this.chainNotice='';}
 resetChain(){this.chainDraft=[];this.resetPlacement();this.render();this.queueDraft();}
 pickCard(id){this.picked=this.picked===id?null:id;this.chainNotice='';this.render();}
 assignRole(i){
  if(!this.picked&&!this.chainDraft[i]){this.chainNotice='먼저 생물 카드를 누르세요.';this.render();return;}
  const next=roles.map((_,n)=>this.chainDraft[n]||null);
  next[i]=this.picked;
  this.chainDraft=next;this.resetPlacement();this.render();this.queueDraft();
 }
 pickRole(i){this.pickedRole=this.pickedRole===i?null:i;this.chainNotice='';this.render();}
 placeOnLayer(layer){
  if(this.placed.includes(layer))return;
  if(this.pickedRole==null)this.chainNotice='먼저 역할 카드를 누르세요.';
  else if(this.pickedRole!==layer)this.chainNotice='그 층이 아닙니다. 먹이가 되는 생물일수록 아래층에 놓입니다.';
  else{this.placed=[...this.placed,layer];this.pickedRole=null;this.chainNotice='';}
  this.render();
 }
 placementBoard(labels){
  const cards=el('div',{class:'organisms','aria-label':'피라미드에 놓을 역할 카드'});
  roles.forEach((role,i)=>{
   if(this.placed.includes(i))return;
   const b=button(roleLabel(role)+': '+labels.get(this.chainDraft[i]),()=>this.pickRole(i),this.pickedRole===i?'selected':'',this.busy);
   b.setAttribute('aria-pressed',String(this.pickedRole===i));cards.append(b);
  });
  const rows=el('div',{class:'pyramid-labels'});
  for(const i of [2,1,0]){
   const done=this.placed.includes(i);
   const b=el('button',{type:'button',class:'pyramid-label '+roles[i]+(done?' placed':''),disabled:done||this.busy,onClick:()=>this.placeOnLayer(i)},
    el('strong',{},done?roleLabel(roles[i]):layerNames[i]),done?el('small',{},labels.get(this.chainDraft[i])):null);
   rows.append(b);
  }
  return el('div',{class:'placement'},cards,el('figure',{class:'diagram pyramid-figure','aria-label':'역할 카드를 놓을 피라미드'},
   el('div',{class:'pyramid-layout'},rows,pyramidSvg([100,100,100],{filled:i=>this.placed.includes(i),onLayer:i=>this.placeOnLayer(i)}))));
 }
 chainPyramid(title,names){
  const rows=el('div',{class:'pyramid-labels'});
  for(const i of [2,1,0])rows.append(el('div',{class:'pyramid-label '+roles[i]},el('strong',{},roleLabel(roles[i])),el('small',{},names[i])));
  return el('figure',{class:'diagram pyramid-figure'},el('figcaption',{class:'help'},title),
   el('div',{class:'pyramid-layout'},rows,pyramidSvg([100,100,100])));
 }
 diagram(values,target=null,reference=values,prediction=false){
  const names=Object.fromEntries(this.state.model_chain.map(o=>[o.role,o.label]));
  const box=el('figure',{class:'diagram pyramid-figure','aria-label':'생태계 피라미드'});
  const labels=el('div',{class:'pyramid-labels'});
  for(const role of [...roles].reverse()){
   labels.append(el('div',{class:'pyramid-label '+role+(target===role?' target':'')},
    el('strong',{},roleNames[role]),el('small',{},names[role])));
  }
  box.append(el('div',{class:'pyramid-layout'},labels,pyramidSvg(values,{reference,target,prediction})),
   el('figcaption',{class:'help'},prediction?'색 면: 내 예측 · 점선: 직전 단계':target?'점선: 직전 단계. 이 층이 점선보다 늘어날지 줄어들지 고르세요.':'색 면: 확인한 상태 · 변한 층의 점선: 직전 단계'),
   el('p',{class:'help'},'층의 폭은 증가와 감소 방향만 나타냅니다. 층끼리 양을 비교하는 그림이 아닙니다.'));
  return box;
 }
 explore(){
  const s=this.state;
  const observed=observedStep(s);
  this.stage=Math.max(0,Math.min(this.stage,s.question?.step??observed));
  const pending=this.stage===s.question?.step;
  const frame=s.frames[pending?observed:this.stage]||s.frames[0];
  const reference=pending?frame.values:(s.frames[Math.max(0,this.stage-1)]||frame).values;
  const shown=[...frame.values];
  if(pending&&this.choice){
   const index=roles.indexOf(s.question.target);
   shown[index]=Math.max(40,Math.min(160,shown[index]+(this.choice==='increase'?30:-30)));
  }
  const phases=el('div',{class:'phases'});
  const stageButton=(i,label=String(i))=>{
   const b=button(label,()=>{this.stage=i;this.render();},'',i>observed&&i!==s.question?.step);
   b.className='stage'+(i===this.stage?' current':'');b.setAttribute('aria-label',i===0?'처음 상태':(i<=3?'변화 ':'회복 ')+i+'단계');
   if(i===1)b.setAttribute('title','상황에서 주어진 변화');
   if(i===this.stage)b.setAttribute('aria-current','step');return b;
  };
  phases.append(stageButton(0,'처음'));
  for(const [start,label,kind] of [[1,'변화','change'],[4,'회복','recovery']]){
   phases.append(el('div',{class:'phase '+kind,role:'group','aria-label':label+' 과정'},el('strong',{},label),
    el('div',{class:'stage-buttons'},[0,1,2].map(n=>stageButton(start+n)))));
  }
  const figure=el('section',{class:'card'},el('h2',{},'관찰 단계'),
   el('p',{class:'help'},'서로 겹쳐 일어날 수 있는 반응을 한 층씩 나누어 살펴봅니다. 회복 가능한 조건을 가정합니다.'),
   phases,this.diagram(shown,pending?s.question.target:null,reference,pending&&!!this.choice),
   el('div',{class:'nav-actions'},button('이전 변화',()=>{this.stage--;this.render();},'',this.stage===0),
    button('다음 변화',()=>{this.stage++;this.render();},'',this.stage>=(s.question?.step??observed))));
  const work=el('section',{class:'card'});
  if(pending){
   work.append(el('span',{class:'pill'},(s.question.phase==='change'?'변화':'회복')+' '+s.question.step+'단계 예측'),
    el('h2',{class:'question-title'},s.question.target_name+'의 '+(s.question.target==='producer'?'자원량':'개체수')+'는 어떻게 달라질까요?'),
    el('p',{class:'help'},'이번에는 '+roleLabel(s.question.target)+'만 예측합니다.'));
   const choices=el('div',{class:'directions',role:'group','aria-label':'증감 방향 선택'});
   for(const choice of ['decrease','increase']){
    const b=button(directionNames[choice],()=>{this.choice=choice;this.render();this.queueDraft();},this.choice===choice?'selected':'',this.busy);
    b.dataset.choice=choice;
    b.setAttribute('aria-pressed',String(this.choice===choice));choices.append(b);
   }
   const reason=el('textarea',{id:'prediction-reason',maxLength:4000,value:this.reason,
    placeholder:'먹이의 양이나 잡아먹히는 정도가 어떻게 달라지는지 연결해 설명하세요.',
    onInput:event=>{this.reason=event.target.value;confirm.disabled=!this.choice||!this.reason.trim()||this.busy;this.queueDraft();}});
   const confirm=button(this.busy?'저장 중…':'예측 확정하고 변화 확인',()=>this.send('answer',{
    step:s.question.step,choice:this.choice,reason:this.reason}),'primary',!this.choice||!this.reason.trim()||this.busy);
   this.confirmButton=confirm;
   this.saved=el('p',{class:'saved','aria-live':'polite'},this.saveStatus||'');
   work.append(choices,el('label',{htmlFor:'prediction-reason'},'먹이 관계를 바탕으로 예측한 이유'),reason,this.saved,this.conflictNotice(),
    el('div',{class:'actions'},confirm),el('p',{class:'help'},'첫 예측과 이유가 저장된 뒤 모형의 변화를 확인합니다. 확정한 답안은 수정할 수 없습니다.'));
  }else if(this.stage===0){
   work.append(el('h2',{},'처음의 안정된 상태'),el('p',{},frame.explanation),
    el('div',{class:'actions'},button('제시된 1단계 보기',()=>{this.stage=1;this.render();},'primary')));
  }else if(this.stage===1){
   work.append(el('span',{class:'pill'},'변화 1단계 · 제시된 상황'),el('h2',{},frame.label),el('p',{},frame.explanation),
    el('p',{class:'help'},'1단계는 상황에서 주어진 변화입니다. 2단계부터 먹이 관계를 바탕으로 예측하세요.'),
    el('div',{class:'actions'},button(s.answered?'2단계 보기':'2단계 예측하기',()=>{this.stage=2;this.render();},'primary')));
  }else{
   const answer=s.answers.find(a=>a.step===this.stage),matches=answer.choice===frame.expectedChoice;
   work.append(el('span',{class:'pill'},'확정한 '+this.stage+'단계'),el('h2',{},frame.label),
    el('p',{},'나의 예측: '+directionNames[answer.choice]),el('p',{},'나의 이유: '+answer.reason),
    el('div',{class:'feedback'},el('strong',{},matches?'모형과 증감 방향이 일치합니다.':'모형의 증감 방향과 비교해 보세요.'),
     el('p',{},frame.explanation),el('p',{class:'help'},'모형의 방향: '+directionNames[frame.expectedChoice]+' · 서술한 이유는 선생님이 확인합니다.')),
    el('div',{class:'actions'},s.question?button('다음 변화 예측',()=>{this.stage=s.question.step;this.render();},'primary'):
     button(this.busy?'제출 중…':'최종 제출',()=>this.send('submit',{}),'primary',this.busy)),
    s.question?null:el('p',{class:'help'},'최종 제출 후에는 문제, 해설, 답안을 다시 열 수 없습니다.'));
  }
  return el('div',{class:'two-col'},figure,work);
 }
}
