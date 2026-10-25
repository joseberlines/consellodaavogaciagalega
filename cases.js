// Storage schema v1: prompts stay global; documents and CENDOJ belong to a case.
const CASES_KEY = 'caseManager.v1';
const CASE_SCOPED_KEYS = ['promptLauncher.documents', 'cendoj.session', 'cendoj.texts'];
const caseStorageKey = (id, key) => `case.${id}.${key}`;
async function initializeCases() {
  const saved = await chrome.storage.local.get([CASES_KEY, ...CASE_SCOPED_KEYS]);
  if (saved[CASES_KEY]) return saved[CASES_KEY];
  const id = 'initial';
  const manager = { activeId: id, cases: [{ id, name: 'Expediente inicial', createdAt: new Date().toISOString() }] };
  const values = { [CASES_KEY]: manager };
  for (const key of CASE_SCOPED_KEYS) values[caseStorageKey(id,key)] = saved[key] ?? (key === 'promptLauncher.documents' ? [] : key === 'cendoj.texts' ? {} : {rows:[],running:false});
  // Write the migration and its marker atomically, then remove the legacy copies.
  await chrome.storage.local.set(values);
  await chrome.storage.local.remove(CASE_SCOPED_KEYS);
  return manager;
}
async function activeCaseId() { return (await initializeCases()).activeId; }
async function readCaseValue(key, id) {
  id = id || await activeCaseId();
  return (await chrome.storage.local.get(caseStorageKey(id,key)))[caseStorageKey(id,key)];
}
async function writeCaseValues(id, values) {
  const manager = await initializeCases();
  if (!manager.cases.some(item => item.id === id)) throw Error('El expediente ya no existe.');
  const scoped = {};
  for (const [key,value] of Object.entries(values)) {
    if (!CASE_SCOPED_KEYS.includes(key)) throw Error('Dato de expediente no válido.');
    scoped[caseStorageKey(id,key)] = value;
  }
  await chrome.storage.local.set(scoped);
}
