(() => {
  const $ = id => document.getElementById(id);
  const send = async (action, extra = {}) => {
    try { const response = await chrome.runtime.sendMessage({ type: 'cendoj:' + action, ...extra }); if (!response?.ok) throw Error(response?.error || 'No se pudo completar la operación.'); }
    catch (error) { $('cendojStatus').textContent = error.message; }
  };
  $('cendojToggle').onclick = () => { const body = $('cendojBody'); body.hidden = !body.hidden; $('cendojToggle').setAttribute('aria-expanded', String(!body.hidden)); };
  $('cendojForm').onsubmit = event => { event.preventDefault(); send('start', { query: $('cendojQuery').value.trim(), limit: Number($('cendojLimit').value), autoExport: $('cendojAutoExport').checked }); };
  for (const [id, action] of [['Stop','stop'],['Capture','capture'],['Clear','clear'],['Csv','export'],['Json','export']]) $('cendoj'+id).onclick = () => send(action, { format: id.toLowerCase() });
  function render(state = {}) {
    $('cendojCount').textContent = (state.rows || []).length;
    $('cendojStatus').textContent = state.status || 'Introduce una consulta para abrir el buscador público del CENDOJ.';
    $('cendojStart').disabled = !!state.running;
    $('cendojStop').disabled = !state.running;
    $('cendojCsv').disabled = $('cendojJson').disabled = !state.rows?.length;
    if (document.activeElement !== $('cendojQuery')) $('cendojQuery').value = state.query || '';
    $('cendojResults').replaceChildren();
    for (const row of state.rows || []) {
      const card = document.createElement('article');
      const title = document.createElement('strong'); title.textContent = `${row.posicion}. ${row.titulo}`; card.append(title);
      const meta = document.createElement('p'); meta.textContent = [row.fecha,row.organo,row.roj,row.ecli].filter(Boolean).join(' · '); card.append(meta);
      const summary = document.createElement('p'); summary.textContent = row.resumen; card.append(summary);
      if (row.url_documento?.startsWith('https://www.poderjudicial.es/')) { const a = document.createElement('a'); a.href = row.url_documento; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Abrir resolución en CENDOJ'; card.append(a); }
      $('cendojResults').append(card);
    }
  }
  chrome.storage.local.get('cendoj.session').then(data => render(data['cendoj.session']));
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes['cendoj.session']) render(changes['cendoj.session'].newValue); });
})();
