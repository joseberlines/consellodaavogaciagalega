const CASE_BACKUP_FORMAT = 'cag-case-backup';
const CASE_BACKUP_MAX_BYTES = 8 * 1024 * 1024;
function validateCaseBackup(input) {
  const fail = () => { throw Error('La copia no es válida o usa una versión no compatible.'); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const string = (value, max = CASE_BACKUP_MAX_BYTES) => typeof value === 'string' && value.length <= max;
  const fields = (value, keys) => {
    if (!object(value)) return fail();
    const result = {};
    for (const key of keys) if (value[key] !== undefined) { if (!string(value[key])) return fail(); result[key] = value[key]; }
    return result;
  };
  if (!object(input) || input.format !== CASE_BACKUP_FORMAT || input.version !== 1 || !object(input.case) || !string(input.case.name,120) || !input.case.name.trim()) fail();
  if (new TextEncoder().encode(JSON.stringify(input,null,2)).length > CASE_BACKUP_MAX_BYTES) throw Error('La copia supera el límite de 8 MB.');
  const source = input.case;
  if (source.createdAt !== undefined && (!string(source.createdAt,100) || !Number.isFinite(Date.parse(source.createdAt)))) fail();
  if (!Array.isArray(source.documents) || !object(source.cendoj) || !Array.isArray(source.cendoj.rows) || !object(source.cendoj.texts)) fail();
  const documents = source.documents.map(doc => {
    if (!object(doc) || !string(doc.name,1000) || !doc.name.trim() || !string(doc.text)) return fail();
    const clean = fields(doc,['name','text','ext','addedAt']);
    if (doc.size !== undefined) { if (!Number.isSafeInteger(doc.size) || doc.size < 0) return fail(); clean.size = doc.size; }
    return clean;
  });
  const rows = source.cendoj.rows.map((row,index) => {
    const clean = fields(row,['id','titulo','fecha','organo','roj','ecli','n_resolucion','n_recurso','ponente','municipio','resumen','url_documento','text','texto_integro']);
    if (clean.url_documento) { try { const url = new URL(clean.url_documento); if (url.origin !== 'https://www.poderjudicial.es') fail(); } catch { fail(); } }
    return {...clean,posicion:index+1};
  });
  const texts = Object.fromEntries(Object.entries(source.cendoj.texts).map(([key,value]) => {
    if (!key || !object(value) || !string(value.text)) return fail();
    return [key, fields(value,['text','name'])];
  }));
  if (source.cendoj.query !== undefined && !string(source.cendoj.query)) fail();
  if (source.cendoj.limit !== undefined && ![10,25,50].includes(source.cendoj.limit)) fail();
  return { name:source.name.trim(), createdAt:source.createdAt, documents, session:{query:source.cendoj.query || '',limit:source.cendoj.limit || 50,rows,running:false,status:'Expediente restaurado desde una copia local.'}, texts };
}
async function buildCaseBackup(caseId) {
  const manager = await initializeCases();
  const entry = manager.cases.find(item=>item.id===caseId);
  if (!entry) throw Error('El expediente ya no existe.');
  const keys = CASE_SCOPED_KEYS.map(key=>caseStorageKey(caseId,key));
  const saved = await chrome.storage.local.get(keys);
  const session = saved[caseStorageKey(caseId,'cendoj.session')] || {};
  const backup = {format:CASE_BACKUP_FORMAT,version:1,appVersion:chrome.runtime.getManifest().version,exportedAt:new Date().toISOString(),case:{name:entry.name,createdAt:entry.createdAt,documents:saved[caseStorageKey(caseId,'promptLauncher.documents')] || [],cendoj:{query:session.query || '',limit:session.limit || 50,rows:session.rows || [],texts:saved[caseStorageKey(caseId,'cendoj.texts')] || {}}}};
  validateCaseBackup(backup);
  return backup;
}
async function restoreCaseBackup(input) {
  // Validate before touching storage. Never accept IDs, active search state or global prompts.
  const restored = validateCaseBackup(input);
  const manager = await initializeCases();
  const id = crypto.randomUUID();
  let name = restored.name;
  let suffix = 1;
  const names = new Set(manager.cases.map(item=>item.name));
  while (names.has(name)) { const ending = suffix === 1 ? ' (restaurado)' : ` (restaurado ${suffix})`; name=restored.name.slice(0,120-ending.length)+ending; suffix++; }
  const next = {activeId:id,cases:[...manager.cases,{id,name,createdAt:restored.createdAt || new Date().toISOString(),restoredAt:new Date().toISOString()}]};
  const values = {
    [CASES_KEY]:next,
    [caseStorageKey(id,'promptLauncher.documents')]:restored.documents,
    [caseStorageKey(id,'cendoj.session')]:{...restored.session,caseId:id},
    [caseStorageKey(id,'cendoj.texts')]:restored.texts
  };
  const current = await readCaseValue('cendoj.session',manager.activeId);
  if (current?.running) values[caseStorageKey(manager.activeId,'cendoj.session')]={...current,running:false,status:'Búsqueda detenida al restaurar otro expediente. Resultados conservados.'};
  // Persist case metadata and content in a single write; quota errors leave no empty case.
  await chrome.storage.local.set(values);
  clearTimeout(cendojTimer);
  return next;
}
