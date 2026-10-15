// Shared logic for both the side panel (sidepanel.html) and the full-tab
// library view (library.html). Both pages use identical element IDs; only
// their CSS/layout differs. `document.body.dataset.context` is either
// "sidepanel" or "library" and gates the few behaviors that differ (mainly:
// inserting text into an underlying page only makes sense from the side
// panel, not from the library's own standalone tab).

const CONTEXT = document.body.dataset.context; // "sidepanel" | "library"

// ---------- Element refs ----------
const fileInput = document.getElementById("fileInput");
const docFileInput = document.getElementById("docFileInput");
const clearBtn = document.getElementById("clearBtn");
const clearDocsBtn = document.getElementById("clearDocsBtn");
const selectAllDocsBtn = document.getElementById("selectAllDocsBtn");
const helpBtn = document.getElementById("helpBtn");
const helpPanel = document.getElementById("helpPanel");
const closeHelpBtn = document.getElementById("closeHelpBtn");
const searchBox = document.getElementById("searchBox");
const authorFilter = document.getElementById("authorFilter");
const statusEl = document.getElementById("status");
const promptListEl = document.getElementById("promptList");
const docListEl = document.getElementById("docList");
const fileMetaLine = document.getElementById("fileMetaLine");
const openLibraryBtn = document.getElementById("openLibraryBtn");

const promptsSectionHeader = document.getElementById("promptsSectionHeader");
const promptsSectionBody = document.getElementById("promptsSectionBody");
const promptsSectionChevron = document.getElementById("promptsSectionChevron");
const promptsCountBadge = document.getElementById("promptsCountBadge");

const docsSectionHeader = document.getElementById("docsSectionHeader");
const docsSectionBody = document.getElementById("docsSectionBody");
const docsSectionChevron = document.getElementById("docsSectionChevron");
const docsCountBadge = document.getElementById("docsCountBadge");

const combineBar = document.getElementById("combineBar");
const combineSummary = document.getElementById("combineSummary");
const combineBtn = document.getElementById("combineBtn");

const combinedPreviewBox = document.getElementById("combinedPreviewBox");
const combinedPreviewText = document.getElementById("combinedPreviewText");
const combinedCopyBtn = document.getElementById("combinedCopyBtn");
const combinedCopyFlag = document.getElementById("combinedCopyFlag");
const insertHint = document.getElementById("insertHint");

const addPromptBtn = document.getElementById("addPromptBtn");
const downloadJsonBtn = document.getElementById("downloadJsonBtn");
const downloadTxtBtn = document.getElementById("downloadTxtBtn");
const addPromptPanel = document.getElementById("addPromptPanel");
const newName = document.getElementById("newName");
const newAuthor = document.getElementById("newAuthor");
const newDate = document.getElementById("newDate");
const newCategory = document.getElementById("newCategory");
const newComments = document.getElementById("newComments");
const newIncludes = document.getElementById("newIncludes");
const newText = document.getElementById("newText");
const saveNewPromptBtn = document.getElementById("saveNewPromptBtn");
const cancelNewPromptBtn = document.getElementById("cancelNewPromptBtn");
const addPromptError = document.getElementById("addPromptError");

// ---------- State ----------
let allPrompts = [];
let allDocuments = [];
let fileMetadata = null;
let expandedCategories = new Set();
let checkedPromptNames = new Set();
let checkedDocNames = new Set();
let sectionsExpanded = { prompts: true, documents: true };

const SECTIONS_KEY = "promptLauncher.sectionsExpanded";

// ---------- Storage ----------
async function loadAll() {
  const data = await chrome.storage.local.get([
    STORAGE_KEY,
    EXPANDED_KEY,
    METADATA_KEY,
    DOCS_STORAGE_KEY,
    SECTIONS_KEY,
  ]);
  allPrompts = data[STORAGE_KEY] || [];
  expandedCategories = new Set(data[EXPANDED_KEY] || []);
  fileMetadata = data[METADATA_KEY] || null;
  allDocuments = data[DOCS_STORAGE_KEY] || [];
  sectionsExpanded = data[SECTIONS_KEY] || { prompts: true, documents: true };

  applySectionState();
  renderFileMeta();
  renderPrompts();
  renderDocuments();
  renderCombineBar();
}

