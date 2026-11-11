/* Misa 10.8.3 – opt-in family accounts and child profiles, diagnostic fallback, cloud sync disabled in offline mode. */
(()=>{'use strict';
const cfg={apiKey:'AIzaSyCtqncLwvLGRfPaJyX5v3mTKnFwJbwqP1w',authDomain:'gyakoroljunk-misaval.firebaseapp.com',projectId:'gyakoroljunk-misaval',appId:'1:606749224072:web:1dc42e9b9810a59541833d'};
const css=document.createElement('style');css.textContent=`#m108-open{position:fixed;right:12px;bottom:12px;z-index:2147482500;border-radius:10px;background:#234b64;color:white;padding:11px 15px;border:2px solid #a6d8f5;font:700 14px system-ui;cursor:pointer}#m108-shade{position:fixed;inset:0;z-index:2147483500;background:#07131ddf;display:none;align-items:center;justify-content:center;padding:15px;font:15px system-ui;color:#edf6ff}#m108-shade.show{display:flex}#m108-dialog{background:#183044;border:2px solid #75b6c7;border-radius:16px;padding:20px;width:min(510px,100%);max-height:90vh;overflow:auto;box-shadow:0 12px 40px #0009}#m108-dialog h2{margin:0 0 10px;font-size:22px}#m108-dialog p{line-height:1.5}#m108-dialog input{display:block;width:100%;padding:11px;margin:9px 0;background:#fff;color:#142331;border-radius:8px;border:1px solid #7997a6;font:inherit}#m108-dialog button{background:#315f78;color:#fff;border:1px solid #80bed6;border-radius:8px;padding:9px 12px;margin:4px;cursor:pointer;font:inherit}#m108-dialog button:disabled{opacity:.5}#m108-dialog button.primary{background:#14775f}#m108-status{white-space:pre-wrap;min-height:24px;color:#ffe4a0}#m108-children button.selected{border:2px solid #8fe1b1;background:#16684e}#m108-close{float:right}`;document.head.append(css);
const button=document.createElement('button');button.id='m108-open';button.type='button';button.textContent='👨‍👩‍👧 Családi profil (teszt)';document.body.append(button);
const shade=document.createElement('div');shade.id='m108-shade';shade.innerHTML=`<section id="m108-dialog" role="dialog" aria-modal="true" aria-labelledby="m108-title"><button id="m108-close" type="button">Bezárás ✕</button><h2 id="m108-title">👨‍👩‍👧 Misa 10.8.14 – Családi profilok (automatikus szinkron TESZT)</h2><p>Szülői e-mailes belépés, gyermekprofilok becenévvel. Minden játékindítás előtt válassz gyermekprofilt. Az eredmények helyben tárolódnak. A felhőeredmények induláskor automatikusan ellenőrizhetők és biztonságosan átvehetők. Sikeres felhőellenőrzés után az új eredmények automatikusan mentődnek. Csak egyszerű eredménylistákat egyesítünk tranzakcióban; ütközés esetén a feltöltés leáll. Kapcsolati hiba esetén a helyi eredmények megmaradnak.</p><div id="m108-login"><input id="m108-email" type="email" autocomplete="username" placeholder="Szülő e-mail-címe"><input id="m108-password" type="password" autocomplete="current-password" placeholder="Jelszó (legalább 6 karakter)"><button id="m108-signin" type="button" class="primary">Belépés</button><button id="m108-register" type="button">Szülői fiók létrehozása</button></div><div id="m108-profile" hidden><p id="m108-account"></p><div id="m108-children"></div><input id="m108-nickname" maxlength="24" autocomplete="off" placeholder="Új gyermekprofil beceneve (ne teljes név)"><button id="m108-add" type="button" class="primary">+ Gyermekprofil hozzáadása</button><button id="m108-signout" type="button">Kijelentkezés</button><button id="m10811-restore" type="button" style="display:block;background:#14775f">☁️ Felhőeredmények ellenőrzése és biztonságos átvétele</button><button id="m10812-enable" type="button" style="display:block;background:#315f78">🔒 Biztonságos felhőmentés engedélyezése (teszt)</button><button id="m10812-disable" type="button" style="display:none">⏸ Felhőmentés kikapcsolása</button></div><p id="m108-status" role="status">Kapcsolódás…</p><p style="font-size:12px;color:#bcd0dd">A tanári szerkesztő és a felhőfrissítés ettől függetlenül működik. A profilok a szülői fiók alatt privát Firestore-adatok.</p></section>`;document.body.append(shade);
const $=id=>document.getElementById(id),status=t=>$('m108-status').textContent=t;
let app,auth,db,au,fs,user=null,profiles=[];let busy=false, activeChild=null, syncTimer=null, syncing=false, cloudConflict=false, offlineMode=false;
const startupReloadKey="misa10810-startup-reload";
let syncEnabled=false; // 10.8.14: enable only after successful server-side reconciliation
let pendingWrite=false, retryCount=0, retryTimer=null;
const gate=document.createElement('div');gate.id='m1081-gate';gate.style.cssText='position:fixed;inset:0;z-index:2147483400;background:#07131ded;display:flex;align-items:center;justify-content:center;color:white;font:700 20px system-ui;text-align:center;padding:24px';gate.textContent='👨‍👩‍👧 Válassz gyermekprofilt a játék indításához';document.body.append(gate);
const gameClick=e=>{if(activeChild)return;const target=e.target.closest?.('.welcome-click');if(target){e.preventDefault();e.stopImmediatePropagation();shade.classList.add('show');status(user?'Válassz egy gyermekprofilt!':'Jelentkezz be szülőként!')}};document.addEventListener('click',gameClick,true);
function prefix(id){return 'misa343_data_'+id+'_'}
function localId(uid,child){return 'f_'+uid+'_'+child}
function localData(id){const out={};const pre=prefix(id);for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(pre))out[k.slice(pre.length)]=localStorage.getItem(k)}return out}
// 10.8.8: Conservative, lossless reconciliation of progress lists.
// Non-list disagreements are never overwritten automatically.
function reconcile(local,remote){
 const merged={...remote};let conflict=false;
 for(const [k,v] of Object.entries(local)){
  if(!(k in remote)){merged[k]=v;continue}
  if(v===remote[k])continue;
  let l,r;
  try{l=JSON.parse(v);r=JSON.parse(remote[k])}catch(e){conflict=true;continue}
  if(Array.isArray(l)&&Array.isArray(r)&&l.every(x=>['string','number'].includes(typeof x))&&r.every(x=>['string','number'].includes(typeof x))){
   merged[k]=JSON.stringify([...new Set([...r,...l])]);
  }else{conflict=true}
 }
 return {merged,conflict,changed:JSON.stringify(merged)!==JSON.stringify(remote)};
}
function applyCloud(id,data){
 const pre=prefix(id);
 for(const [k,v] of Object.entries(data))if(typeof v==='string'&&k.length<180)localStorage.setItem(pre+k,v);
}
function markConflict(id,message){cloudConflict=true;localStorage.setItem('misa1081-conflict-'+id,'1');status('⚠️ '+message+' Automatikus felhőmentés letiltva; az adatok megmaradtak.');}
async function refreshCloud(child,doReload){
 const id=localId(user.uid,child),ref=fs.doc(db,'csaladok',user.uid,'gyermekek',child,'eredmenyek','aktualis');
 const snap=await withTimeout(fs.getDocFromServer(ref),20000);
 const remote=snap.exists()?(snap.data().data||{}):{};
 const local=localData(id);
 // Read-only diagnostic: do not overwrite either copy or reload the page.
 const result=reconcile(local,remote);
 const different=JSON.stringify(local)!==JSON.stringify(remote);
 if(different){cloudConflict=true;status('🔒 10.8.10 BIZTONSÁGOS MÓD: a helyi és felhős mentés eltér. Nincs automatikus felülírás vagy újratöltés. Felhőkulcsok: '+Object.keys(remote).length+', helyi kulcsok: '+Object.keys(local).length+'.');}
 else status('🔒 10.8.10 BIZTONSÁGOS MÓD: felhőellenőrzés kész; feltöltés kikapcsolva.');
 return false;
}
// Merge ONLY primitive JSON lists. Any incompatible or non-list disagreement blocks writing.
function uploadMerge(local,remote){
 const merged={...remote};const conflicts=[];
 for(const [key,value] of Object.entries(local)){
  if(typeof value!=='string'){conflicts.push(key);continue}
  if(!(key in merged)){merged[key]=value;continue}
  if(value===merged[key])continue;
  let a,b;try{a=JSON.parse(value);b=JSON.parse(merged[key])}catch(e){conflicts.push(key);continue}
  if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(v=>typeof v==='number'||typeof v==='string'))
   merged[key]=JSON.stringify([...new Set([...b,...a])]);
  else conflicts.push(key);
 }
 return {merged,conflicts};
}
async function saveCloud(){
 if(!syncEnabled||!user||!activeChild||offlineMode||cloudConflict||syncing)return;
 syncing=true;const child=activeChild,uid=user.uid,id=localId(uid,child);
 const snapshot=localData(id),ref=fs.doc(db,'csaladok',uid,'gyermekek',child,'eredmenyek','aktualis');
 pendingWrite=false;
 try{
  let committed;
  await withTimeout(fs.runTransaction(db,async tx=>{
   const snap=await tx.get(ref),remote=snap.exists()?(snap.data().data||{}):{};
   if(!remote||typeof remote!=='object'||Array.isArray(remote))throw Error('Hibás felhős adat');
   const result=uploadMerge(snapshot,remote);
   if(result.conflicts.length)throw Object.assign(new Error('Nem egyesíthető mezők: '+result.conflicts.join(', ')),{code:'misa/conflict'});
   committed=result.merged;
   tx.set(ref,{data:committed,updatedAt:new Date().toISOString()});
  }),25000);
  // Never overwrite changes that happened while the network request was in flight.
  if(user?.uid===uid&&activeChild===child){
   for(const [key,value] of Object.entries(committed)){
    const now=localStorage.getItem(prefix(id)+key);
    if(now===snapshot[key]||now===null&&!(key in snapshot))localStorage.setItem(prefix(id)+key,value);
   }
  }
  retryCount=0;status('✅ Automatikus felhőmentés kész.');
 }catch(e){
  const conflict=e.code==='misa/conflict'||/Hibás felhős adat/.test(e.message||'');
  if(conflict){syncEnabled=false;cloudConflict=true;updateSyncButtons();status('⛔ Adatütközés: automatikus feltöltés leállítva. A helyi adatok megmaradtak. '+(e.message||''));}
  else{pendingWrite=true;retryCount++;status('⚠️ Felhőmentés várakozik (kapcsolati hiba). A helyi eredmények biztonságban vannak. Újrapróbálkozás…');}
 }finally{
  syncing=false;
  if(syncEnabled&&activeChild===child&&user?.uid===uid){
   if(pendingWrite){clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(syncEnabled&&!syncing)saveCloud()},Math.min(60000,5000*Math.pow(2,Math.min(retryCount,4))));}
   else if(JSON.stringify(localData(id))!==JSON.stringify(snapshot)){scheduleSync();}
  }
 }
}
function updateSyncButtons(){
 $('m10812-enable').style.display=syncEnabled?'none':'block';
 $('m10812-disable').style.display=syncEnabled?'block':'none';
}
function scheduleSync(){if(!syncEnabled||!activeChild||offlineMode||cloudConflict)return;pendingWrite=true;clearTimeout(syncTimer);clearTimeout(retryTimer);syncTimer=setTimeout(()=>{if(!syncing)saveCloud()},1800)}
$('m10812-enable').onclick=async()=>{
 if(!user||!activeChild||busy)return status('Előbb válassz gyermekprofilt!');
 if(!confirm('TESZT: Engedélyezed az eredmények felhőbe írását ebben a böngészőmunkamenetben? Csak egyszerű listákat egyesítünk, összetett eltérés esetén megállunk. A felhőadatok módosulni fognak. A 10.8.11 mentést tartsd meg.'))return;
 cloudConflict=false;syncEnabled=true;updateSyncButtons();
 status('☁️ Biztonságos első feltöltés…');await saveCloud();
};
$('m10812-disable').onclick=()=>{syncEnabled=false;pendingWrite=false;clearTimeout(syncTimer);clearTimeout(retryTimer);updateSyncButtons();status('🔒 Felhőmentés kikapcsolva.')};
const originalSet=misaProfileStore.setItem.bind(misaProfileStore),originalRemove=misaProfileStore.removeItem.bind(misaProfileStore);misaProfileStore.setItem=(k,v)=>{const result=originalSet(k,v);scheduleSync();return result};misaProfileStore.removeItem=k=>{const result=originalRemove(k);scheduleSync();return result};
function activateChild(x,offline){
  const id=localId(user.uid,x.id);
  localStorage.setItem('misa343_active',id);
  localStorage.setItem(selectedKey(),x.id);
  sessionStorage.setItem('misa1081-chosen',user.uid+':'+x.id);
  if(offline)sessionStorage.setItem('misa1083-offline',user.uid+':'+x.id);
  else sessionStorage.removeItem('misa1083-offline');
  sessionStorage.removeItem(startupReloadKey);
  sessionStorage.removeItem('misa10813-reloaded-'+user.uid+'-'+x.id);
  syncEnabled=false;pendingWrite=false;clearTimeout(syncTimer);clearTimeout(retryTimer);updateSyncButtons();
  location.reload();
}
async function choose(x){
 if(!user||busy)return;
 setBusy(true);
 const id=localId(user.uid,x.id),local=localData(id);
 try{
  status('☁️ Felhős eredmények ellenőrzése… (legfeljebb 12 másodperc)');
  const ref=fs.doc(db,'csaladok',user.uid,'gyermekek',x.id,'eredmenyek','aktualis');
  const doc=await withTimeout(fs.getDocFromServer(ref),20000);
  const remote=doc.exists()?(doc.data().data||{}):{};
  const result=safeUnion(local,remote);
  if(result.issues.length){cloudConflict=true;status('🔒 Nem egyesíthető mezők: '+result.issues.join(', ')+'. A kézi felhőátvétel továbbra is elérhető.');}
  else if(result.changes.length){
   const backupKey='misa10813-backup-'+id;
   localStorage.setItem(backupKey,JSON.stringify({version:'10.8.13',createdAt:new Date().toISOString(),data:local}));
   for(const [key,value] of Object.entries(result.merged))if(local[key]!==value)localStorage.setItem(prefix(id)+key,value);
   status('☁️ Biztonságos eredményegyesítés: '+result.changes.join('; '));
  }
  activateChild(x,false);
 }catch(e){
  status('⚠️ A felhős eredmények nem érhetők el: '+(e.code||e.message||e)+'. A meglévő helyi eredmények változatlanok. Az alábbi gombbal külön, felhőmentés nélkül is indíthatod a játékot.');
  showOfflineButton(x);
 }finally{setBusy(false)}
}
function showOfflineButton(x){
 let b=$('m1083-offline');if(!b){b=document.createElement('button');b.id='m1083-offline';b.type='button';b.textContent='▶ Játék indítása helyi módban (felhőmentés nélkül)';b.style.cssText='display:block;background:#916025;color:white;margin:12px 4px';$('m108-status').after(b)}
 b.hidden=false;b.onclick=()=>{if(!user)return;const ok=confirm('A felhő most nem érhető el. A játék kizárólag ennek a gyermeknek a helyi eredményeit használja. A felhőbe NEM mentünk, és a meglévő felhős eredményeket NEM töltjük le. Folytatod?');if(ok)activateChild(x,true)};
}

