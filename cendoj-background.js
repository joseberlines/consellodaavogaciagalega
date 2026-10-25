const CENDOJ_KEY = 'cendoj.session';
const CENDOJ_FIELDS = ['posicion','id','titulo','fecha','organo','roj','ecli','n_resolucion','n_recurso','ponente','municipio','resumen','url_documento'];
let cendojQueue = Promise.resolve();
const cendojRead = async () => (await chrome.storage.local.get(CENDOJ_KEY))[CENDOJ_KEY] || { rows: [], running: false };
const cendojSave = state => chrome.storage.local.set({ [CENDOJ_KEY]: state });
const cendojValidUrl = url => { try { const u = new URL(url); return u.origin === 'https://www.poderjudicial.es' && u.pathname.startsWith('/search/'); } catch { return false; } };
async function cendojDOM(tabId, action, extra = {}) {
  const tab = await chrome.tabs.get(tabId);
  if (!cendojValidUrl(tab.url)) throw Error('Selecciona una pestaña de resultados del CENDOJ.');
  const result = await chrome.tabs.sendMessage(tabId, { type: 'cendoj:dom', action, ...extra });
  if (!result?.ok) throw Error(result?.error || 'La página no responde. Recárgala y captura manualmente.');
  return result;
}
function cendojMerge(existing, incoming, limit) {
  const rows = [...existing];
  for (const row of incoming) {
    if (rows.length >= limit) break;
    if (rows.some(old => ['ecli','roj','url_documento'].some(key => row[key] && old[key] === row[key]) || JSON.stringify({ ...old, posicion: 0 }) === JSON.stringify({ ...row, posicion: 0 }))) continue;
    rows.push({ ...row, posicion: rows.length + 1 });
  }
  return rows;
}
function cendojCsv(rows) {
  const cell = value => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replace(/"/g, '""') + '"';
  return '\ufeff' + [CENDOJ_FIELDS.join(';'), ...rows.map(row => CENDOJ_FIELDS.map(key => cell(row[key])).join(';'))].join('\r\n');
}
async function cendojExport(state, format) {
  if (!state.rows.length) throw Error('Todavía no hay resultados para exportar.');
  if (!['csv','json'].includes(format)) throw Error('Formato no válido.');
  const data = format === 'csv' ? cendojCsv(state.rows) : JSON.stringify(state.rows, null, 2);
  await chrome.downloads.download({ url: 'data:' + (format === 'csv' ? 'text/csv' : 'application/json') + ';charset=utf-8,' + encodeURIComponent(data), filename: 'CENDOJ_Local/resultados.' + format, conflictAction: 'uniquify', saveAs: false });
}
async function cendojFinish(state, status) {
  state.running = false; state.status = status; await cendojSave(state);
  if (state.autoExport && state.rows.length) {
    try { await cendojExport(state, 'csv'); await cendojExport(state, 'json'); }
    catch (error) { state.status += ' Exportación pendiente: ' + error.message; await cendojSave(state); }
  }
}
async function cendojCapture(state, manual = false) {
  const result = await cendojDOM(state.tabId, 'capture');
  if (!result.rows.length) {
    if (manual) throw Error('No se detectan resultados. Revisa los avisos y realiza la búsqueda en CENDOJ.');
    return false;
  }
  if (!manual && result.signature === state.signature) return false;
  state.rows = cendojMerge(state.rows, result.rows, state.limit || 50);
  state.signature = result.signature;
  state.status = `${state.rows.length} resultados guardados localmente.`;
  if (!state.running || manual) { await cendojSave(state); return true; }
  if (state.rows.length >= state.limit || !result.next) {
    await cendojFinish(state, `${state.rows.length} resultados guardados. ${state.rows.length >= state.limit ? 'Límite alcanzado.' : 'Sin más páginas detectables; puedes capturar manualmente.'}`);
  } else {
    await cendojSave(state);
    await cendojDOM(state.tabId, 'next');
  }
  return true;
}
let cendojTimer;
function cendojSchedule() {
  clearTimeout(cendojTimer);
  cendojTimer = setTimeout(() => cendojEnqueue(async () => {
    const state = await cendojRead();
    if (!state.running) return;
    try {
      if (Date.now() - state.started > 180000) { await cendojFinish(state, 'Búsqueda detenida por tiempo de espera. Puedes capturar manualmente.'); return; }
      const tab = await chrome.tabs.get(state.tabId);
      if (tab.status !== 'complete') { cendojSchedule(); return; }
      if (state.pendingSearch) {
        await cendojDOM(state.tabId, 'search', { query: state.query });
        state.pendingSearch = false; await cendojSave(state);
      } else await cendojCapture(state);
      if ((await cendojRead()).running) cendojSchedule();
    } catch (error) { await cendojFinish(state, error.message + ' Puedes continuar con Capturar página visible.'); }
  }), 1800);
}
function cendojEnqueue(task) { const next = cendojQueue.then(task); cendojQueue = next.catch(console.error); return next; }
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'complete') cendojEnqueue(async () => { const state = await cendojRead(); if (state.running && state.tabId === tabId) cendojSchedule(); });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message.type?.startsWith('cendoj:') || message.type === 'cendoj:dom') return;
  if (sender.id !== chrome.runtime.id || sender.tab) return;
  cendojEnqueue(async () => {
    let state = await cendojRead();
    switch (message.type) {
      case 'cendoj:start': {
        if (!message.query || ![10,25,50].includes(message.limit)) throw Error('Introduce una consulta y un límite válido.');
        const tab = await chrome.tabs.create({ url: 'https://www.poderjudicial.es/search/indexAN.jsp' });
        state = { query: message.query, limit: message.limit, autoExport: !!message.autoExport, rows: [], tabId: tab.id, running: true, pendingSearch: true, started: Date.now(), status: 'Abriendo CENDOJ. Revisa cualquier aviso legal en la página.' };
        await cendojSave(state); cendojSchedule(); break;
      }
      case 'cendoj:stop': clearTimeout(cendojTimer); await cendojFinish(state, 'Detenido. Se conservan los resultados recogidos.'); break;
      case 'cendoj:clear': clearTimeout(cendojTimer); await cendojSave({ rows: [], running: false, status: 'Resultados borrados.' }); break;
      case 'cendoj:capture': {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const selected = tabs.find(tab => cendojValidUrl(tab.url));
        if (selected) state.tabId = selected.id;
        if (!state.tabId) throw Error('Abre y selecciona la página de resultados del CENDOJ.');
        state.running = false; clearTimeout(cendojTimer); await cendojSave(state); await cendojCapture(state, true); break;
      }
      case 'cendoj:export': await cendojExport(state, message.format); break;
      default: throw Error('Operación no reconocida.');
    }
    respond({ ok: true });
  }).catch(error => respond({ ok: false, error: error.message }));
  return true;
});
// Worker restarts preserve rows and explicitly expose interrupted operations.
cendojEnqueue(async () => { const state = await cendojRead(); if (state.running) { state.running = false; state.status = 'La búsqueda se interrumpió al reiniciarse el proceso. Captura la página visible o inicia otra consulta.'; await cendojSave(state); } });