async function savePrompts(prompts) {
  await chrome.storage.local.set({ [STORAGE_KEY]: prompts });
  allPrompts = prompts;
  renderPrompts();
  renderCombineBar();
}

async function saveMetadata(metadata) {
  await chrome.storage.local.set({ [METADATA_KEY]: metadata });
  fileMetadata = metadata;
  renderFileMeta();
}

async function saveDocumentsState(docs) {
  await chrome.storage.local.set({ [DOCS_STORAGE_KEY]: docs });
  allDocuments = docs;
  renderDocuments();
  renderCombineBar();
}

async function saveExpandedCategories() {
  await chrome.storage.local.set({ [EXPANDED_KEY]: Array.from(expandedCategories) });
}

async function saveSectionsState() {
  await chrome.storage.local.set({ [SECTIONS_KEY]: sectionsExpanded });
}

function applySectionState() {
  promptsSectionBody.hidden = !sectionsExpanded.prompts;
  promptsSectionChevron.classList.toggle("expanded", sectionsExpanded.prompts);
  docsSectionBody.hidden = !sectionsExpanded.documents;
  docsSectionChevron.classList.toggle("expanded", sectionsExpanded.documents);
}

function toggleCategory(category) {
  if (expandedCategories.has(category)) expandedCategories.delete(category);
  else expandedCategories.add(category);
  saveExpandedCategories();
  renderPrompts();
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#d33" : "#666";
}

function renderFileMeta() {
  if (!fileMetadata || (!fileMetadata.fileName && !fileMetadata.creationDate)) {
    fileMetaLine.hidden = true;
    fileMetaLine.innerHTML = "";
    return;
  }
  const parts = [];
  if (fileMetadata.fileName) parts.push(`<strong>${escapeHtml(fileMetadata.fileName)}</strong>`);
  if (fileMetadata.creationDate) parts.push(escapeHtml(fileMetadata.creationDate));
  if (fileMetadata.createdBy) parts.push(`por ${escapeHtml(fileMetadata.createdBy)}`);
  fileMetaLine.innerHTML = `📄 ${parts.join("  ·  ")}`;
  fileMetaLine.hidden = false;
}

