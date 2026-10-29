export const roleNames={producer:'생산자 자원량',primary:'1차 소비자',secondary:'2차 소비자'};
export const directionNames={increase:'증가',decrease:'감소',stable:'유지'};
export function el(tag,attrs={},...children){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),event=>{
   try{const result=value(event);result?.catch?.(error=>window.dispatchEvent(new CustomEvent('eco-ui-error',{detail:error.message})));}
   catch(error){window.dispatchEvent(new CustomEvent('eco-ui-error',{detail:error.message}));}
  });
  else if(key==='class')node.className=value;
  else if(value!==false&&value!=null){if(key in node&&!key.startsWith('aria-')&&!key.startsWith('data-'))node[key]=value;else node.setAttribute(key,String(value));}
 }
 for(const child of children.flat(Infinity)){if(child!=null&&child!==false)node.append(child instanceof Node?child:document.createTextNode(String(child)));}
 return node;
}
export const button=(text,run,kind='',disabled=false)=>el('button',{type:'button',class:'btn '+kind,onClick:run,disabled},text);
export function formatTime(value){return value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)):'—';}
export function download(value,name,type='application/json'){
 const url=URL.createObjectURL(new Blob([value],{type})),a=el('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export function field(label,input){return el('div',{class:'field'},el('label',{},label),input);}
export function csvCell(value){const s=String(value??'');return '"'+(/^[\s]*[=+\-@]|^[\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}
