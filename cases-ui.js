// Adapter keeps existing rendering code while scoping case data explicitly.
const CaseStorage = (() => {
  let manager, ready;
  const listeners=[];
  async function request(action, extra={}) {
    const result=await chrome.runtime.sendMessage({type:'cases:'+action,...extra});
    if (!result?.ok) throw Error(result?.error || 'No se pudo acceder al expediente.');
    return result;
  }
  async function init() {
    if (!ready) ready=request('init').then(result=>{manager=result.manager;render();return manager;}).catch(error=>{ready=null;throw error;});
    await ready; return manager;
  }
  async function get(keys, caseId) {
    await init(); const id=caseId || manager.activeId;
    const wanted=typeof keys==='string'?[keys]:keys;
    const actual=wanted.map(key=>CASE_SCOPED_KEYS.includes(key)?caseStorageKey(id,key):key);
    const saved=await chrome.storage.local.get(actual), result={};
    wanted.forEach((key,i)=>{if(saved[actual[i]]!==undefined)result[key]=saved[actual[i]];});
    if (!caseId && id !== manager.activeId) return get(keys);
    return result;
  }
  async function set(values, caseId) {
    await init(); const id=caseId || manager.activeId;
    const scoped={},global={};
    for(const [key,value] of Object.entries(values)) (CASE_SCOPED_KEYS.includes(key)?scoped:global)[key]=value;
    if(Object.keys(scoped).length) await request('write',{caseId:id,values:scoped});
    if(Object.keys(global).length) await chrome.storage.local.set(global);
  }
  function render() {
    const select=document.getElementById('caseSelect'); if(!select || !manager)return;
    select.replaceChildren();
    for(const item of manager.cases){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
    select.value=manager.activeId;
    document.getElementById('caseDelete').disabled=manager.cases.length<2;
  }
  chrome.storage.onChanged.addListener(async(changes,area)=>{
    if(area!=='local')return;
    await init(); const oldId=manager.activeId;
    if(changes[CASES_KEY]?.newValue){manager=changes[CASES_KEY].newValue;render();}
    const translated={};
    for(const [key,value] of Object.entries(changes)) {
      if(!key.startsWith('case.'))translated[key]=value;
      for(const logical of CASE_SCOPED_KEYS)if(key===caseStorageKey(manager.activeId,logical))translated[logical]=value;
    }
    if(oldId!==manager.activeId){
      const saved=await get(CASE_SCOPED_KEYS);
      for(const key of CASE_SCOPED_KEYS)translated[key]={newValue:saved[key]};
      translated.caseChanged={newValue:manager.activeId};
    }
    for(const fn of listeners)fn(translated,area);
  });
  async function action(action,extra={}) {
    const status=document.getElementById('caseStatus');
    try{await request(action,extra);status.textContent='';}catch(error){status.textContent=error.message;render();}
  }
  document.getElementById('caseSelect')?.addEventListener('change',event=>action('switch',{caseId:event.target.value}));
  document.getElementById('caseCreate')?.addEventListener('click',()=>{const name=prompt('Nombre del nuevo expediente');if(name?.trim())action('create',{name});});
  document.getElementById('caseRename')?.addEventListener('click',()=>{const current=manager?.cases.find(item=>item.id===manager.activeId);const name=prompt('Nuevo nombre del expediente',current?.name);if(name?.trim())action('rename',{caseId:current.id,name});});
  document.getElementById('caseDelete')?.addEventListener('click',()=>{const current=manager?.cases.find(item=>item.id===manager.activeId);if(current && confirm(`¿Eliminar «${current.name}» y todos sus documentos y datos CENDOJ? Esta acción no se puede deshacer. Los prompts comunes se conservan.`))action('delete',{caseId:current.id});});
  let pendingBackup = null;
  const backupStatus = message => { document.getElementById('caseStatus').textContent = message; };
  document.getElementById('caseBackup')?.addEventListener('click',async()=>{
    try {
      await init(); const caseId=manager.activeId;
      const {backup}=await request('backup',{caseId});
      const name=backup.case.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_');
      triggerDownload(`expediente-${name}-${backup.exportedAt.slice(0,10)}.json`,JSON.stringify(backup,null,2),'application/json');
      backupStatus('Copia preparada para descargar. Contiene el texto guardado; no los PDF o Word originales ni los prompts comunes.');
    }catch(error){backupStatus('No se pudo crear la copia: '+error.message);}
  });
  document.getElementById('caseRestore')?.addEventListener('click',()=>document.getElementById('caseRestoreFile').click());
  document.getElementById('caseRestoreFile')?.addEventListener('change',async event=>{
    pendingBackup=null;document.getElementById('caseRestorePreview').hidden=true;
    const file=event.target.files[0];if(!file)return;
    try {
      if(file.size>CASE_BACKUP_MAX_BYTES)throw Error('La copia supera el límite de 8 MB.');
      const backup=JSON.parse(await file.text()), validated=validateCaseBackup(backup);
      pendingBackup=backup;
      document.getElementById('caseRestoreSummary').textContent=`${validated.name}: ${validated.documents.length} documentos, ${validated.session.rows.length} resoluciones y ${Object.keys(validated.texts).length} textos adjuntos. Se creará un nuevo expediente; los existentes y los prompts comunes se conservarán.`;
      document.getElementById('caseRestorePreview').hidden=false;backupStatus('');
    }catch(error){backupStatus('No se puede restaurar: '+error.message);}
    finally{event.target.value='';}
  });
  document.getElementById('caseRestoreCancel')?.addEventListener('click',()=>{pendingBackup=null;document.getElementById('caseRestorePreview').hidden=true;});
  document.getElementById('caseRestoreConfirm')?.addEventListener('click',async()=>{
    if(!pendingBackup)return;
    const button=document.getElementById('caseRestoreConfirm');button.disabled=true;
    try{await request('restore',{backup:pendingBackup});pendingBackup=null;document.getElementById('caseRestorePreview').hidden=true;backupStatus('Copia restaurada en un nuevo expediente.');}
    catch(error){backupStatus('No se pudo restaurar. Los expedientes existentes se conservan: '+error.message);}
    finally{button.disabled=false;}
  });
  init().catch(error=>{const el=document.getElementById('caseStatus');if(el)el.textContent=error.message;});
  return {addDocuments:(caseId,documents)=>request('addDocuments',{caseId,documents}),local:{get,set},onChanged:{addListener:fn=>listeners.push(fn)},activeId:async()=>{await init();return manager.activeId;}};
})();
