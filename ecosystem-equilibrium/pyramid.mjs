const baseTop=[240,120,0],baseBottom=[360,240,120],layerY=[218,124,30];
export function pyramidPoints(index,value){
 const factor=value/100,top=baseTop[index]*factor/2,bottom=baseBottom[index]*factor/2,y=layerY[index];
 return [[280-top,y],[280+top,y],[280+bottom,y+88],[280-bottom,y+88]]
  .map(pair=>pair.map(n=>Math.round(n*100)/100).join(',')).join(' ');
}
function svgElement(tag,attributes={},text){
 const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
 for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
 if(text!=null)node.textContent=text;return node;
}
export function pyramidSvg(values,{reference=values,target=null,prediction=false}={}){
 const roles=['producer','primary','secondary'],names=['생산자 자원량','1차 소비자','2차 소비자'];
 const description=values.map((v,i)=>names[i]+' '+v+(reference[i]!==v?', 직전 '+reference[i]:'')).join('. ');
 const svg=svgElement('svg',{class:'pyramid-svg',viewBox:'0 0 560 330',role:'img',
  'aria-label':(prediction?'나의 예측 피라미드. ':'관찰 단계 피라미드. ')+description});
 svg.append(svgElement('title',{},'영양 단계별 상대 변화 피라미드'),svgElement('desc',{},description));
 for(let i=0;i<3;i++){
  const group=svgElement('g',{'data-role':roles[i]});
  group.append(svgElement('polygon',{class:'pyramid-layer'+(target===roles[i]?' target':''),
   'data-role':roles[i],points:pyramidPoints(i,values[i]),fill:['#b6ce70','#80bdc8','#e8a992'][i],
   stroke:target===roles[i]?'#297e83':'#ffffff','stroke-width':target===roles[i]?3:2,
   'fill-opacity':prediction&&target===roles[i]?0.78:1,'stroke-linejoin':'round'}));
  if(reference[i]!==values[i])group.append(svgElement('polygon',{class:'pyramid-reference','data-role':roles[i],
   points:pyramidPoints(i,reference[i]),fill:'none',stroke:'#526b77','stroke-width':1.8,'stroke-dasharray':'6 5'}));
  group.append(svgElement('text',{x:280,y:layerY[i]+68,'text-anchor':'middle',fill:'#243d47',
   'font-size':30,'font-weight':750,'aria-hidden':true},values[i]));
  svg.append(group);
 }
 return svg;
}
