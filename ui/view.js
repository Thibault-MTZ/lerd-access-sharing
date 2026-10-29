function groupShares(rows){
 const groups=new Map();
 for(const row of rows||[]){
  if(!row||typeof row.project!=='string'||!row.project)continue;
  let group=groups.get(row.project);
  if(!group){group={project:row.project,site:null,worktrees:[]};groups.set(row.project,group)}
  if(row.kind==='worktree')group.worktrees.push(row);
  else if(!group.site)group.site=row;
 }
 return [...groups.values()];
}
function filterGroups(groups,options={}){
 const query=String(options.query||'').trim().toLocaleLowerCase();
 const nativeAvailable=options.nativeAccessAvailable===true;
 const rowMatch=(row,projectMatches)=>{
  if(options.site&&row.project!==options.site)return false;
  if(options.site&&(row.branch||'')!==(options.branch||''))return false;
  if(options.share==='active'&&(row.paused||row.visibility==='closed'))return false;
  if(options.share==='public'&&(row.paused||row.visibility!=='public'))return false;
  if(options.share==='lan'&&(row.paused||row.visibility!=='private'))return false;
  if(options.share==='paused'&&!row.paused)return false;
  if(options.share==='stopped'&&(row.paused||row.visibility!=='closed'))return false;
  const policy=row.visibility==='private'?'outside':!nativeAvailable?'unavailable':row.access_policy_reported&&row.access_summary?.mode?row.access_summary.mode:'unreported';
  if(options.protection&&options.protection!=='all'&&options.protection!==policy)return false;
  return !query||projectMatches||[row.project,row.branch,row.git_branch].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
 };
 const result=[];
 for(const group of groups||[]){
  const projectMatches=Boolean(query)&&group.project.toLocaleLowerCase().includes(query);
  const site=group.site&&rowMatch(group.site,projectMatches)?group.site:null;
  const worktrees=group.worktrees.filter(row=>rowMatch(row,projectMatches));
  if(site||worktrees.length)result.push({...group,site,worktrees});
 }
 return result;
}
function sortGroups(groups,sortBy='name'){
 const collator=new Intl.Collator('fr',{sensitivity:'base',numeric:true});
 const name=row=>String(row.git_branch||row.branch||row.project||'');
 const activity=row=>row.paused?1:row.visibility==='public'||row.visibility==='private'?3:0;
 const protectionScores=new Map([['closed',5],['ip_and_password',4],['password',4],['ip',4],['ip_or_password',3],['public',2]]);
 const protection=row=>row.access_policy_reported?protectionScores.get(row.access_summary?.mode)||0:0;
 const score=(group,fn)=>Math.max(0,...[group.site,...group.worktrees].filter(Boolean).map(fn));
 const compareTargets=(a,b)=>{
  if(sortBy==='activity'&&activity(a)!==activity(b))return activity(b)-activity(a);
  if(sortBy==='protection'&&protection(a)!==protection(b))return protection(b)-protection(a);
  return collator.compare(name(a),name(b));
 };
 return (groups||[]).map(group=>({...group,worktrees:[...group.worktrees].sort(compareTargets)})).sort((a,b)=>{
  if(sortBy==='activity'&&score(a,activity)!==score(b,activity))return score(b,activity)-score(a,activity);
  if(sortBy==='protection'&&score(a,protection)!==score(b,protection))return score(b,protection)-score(a,protection);
  return collator.compare(a.project,b.project);
 });
}
function nonEmptySecret(value){return typeof value==='string'&&value.length>0}
function isInlineAccess(context){return Boolean(context&&context.intent==='access')}

