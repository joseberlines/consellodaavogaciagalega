chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message.type?.startsWith('cases:') || sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return;
  cendojEnqueue(async () => {
    const manager = await initializeCases();
    const name = String(message.name || '').trim();
    if (['cases:create','cases:rename'].includes(message.type) && (!name || name.length > 120)) throw Error('Introduce un nombre de 1 a 120 caracteres.');
    if (message.type === 'cases:backup') { respond({ok:true,backup:await buildCaseBackup(message.caseId)}); return; }
    if (message.type === 'cases:restore') { respond({ok:true,manager:await restoreCaseBackup(message.backup)}); return; }
    if (message.type === 'cases:init') { respond({ok:true,manager}); return; }
    if (message.type === 'cases:write') { await writeCaseValues(message.caseId,message.values); respond({ok:true}); return; }
    if (message.type === 'cases:addDocuments') {
      const id = message.caseId;
      const documents = await readCaseValue('promptLauncher.documents',id) || [];
      const names = new Set(documents.map(doc=>doc.name));
      const added = [];
      for (const doc of message.documents || []) if (!names.has(doc.name)) { names.add(doc.name); added.push(doc); }
      await writeCaseValues(id,{'promptLauncher.documents':[...documents,...added]});
      respond({ok:true}); return;
    }
    const target = manager.cases.find(item => item.id === message.caseId);
    if (['cases:switch','cases:rename','cases:delete'].includes(message.type) && !target) throw Error('El expediente ya no existe.');
    if (message.type === 'cases:delete' && manager.cases.length === 1) throw Error('Conserva al menos un expediente.');
    if (['cases:switch','cases:create','cases:delete'].includes(message.type)) {
      // Switching stops the old search before changing the active case.
      clearTimeout(cendojTimer);
      const state = await cendojRead();
      if (state.running) { state.running = false; state.status = 'Búsqueda detenida al cambiar de expediente. Resultados conservados.'; await cendojSave(state); }
    }
    switch (message.type) {
      case 'cases:create': {
        const id = crypto.randomUUID();
        manager.cases.push({id,name,createdAt:new Date().toISOString()}); manager.activeId=id; break;
      }
      case 'cases:switch': manager.activeId=target.id; break;
      case 'cases:rename': target.name=name; break;
      case 'cases:delete':
        if (manager.cases.length === 1) throw Error('Conserva al menos un expediente.');
        manager.cases=manager.cases.filter(item=>item.id!==target.id);
        if (manager.activeId===target.id) manager.activeId=manager.cases[0].id;
        break;
      default: throw Error('Operación no reconocida.');
    }
    await chrome.storage.local.set({[CASES_KEY]:manager});
    if (message.type==='cases:delete') await chrome.storage.local.remove(CASE_SCOPED_KEYS.map(key=>caseStorageKey(target.id,key)));
    respond({ok:true,manager});
  }).catch(error=>respond({ok:false,error:error.message}));
  return true;
});
