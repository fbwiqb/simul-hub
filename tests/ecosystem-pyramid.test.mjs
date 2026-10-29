import test from 'node:test';
import assert from 'node:assert/strict';
import {pyramidPoints} from '../ecosystem-equilibrium/pyramid.mjs';
const coordinates=(role,value)=>pyramidPoints(role,value).split(' ').map(pair=>pair.split(',').map(Number));
test('처음 상태는 위 삼각형과 중간·아래 사다리꼴이 맞닿는 3층 피라미드다',()=>{
 const bottom=coordinates(0,100),middle=coordinates(1,100),top=coordinates(2,100);
 assert.deepEqual(top[0],top[1]);
 assert.equal(bottom[1][0]-bottom[0][0],middle[2][0]-middle[3][0]);
 assert.equal(middle[1][0]-middle[0][0],top[2][0]-top[3][0]);
 assert(top[2][1]<middle[0][1]&&middle[2][1]<bottom[0][1]);
 assert((bottom[2][0]-bottom[3][0])>(middle[2][0]-middle[3][0]));
});
test('한 층의 증감은 그 층의 폭만 바꾸고 중심·높이와 나머지 두 층은 보존한다',()=>{
 const original=[100,100,100].map((v,i)=>coordinates(i,v));
 for(let role=0;role<3;role++)for(const value of [40,70,130,160]){
  const values=[100,100,100];values[role]=value;
  const next=values.map((v,i)=>coordinates(i,v));
  for(let i=0;i<3;i++){
   if(i!==role)assert.deepEqual(next[i],original[i]);
   else{
    assert.notDeepEqual(next[i],original[i]);
    assert.deepEqual(next[i].map(p=>p[1]),original[i].map(p=>p[1]));
    assert.equal((next[i][2][0]+next[i][3][0])/2,280);
    assert.equal(next[i][2][0]-next[i][3][0],(original[i][2][0]-original[i][3][0])*value/100);
   }
  }
 }
});