// 10.8.11: explicit, read-only cloud retrieval with backup and user approval.
// Never write to Firestore. Never replace local data without an exportable backup.
function downloadBackup(id, local){
 const content=JSON.stringify({version:'10.8.11',childId:id,createdAt:new Date().toISOString(),data:local},null,2);
 const blob=new Blob([content],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
 a.download='Misa_helyi_eredmenyek_biztonsagi_mentes_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function safeUnion(local,remote){
 const merged={...local};const issues=[];const changes=[];
 for(const [key,value] of Object.entries(remote)){
  if(typeof value!=='string'){issues.push(key+' (nem szöveg)');continue}
  if(!(key in local)){merged[key]=value;changes.push(key+' (új felhős kulcs)');continue}
  if(local[key]===value)continue;
  let l,r;try{l=JSON.parse(local[key]);r=JSON.parse(value)}catch(e){issues.push(key+' (nem JSON)');continue}
  if(Array.isArray(l)&&Array.isArray(r)&&[...l,...r].every(x=>typeof x==='number'||typeof x==='string')){
   const union=[...new Set([...l,...r])];
   merged[key]=JSON.stringify(union);changes.push(key+': '+l.length+' helyi, '+r.length+' felhős → '+union.length);
  }else{issues.push(key+' (összetett vagy eltérő adat)')}
 }
 return {merged,issues,changes};
}
// 10.8.13: startup read-only cloud reconciliation. Persist a recoverable local backup
// before changing any game progress; never upload or delete progress here.
async function autoPull(child){
 const id=localId(user.uid,child);
 const ref=fs.doc(db,'csaladok',user.uid,'gyermekek',child,'eredmenyek','aktualis');
 const snap=await withTimeout(fs.getDocFromServer(ref),20000);
 if(!snap.exists())return {changed:false,message:'A felhőben még nincs mentés.'};
 const remote=snap.data().data;
 if(!remote||typeof remote!=='object'||Array.isArray(remote))throw Error('Hibás felhős eredményadat');
 const local=localData(id),result=safeUnion(local,remote);
 if(result.issues.length){cloudConflict=true;return {changed:false,message:'🔒 Nem egyesíthető mezők: '+result.issues.join(', ')+'. Kézi ellenőrzés szükséges.'}}
 if(!result.changes.length)return {changed:false,message:'☁️ A helyi eredmények naprakészek.'};
 const backupKey='misa10813-backup-'+id;
 const backup={version:'10.8.13',createdAt:new Date().toISOString(),data:local};
 // Never modify local progress if the backup cannot be saved.
 localStorage.setItem(backupKey,JSON.stringify(backup));
 for(const [key,value] of Object.entries(result.merged))if(local[key]!==value)localStorage.setItem(prefix(id)+key,value);
 return {changed:true,message:'☁️ Felhőből biztonságosan átvett eredmények: '+result.changes.join('; ')};
}
async function restoreFromCloud(){
 if(!user||!activeChild){status('Előbb válassz gyermekprofilt!');return}
 if(busy)return;
 setBusy(true);const restoreButton=$('m10811-restore');restoreButton.disabled=true;
 try{
  status('☁️ A gyermek felhőeredményeinek lekérése…');
  const id=localId(user.uid,activeChild);
  const ref=fs.doc(db,'csaladok',user.uid,'gyermekek',activeChild,'eredmenyek','aktualis');
  const snap=await withTimeout(fs.getDocFromServer(ref),20000);
  if(!snap.exists()){status('A felhőben még nincs mentés. Nem történt módosítás.');return}
  const remote=snap.data().data;
  if(!remote||typeof remote!=='object'||Array.isArray(remote)){status('Hibás felhőadat; nem történt módosítás.');return}
  const local=localData(id),result=safeUnion(local,remote);
  const msg='Felhőadatok ellenőrzése:\n'+(result.changes.join('\n')||'Nincs új, biztonságosan átvehető adat.')+
   (result.issues.length?'\nNem egyesíthető mezők (változatlanok maradnak): '+result.issues.join(', '):'');
  status('🔒 '+msg+'\nFELHŐFELTÖLTÉS KIKAPCSOLVA.');
  if(!result.changes.length)return;
  if(!confirm(msg+'\n\nA helyi mentésről JSON biztonsági másolat készül. Ezután csak a felsorolt, biztonságosan egyesíthető mezők változnak a HELYI tárhelyen. A Firebase-be semmit nem írunk. Folytatod?'))return;
  downloadBackup(id,local);
  // Apply only after backup download has been initiated; never delete local-only keys.
  for(const [key,value] of Object.entries(result.merged)){
   if(local[key]!==value)localStorage.setItem(prefix(id)+key,value);
  }
  status('✅ Helyi eredmények egyesítve. A Firebase változatlan. Az eredmények megjelenítéséhez egyszer töltsd újra az oldalt.');
  alert('A helyi eredmények átvétele megtörtént, biztonsági mentés letöltése elindult. A Firebase-be nem írtunk. Most egyszer frissítsd az oldalt.');
 }catch(e){status('⚠️ Felhőletöltés sikertelen: '+(e.code||e.message||String(e))+'. A helyi és felhőadatok változatlanok.');}
 finally{setBusy(false);restoreButton.disabled=false}
}
$('m10811-restore').onclick=restoreFromCloud;
function setBusy(v){busy=v;for(const id of ['m108-signin','m108-register','m108-add','m108-signout'])$(id).disabled=v}
function withTimeout(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('A Firebase nem válaszolt '+Math.round(ms/1000)+' másodpercen belül. Ellenőrizd a kapcsolatot, majd próbáld újra.'),{code:'firestore/timeout'})),ms)})]).finally(()=>clearTimeout(timer))}
function selectedKey(){return user?'misa108-child-'+user.uid:null}
function paint(){ $('m108-login').hidden=!!user;$('m108-profile').hidden=!user; if(!user)return; $('m108-account').textContent='Szülői fiók: '+(user.email||'Bejelentkezve');const area=$('m108-children');area.replaceChildren();const chosen=activeChild;if(!profiles.length){const p=document.createElement('p');p.textContent='Még nincs gyermekprofil.';area.append(p)}for(const x of profiles){const b=document.createElement('button');b.type='button';b.textContent=(chosen===x.id?'✓ ':'')+x.nickname;b.className=chosen===x.id?'selected':'';b.onclick=()=>choose(x);area.append(b)}button.textContent=activeChild&&profiles.find(x=>x.id===activeChild)?'👤 '+profiles.find(x=>x.id===activeChild).nickname+' · Váltás':'👨‍👩‍👧 Családi profil'}
async function loadProfiles(){profiles=[];if(!user){paint();return}const snap=await withTimeout(fs.getDocs(fs.collection(db,'csaladok',user.uid,'gyermekek')),20000);profiles=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));sessionStorage.setItem('misa1083-profiles-'+user.uid,JSON.stringify(profiles));paint()}
async function action(fn){if(busy)return;setBusy(true);try{await fn()}catch(e){status('Hiba: '+(e.code||e.message||String(e))+'. Ellenőrizd a Firestore-szabályokat és az Authentication beállításait.')}finally{setBusy(false)}}
$('m108-signin').onclick=()=>action(async()=>{if(!auth)throw Error('Firebase még nem érhető el');await au.signInWithEmailAndPassword(auth,$('m108-email').value.trim(),$('m108-password').value);$('m108-password').value='';status('Sikeres bejelentkezés.')});
$('m108-register').onclick=()=>action(async()=>{if(!auth)throw Error('Firebase még nem érhető el');const email=$('m108-email').value.trim(),pass=$('m108-password').value;if(!email||pass.length<6)throw Error('Adj meg e-mail-címet és legalább 6 karakteres jelszót.');if(!confirm('Új szülői fiókot hozol létre a megadott e-mail-címmel. Folytatod?'))return;await au.createUserWithEmailAndPassword(auth,email,pass);$('m108-password').value='';status('Szülői fiók létrehozva. Most hozzáadhatsz egy becenevet.')});
$('m108-add').onclick=()=>action(async()=>{if(!user)throw Error('Jelentkezz be');const nickname=$('m108-nickname').value.trim();if(nickname.length<2||nickname.length>24||/[<>\n\r]/.test(nickname))throw Error('A becenév 2–24 karakter legyen.');if(profiles.length>=8)throw Error('Legfeljebb 8 gyermekprofil hozható létre.');const ref=fs.doc(fs.collection(db,'csaladok',user.uid,'gyermekek'));await fs.setDoc(ref,{nickname,createdAt:new Date().toISOString()});$('m108-nickname').value='';await loadProfiles();paint();status('Gyermekprofil létrehozva. Kattints a profil nevére a játék indításához.')});
$('m108-signout').onclick=()=>action(async()=>{await au.signOut(auth);status('Kijelentkezve.')});
button.onclick=()=>{shade.classList.add('show');$('m108-close').focus()};$('m108-close').onclick=()=>{if(activeChild)shade.classList.remove('show');else status('Előbb válassz gyermekprofilt!')};shade.addEventListener('click',e=>{if(e.target===shade&&activeChild)shade.classList.remove('show')});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeChild&&shade.classList.contains('show'))shade.classList.remove('show')});
(async()=>{try{const [a,u,f]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')]);app=a.getApps().find(x=>x.name==='misa108-family')||a.initializeApp(cfg,'misa108-family');auth=u.getAuth(app);db=f.initializeFirestore(app,{experimentalAutoDetectLongPolling:true,useFetchStreams:false});au=u;fs=f;u.onAuthStateChanged(auth,async current=>{
 user=current;profiles=[];activeChild=null;syncEnabled=false;pendingWrite=false;clearTimeout(syncTimer);clearTimeout(retryTimer);updateSyncButtons();paint();
 if(current){
  const selected=sessionStorage.getItem('misa1081-chosen');
  const offlineSelected=sessionStorage.getItem('misa1083-offline');
  const currentId=localStorage.getItem('misa343_active');
  if(offlineSelected&&offlineSelected===selected&&selected.startsWith(current.uid+':')&&currentId===localId(current.uid,selected.slice(current.uid.length+1))){
   try{profiles=JSON.parse(sessionStorage.getItem('misa1083-profiles-'+current.uid)||'[]')}catch(e){profiles=[]}
   const match=profiles.find(x=>selected===current.uid+':'+x.id);
   if(match){activeChild=match.id;offlineMode=true;cloudConflict=true;gate.style.display='none';shade.classList.remove('show');button.textContent='👤 '+match.nickname+' · Helyi mód';paint();status('Helyi mód: a felhőbe mentés szünetel.');return}
  }
  try{
   await loadProfiles();
   const match=profiles.find(x=>selected===current.uid+':'+x.id&&currentId===localId(current.uid,x.id));
   if(match){
    status('☁️ Legfrissebb eredmények ellenőrzése…');
    // Pull remote progress before exposing the game; writes remain disabled.
    const pull=await autoPull(match.id);
    activeChild=match.id;offlineMode=false;
    gate.style.display='none';shade.classList.remove('show');button.textContent='👤 '+match.nickname+' · Váltás';
    if(!cloudConflict){syncEnabled=true;updateSyncButtons();status(pull.message+' ✅ Automatikus felhőmentés aktív.');}
    else{syncEnabled=false;updateSyncButtons();status(pull.message+' 🔒 Adatütközés: felhőfeltöltés kikapcsolva.');}
    // The main game may have initialized from localStorage before this async pull.
    // One guarded reload allows it to read the merged state; no reload loop.
    if(pull.changed){
      const guard='misa10813-reloaded-'+current.uid+'-'+match.id;
      if(sessionStorage.getItem(guard)!=='1'){
       sessionStorage.setItem(guard,'1');location.reload();return;
      }
    }
   }
   else{gate.style.display='flex';shade.classList.add('show');status('Válassz gyermekprofilt a játékhoz!')}
  }catch(e){status('⚠️ Felhőfrissítés sikertelen: '+(e.code||e.message)+'. Az eredmények biztonsága miatt a játék indítása szünetel. Próbáld újra az oldal frissítésével.')}
 }else{sessionStorage.removeItem('misa1081-chosen');sessionStorage.removeItem('misa1083-offline');gate.style.display='flex';shade.classList.add('show');button.textContent='👨‍👩‍👧 Családi profil';status('Jelentkezz be vagy hozz létre szülői fiókot.')}
 })}catch(e){status('Firebase kapcsolat sikertelen: '+e.message)}})();
})();