function shareStatus(row,nativeAvailable=true){
 if(row.paused)return {label:'En pause',tone:'bad',protection:null};
 if(row.visibility==='closed')return {label:'Non partagé',tone:'bad',protection:null};
 if(row.visibility==='private')return {label:'LAN seulement',tone:'warn',protection:null};
 if(row.visibility!=='public')return {label:'État inconnu',tone:'warn',protection:null};
 const summary=nativeAvailable&&row.access_policy_reported?row.access_summary:null;
 if(summary?.mode==='closed')return {label:'Refus total',tone:'bad',protection:null};
 if(!['public','ip','password','ip_and_password','ip_or_password'].includes(summary?.mode))return {label:'Partage actif',tone:'ok',protection:'Protection non rapportée'};
 const auth=['ip','password','ip_and_password','ip_or_password'].includes(summary?.mode);
 const rate=summary?.rate?.requests_per_second;
 if(auth||typeof rate==='number'&&Number.isFinite(rate)&&rate>0)return {label:'Partage actif',tone:'ok',protection:'Protégé'};
 if(summary?.mode==='public'&&rate===0)return {label:'Partage actif',tone:'ok',protection:'Sans restriction'};
 return {label:'Partage actif',tone:'ok',protection:'Protection non rapportée'};
}
function activeShareCount(group,nativeAvailable=true){
 return [group.site,...group.worktrees].filter(Boolean).filter(row=>['Partage actif','LAN seulement'].includes(shareStatus(row,nativeAvailable).label)).length;
}
function projectInitiallyCollapsed(group,nativeAvailable=true){return activeShareCount(group,nativeAvailable)===0}
function policyInheritance(policy){
 if(policy.inherited===undefined&&policy.parent_revision===undefined)return {available:false,inherited:false,parent_revision:null};
 if(typeof policy.inherited!=='boolean'||!Number.isInteger(policy.parent_revision)||policy.parent_revision<0)throw new Error('Métadonnées d’héritage non reconnues.');
 return {available:true,inherited:policy.inherited,parent_revision:policy.parent_revision};
}
function inheritanceResetPayload(site,branch,revision,parent_revision){
 if(!branch||!Number.isInteger(revision)||revision<0||!Number.isInteger(parent_revision)||parent_revision<0)throw new Error('Contexte d’héritage incomplet.');
 return {site,branch,inherit:true,revision,parent_revision};
}
function inheritanceLabel(row){
 if(row.kind!=='worktree'||typeof row.access_summary?.inherited!=='boolean')return null;
 return row.access_summary.inherited?'Règles du parent':'Règles personnalisées';
}