// ---------- Prompts: rendering ----------
function populateAuthorFilter() {
  const counts = new Map();
  allPrompts.forEach((p) => {
    const key = p.author || "Desconocido";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const selected = authorFilter.value;
  const authors = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
  authorFilter.innerHTML = `<option value="">Todos los autores (${allPrompts.length})</option>${authors
    .map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)} (${counts.get(a)})</option>`)
    .join("")}`;
  if (selected && authors.includes(selected)) authorFilter.value = selected;
}

function renderPrompts() {
  populateAuthorFilter();
  promptsCountBadge.textContent = allPrompts.length;

  const query = searchBox.value.trim().toLowerCase();
  const selectedAuthor = authorFilter.value;

  const filtered = allPrompts.filter((p) => {
    const matchesAuthor = !selectedAuthor || (p.author || "Desconocido") === selectedAuthor;
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.author.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query);
    return matchesAuthor && matchesQuery;
  });

  promptListEl.innerHTML = "";

  if (allPrompts.length === 0) {
    promptListEl.innerHTML = `<div class="empty-state">Todavía no hay prompts cargados.<br/>Sube un archivo JSON para empezar.</div>`;
    return;
  }
  if (filtered.length === 0) {
    promptListEl.innerHTML = `<div class="empty-state">Ningún prompt coincide con la búsqueda.</div>`;
    return;
  }

  const hasCategories = allPrompts.some((p) => p.category);

  if (!hasCategories) {
    filtered.forEach((p) => promptListEl.appendChild(buildPromptRow(p)));
    return;
  }

  const groups = new Map();
  filtered.forEach((p) => {
    const key = p.category || UNCATEGORIZED;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });

  const sortedCategories = Array.from(groups.keys()).sort((a, b) =>
    a === UNCATEGORIZED ? 1 : b === UNCATEGORIZED ? -1 : a.localeCompare(b)
  );

  sortedCategories.forEach((category) => {
    const items = groups.get(category);
    const isExpanded = query || selectedAuthor ? true : expandedCategories.has(category);

    const groupEl = document.createElement("div");
    groupEl.className = "category-group";

    const header = document.createElement("button");
    header.className = "category-header";
    header.innerHTML = `<span class="chevron ${isExpanded ? "expanded" : ""}">▸</span><span class="category-name">${escapeHtml(
      category
    )}</span><span class="category-count">${items.length}</span>`;
    header.addEventListener("click", () => toggleCategory(category));
    groupEl.appendChild(header);

    if (isExpanded) {
      const itemsEl = document.createElement("div");
      itemsEl.className = "category-items";
      items.forEach((p) => itemsEl.appendChild(buildPromptRow(p)));
      groupEl.appendChild(itemsEl);
    }

    promptListEl.appendChild(groupEl);
  });
}

function buildPromptRow(p) {
  const row = document.createElement("label");
  row.className = "item-row prompt-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checkedPromptNames.has(p.name);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) checkedPromptNames.add(p.name);
    else checkedPromptNames.delete(p.name);
    renderCombineBar();
  });

  const body = document.createElement("div");
  body.className = "item-body";
  const metaParts = [p.author, p.date].filter(Boolean);
  const commentSnippet = p.comments ? truncate(p.comments, 100) : "";
  const composedBadge =
    p.includes && p.includes.length ? `<span class="composed-badge">🔗 ${p.includes.length}</span>` : "";
  body.innerHTML = `<span class="item-name">${escapeHtml(p.name)}${composedBadge}</span>${
    metaParts.length ? `<span class="meta">${escapeHtml(metaParts.join(" · "))}</span>` : ""
  }${commentSnippet ? `<span class="comment-snippet">${escapeHtml(commentSnippet)}</span>` : ""}`;

  row.appendChild(checkbox);
  row.appendChild(body);
  return row;
}

// ---------- Documents: rendering ----------
function updateSelectAllBtn() {
  const allChecked = allDocuments.length > 0 && allDocuments.every((d) => checkedDocNames.has(d.name));
  selectAllDocsBtn.disabled = allDocuments.length === 0;
  selectAllDocsBtn.textContent = allChecked ? "Deseleccionar todos" : "Seleccionar todos";
}

function renderDocuments() {
  docsCountBadge.textContent = allDocuments.length;
  updateSelectAllBtn();
  docListEl.innerHTML = "";

  if (allDocuments.length === 0) {
    docListEl.innerHTML = `<div class="empty-state">Todavía no hay documentos subidos.<br/>Pulsa "Subir documentos" para añadir PDF, Word, Excel, ODS, ODT, texto o archivos .eml.</div>`;
    return;
  }

  allDocuments.forEach((d) => docListEl.appendChild(buildDocRow(d)));
}

function buildDocRow(d) {
  const row = document.createElement("div");
  row.className = "item-row doc-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checkedDocNames.has(d.name);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) checkedDocNames.add(d.name);
    else checkedDocNames.delete(d.name);
    renderCombineBar();
  });

  const body = document.createElement("div");
  body.className = "item-body";
  const sizeKb = d.size ? `${Math.max(1, Math.round(d.size / 1024))} KB` : "";
  body.innerHTML = `<span class="item-name">📎 ${escapeHtml(d.name)}</span><span class="meta">${escapeHtml(
    d.ext.toUpperCase()
  )}${sizeKb ? " · " + sizeKb : ""}</span>`;

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-doc-btn";
  removeBtn.title = "Quitar este documento";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    checkedDocNames.delete(d.name);
    await saveDocumentsState(allDocuments.filter((doc) => doc.name !== d.name));
  });

  row.appendChild(checkbox);
  row.appendChild(body);
  row.appendChild(removeBtn);
  return row;
}

// ---------- Combine bar ----------
function renderCombineBar() {
  updateSelectAllBtn();
  const n = checkedPromptNames.size;
  const m = checkedDocNames.size;
  if (n === 0 && m === 0) {
    combineSummary.textContent = "Selecciona prompts y/o documentos para combinarlos.";
    combineBtn.disabled = true;
  } else {
    combineSummary.textContent = `${n} prompt${n === 1 ? "" : "s"} + ${m} documento${m === 1 ? "" : "s"} seleccionado${n + m === 1 ? "" : "s"}`;
    combineBtn.disabled = false;
  }
}

function buildCombinedText() {
  const parts = [];

  allPrompts
    .filter((p) => checkedPromptNames.has(p.name))
    .forEach((p) => {
      const resolved = resolvePromptText(p, allPrompts);
      parts.push(resolved.text);
    });

  allDocuments
    .filter((d) => checkedDocNames.has(d.name))
    .forEach((d) => {
      parts.push(`--- ${d.name} ---\n${d.text}`);
    });

  return parts.join("\n\n");
}

async function combineAndUse() {
  const combined = buildCombinedText();
  if (!combined.trim()) {
    setStatus("No hay nada seleccionado para combinar.", true);
    return;
  }

  combinedPreviewBox.hidden = false;
  combinedPreviewText.value = combined;
  combinedCopyFlag.hidden = true;

  await copyToClipboard(combined, combinedCopyFlag);

  if (CONTEXT === "sidepanel") {
    await insertIntoActiveTab(combined);
    insertHint.hidden = false;
  } else {
    insertHint.hidden = true;
  }
}

// ---------- Clipboard & page insertion ----------
async function copyToClipboard(text, flagEl) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  if (flagEl) {
    flagEl.hidden = false;
    setTimeout(() => (flagEl.hidden = true), 1500);
  }
}

async function insertIntoActiveTab(text) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: insertTextIntoActiveElement,
      args: [text],
    });
  } catch (err) {
    setStatus("Copiado al portapapeles. No se pudo insertar automáticamente en esta página — pega manualmente (Cmd/Ctrl+V).");
  }
}

function insertTextIntoActiveElement(text) {
  const el = document.activeElement;
  if (!el) return;
  const isTextInput =
    el.tagName === "TEXTAREA" ||
    (el.tagName === "INPUT" && ["text", "search", "email", "url", "tel"].includes(el.type));
  if (isTextInput) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (typeof el.setRangeText === "function") el.setRangeText(text, start, end, "end");
    else el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (el.isContentEditable) {
    document.execCommand("insertText", false, text);
  }
}

// ---------- Events: prompts JSON upload ----------
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    const prompts = normalize(raw);
    const metadata = extractMetadata(raw, file);
    await savePrompts(prompts);
    await saveMetadata(metadata);
    setStatus(`Se cargaron ${prompts.length} prompt${prompts.length === 1 ? "" : "s"}.`);
  } catch (err) {
    setStatus(`No se pudo cargar el archivo: ${err.message}`, true);
  } finally {
    fileInput.value = "";
  }
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("¿Quitar todos los prompts guardados? No se puede deshacer (salvo que tengas una copia descargada).")) return;
  checkedPromptNames.clear();
  await savePrompts([]);
  await saveMetadata(null);
  setStatus("Se borraron todos los prompts guardados.");
});

// ---------- Events: documents upload ----------
docFileInput.addEventListener("change", async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  setStatus(`Procesando ${files.length} documento(s)…`);
  const { added, errors } = await processUploadedFiles(files);

  if (added.length) {
    const existingNames = new Set(allDocuments.map((d) => d.name));
    const deduped = added.filter((d) => !existingNames.has(d.name));
    await saveDocumentsState([...allDocuments, ...deduped]);
  }

  if (errors.length) {
    setStatus(
      `Se añadieron ${added.length} documento(s). Fallaron ${errors.length}: ${errors
        .map((e2) => `${e2.name} (${e2.message})`)
        .join("; ")}`,
      errors.length > 0 && added.length === 0
    );
  } else {
    setStatus(`Se añadieron ${added.length} documento(s).`);
  }
  docFileInput.value = "";
});

selectAllDocsBtn.addEventListener("click", () => {
  const allChecked = allDocuments.length > 0 && allDocuments.every((d) => checkedDocNames.has(d.name));
  if (allChecked) checkedDocNames.clear();
  else allDocuments.forEach((d) => checkedDocNames.add(d.name));
  renderDocuments();
  renderCombineBar();
});

clearDocsBtn.addEventListener("click", async () => {
  if (!confirm("¿Quitar todos los documentos subidos?")) return;
  checkedDocNames.clear();
  await saveDocumentsState([]);
  setStatus("Se borraron todos los documentos subidos.");
});

searchBox.addEventListener("input", renderPrompts);
authorFilter.addEventListener("change", renderPrompts);

helpBtn.addEventListener("click", () => {
  helpPanel.hidden = !helpPanel.hidden;
});
closeHelpBtn.addEventListener("click", () => {
  helpPanel.hidden = true;
});

// ---------- Section collapse/expand ----------
promptsSectionHeader.addEventListener("click", () => {
  sectionsExpanded.prompts = !sectionsExpanded.prompts;
  applySectionState();
  saveSectionsState();
});
docsSectionHeader.addEventListener("click", () => {
  sectionsExpanded.documents = !sectionsExpanded.documents;
  applySectionState();
  saveSectionsState();
});

// ---------- Add prompt ----------
addPromptBtn.addEventListener("click", () => {
  addPromptPanel.hidden = !addPromptPanel.hidden;
  addPromptError.hidden = true;
  if (!addPromptPanel.hidden) populateIncludesPicker();
});

function populateIncludesPicker() {
  if (allPrompts.length === 0) {
    newIncludes.innerHTML = `<option disabled>Aún no hay otros prompts cargados</option>`;
    return;
  }
  const sorted = [...allPrompts].sort((a, b) => a.name.localeCompare(b.name));
  newIncludes.innerHTML = sorted
    .map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`)
    .join("");
}

