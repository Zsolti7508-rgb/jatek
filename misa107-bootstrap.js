/* Misa 10.7 – stable original question indices; cloud curriculum ordering metadata. */
(function(){'use strict';
const KEY='misa107-published-v1', OLDKEY='misa106-published-v1';
const get=(b,k)=>{const l=b.split('\n').find(x=>x.startsWith(k));return l?l.slice(k.length).trim():''};
const normalize=s=>String(s||'').normalize('NFC').trim();
function parse(block,old){
 const type=get(block,'Típus:')||'choice',q=get(block,'Kérdés:');if(!q)throw Error('Üres kérdés');
 const item={...(old||{})};item.explain=get(block,'Magyarázat:');
 if(type==='legacy-choice'||type==='legacy-type'){
  item.prompt=q;item.kind=type==='legacy-choice'?'choice':'type';item.answer=get(block,'Helyes válasz:');item.source=get(block,'Forrás:');
  if(type==='legacy-choice')item.choices=get(block,'Válaszok:').split(' | ').filter(Boolean);
  return item;
 }
 item.q=q;item.type=type;const page=get(block,'Oldal:');if(/^\d+$/.test(page))item.page=Number(page);else delete item.page;
 if(type==='choice'){item.opts=get(block,'Válaszok:').split(' | ').filter(Boolean);item.answer=get(block,'Helyes válasz:');if(item.opts.length<2||!item.opts.includes(item.answer))throw Error('Hibás feleletválasztós kérdés');}
 else if(type==='fill'){item.answer=get(block,'Helyes válasz:');item.tip=get(block,'Segítség:');if(!item.answer)throw Error('Hiányzó válasz');}
 else if(type==='match'){item.pairs=JSON.parse(get(block,'Párok JSON:'));if(!Array.isArray(item.pairs)||item.pairs.length<2)throw Error('Hibás párosítás');}
 else if(type==='order'||type==='abc'){item.words=JSON.parse(get(block,'Szavak JSON:'));if(!Array.isArray(item.words)||item.words.length<2)throw Error('Hibás sorrend');if(type==='order'){const alt=get(block,'Elfogadott sorrendek JSON:');if(alt)item.acceptedOrders=JSON.parse(alt);}}
 else throw Error('Nem támogatott típus: '+type);
 const image=get(block,'Kép adat:');if(image)item.misaImage=image;
 const answerImages=get(block,'Válaszképek JSON:');if(answerImages)item.misaAnswerImages=JSON.parse(answerImages);
 return item;
}
const base=BANKS.map(b=>({title:b.title,items:b.items.map(x=>({...x}))}));
const baseTopics=base.map(b=>[...new Set(b.items.map(x=>x.topic))]);
function convert(data){
 if(!data||!Array.isArray(data.subjects)||!data.subjects.length)throw Error('Érvénytelen tantárgylista');
 const out=base.map(b=>({title:b.title,items:b.items.map(x=>({...x}))}));
 const used=new Set(),order=base.map(()=>[]),renamed=base.map(()=>({}));let total=0,legacy=0,added=0;
 for(const subject of data.subjects){if(!Array.isArray(subject.lessons))throw Error('Hibás leckelista');for(const lesson of subject.lessons){
  const blocks=String(lesson.content||'').split('\n\n──────────\n\n').filter(b=>b.split('\n').some(x=>x.startsWith('Kérdés:')));
  if(!blocks.length)continue;
  const known=blocks.map(b=>/^b(\d+)-i(\d+)$/.exec(get(b,'Azonosító:'))).filter(Boolean);
  const ids=new Set(known.map(m=>Number(m[1])));if(ids.size>1)throw Error('Több bank egy leckében: '+lesson.title);
  let bi=known.length?Number(known[0][1]):-1;
  if(bi<0){const matches=base.map((b,i)=>normalize(lesson.title).startsWith(b.title+' – ')?i:-1).filter(i=>i>=0);if(matches.length!==1)throw Error('Új lecke bankja nem ismert: '+lesson.title);bi=matches[0]}
  if(!base[bi])throw Error('Ismeretlen kérdésbank');
  const prefix=base[bi].title+' – ',topic=normalize(lesson.title).startsWith(prefix)?normalize(lesson.title).slice(prefix.length):normalize(lesson.title);
  if(!order[bi].includes(topic))order[bi].push(topic);
  for(const block of blocks){const id=get(block,'Azonosító:');if(!id||used.has(id))throw Error('Hiányzó vagy ismétlődő kérdésazonosító');used.add(id);
   const m=/^b(\d+)-i(\d+)$/.exec(id);if(m&&Number(m[1])!==bi)throw Error('Kérdésbank-eltérés');
   const idx=m?Number(m[2]):-1,old=m?base[bi].items[idx]:null;
   if(m&&!old)throw Error('Ismeretlen eredeti kérdés: '+id);
   const item=parse(block,old);item.topic=topic;
   if(m){out[bi].items[idx]=item;legacy++;if(old.topic!==topic)renamed[bi][old.topic]=topic;}
   else {out[bi].items.push(item);added++}
   total++;
  }
 }}
 if(total<100||total>20000)throw Error('Váratlan kérdésszám: '+total);
 if(legacy!==base.reduce((n,b)=>n+b.items.length,0))throw Error('Nem teljes a felhőtananyag: '+legacy+' eredeti kérdés szerepel. A régi kérdésbank marad aktív.');
 // Keep original indices intact: saved per-bank index-based progress cannot shift.
 const topicOrder=order.map((arr,bi)=>{
  const actual=[...new Set(out[bi].items.map(x=>x.topic))];
  return [...baseTopics[bi].map(x=>renamed[bi][x]||x).filter(x=>actual.includes(x)),...arr.filter(x=>actual.includes(x)),...actual].filter((x,i,a)=>a.indexOf(x)===i);
 });
 return {banks:out,total,topicOrder,added,renamed};
}
window.Misa107={key:KEY,convert};
try{
 const raw=sessionStorage.getItem(KEY);if(!raw)return;
 const pack=JSON.parse(raw),result=convert(pack.data);
 BANKS.splice(0,BANKS.length,...result.banks);
 window.Misa107.active=true;window.Misa107.version=pack.version;window.Misa107.count=result.total;window.Misa107.topicOrder=result.topicOrder;window.Misa107.renamed=result.renamed;
}catch(e){window.Misa107.error=e.message;try{sessionStorage.removeItem(KEY)}catch(_){}}
})();