if(typeof module!=='undefined'&&module.exports)module.exports={groupShares,filterGroups,sortGroups,nonEmptySecret,isInlineAccess,shareStatus,activeShareCount,projectInitiallyCollapsed,policyInheritance,inheritanceResetPayload,inheritanceLabel};
else (()=>{
// L’interface n’applique jamais une politique avant validation explicite.
 const $=id=>document.getElementById(id);
 const context=lerd.context||{};
 const contextIntent=isInlineAccess(context);
 const scopedSite=context.site||'';
 const scopedBranch=context.branch||'';
 let snapshot=null;
 let target=null;
 let detailReturnFocus=null;
 let autoOpened=false;
 let revision=null;
 let originalMode='closed';
 let parentRevision=null;
 let inheritanceAvailable=false;
 let originalInherited=false;
 let pendingReset=false;
 let returnFocus=null;
 let credentialCount=0;
 const collapsedProjects=new Set();
 const knownProjects=new Set();
 const modes=new Set(['closed','public','ip','password','ip_and_password','ip_or_password']);
 const text=(tag,value,cls)=>{const element=document.createElement(tag);element.textContent=String(value??'');if(cls)element.className=cls;return element};
 const displayBranch=row=>row.git_branch||row.branch||'';
 const policyPath=row=>'policy?site='+encodeURIComponent(row.project)+'&branch='+encodeURIComponent(row.branch||'');
 const policyModes=new Map([
  ['closed',{label:'Refus total',className:'bad'}],['public',{label:'Sans contrôle IP/compte',className:'ok'}],
  ['ip',{label:'Filtrage IP',className:'warn'}],['password',{label:'Compte requis',className:'warn'}],
  ['ip_and_password',{label:'IP + compte',className:'warn'}],['ip_or_password',{label:'IP ou compte',className:'warn'}]
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
  const denial=row.access_summary.denial_status;
  if(denial===403||denial===404)cell.append(text('div','Refus '+denial+(denial===404?' · Introuvable':' · Accès refusé'),'lerd-muted'));
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
  if(usesParentRules()){$('impact-summary').textContent='Cette branche suivra les règles du projet parent (révision '+parentRevision+'). Les règles personnalisées seront retirées, sans changer le parent ni la publication.';return}
  const mode=$('mode').value;
  const labels={closed:'La cible sera fermée à tout accès.',public:'L’accès restera public.',ip:'Seuls les réseaux CIDR indiqués pourront accéder au site.',password:'Un compte valide sera requis.',ip_and_password:'Un réseau autorisé et un compte valide seront requis.',ip_or_password:'Un réseau autorisé ou un compte valide suffira.'};
  const networkValues=$('networks').value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
  const needsNetwork=mode==='ip'||mode==='ip_and_password'||mode==='ip_or_password';
  const needsAccount=mode==='password'||mode==='ip_and_password'||mode==='ip_or_password';
  const addedUsers=needsAccount?credentialRows().map(row=>row.username):[];
  const removedUsers=needsAccount?[...$('existing-users').querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value):[];
  let impact=labels[mode]||'';
  if(target?.branch&&inheritanceAvailable&&originalInherited)impact+=' Une exception sera créée pour cette branche ; les changements futurs du parent ne seront plus suivis.';
  if(needsNetwork)impact+=' Réseaux autorisés : '+(networkValues.join(', ')||'aucun')+'.';
  if(addedUsers.length)impact+=' Comptes ajoutés ou renouvelés : '+addedUsers.join(', ')+'.';
  if(removedUsers.length)impact+=' Comptes retirés : '+removedUsers.join(', ')+'.';
  const denial=Number($('denial-status').value);
  impact+=' Refus réseau : '+(denial===404?'404 Introuvable':'403 Accès refusé')+'.';
  if(needsAccount)impact+=' Basic Auth conserve 401.';
  const rate=Number($('rate').value||0);
  impact+=' Limite : '+(rate>0?rate+' requêtes/s, burst '+$('burst').value:'désactivée')+'.';
  $('impact-summary').textContent=impact;
 }
 function usesParentRules(){return Boolean(target?.branch&&inheritanceAvailable&&$('inherit-parent').checked)}
 function updateInheritanceFields(){
  const inherited=usesParentRules();
  $('apply-policy').disabled=!Number.isInteger(revision)||(inherited&&originalInherited);
  for(const id of ['mode','denial-status','networks','rate','burst','add-credential'])$(id).disabled=inherited;
  for(const input of $('existing-users').querySelectorAll('input'))input.disabled=inherited;
  for(const input of $('credentials').querySelectorAll('input,button'))input.disabled=inherited;
  $('inheritance-help').textContent=inherited?'La branche suit les changements du parent. Décochez pour préparer une exception.':'Les changements créent ou modifient une exception pour cette branche uniquement.';
  updateImpact();
 }
 function credentialRows(){return [...$('credentials').querySelectorAll('[data-credential]')].map(row=>({
  username:row.querySelector('[data-username]').value.trim(),
  password:row.querySelector('[data-password]').value
 })).filter(row=>row.username&&nonEmptySecret(row.password))}
 function hasPartialCredentials(){return [...$('credentials').querySelectorAll('[data-credential]')].some(row=>{
  const username=row.querySelector('[data-username]').value.trim();
  const password=row.querySelector('[data-password]').value;
  return Boolean(username)!==nonEmptySecret(password);
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
 function protectionDescription(row){
  if(row.visibility==='private')return 'LAN : hors portée';
  if(row.paused)return row.access_policy_reported?'Règle préparée · partage en pause':'Partage en pause';
  if(row.visibility==='closed')return row.access_policy_reported?'Règle préparée · partage arrêté':'Partage arrêté';
  if(snapshot.native_access_available!==true)return 'Protection indisponible';
  if(row.access_policy_reported!==true||!row.access_summary)return 'Protection non rapportée';
  const policy=policyModes.get(row.access_summary.mode);
  if(!policy)return 'Mode inconnu';
  const rate=row.access_summary.rate;
  const detail=rate&&typeof rate.requests_per_second==='number'?(rate.requests_per_second>0?' · '+rate.requests_per_second+' req/s'+(typeof rate.burst==='number'?' · burst '+rate.burst:''):' · limite désactivée'):'';
  const denial=row.access_summary.denial_status;
  const denialDetail=denial===403||denial===404?' · refus '+denial:'';
  return policy.label+detail+denialDetail;
 }
 function openDetails(row,trigger){
  detailReturnFocus=trigger||document.activeElement;
  $('details-title').textContent=row.project+(row.branch?' · '+displayBranch(row):'');
  const fields=$('detail-fields');fields.replaceChildren();
  const add=(label,value)=>{fields.append(text('dt',label,'lerd-label'),text('dd',value,'lerd-muted'))};
  add('Type',row.kind==='worktree'?'Worktree':'Site');
  if(row.domain)add('Domaine LERD',row.domain);
  if(row.framework)add('Framework',row.framework);
  if(row.php_version)add('PHP',row.php_version);
  if(row.node_version)add('Node.js',row.node_version);
  if(!row.branch&&row.git_branch)add('Branche Git',row.git_branch);
  if(row.branch){add('Branche',displayBranch(row));if(row.git_branch&&row.git_branch!==row.branch)add('Identifiant LERD',row.branch)}
  add('Partage',row.paused?'En pause':row.visibility==='public'?'Public actif':row.visibility==='private'?'LAN actif':'Arrêté');
  if(row.url)add('URL',row.url);
  if(row.port_reported)add('Port',row.port);else if(row.visibility==='public')add('Port','Non exposé par l’API');
  add('Protection native',protectionDescription(row));
  const origin=inheritanceLabel(row);if(origin)add('Origine des règles',origin);
  if(row.kind==='worktree'&&Number.isInteger(row.access_summary?.parent_revision))add('Révision du parent',row.access_summary.parent_revision);
  if(row.access_policy_reported&&row.access_summary?.inherited!==true&&Number.isInteger(row.access_summary?.revision))add('Révision de règle',row.access_summary.revision);
  $('details-dialog').showModal();$('close-details').focus();
 }
 function statusBadges(row){
  const state=shareStatus(row,snapshot.native_access_available===true);const badges=text('div','','target-status');
  badges.append(text('span',state.label,'lerd-pill '+state.tone));
  if(state.protection)badges.append(text('span',state.protection,'lerd-pill '+(state.protection==='Sans restriction'?'ok':'warn')));
  const origin=inheritanceLabel(row);if(origin)badges.append(text('span',origin,'lerd-pill accent'));
  return badges;
 }
 function targetAddress(row){
  if(!row.url)return text('span','—','lerd-muted');
  const link=text('a',row.url,'target-link lerd-mono');link.href=row.url;link.target='_blank';link.rel='noopener noreferrer';return link;
 }
 function targetActions(row){
  const actions=text('div','','target-actions');
  const details=document.createElement('button');details.type='button';details.textContent='Détails';details.setAttribute('aria-label','Détails de '+row.project+(row.branch?' · '+displayBranch(row):''));details.addEventListener('click',()=>openDetails(row,details));
  const configure=document.createElement('button');configure.type='button';configure.textContent='Protection';configure.setAttribute('aria-label','Configurer la protection pour '+row.project+(row.branch?' · '+displayBranch(row):''));configure.addEventListener('click',()=>openPolicy(row,configure));
  actions.append(details,configure);return actions;
 }
 function projectHeading(group){
  const heading=text('div','','project-heading');const targets=[group.site,...group.worktrees].filter(Boolean);
  const toggle=document.createElement('button');toggle.type='button';toggle.textContent=(collapsedProjects.has(group.project)?'▸ ':'▾ ')+group.project;toggle.setAttribute('aria-expanded',String(!collapsedProjects.has(group.project)));
  toggle.addEventListener('click',()=>{if(collapsedProjects.has(group.project))collapsedProjects.delete(group.project);else collapsedProjects.add(group.project);render()});
  const active=activeShareCount(group,snapshot.native_access_available===true);
  const hasPublic=targets.some(row=>shareStatus(row,snapshot.native_access_available===true).label==='Partage actif');
  heading.append(toggle,text('span',active+' actif(s) / '+targets.length+' cible(s)'+(group.worktrees.length?' · '+group.worktrees.length+' worktree(s)':''),'lerd-pill '+(active?(hasPublic?'ok':'warn'):'bad')));return heading;
 }
 function appendShareCard(row,container){
  const card=text('article','','lerd-card target-card');
  card.append(text('h3',row.kind==='worktree'?displayBranch(row):'Site principal'),statusBadges(row),targetAddress(row));
  const runtime=[row.framework,row.php_version?'PHP '+row.php_version:null,row.node_version?'Node.js '+row.node_version:null].filter(Boolean);
  if(runtime.length)card.append(text('p',runtime.join(' · '),'lerd-muted'));
  card.append(text('p',protectionDescription(row),'lerd-muted'),targetActions(row));container.append(card);
 }
 function appendShareRow(row){
  const tr=document.createElement('tr');const identity=document.createElement('td');
  identity.className=row.kind==='worktree'?'target-worktree':'target-site';
  identity.append(text('strong',row.kind==='worktree'?'↳ '+displayBranch(row):'Site principal'));
  if(row.kind!=='worktree'&&displayBranch(row))identity.append(text('div',displayBranch(row),'lerd-muted'));
  const state=document.createElement('td');
  state.append(statusBadges(row));
  const address=document.createElement('td');
  address.append(targetAddress(row));
  const port=text('td',row.port_reported?row.port:row.visibility==='public'?'Non exposé par l’API':'—','lerd-muted');
  const protection=protectionCell(row);
  const actions=document.createElement('td');
  actions.append(targetActions(row));tr.append(identity,state,address,port,protection,actions);$('rows').append(tr);
 }
 function render(){
  if(!snapshot)return;
  const groups=sortGroups(filterGroups(groupShares(snapshot.shares),{
   query:$('search').value,share:$('share-filter').value,protection:$('protection-filter').value,
   nativeAccessAvailable:snapshot.native_access_available,site:scopedSite,branch:scopedBranch
  }),$('sort-by').value);
  const cards=$('view-mode').value==='cards';$('table-view').hidden=cards;$('cards-view').hidden=!cards;
  $('rows').replaceChildren();$('cards-view').replaceChildren();
  let visibleTargets=0;
  for(const group of groups){
   const groupTargets=[group.site,...group.worktrees].filter(Boolean);
   const isCollapsed=collapsedProjects.has(group.project);
   if(cards){
    const project=text('section','','lerd-card project-card');project.append(projectHeading(group));
    if(!isCollapsed){const grid=text('div','','target-grid');for(const row of groupTargets){appendShareCard(row,grid);visibleTargets++}project.append(grid)}
    $('cards-view').append(project);
   }else{
    const header=document.createElement('tr');header.className='lerd-row project-group';const headerCell=document.createElement('td');headerCell.colSpan=6;
    headerCell.append(projectHeading(group));header.append(headerCell);$('rows').append(header);
    if(!isCollapsed)for(const row of groupTargets){appendShareRow(row);visibleTargets++}
   }
  }
  $('empty').hidden=groups.length!==0;
  $('count').textContent=groups.length+' projet(s) · '+visibleTargets+' cible(s) affichée(s)';
 }
 async function refresh(){
  $('refresh').disabled=true;$('status').textContent='Lecture de l’état natif…';
  try{
   const data=parseResponse(await lerd.api('shares'));
   if(data.schema_version!==1||data.read_only!==true||!Array.isArray(data.shares))throw new Error('Réponse du plugin non reconnue.');
   snapshot=data;
   for(const group of groupShares(data.shares))if(!knownProjects.has(group.project)){knownProjects.add(group.project);if(projectInitiallyCollapsed(group,data.native_access_available===true))collapsedProjects.add(group.project)}
   render();$('status').textContent='Source : '+data.source+' · état lu à '+new Date().toLocaleTimeString('fr-FR');
   if(!autoOpened&&context.intent==='access'){
    autoOpened=true;
    const row=data.shares.find(item=>item.project===scopedSite&&(item.branch||'')===scopedBranch&&item.visibility==='public'&&!item.paused);
    if(row)await openPolicy(row,null);
    else showInlinePolicyStatus('Cette cible n’a plus de partage public actif. Fermez cette fenêtre puis relancez Protection depuis le menu du partage.');
   }
  }catch(error){
   $('status').textContent=error.message||'Lecture impossible.';
   if(contextIntent)showInlinePolicyStatus('Impossible de charger la cible depuis LERD. Fermez cette fenêtre puis réessayez.');
  }
  finally{$('refresh').disabled=false}
 }
 function showInlinePolicyStatus(message){
  const dialog=$('policy-dialog');dialog.classList.add('inline-policy');dialog.open=true;
  $('policy-status').textContent=message;$('apply-policy').disabled=true;$('cancel-policy').textContent='Fermer';
 }
 function clearCredentials(){
  for(const input of $('credentials').querySelectorAll('[data-password]'))input.value='';
  $('credentials').replaceChildren();
 }
 function closeDialog(){
  clearCredentials();$('dialog-error').textContent='';
  if(contextIntent){lerd.close();return}
  $('policy-dialog').close();if(returnFocus)returnFocus.focus();
 }
 async function openPolicy(row,trigger=returnFocus){
  returnFocus=trigger||document.activeElement;
  target={project:row.project,branch:row.branch||''};revision=null;parentRevision=null;inheritanceAvailable=false;originalInherited=false;pendingReset=false;
  $('inheritance-field').hidden=true;$('inherit-parent').checked=false;$('reset-inheritance').hidden=true;updateInheritanceFields();
  $('target-label').textContent=target.project+(target.branch?' · '+displayBranch(row):' · site');
  $('policy-status').textContent='Lecture de la politique…';$('dialog-error').textContent='';$('apply-policy').disabled=true;
  $('mode').value='closed';$('networks').value='';$('rate').value='0';$('burst').value='60';renderUsers([]);clearCredentials();updateModeFields();
  if(contextIntent){$('policy-dialog').classList.add('inline-policy');$('policy-dialog').open=true;$('dialog-title').hidden=true;$('cancel-policy').textContent='Fermer'}
  else $('policy-dialog').showModal();
  try{
   const policy=parseResponse(await lerd.api(policyPath(target)));
   if(!policy||policy.version!==1||policy.site!==target.project||(policy.branch||'')!==target.branch||!modes.has(policy.mode)||!Number.isInteger(policy.revision)||policy.enforcement!=='native'||!Array.isArray(policy.networks)||!Array.isArray(policy.users)||!policy.rate||typeof policy.rate.requests_per_second!=='number'||typeof policy.rate.burst!=='number'||(policy.denial_status!==undefined&&![403,404].includes(policy.denial_status)))throw new Error('Contrat de politique non reconnu.');
   const inheritance=policyInheritance(policy);parentRevision=inheritance.parent_revision;inheritanceAvailable=inheritance.available;originalInherited=inheritance.inherited;
   $('inheritance-field').hidden=!(target.branch&&inheritanceAvailable);$('inherit-parent').checked=Boolean(target.branch&&originalInherited);$('reset-inheritance').hidden=!(target.branch&&inheritanceAvailable&&!originalInherited);
   $('inheritance-badge').textContent=originalInherited?'Règles du parent':'Règles personnalisées';
   revision=policy.revision;originalMode=policy.mode;$('mode').value=policy.mode;$('networks').value=policy.networks.join('\n');$('denial-status').value=String(policy.denial_status===undefined?403:policy.denial_status);$('rate').value=String(policy.rate.requests_per_second);$('burst').value=String(policy.rate.burst);
   renderUsers(policy.users);$('policy-status').textContent='Politique native · révision '+policy.revision+'. Les mots de passe ne sont pas lisibles.';
   $('apply-policy').disabled=false;updateModeFields();updateInheritanceFields();(usesParentRules()?$('inherit-parent'):$('mode')).focus();
  }catch(error){$('policy-status').textContent=customLerdMessage(error);$('apply-policy').disabled=true}
 }
 function validatePolicy(){
  $('dialog-error').textContent='';
  if(!target||!Number.isInteger(revision)){$('dialog-error').textContent='La politique n’est pas disponible pour cette cible.';$('dialog-error').focus();return false}
  if(usesParentRules())return Number.isInteger(parentRevision);
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
   }
  }
  if(!modes.has(mode)){$('dialog-error').textContent='Choisissez un mode d’accès valide.';$('dialog-error').focus();return false}
  if(![403,404].includes(Number($('denial-status').value))){$('dialog-error').textContent='Choisissez 403 ou 404 pour les refus réseau.';$('dialog-error').focus();return false}
  if(needsNetwork&&!networks.length){$('dialog-error').textContent='Ajoutez au moins un réseau CIDR pour ce mode.';$('dialog-error').focus();return false}
  if(needsAccount&&credentials.length+currentUsers-removeCount===0){$('dialog-error').textContent='Conservez ou ajoutez au moins un compte pour ce mode.';$('dialog-error').focus();return false}
  const rate=Number($('rate').value||0);const burst=Number($('burst').value||60);
  if(!Number.isFinite(rate)||rate<0||rate>100000||!Number.isInteger(burst)||burst<1||burst>10000){$('dialog-error').textContent='La limite doit être entre 0 et 100000 requêtes/s, avec un burst entre 1 et 10000.';$('dialog-error').focus();return false}
  return true;
 }
 function previewChanges(){
  if(!validatePolicy())return;
  pendingReset=usesParentRules();
  const mode=$('mode').value;
  const needsAccount=mode==='password'||mode==='ip_and_password'||mode==='ip_or_password';
  const removeCount=needsAccount?$('existing-users').querySelectorAll('input[type="checkbox"]:checked').length:0;
  $('confirm-target').textContent=$('target-label').textContent;
  $('confirm-summary').textContent=$('impact-summary').textContent;
  const mayReduce=pendingReset||(mode==='public'&&originalMode!=='public')||(mode==='closed'&&originalMode!=='closed')||removeCount>0;
  $('confirm-warning').textContent=pendingReset?'Les règles personnalisées seront retirées. L’accès suivra désormais les règles du parent.':'Cette modification peut ouvrir l’accès ou supprimer un compte. Vérifiez la cible avant de continuer.';
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
  const payload=pendingReset?inheritanceResetPayload(target.project,target.branch,revision,parentRevision):{site:target.project,branch:target.branch,mode,networks,credentials,remove_users,revision,rate:{requests_per_second:rate,burst},denial_status:Number($('denial-status').value)};
  if(!pendingReset&&target.branch&&inheritanceAvailable)payload.parent_revision=parentRevision;
  $('apply-policy').disabled=true;$('dialog-error').textContent='Application en cours…';
  try{
   await lerd.api(policyPath(target),{method:'POST',body:payload});
   if(contextIntent){clearCredentials();lerd.close();return}
   $('dialog-error').textContent='';$('confirm-dialog').close();$('policy-status').textContent='Politique enregistrée. Le statut effectif doit être confirmé par LERD.';
   // Le secret quitte le DOM dès la fin de la requête, succès ou erreur.
   clearCredentials();
   $('policy-dialog').close();
   await refresh();
   $('status').textContent='Règles enregistrées et liste actualisée.';
   const focusTarget=[...document.querySelectorAll('#rows button,#cards-view button')].find(button=>button.getAttribute('aria-label')===returnFocus?.getAttribute('aria-label'));
   (focusTarget||$('refresh')).focus();
  }catch(error){clearCredentials();$('confirm-dialog').close();$('dialog-error').textContent=customLerdMessage(error);$('dialog-error').focus?.()}
  finally{$('apply-policy').disabled=false}
 }
 $('refresh').addEventListener('click',refresh);
 $('search').addEventListener('input',render);
 $('share-filter').addEventListener('change',render);
 $('protection-filter').addEventListener('change',render);
 $('sort-by').addEventListener('change',render);
 $('view-mode').addEventListener('change',render);
 $('expand-all').addEventListener('click',()=>{collapsedProjects.clear();render()});
 $('collapse-all').addEventListener('click',()=>{for(const group of groupShares(snapshot?.shares||[]))collapsedProjects.add(group.project);render()});
 $('mode').addEventListener('change',updateModeFields);
 $('inherit-parent').addEventListener('change',updateInheritanceFields);
 $('reset-inheritance').addEventListener('click',()=>{$('inherit-parent').checked=true;updateInheritanceFields();previewChanges()});
 $('denial-status').addEventListener('change',updateImpact);
 $('networks').addEventListener('input',updateImpact);
 $('rate').addEventListener('input',updateImpact);$('burst').addEventListener('input',updateImpact);
 $('add-credential').addEventListener('click',()=>addCredential());
 $('cancel-policy').addEventListener('click',closeDialog);
 $('apply-policy').addEventListener('click',previewChanges);
 $('confirm-apply').addEventListener('click',applyPolicy);
 $('back-to-policy').addEventListener('click',()=>{$('confirm-dialog').close();$('apply-policy').focus()});
 $('close-details').addEventListener('click',()=>{$('details-dialog').close();detailReturnFocus?.focus()});
 $('policy-dialog').addEventListener('cancel',event=>{clearCredentials();if(contextIntent){event.preventDefault();lerd.close()}});
 $('context-note').hidden=!scopedSite;
 if(scopedSite)$('share-filter').value='all';
 if(contextIntent){$('inventory-section').hidden=true;$('cancel-policy').textContent='Fermer'}
 refresh();
})();
