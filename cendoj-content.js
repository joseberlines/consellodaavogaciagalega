// Only operates on the public CENDOJ DOM. Never requests internal endpoints.
(() => {
  if (globalThis.cendojInstalled) return;
  globalThis.cendojInstalled = true;
  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type !== 'cendoj:dom') return;
    try {
      if (message.action === 'search') {
        const field = document.querySelector('#frmBusquedajurisprudencia_TEXT');
        const button = document.querySelector('#srcjur_search');
        if (!field || !button) throw Error('No se encuentra el formulario. Realiza la búsqueda manualmente y captura la página.');
        field.value = message.query;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        button.click();
        respond({ ok: true });
      } else if (message.action === 'capture') {
        const rows = [...document.querySelectorAll('#jurisprudenciaresults_searchresults div.searchresult, div.searchresult')].map(card => {
          const all = text(card);
          const value = (label) => {
            const match = all.match(new RegExp('(?:^|\\s)' + label + '\\s*:\\s*(.*?)(?=\\s+(?:ROJ|ECLI|Fecha|Órgano|Organo|Ponente|Municipio|N[º°o]?\\.?\\s*(?:de\\s*)?(?:Resolución|Recurso)|Resumen)\\s*:|$)', 'i'));
            return match?.[1]?.trim() || '';
          };
          const link = [...card.querySelectorAll('a[href]')].find(a => /(?:openDocument|document|\/AN\/)/i.test(a.getAttribute('href'))) || card.querySelector('a[href]');
          let url = '';
          try { const u = new URL(link?.getAttribute('href') || '', location.href); if (u.protocol === 'https:' && u.hostname === 'www.poderjudicial.es' && link) url = u.href; } catch {}
          return { id: card.id || '', titulo: text(card.querySelector('h2,h3,h4,.title')) || text(link) || all.slice(0,160), fecha: value('Fecha'), organo: value('[ÓO]rgano'), roj: value('ROJ') || all.match(/\b(?:STS|SAN|SAP|STSJ|ATS|AAP)\s+\d+\/\d{4}\b/)?.[0] || '', ecli: all.match(/ECLI:[A-Z0-9:.\-]+/i)?.[0] || '', n_resolucion: value('N[º°o]?\\.?\\s*(?:de\\s*)?Resoluci[óo]n'), n_recurso: value('N[º°o]?\\.?\\s*(?:de\\s*)?Recurso'), ponente: value('Ponente'), municipio: value('Municipio'), resumen: value('Resumen') || all, url_documento: url };
        });
        const current = document.querySelector('ul.pagination .active');
        const page = Number(text(current));
        const next = [...document.querySelectorAll('ul.pagination a')].find(a => Number(text(a)) === page + 1 && page > 0);
        respond({ ok: true, rows, next: !!next, signature: JSON.stringify(rows) });
      } else if (message.action === 'next') {
        const page = Number(text(document.querySelector('ul.pagination .active')));
        const next = [...document.querySelectorAll('ul.pagination a')].find(a => Number(text(a)) === page + 1 && page > 0);
        if (!next) throw Error('Avanza de página manualmente y pulsa Capturar página visible.');
        next.click(); respond({ ok: true });
      }
    } catch (error) { respond({ ok: false, error: error.message }); }
  });
})();
