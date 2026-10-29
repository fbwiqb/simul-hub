import {el,button,roleNames,directionNames} from './ui.mjs';
import {pyramidSvg} from './pyramid.mjs';
const roles=['producer','primary','secondary'];
const observedStep=state=>state.observed_step??(state.chain?Math.min(6,(state.answered||0)+1):0);

export class StudentWorkspace {
 constructor(container,state,command,options={}){
  this.container=container;this.command=command;this.options=options;this.view='situation';this.stage=0;this.busy=false;
  this.adopt(state,true);this.render();
 }
 adopt(state,reset=false){
  const changed=this.state?.case?.id!==state.case?.id;
  if(reset||changed){
   this.view=state.chain?(state.answered===5&&state.draft?.essay?'report':'explore'):'situation';
   this.stage=(state.draft?.reason||state.draft?.choice)&&state.question?state.question.step:observedStep(state);
   this.chainDraft=[...(state.chain||state.draft?.chain||[])];
   this.reason=state.draft?.reason||'';this.choice=state.draft?.choice||'';this.essay=state.draft?.essay||'';
   this.draftBaseRevision=state.revision;this.dirty=false;this.draftGeneration=0;
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
   this.syncDraft(state);this.render();return;
  }
  if(!action&&sameActivity){
   if(!this.dirty&&!this.saving&&previous.revision!==state.revision){this.syncDraft(state);this.patchDraft();}
   return;
  }
  if(action&&['answer','chain','reroll'].includes(action)){this.dirty=false;this.draftBaseRevision=state.revision;}
  if(action==='answer'||state.answered>(previous?.answered||0)){
   clearTimeout(this.saveTimer);this.dirty=false;this.draftBaseRevision=state.revision;
   this.reason='';this.choice='';this.stage=observedStep(state);this.view='explore';
  }
  if(action==='chain'||(state.chain&&!previous?.chain)){this.chainDraft=[...state.chain];this.stage=1;this.view='explore';}
  this.render();
 }
 syncDraft(state){
  this.chainDraft=[...(state.chain||state.draft?.chain||[])];
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
  if(this.submitButton?.isConnected)this.submitButton.disabled=!this.essay.trim()||this.busy;
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
 queueDraft(){
  this.dirty=true;this.draftGeneration++;
  if(this.saved)this.saved.textContent='저장 중…';
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
    if(this.draftGeneration===generation)this.dirty=false;
    if(this.saved)this.saved.textContent=this.dirty?'저장 중…':'서버에 임시 저장됨';
    if(this.dirty&&!this.disposed)this.saveTimer=setTimeout(()=>void this.saveDraft(),650);
    return result;
   }catch{if(this.saved)this.saved.textContent='아직 저장되지 않았습니다. 연결 후 다시 입력하거나 확정해 주세요.';return null;}
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
   ['situation','상황 페이지',false],['explore','탐구 '+(s.answered||0)+'/5',!s.chain],
   ['report','정리하기',s.answered!==5]]){
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
  const body=this.view==='situation'?this.situation():this.view==='explore'?this.explore():this.report();
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
   el('h3',{},'변화 전의 관찰'),a.before.map(p=>el('p',{},p)),
   el('h3',{},'한 구역에서 생긴 변화'),el('p',{},a.change),
   el('h3',{},'변화 후의 관찰'),a.after.map(p=>el('p',{},p)),el('p',{},a.question));
  const sources=el('details',{class:'article-source'},el('summary',{},'자료 출처'));
  for(const source of s.case.sources)sources.append(el('p',{},el('a',{href:source.url,target:'_blank',rel:'noopener noreferrer'},source.title)));
  story.append(sources);
  const labels=new Map(s.case.organisms.map(o=>[o.id,o.label]));
  const candidates=el('div',{class:'organisms','aria-label':'사례 속 생물 목록'});
  for(const o of s.case.organisms)candidates.append(button(o.label,()=>{
   this.chainDraft.push(o.id);this.render();this.queueDraft();
  },'',!!s.chain||this.chainDraft.includes(o.id)||this.busy));
  const chain=el('div',{class:'chain','aria-label':'내가 작성한 먹이사슬'});
  for(let i=0;i<3;i++){
   if(i)chain.append('→');
   const b=button(labels.get(this.chainDraft[i])||(i+1)+'번째 생물',()=>{
    this.chainDraft.splice(i,1);this.render();this.queueDraft();
   },'',!!s.chain||!this.chainDraft[i]||this.busy);
   b.className='slot';chain.append(b);
  }
  const work=el('section',{class:'card'},el('h2',{},'먹이사슬 작성하기'),
   el('p',{class:'help'},'사례의 행동과 먹이 단서를 연결해, 생물 카드를 순서대로 눌러 보세요.'),
   el('p',{class:'help'},'화살표: 먹히는 생물 → 먹는 생물'),candidates,chain,this.conflictNotice());
  if(s.chain){
   work.append(el('p',{class:'help'},'첫 답안을 확정했습니다. 내가 만든 먹이사슬과 모형을 비교해 보세요.'),
    el('div',{class:'chain-model'},'모형의 먹이사슬',el('div',{},s.model_chain.map((o,i)=>[i?' → ':'',el('span',{},o.label)]))),
    el('div',{class:'actions'},button('탐구 시작하기',()=>this.chooseView('explore'),'primary')));
  }else{
   work.append(el('p',{class:'help'},'확정하면 첫 먹이사슬이 저장되고, 수정할 수 없습니다.'),
    el('div',{class:'actions'},button(this.busy?'저장 중…':'먹이사슬 확정',()=>this.send('chain',{chain:this.chainDraft}),'primary',this.chainDraft.length!==3||this.busy),
     button('다시 놓기',()=>{this.chainDraft=[];this.render();this.queueDraft();},'quiet',this.busy)),
    el('div',{class:'actions'},button(s.rerolls?'상황 바꾸기 사용 완료':'상황 바꾸기 · 1회',()=>this.send('reroll'),'',!!s.rerolls||this.busy)));
  }
  this.saved=el('p',{class:'saved','aria-live':'polite'},'');work.append(this.saved);
  return el('div',{class:'two-col'},story,work);
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
   el('figcaption',{class:'help'},prediction?'색 면: 내 예측 · 점선: 직전 단계':'색 면: 확인한 상태 · 변한 층의 점선: 직전 단계'),
   el('p',{class:'help'},'각 층의 처음 상태를 각각 100으로 놓은 상대량입니다. 층 사이의 절대 개체수·질량을 비교하는 그림이 아닙니다.'));
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
   shown[index]=Math.max(40,Math.min(160,shown[index]+(this.choice==='increase'?30:this.choice==='decrease'?-30:0)));
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
    el('p',{class:'help'},'바로 직전에 확인한 단계와 비교하세요. 이번에는 '+roleNames[s.question.target]+'만 예측합니다.'));
   const choices=el('div',{class:'directions',role:'group','aria-label':'증감 방향 선택'});
   for(const choice of ['decrease','stable','increase']){
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
   this.saved=el('p',{class:'saved','aria-live':'polite'},'');
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
     button('정리하기로 이동',()=>this.chooseView('report'),'primary')));
  }
  return el('div',{class:'two-col'},figure,work);
 }
 report(){
  const s=this.state;
  const essay=el('textarea',{id:'interpretation',maxLength:12000,value:this.essay,placeholder:'제시된 문항에 맞게 사례와 근거를 연결해 설명하세요.',
   onInput:event=>{this.essay=event.target.value;submit.disabled=!this.essay.trim()||this.busy;this.queueDraft();}});
  const submit=button(this.busy?'제출 중…':'수행평가 최종 제출',()=>this.send('submit',{essay:this.essay}),'primary',!this.essay.trim()||this.busy);
  this.submitButton=submit;
  this.saved=el('p',{class:'saved','aria-live':'polite'},'');
  return el('section',{class:'card essay'},el('p',{class:'eyebrow'},'정리하기 · 자유 서술형'),el('h2',{},s.essay_prompt),
   el('p',{class:'help'},'문항의 요구사항을 모두 다루고, 사례와 근거를 연결하세요.'),
   el('label',{htmlFor:'interpretation'},'나의 설명'),essay,this.saved,this.conflictNotice(),
   el('p',{class:'help'},'최종 제출 후에는 문제·해설·답안을 다시 열 수 없습니다. 내용을 확인하고 제출하세요.'),
   el('div',{class:'actions'},submit,button('탐구 다시 확인',()=>this.chooseView('explore'),'quiet')));
 }
}
