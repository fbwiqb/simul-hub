import test from 'node:test';
import assert from 'node:assert/strict';
import {StudentWorkspace} from '../ecosystem-equilibrium/student.mjs';
import {progressLabel} from '../ecosystem-equilibrium/teacher.mjs';
const base={student:{id:'S1'},status:'active',case:{id:'c1'},answered:0,chain:null,revision:1,draft:{},deadline:'2099-01-01'};
function workspace(state=base){
 const s=Object.create(StudentWorkspace.prototype);
 Object.assign(s,{command:async()=>null,options:{demo:true},container:{replaceChildren(){}},view:'situation',stage:0,render(){},queueDraft(){}});
 s.adopt(state,true);return s;
}
const match=(s,ids)=>ids.forEach((id,i)=>{s.pickCard(id);s.assignRole(i);});
test('역할 칸은 순서와 상관없이 채우고 저장 순서는 생산자부터다',()=>{
 const s=workspace();
 s.pickCard('whale');s.assignRole(2);assert.equal(s.chainMatched,false);
 match(s,['plankton','krill']);
 assert.deepEqual(s.chainDraft,['plankton','krill','whale']);assert(s.chainMatched);assert.equal(s.chainPlaced,false);
});
test('카드를 고르지 않고 빈 칸을 누르면 안내만 하고 채운 칸을 누르면 비운다',()=>{
 const s=workspace();
 s.assignRole(0);assert.equal(s.chainNotice,'먼저 생물 카드를 누르세요.');assert.equal(s.chainDraft[0],undefined);
 match(s,['a']);s.assignRole(0);assert.equal(s.chainDraft[0],null);
});
test('맞는 층에만 놓이고 세 층을 모두 놓아야 확정할 수 있다',()=>{
 const s=workspace();match(s,['a','b','c']);
 s.placeOnLayer(0);assert.equal(s.chainNotice,'먼저 역할 카드를 누르세요.');
 s.pickRole(0);s.placeOnLayer(2);assert.deepEqual(s.placed,[]);assert.match(s.chainNotice,/그 층이 아닙니다/);
 s.placeOnLayer(0);assert.deepEqual(s.placed,[0]);assert.equal(s.chainNotice,'');
 for(const i of [2,1]){s.pickRole(i);s.placeOnLayer(i);}
 assert(s.chainPlaced);assert.deepEqual(s.chainDraft,['a','b','c']);
});
test('역할을 바꾸거나 상황이 바뀌면 피라미드 놓기를 처음부터 한다',()=>{
 const s=workspace();match(s,['a','b','c']);s.pickRole(0);s.placeOnLayer(0);
 s.pickCard('d');s.assignRole(1);assert.deepEqual(s.placed,[]);assert.equal(s.chainDraft[1],'d');
 s.pickRole(0);s.placeOnLayer(0);
 s.adopt({...base,case:{id:'c2'}});assert.deepEqual(s.placed,[]);assert.deepEqual(s.chainDraft,[]);
});
test('저장한 초안의 역할은 새로고침 뒤 남고 피라미드 놓기만 다시 한다',()=>{
 const s=workspace({...base,draft:{chain:['a','b','c']}});
 assert(s.chainMatched);assert.equal(s.chainPlaced,false);
});
test('교사 화면은 제출, 미제출, 미완료를 나눠 보여 준다',()=>{
 assert.equal(progressLabel({},true),'미응시');
 assert.equal(progressLabel({started_at:'t',answered:2,chain_confirmed:true},false),'진행 중 · 예측 2/5');
 assert.equal(progressLabel({started_at:'t',answered:5,chain_confirmed:true},true),'예측 완료 · 미제출');
 assert.equal(progressLabel({started_at:'t',answered:2,chain_confirmed:true},true),'미완료 · 예측 2/5');
 assert.equal(progressLabel({started_at:'t',answered:0,chain_confirmed:false},true),'미완료 · 먹이사슬 미확정');
 assert.equal(progressLabel({started_at:'t',answered:5,submitted_at:'t'},true),'제출 완료');
});

test('periodWindow ends at the period end', async () => {
  const {periodWindow} = await import('../ecosystem-equilibrium/teacher.mjs');
  assert.deepEqual(periodWindow('2026-11-16','3',20), {opens_at:'2026-11-16T02:10:00.000Z', closes_at:'2026-11-16T02:30:00.000Z'});
  assert.deepEqual(periodWindow('2026-11-16','4B',20), {opens_at:'2026-11-16T04:00:00.000Z', closes_at:'2026-11-16T04:20:00.000Z'});
  assert.equal(periodWindow('', '3', 20), null);
});

test('classSlots lists only the section class periods ahead', async () => {
  const {classSlots} = await import('../ecosystem-equilibrium/teacher.mjs');
  const now = Date.parse('2026-11-13T05:00:00Z');
  const s13 = classSlots(13, now, 7).map(x => x.date + ' ' + x.period);
  assert.deepEqual(s13, ['2026-11-13 5','2026-11-16 5','2026-11-17 5','2026-11-18 5']);
  const s3 = classSlots(3, now, 4).map(x => x.date + ' ' + x.period);
  assert.deepEqual(s3, ['2026-11-16 4A']);
});
