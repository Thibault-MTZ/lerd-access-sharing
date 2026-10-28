// L’interface n’applique jamais une politique avant validation explicite.
(() => {
 const $=id=>document.getElementById(id);
 const context=lerd.context||{};
 const scopedSite=context.site||'';
 const scopedBranch=context.branch||'';
 let snapshot=null;
 let target=null;
 let revision=null;
 let originalMode='closed';
 let returnFocus=null;
 let credentialCount=0;
 const modes=new Set(['closed','public','ip','password','ip_and_password','ip_or_password']);
 const text=(tag,value,cls)=>{const element=document.createElement(tag);element.textContent=String(value??'');if(cls)element.className=cls;return element};
 const isContextTarget=row=>!scopedSite||(row.project===scopedSite&&(row.branch||'')===scopedBranch);
 const displayBranch=row=>row.git_branch||row.branch||'';
 const policyPath=row=>'policy?site='+encodeURIComponent(row.project)+'&branch='+encodeURIComponent(row.branch||'');
 const policyModes=new Map([
  ['closed',{label:'Refus total',className:'bad'}],['public',{label:'Sans contrôle',className:'warn'}],
  ['ip',{label:'Filtrage IP',className:'ok'}],['password',{label:'Compte requis',className:'ok'}],
  ['ip_and_password',{label:'IP + compte',className:'ok'}],['ip_or_password',{label:'IP ou compte',className:'warn'}]
 ]);
 function protectionCell(row){
  const cell=document.createElement('td');
  if(row.visibility==='private'){
   cell.append(text('span','LAN : hors portée','lerd-pill warn'));return cell;
  }
  if(row.visibility==='closed'){
   cell.append(text('span',row.access_policy_reported?'Règle préparée':'—',row.access_policy_reported?'lerd-pill warn':'lerd-muted'));return cell;
  }
  if(row.paused){cell.append(text('span','Partage en pause','lerd-pill warn'));return cell}
  if(snapshot.native_access_available!==true){cell.append(text('span','Protection indisponible','lerd-pill warn'));return cell}
  if(row.access_policy_reported!==true||!row.access_summary||typeof row.access_summary.mode!=='string'){
   cell.append(text('span','Protection non rapportée','lerd-muted'));return cell;
  }
  const policy=policyModes.get(row.access_summary.mode);
  if(!policy){cell.append(text('span','Mode inconnu','lerd-pill warn'));return cell}
  cell.append(text('span',policy.label,'lerd-pill '+policy.className));
  const rate=row.access_summary.rate;
  if(rate&&typeof rate.requests_per_second==='number'){
   const detail=rate.requests_per_second>0?'Limite '+rate.requests_per_second+' req/s'+(typeof rate.burst==='number'?' · burst '+rate.burst:''):'Limite désactivée';
   cell.append(text('div',detail,'lerd-muted'));
  }
  return cell;
 }
 function parseResponse(value){return typeof value==='string'?JSON.parse(value):value}
 function customLerdMessage(error){
  const message=String(error&&error.message||'');
  if(/\b404\b|not found|protections natives indisponibles/i.test(message))return 'Protection native indisponible pour cette cible. Vérifiez la version de LERD et que le site ou worktree existe.';
  if(/règles ont changé|rules changed/i.test(message))return 'Les règles ont changé ailleurs. Rechargez la politique avant de réessayer.';
  return 'Impossible de lire ou d’enregistrer la politique d’accès.';
 }
 function updateModeFields(){
  const mode=$('mode').value;
  $('networks-field').hidden=!(mode==='ip'||mode==='ip_and_password'||mode==='ip_or_password');
  $('accounts-field').hidden=!(mode==='password'||mode==='ip_and_password'||mode==='ip_or_password');
  updateImpact();
 }
 function updateImpact(){
  const mode=$('mode').value;
  const labels={closed:'La cible sera fermée à tout accès.',public:'L’accès restera public.',ip:'Seuls les réseaux CIDR indiqués pourront accéder au site.',password:'Un compte valide sera requis.',ip_and_password:'Un réseau autorisé et un compte valide seront requis.',ip_or_password:'Un réseau autorisé ou un compte valide suffira.'};
  const networkValues=$('networks').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  const needsNetwork=mode==='ip'||mode==='ip_and_password'||mode==='ip_or_password';
  const needsAccount=mode==='password'||mode==='ip_and_password'||mode==='ip_or_password';
  const addedUsers=needsAccount?credentialRows().map(row=>row.username):[];
  const removedUsers=needsAccount?[...$('existing-users').querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value):[];
  let impact=labels[mode]||'';
  if(needsNetwork)impact+=' Réseaux autorisés : '+(networkValues.join(', ')||'aucun')+'.';
  if(addedUsers.length)impact+=' Comptes ajoutés ou renouvelés : '+addedUsers.join(', ')+'.';
  if(removedUsers.length)impact+=' Comptes retirés : '+removedUsers.join(', ')+'.';
  const rate=Number($('rate').value||0);
  impact+=' Limite : '+(rate>0?rate+' requêtes/s, burst '+$('burst').value:'désactivée')+'.';
  $('impact-summary').textContent=impact;
 }
 function credentialRows(){return [...$('credentials').querySelectorAll('[data-credential]')].map(row=>({
  username:row.querySelector('[data-username]').value.trim(),
  password:row.querySelector('[data-password]').value
 })).filter(row=>row.username&&row.password)}
 function hasPartialCredentials(){return [...$('credentials').querySelectorAll('[data-credential]')].some(row=>{
  const username=row.querySelector('[data-username]').value.trim();
  const password=row.querySelector('[data-password]').value;
  return Boolean(username)!==Boolean(password);
 })}
 function addCredential(){
  const row=document.createElement('div');row.dataset.credential=String(++credentialCount);row.className='credential-row lerd-section';
  const userField=document.createElement('div');userField.className='form-field';
  const userLabel=document.createElement('label');userLabel.htmlFor='lerd-account-'+credentialCount;userLabel.textContent='Nom du compte';
  const user=document.createElement('input');user.id=userLabel.htmlFor;user.type='text';user.autocomplete='off';user.dataset.username='';
  userField.append(userLabel,user);
  const passwordField=document.createElement('div');passwordField.className='form-field';
  const passwordLabel=document.createElement('label');passwordLabel.htmlFor='lerd-password-'+credentialCount;passwordLabel.textContent='Mot de passe';
  const secret=document.createElement('input');secret.id=passwordLabel.htmlFor;secret.type='password';secret.autocomplete='new-password';secret.dataset.password='';
  passwordField.append(passwordLabel,secret);
  const remove=document.createElement('button');remove.type='button';remove.textContent='Retirer';remove.addEventListener('click',()=>{row.remove();updateImpact()});
  row.append(userField,passwordField,remove);$('credentials').append(row);
  user.addEventListener('input',updateImpact);secret.addEventListener('input',updateImpact);
 }
 function renderUsers(users){
  $('existing-users').replaceChildren();
  for(const user of users){
   if(!user||typeof user.username!=='string')continue;
   const label=document.createElement('label');
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=user.username;
   checkbox.addEventListener('change',updateImpact);
   label.append(checkbox,document.createTextNode(' Retirer '+user.username));$('existing-users').append(label);
  }
 }
 function render(){
  if(!snapshot)return;
  const query=$('search').value.trim().toLowerCase();
  const rows=snapshot.shares.filter(row=>isContextTarget(row)&&(! $('active').checked||row.visibility!=='closed')&&(!query||[row.project,displayBranch(row),row.branch].filter(Boolean).join(' ').toLowerCase().includes(query)));
  $('rows').replaceChildren();
  for(const row of rows){
   const tr=document.createElement('tr');const identity=document.createElement('td');
   identity.append(text('strong',row.project));
   if(displayBranch(row))identity.append(text('div',displayBranch(row),'lerd-muted'));
   const state=document.createElement('td');
   const shareLabel=row.paused?'Partage en pause':({public:'Partage public actif',private:'Partage LAN actif',closed:'Partage arrêté'})[row.visibility]||'État inconnu';
   state.append(text('span',shareLabel,'lerd-pill '+(row.paused?'warn':row.visibility==='closed'?'bad':'accent')));
   const address=document.createElement('td');
   if(row.url){const link=text('a',row.url,'lerd-mono');link.href=row.url;link.target='_blank';link.rel='noopener noreferrer';address.append(link)}
   else address.append(text('span','—','lerd-muted'));
   const port=text('td',row.port_reported?row.port:row.visibility==='public'?'Non exposé par l’API':'—','lerd-muted');
   const protection=protectionCell(row);
   const actions=document.createElement('td');const configure=document.createElement('button');configure.type='button';configure.textContent='Configurer l’accès';configure.setAttribute('aria-label','Configurer l’accès pour '+row.project+(row.branch?' · '+displayBranch(row):''));configure.addEventListener('click',()=>openPolicy(row,configure));actions.append(configure);
   tr.append(identity,state,address,port,protection,actions);$('rows').append(tr);
  }
  $('empty').hidden=rows.length!==0;
  $('count').textContent=rows.length+' affiché(s) · '+snapshot.active_count+' actif(s)';
 }
 async function refresh(){
  $('refresh').disabled=true;$('status').textContent='Lecture de l’état natif…';
  try{
   const data=parseResponse(await lerd.api('shares'));
   if(data.schema_version!==1||data.read_only!==true||!Array.isArray(data.shares))throw new Error('Réponse du plugin non reconnue.');
   snapshot=data;render();$('status').textContent='Source : '+data.source+' · état lu à '+new Date().toLocaleTimeString('fr-FR');
  }catch(error){$('status').textContent=error.message||'Lecture impossible.'}
  finally{$('refresh').disabled=false}
 }
 function clearCredentials(){
  for(const input of $('credentials').querySelectorAll('[data-password]'))input.value='';
  $('credentials').replaceChildren();
 }
 function closeDialog(){clearCredentials();$('dialog-error').textContent='';$('policy-dialog').close();if(returnFocus)returnFocus.focus()}
 async function openPolicy(row,trigger=returnFocus){
  returnFocus=trigger||document.activeElement;
  target={project:row.project,branch:row.branch||''};revision=null;
  $('target-label').textContent=target.project+(target.branch?' · '+displayBranch(row):' · site');
  $('policy-status').textContent='Lecture de la politique…';$('dialog-error').textContent='';$('apply-policy').disabled=true;
  $('mode').value='closed';$('networks').value='';$('rate').value='0';$('burst').value='60';renderUsers([]);clearCredentials();updateModeFields();
  $('policy-dialog').showModal();
  try{
   const policy=parseResponse(await lerd.api(policyPath(target)));
   if(!policy||policy.version!==1||policy.site!==target.project||(policy.branch||'')!==target.branch||!modes.has(policy.mode)||!Number.isInteger(policy.revision)||policy.enforcement!=='native'||!Array.isArray(policy.networks)||!Array.isArray(policy.users)||!policy.rate||typeof policy.rate.requests_per_second!=='number'||typeof policy.rate.burst!=='number')throw new Error('Contrat de politique non reconnu.');
   revision=policy.revision;originalMode=policy.mode;$('mode').value=policy.mode;$('networks').value=policy.networks.join('\n');$('rate').value=String(policy.rate.requests_per_second);$('burst').value=String(policy.rate.burst);
   renderUsers(policy.users);$('policy-status').textContent='Politique native · révision '+policy.revision+'. Les mots de passe ne sont pas lisibles.';
   $('apply-policy').disabled=false;updateModeFields();$('mode').focus();
  }catch(error){$('policy-status').textContent=customLerdMessage(error);$('apply-policy').disabled=true}
 }
 function validatePolicy(){
  $('dialog-error').textContent='';
  if(!target||!Number.isInteger(revision)){$('dialog-error').textContent='La politique n’est pas disponible pour cette cible.';$('dialog-error').focus();return false}
  const mode=$('mode').value;
  const networks=$('networks').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  const credentials=credentialRows();
  const removeCount=$('existing-users').querySelectorAll('input[type="checkbox"]:checked').length;
  const currentUsers=$('existing-users').querySelectorAll('input[type="checkbox"]').length;
  const needsNetwork=mode==='ip'||mode==='ip_and_password'||mode==='ip_or_password';
  const needsAccount=mode==='password'||mode==='ip_and_password'||mode==='ip_or_password';
  if(needsAccount&&hasPartialCredentials()){$('dialog-error').textContent='Chaque compte ajouté doit avoir un nom et un mot de passe.';$('dialog-error').focus();return false}
  if(needsAccount){
   const usernames=new Set();
   for(const credential of credentials){
    if(Array.from(credential.username).length>128||credential.username.includes(':')){$('dialog-error').textContent='Un nom de compte dépasse 128 caractères ou contient « : ».';$('dialog-error').focus();return false}
    if(usernames.has(credential.username)){$('dialog-error').textContent='Chaque nom de compte ajouté doit être unique.';$('dialog-error').focus();return false}
    usernames.add(credential.username);
    const bytes=new TextEncoder().encode(credential.password).length;
    if(bytes<8||bytes>72){$('dialog-error').textContent='Chaque mot de passe doit contenir entre 8 et 72 octets en UTF-8.';$('dialog-error').focus();return false}
   }
  }
  if(!modes.has(mode)){$('dialog-error').textContent='Choisissez un mode d’accès valide.';$('dialog-error').focus();return false}
  if(needsNetwork&&!networks.length){$('dialog-error').textContent='Ajoutez au moins un réseau CIDR pour ce mode.';$('dialog-error').focus();return false}
  if(needsAccount&&credentials.length+currentUsers-removeCount===0){$('dialog-error').textContent='Conservez ou ajoutez au moins un compte pour ce mode.';$('dialog-error').focus();return false}
  const rate=Number($('rate').value||0);const burst=Number($('burst').value||60);
  if(!Number.isFinite(rate)||rate<0||rate>100000||!Number.isInteger(burst)||burst<1||burst>10000){$('dialog-error').textContent='La limite doit être entre 0 et 100000 requêtes/s, avec un burst entre 1 et 10000.';$('dialog-error').focus();return false}
  return true;
 }
 function previewChanges(){
  if(!validatePolicy())return;
  const mode=$('mode').value;
  const needsAccount=mode==='password'||mode==='ip_and_password'||mode==='ip_or_password';
  const removeCount=needsAccount?$('existing-users').querySelectorAll('input[type="checkbox"]:checked').length:0;
  $('confirm-target').textContent=$('target-label').textContent;
  $('confirm-summary').textContent=$('impact-summary').textContent;
  const mayReduce=mode==='public'||(mode==='closed'&&originalMode!=='closed')||removeCount>0;
  $('confirm-warning').hidden=!mayReduce;
  const button=$('confirm-apply');button.className=mayReduce?'danger':'primary';
  $('confirm-dialog').showModal();button.focus();
 }
 async function applyPolicy(){
  if(!target||!Number.isInteger(revision)){$('confirm-dialog').close();$('dialog-error').textContent='La politique n’est plus disponible. Rechargez-la avant de réessayer.';return}
  const mode=$('mode').value;
  const needsNetwork=mode==='ip'||mode==='ip_and_password'||mode==='ip_or_password';
  const needsAccount=mode==='password'||mode==='ip_and_password'||mode==='ip_or_password';
  const networks=needsNetwork?$('networks').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean):[];
  const credentials=needsAccount?credentialRows():[];
  const remove_users=needsAccount?[...$('existing-users').querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value):[];
  const rate=Number($('rate').value||0);const burst=Number($('burst').value||60);
  const payload={site:target.project,branch:target.branch,mode,networks,credentials,remove_users,revision,rate:{requests_per_second:rate,burst}};
  $('apply-policy').disabled=true;$('dialog-error').textContent='Application en cours…';
  try{
   await lerd.api(policyPath(target),{method:'POST',body:payload});
   $('dialog-error').textContent='';$('confirm-dialog').close();$('policy-status').textContent='Politique enregistrée. Le statut effectif doit être confirmé par LERD.';
   // Le secret quitte le DOM dès la fin de la requête, succès ou erreur.
   clearCredentials();
   await refresh();
   const row=snapshot.shares.find(item=>item.project===target.project&&(item.branch||'')===target.branch);
   if(row){$('policy-dialog').close();await openPolicy(row,returnFocus)}
  }catch(error){clearCredentials();$('confirm-dialog').close();$('dialog-error').textContent=customLerdMessage(error);$('dialog-error').focus?.()}
  finally{$('apply-policy').disabled=false}
 }
 $('refresh').addEventListener('click',refresh);
 $('search').addEventListener('input',render);
 $('active').addEventListener('change',render);
 $('mode').addEventListener('change',updateModeFields);
 $('networks').addEventListener('input',updateImpact);
 $('rate').addEventListener('input',updateImpact);$('burst').addEventListener('input',updateImpact);
 $('add-credential').addEventListener('click',()=>addCredential());
 $('cancel-policy').addEventListener('click',closeDialog);
 $('apply-policy').addEventListener('click',previewChanges);
 $('confirm-apply').addEventListener('click',applyPolicy);
 $('back-to-policy').addEventListener('click',()=>{$('confirm-dialog').close();$('apply-policy').focus()});
 $('policy-dialog').addEventListener('cancel',clearCredentials);
 $('context-note').hidden=!scopedSite;
 if(scopedSite){$('active').checked=false}
 refresh();
})();
