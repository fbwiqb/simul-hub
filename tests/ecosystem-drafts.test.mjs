import test from 'node:test';
import assert from 'node:assert/strict';
import {StudentWorkspace} from '../ecosystem-equilibrium/student.mjs';
function workspace(command){
 const s=Object.create(StudentWorkspace.prototype);
 Object.assign(s,{command,chainDraft:[],choice:'increase',reason:'A',essay:'',dirty:true,
  draftGeneration:1,draftBaseRevision:0,container:{replaceChildren(){}},
  state:{case:{id:'same'},answered:0,chain:null,deadline:'2099-01-01',revision:0}});
 return s;
}
test('변경하지 않은 탭을 숨겨도 초안을 다시 쓰지 않는다',async()=>{
 let sent=0;const s=workspace(async()=>{sent++;});s.dirty=false;
 await s.flushDraft();assert.equal(sent,0);
});
test('저장 중 추가 입력 후 화면을 숨겨도 최신 스냅샷을 직렬로 저장한다',async()=>{
 let release;const sent=[];const first=new Promise(resolve=>{release=resolve;});
 const s=workspace(async(_op,p)=>{sent.push(p);return sent.length===1?first:{status:'active',revision:2};});
 const active=s.saveDraft();s.reason='AB';s.draftGeneration=2;
 const flushed=s.flushDraft();s.dispose();release({status:'active',revision:1});
 await Promise.all([active,flushed]);
 assert.deepEqual(sent.map(p=>p.draft.reason),['A','AB']);
 assert.deepEqual(sent.map(p=>p.revision),[0,1]);assert.equal(s.dirty,false);
});
test('다른 탭의 최신 상태를 자기 저장 성공 revision으로 오인하지 않는다',async()=>{
 let release;const sent=[];const first=new Promise(resolve=>{release=resolve;});
 const s=workspace(async(_op,p)=>{sent.push(p);return sent.length===1?first:null;});
 const active=s.saveDraft();s.reason='AB';s.draftGeneration=2;
 s.state={...s.state,revision:2,draft:{reason:'다른 탭의 C'}};
 const flushed=s.flushDraft();s.dispose();release({status:'active',revision:1});
 await Promise.all([active,flushed]);
 assert.deepEqual(sent.map(p=>p.revision),[0,1]);
 assert.notEqual(sent[1].revision,s.state.revision);assert(s.dirty);
});
