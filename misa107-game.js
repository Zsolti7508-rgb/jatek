/* Misa 10.7 – automatic check; manual retry; stable progress indices. */
(function(){'use strict';
 const cfg={apiKey:'AIzaSyCtqncLwvLGRfPaJyX5v3mTKnFwJbwqP1w',authDomain:'gyakoroljunk-misaval.firebaseapp.com',projectId:'gyakoroljunk-misaval',appId:'1:606749224072:web:1dc42e9b9810a59541833d'};
 const gate=document.createElement('div');gate.id='misa107startup';gate.setAttribute('role','status');gate.setAttribute('aria-live','polite');gate.style.cssText='position:fixed;inset:0;z-index:999999;background:#102a3eea;color:white;display:flex;align-items:center;justify-content:center;text-align:center;font:700 21px/1.5 system-ui;padding:25px';gate.textContent='☁️ A közzétett tananyag ellenőrzése…';document.body.appendChild(gate);const release=()=>{if(gate.isConnected)gate.remove()};
 // Safety net independent of Firebase promises: never trap the player behind this overlay.
 const startupTimer=setTimeout(()=>{release();console.warn('Misa: felhős tananyag ellenőrzése tovább tart; a helyi játék elérhető.')},6500);
 const button=document.createElement('button');button.type='button';button.id='misa107refresh';button.textContent='☁️ Felhőfrissítés';button.style.cssText='position:fixed;bottom:12px;left:12px;z-index:99990;background:#1a5674;color:#fff;border:2px solid #fff;border-radius:10px;padding:11px 14px;font:700 14px system-ui;cursor:pointer';
 const info=document.createElement('div');info.id='misa107info';info.setAttribute('role','status');info.style.cssText='position:fixed;bottom:65px;left:12px;max-width:min(420px,90vw);z-index:99991;background:#173445;color:white;border:1px solid #8cb3cb;border-radius:10px;padding:12px;font:14px/1.5 system-ui;box-shadow:0 4px 20px #0007;display:none;pointer-events:none';
 const say=s=>{info.textContent=s;info.style.display='block'};
 document.body.append(button,info);
 if(window.Misa107?.active){say('☁️ Közzétett tananyag aktív: '+window.Misa107.count+' kérdés. Verzió: '+window.Misa107.version);setTimeout(()=>info.style.display='none',3000)}
 else if(window.Misa107?.error)say('⚠️ Felhős tananyag elutasítva: '+window.Misa107.error+' · A beépített kérdésbank maradt aktív.');
 let busy=false;
 function limited(p,ms){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('A Firebase nem válaszolt időben ('+Math.round(ms/1000)+' mp).')),ms)})]).finally(()=>clearTimeout(timer))}
 async function refresh(manual){
  if(busy)return;busy=true;button.disabled=true;
  if(manual)say('Felhős tananyag ellenőrzése…');
  try{
   const [a,f]=await limited(Promise.all([import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')]),8000);
   const app=a.getApps().find(x=>x.name==='misa108-family') || a.getApps().find(x=>x.name==='[DEFAULT]') || a.initializeApp(cfg,'misa107-public');
   const db=f.getFirestore(app);
   const m=await limited(f.getDoc(f.doc(db,'publikus_tananyag','aktualis')),8000);if(!m.exists())throw Error('Még nincs közzétett tananyag');
   const meta=m.data();if(!Number.isInteger(meta.parts)||meta.parts<1||meta.parts>200||typeof meta.version!=='string')throw Error('Hibás közzététel');
   if(window.Misa107?.active&&window.Misa107.version===meta.version){if(manual)say('✓ A legfrissebb tananyag aktív ('+window.Misa107.count+' kérdés).');return}
   const parts=[];for(let i=0;i<meta.parts;i++){const p=await limited(f.getDoc(f.doc(db,'publikus_tananyag',meta.version+'_p'+i)),8000);if(!p.exists()||typeof p.data().text!=='string')throw Error('Hiányzó adatrész: '+i);parts.push(p.data().text)}
   const data=JSON.parse(parts.join('')),check=window.Misa107.convert(data);
   try{sessionStorage.setItem(window.Misa107.key,JSON.stringify({version:meta.version,data}))}catch(e){throw Error('A böngésző ideiglenes tárhelye megtelt')}
   say('✓ '+check.total+' kérdés ellenőrizve. Frissítés, az eredmények megtartásával…');location.reload();
  }catch(e){if(manual||!window.Misa107?.active)say('⚠️ Felhőellenőrzés sikertelen: '+e.message+'. A meglévő játék használható marad.');}
  finally{busy=false;button.disabled=false;clearTimeout(startupTimer);release()}
 }
 button.onclick=()=>refresh(true);
 // Do not block the game startup; one non-destructive version check per page load.
 refresh(false);
})();
