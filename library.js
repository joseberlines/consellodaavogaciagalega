(() => {
  const keys = [STORAGE_KEY, DOCS_STORAGE_KEY, 'cendoj.session', 'cendoj.texts', 'library.readerSize'];
  const $ = id => document.getElementById(id);
  let data = {}, entries = [], selected = null, readerSize = 20;
  const types = [['prompt', 'Prompts'], ['document', 'Documentos'], ['cendoj', 'CENDOJ']];
  const cendojId = row => row.ecli || row.roj || row.url_documento || row.id || row.titulo;
  const current = () => entries.find(entry => entry.id === selected);
  function rebuild() {
    const prompts = data[STORAGE_KEY] || [];
    entries = prompts.map((prompt, index) => {
      const resolved = resolvePromptText(prompt, prompts);
      return { id: 'prompt:' + index + ':' + prompt.name, type: 'prompt', title: prompt.name, text: resolved.text, meta: [prompt.author, prompt.date, prompt.category, prompt.comments].filter(Boolean).join(' · '), notice: resolved.warnings.join(' ') };
    });
    entries.push(...(data[DOCS_STORAGE_KEY] || []).map((doc, index) => ({ id: 'document:' + index + ':' + doc.name, type: 'document', title: doc.name, text: doc.text || '', meta: [doc.ext?.toUpperCase(), doc.addedAt?.slice(0,10)].filter(Boolean).join(' · ') })));
    entries.push(...(data['cendoj.session']?.rows || []).map((row, index) => {
      const sourceId = cendojId(row);
      const fullText = data['cendoj.texts']?.[sourceId]?.text || row.texto_integro || row.text || '';
      return { id: 'cendoj:' + index + ':' + sourceId, sourceId, type: 'cendoj', title: row.titulo || row.roj || 'Resolución CENDOJ', text: fullText || row.resumen || '', url: row.url_documento, meta: [['Fecha',row.fecha],['Órgano',row.organo],['ROJ',row.roj],['ECLI',row.ecli],['Resolución',row.n_resolucion],['Recurso',row.n_recurso],['Ponente',row.ponente],['Municipio',row.municipio]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join('\n'), notice: fullText ? '' : 'Solo se ha guardado el resumen del listado, no la sentencia íntegra. Abre la resolución en CENDOJ y adjunta su PDF o texto para leerla completa aquí.' };
    }));
    if (selected && !current()) selected = null;
    renderList(); renderReader();
  }
  function renderList() {
    const query = $('librarySearch').value.trim().toLocaleLowerCase('es');
    $('libraryList').replaceChildren();
    for (const [type, label] of types) {
      const all = entries.filter(entry => entry.type === type);
      const visible = all.filter(entry => [entry.title,entry.meta,entry.text].join(' ').toLocaleLowerCase('es').includes(query));
      const section = document.createElement('section'); section.className = 'collection';
      const heading = document.createElement('h2'); heading.textContent = label;
      const count = document.createElement('span'); count.textContent = query ? visible.length + '/' + all.length : all.length; heading.append(count); section.append(heading);
      const list = document.createElement('ul');
      for (const entry of visible) {
        const li = document.createElement('li'), button = document.createElement('button');
        button.className = 'item-button'; button.textContent = entry.title; button.setAttribute('aria-current', String(entry.id === selected));
        const meta = document.createElement('small'); meta.textContent = entry.meta.split('\n')[0]; button.append(meta);
        button.onclick = () => { selected = entry.id; renderList(); renderReader(); $('reader').scrollTop = 0; $('readerTitle').focus(); };
        li.append(button); list.append(li);
      }
      section.append(list);
      if (!visible.length) { const empty = document.createElement('p'); empty.className='empty'; empty.textContent = all.length ? 'Sin coincidencias.' : 'Todavía no hay elementos guardados.'; section.append(empty); }
      $('libraryList').append(section);
    }
  }
  function renderReader() {
    const entry = current();
    $('readerEmpty').hidden = !!entry; $('readerArticle').hidden = !entry;
    if (!entry) return;
    $('readerType').textContent = types.find(([type])=>type===entry.type)[1];
    $('readerTitle').textContent = entry.title; $('readerMeta').textContent = entry.meta;
    $('readerNotice').textContent = entry.notice || '';
    $('readerText').textContent = entry.text || 'Este elemento no contiene texto legible.';
    $('readerSource').hidden = true; $('readerSource').removeAttribute('href');
    if (entry.type === 'cendoj') {
      try { const url = new URL(entry.url); if (url.origin === 'https://www.poderjudicial.es') { $('readerSource').href = url.href; $('readerSource').hidden = false; } } catch {}
    }
    $('readerAttachLabel').hidden = entry.type !== 'cendoj';
  }
  $('librarySearch').addEventListener('input', renderList);
  $('readerCopy').onclick = async () => { try { await navigator.clipboard.writeText(current()?.text || ''); $('libraryStatus').textContent = 'Texto copiado.'; } catch { $('libraryStatus').textContent = 'No se pudo copiar el texto.'; } };
  $('readerAttach').onchange = async event => {
    const attachCaseId = await CaseStorage.activeId();
    const entry = current(), file = event.target.files[0]; if (!entry || entry.type !== 'cendoj' || !file) return;
    $('libraryStatus').textContent = 'Extrayendo texto…';
    try {
      const text = await extractDocumentText(file); if (!text.trim()) throw Error('No se encontró texto. Si el PDF está escaneado, necesita reconocimiento de texto.');
      const saved = await CaseStorage.local.get('cendoj.texts', attachCaseId);
      const texts = { ...(saved['cendoj.texts'] || {}), [entry.sourceId]: { text, name: file.name } };
      await CaseStorage.local.set({ 'cendoj.texts': texts }, attachCaseId); if (await CaseStorage.activeId() === attachCaseId) { data['cendoj.texts'] = texts; rebuild(); }
      $('libraryStatus').textContent = 'Texto íntegro guardado localmente.';
    } catch (error) { $('libraryStatus').textContent = error.message; }
    event.target.value = '';
  };
  async function resize(delta) { readerSize = Math.min(32,Math.max(16,readerSize+delta)); document.documentElement.style.setProperty('--reader-size',readerSize+'px'); await CaseStorage.local.set({'library.readerSize':readerSize}); }
  $('readerSmaller').onclick = () => resize(-2); $('readerLarger').onclick = () => resize(2);
  CaseStorage.onChanged.addListener((changes, area) => { if (area !== 'local') return; if (changes.caseChanged) selected = null; for (const key of keys) if (changes[key]) data[key] = changes[key].newValue; rebuild(); });
  ensureDefaultCasePrompts().then(() => CaseStorage.local.get(keys)).then(saved => { data = saved; readerSize = Math.min(32,Math.max(16,Number(saved['library.readerSize']) || 20)); document.documentElement.style.setProperty('--reader-size',readerSize+'px'); rebuild(); }).catch(error => { $('libraryStatus').textContent = 'No se pudo cargar la biblioteca: '+error.message; });
})();