cancelNewPromptBtn.addEventListener("click", () => {
  clearAddPromptForm();
  addPromptPanel.hidden = true;
});

saveNewPromptBtn.addEventListener("click", async () => {
  const text = newText.value.trim();
  if (!text) {
    addPromptError.textContent = "El texto del prompt es obligatorio.";
    addPromptError.hidden = false;
    return;
  }
  const prompt = {
    name: newName.value.trim() || `Prompt ${allPrompts.length + 1}`,
    date: newDate.value || "",
    author: newAuthor.value.trim(),
    category: newCategory.value.trim(),
    comments: newComments.value.trim(),
    includes: Array.from(newIncludes.selectedOptions).map((o) => o.value),
    text,
  };
  const normalized = normalize([prompt])[0];
  await savePrompts([...allPrompts, normalized]);
  clearAddPromptForm();
  addPromptPanel.hidden = true;
  setStatus(`Se añadió "${normalized.name}".`);
});

function clearAddPromptForm() {
  newName.value = "";
  newAuthor.value = "";
  newDate.value = "";
  newCategory.value = "";
  newComments.value = "";
  newText.value = "";
  Array.from(newIncludes.options).forEach((o) => (o.selected = false));
  addPromptError.hidden = true;
}

// ---------- Downloads ----------
downloadJsonBtn.addEventListener("click", () => {
  if (allPrompts.length === 0) {
    setStatus("Todavía no hay prompts que descargar.", true);
    return;
  }
  const exportData = { prompts: allPrompts };
  if (fileMetadata) exportData.metadata = fileMetadata;
  triggerDownload("prompts.json", JSON.stringify(exportData, null, 2), "application/json");
  setStatus(`Se descargaron ${allPrompts.length} prompt${allPrompts.length === 1 ? "" : "s"} como JSON.`);
});

downloadTxtBtn.addEventListener("click", () => {
  if (allPrompts.length === 0) {
    setStatus("Todavía no hay prompts que descargar.", true);
    return;
  }
  triggerDownload("prompts.txt", buildTextExport(allPrompts, fileMetadata), "text/plain");
  setStatus(`Se descargaron ${allPrompts.length} prompt${allPrompts.length === 1 ? "" : "s"} como texto.`);
});

// ---------- Open as tab (hidden entirely when already in the library tab) ----------
if (openLibraryBtn) {
  if (CONTEXT === "library") {
    openLibraryBtn.hidden = true;
  } else {
    openLibraryBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
    });
  }
}

combineBtn.addEventListener("click", combineAndUse);
combinedCopyBtn.addEventListener("click", () => {
  copyToClipboard(combinedPreviewText.value, combinedCopyFlag);
});

// Keep in sync across the side panel and any open library tab.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    (changes[STORAGE_KEY] || changes[EXPANDED_KEY] || changes[METADATA_KEY] || changes[DOCS_STORAGE_KEY])
  ) {
    loadAll();
  }
});

loadAll();
