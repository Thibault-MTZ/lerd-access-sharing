// Le pont natif reste la seule voie d'accès ; aucune donnée n'est persistée.
(() => {
 const $=id=>document.getElementById(id);
 let snapshot=null;
 const text=(tag,value,cls)=>{const element=document.createElement(tag);element.textContent=String(value??'');if(cls)element.className=cls;return element};
 function render(){
  if(!snapshot)return;
  const query=$('search').value.trim().toLowerCase();
  const rows=snapshot.shares.filter(row=>(!$('active').checked||row.visibility!=='closed')&&(!query||[row.project,row.branch].filter(Boolean).join(' ').toLowerCase().includes(query)));
  $('rows').replaceChildren();
  for(const row of rows){
   const tr=document.createElement('tr');const identity=document.createElement('td');
   identity.append(text('strong',row.project));
   if(row.branch)identity.append(text('div',row.branch,'lerd-muted'));
   const state=document.createElement('td');
   state.append(text('span',({public:'Public natif',private:'LAN',closed:'Fermé'})[row.visibility]||'Inconnu','lerd-pill '+(row.visibility==='closed'?'':'accent')));
   if(row.paused)state.append(text('span','En pause','lerd-pill warn'));
   const address=document.createElement('td');
   if(row.url){const link=text('a',row.url,'lerd-mono');link.href=row.url;link.target='_blank';link.rel='noopener noreferrer';address.append(link)}
   else address.append(text('span','—','lerd-muted'));
   const port=text('td',row.port_reported?row.port:row.visibility==='public'?'Non exposé par l’API':'—','lerd-muted');
   tr.append(identity,state,address,port);$('rows').append(tr);
  }
  $('empty').hidden=rows.length!==0;
  $('count').textContent=rows.length+' affiché(s) · '+snapshot.active_count+' actif(s)';
  $('limits').replaceChildren(...snapshot.limits.map(value=>text('li',value)));
 }
 async function refresh(){
  $('refresh').disabled=true;$('status').textContent='Lecture de l’état natif…';
  try{
   const data=JSON.parse(await lerd.api('shares'));
   if(data.schema_version!==1||data.read_only!==true||!Array.isArray(data.shares))throw new Error('Réponse du plugin non reconnue.');
   snapshot=data;render();$('status').textContent='Source : '+data.source+' · état lu à '+new Date().toLocaleTimeString('fr-FR');
  }catch(error){$('status').textContent=error.message||'Lecture impossible.'}
  finally{$('refresh').disabled=false}
 }
 $('refresh').addEventListener('click',refresh);
 $('search').addEventListener('input',render);
 $('active').addEventListener('change',render);
 refresh();
})();
