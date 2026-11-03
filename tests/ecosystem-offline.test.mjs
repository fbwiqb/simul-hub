import test from 'node:test';
import assert from 'node:assert/strict';
import {StudentWorkspace,clearUnsaved} from '../ecosystem-equilibrium/student.mjs';
const store=new Map();
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),
 get length(){return store.size;},key:i=>[...store.keys()][i]??null};
const key='eco2026-unsaved:S1';
const base={student:{id:'S1'},status:'active',case:{id:'c1'},answered:2,chain:['a','b','c'],question:{step:4},revision:7,draft:{},deadline:'2099-01-01'};
function workspace(state,command,options={}){
 const s=Object.create(StudentWorkspace.prototype);
 Object.assign(s,{command,options,container:{replaceChildren(){}},view:'situation',stage:0});
 s.adopt(state,true);return s;
}
test.beforeEach(()=>store.clear());
test('끊긴 동안 입력하면 이 기기에 보관하고 저장 성공 후 지운다',async()=>{
 let online=false;const s=workspace(base,async(_op,p)=>online?{status:'active',revision:p.revision+1}:null);
 s.choice='increase';s.reason='늑대가 줄어서';s.queueDraft();clearTimeout(s.saveTimer);
 assert.equal(JSON.parse(store.get(key)).draft.reason,'늑대가 줄어서');
 await s.saveDraft();assert(s.saveFailed);assert(store.has(key));assert(s.dirty);
 online=true;s.state={...s.state};s.update({...base},undefined);await s.inFlight;
 assert.equal(s.dirty,false);assert.equal(store.has(key),false);assert.equal(s.saveStatus,'서버에 임시 저장됨');
});
test('새로고침 뒤 같은 revision이면 보관한 글을 복원하고 저장을 예약한다',()=>{
 store.set(key,JSON.stringify({case:'c1',answered:2,chained:true,base:7,draft:{chain:[],choice:'decrease',reason:'복원할 글',essay:''}}));
 const s=workspace(base,async()=>null);
 assert.equal(s.reason,'복원할 글');assert.equal(s.choice,'decrease');assert(s.dirty);assert.equal(s.stage,4);
});
test('다른 기기에서 먼저 저장했으면 덮지 않고 미저장 글로만 보여 준다',()=>{
 store.set(key,JSON.stringify({case:'c1',answered:2,chained:true,base:5,draft:{chain:[],choice:'decrease',reason:'이 기기 글',essay:''}}));
 const s=workspace({...base,draft:{reason:'다른 기기 글'}},async()=>null);
 assert.equal(s.reason,'다른 기기 글');assert.equal(s.dirty,false);assert.equal(s.conflictDraft.reason,'이 기기 글');
});
test('단계가 이미 넘어갔거나 다른 학생이면 복원하지 않는다',()=>{
 store.set(key,JSON.stringify({case:'c1',answered:1,chained:true,base:7,draft:{reason:'지난 단계'}}));
 const s=workspace(base,async()=>null);
 assert.equal(s.reason,'');assert.equal(store.has(key),false);
 store.set(key,JSON.stringify({case:'c1',answered:2,chained:true,base:7,draft:{reason:'S1 글'}}));
 const other=workspace({...base,student:{id:'S2'}},async()=>null);
 assert.equal(other.reason,'');assert(store.has(key));
});
test('교사 데모는 보관하지 않고 로그아웃하면 모두 지운다',()=>{
 const s=workspace(base,async()=>null,{demo:true});s.reason='데모';s.queueDraft();clearTimeout(s.saveTimer);
 assert.equal(store.size,0);
 store.set(key,'{}');store.set('eco2026-unsaved:S2','{}');store.set('other','1');
 clearUnsaved();assert.deepEqual([...store.keys()],['other']);
});
