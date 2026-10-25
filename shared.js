// Shared constants and helpers used by panel-core.js (and therefore both
// sidepanel.html and library.html).

const STORAGE_KEY = "promptLauncher.prompts";
const EXPANDED_KEY = "promptLauncher.expandedCategories";
const METADATA_KEY = "promptLauncher.metadata";
const UNCATEGORIZED = "Sin categoría";

// Accepts either a bare array or { prompts: [...] }.
// Accepts a few common key aliases per field so varied JSON exports still work.
function normalize(raw) {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw.prompts) ? raw.prompts : null;
  if (!arr) throw new Error("El JSON debe ser una lista de prompts o un objeto con una lista 'prompts'.");

  return arr.map((item, i) => {
    const name = item.name ?? item.nombre ?? item.prompt_name ?? item.title ?? `Prompt ${i + 1}`;
    const date = item.date ?? item.fecha ?? item.date_of_creation ?? item.created_at ?? "";
    const author = item.author ?? item.autor ?? item.prompt_author ?? "";
    const text = item.text ?? item.texto ?? item.prompt_text ?? item.content ?? "";
    const category = item.category ?? item.categoria ?? item["categoría"] ?? item.prompt_category ?? "";
    const comments = item.author_comments ?? item.comentarios_del_autor ?? item.comments ?? item.comentarios ?? "";
    const includesRaw = item.includes ?? item.incluye ?? item.include ?? item.composed_of ?? [];
    const includes = Array.isArray(includesRaw)
      ? includesRaw.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (!text) throw new Error(`El prompt n.º ${i + 1} ("${name}") no tiene texto.`);
    return {
      name: String(name),
      date: String(date),
      author: String(author),
      text: String(text),
      category: String(category),
      comments: String(comments),
      includes,
    };
  });
}

// Reads the optional top-level "metadata" object from an uploaded JSON file
// (created_by, creation_date, project, total_prompts, file_name), falling
// back to the browser-provided File object's own name/last-modified date
// when the JSON doesn't supply them.
function extractMetadata(raw, file) {
  const meta = raw && typeof raw === "object" && raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};

  const fileName = meta.file_name ?? meta.nombre_archivo ?? meta.fileName ?? meta.filename ?? (file && file.name) ?? "";

  let creationDate = meta.creation_date ?? meta.fecha_creacion ?? meta.created_date ?? meta.date ?? meta.fecha ?? "";
  if (!creationDate && file && file.lastModified) {
    creationDate = new Date(file.lastModified).toISOString().slice(0, 10);
  }

  const createdBy = meta.created_by ?? meta.creado_por ?? meta.createdBy ?? meta.author ?? meta.autor ?? "";
  const project = meta.project ?? meta.proyecto ?? "";
  const totalPrompts = meta.total_prompts ?? meta.totalPrompts ?? null;

  return {
    fileName: String(fileName),
    creationDate: String(creationDate),
    createdBy: String(createdBy),
    project: String(project),
    totalPrompts: totalPrompts === null ? null : Number(totalPrompts),
  };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1).trimEnd() + "…" : str;
}

// Resolves a prompt's full usable text by appending the text of any prompts
// it "includes" (referenced by name), in order. Recursive — an included
// prompt can itself include others. Guards against cycles (A includes B
// includes A) by tracking which names are already part of the current
// resolution chain; a cyclic reference is skipped rather than looping
// forever.
//
// Returns { text, composedOf, warnings }:
//   - text: the fully resolved, ready-to-use prompt text
//   - composedOf: the direct include names that resolved successfully (for display)
//   - warnings: any include names that were missing or caused a cycle
function resolvePromptText(prompt, allPrompts, chain = new Set()) {
  const nextChain = new Set(chain);
  nextChain.add(prompt.name);

  const parts = [prompt.text];
  const composedOf = [];
  const warnings = [];

  (prompt.includes || []).forEach((includeName) => {
    const target = allPrompts.find((p) => p.name === includeName);
    if (!target) {
      warnings.push(`"${includeName}" no encontrado — omitido.`);
      return;
    }
    if (nextChain.has(target.name)) {
      warnings.push(`"${includeName}" crea una referencia circular — omitido.`);
      return;
    }
    const resolved = resolvePromptText(target, allPrompts, nextChain);
    parts.push(resolved.text);
    composedOf.push(includeName);
    warnings.push(...resolved.warnings);
  });

  return { text: parts.join("\n\n"), composedOf, warnings };
}

// Builds a plain-text, human-readable rendering of the whole prompt collection.
function buildTextExport(prompts, metadata) {
  const lines = ["EXPORTACIÓN DE LA BIBLIOTECA DE PROMPTS"];

  if (metadata && metadata.fileName) lines.push(`Archivo de origen: ${metadata.fileName}`);
  if (metadata && metadata.creationDate) lines.push(`Fecha del archivo: ${metadata.creationDate}`);
  if (metadata && metadata.createdBy) lines.push(`Preparado por: ${metadata.createdBy}`);
  lines.push(`Exportado: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`Total de prompts: ${prompts.length}`);
  lines.push("");

  prompts.forEach((p, i) => {
    const resolved = resolvePromptText(p, prompts);
    lines.push("=".repeat(60));
    lines.push(`${i + 1}. ${p.name}`);
    const metaParts = [
      p.author && `Autor: ${p.author}`,
      p.date && `Fecha: ${p.date}`,
      p.category && `Categoría: ${p.category}`,
    ].filter(Boolean);
    if (metaParts.length) lines.push(metaParts.join("  |  "));
    if (resolved.composedOf.length) lines.push(`Compuesto por: ${resolved.composedOf.join(", ")}`);
    if (p.comments) {
      lines.push("");
      lines.push(`Comentario: ${p.comments}`);
    }
    lines.push("");
    lines.push(resolved.text);
    lines.push("");
  });

  lines.push("=".repeat(60));
  return lines.join("\n");
}

function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Added once, without replacing uploaded prompts or restoring deliberately deleted defaults.
const DEFAULT_PROMPTS_KEY = 'promptLauncher.defaultPrompts.v1';
const DEFAULT_CASE_PROMPTS = [
  {
    name: 'Estado del caso — informe para el abogado',
    author: 'Consello da Abogacía Galega', category: 'Análisis del caso', date: '',
    comments: 'Selecciona este prompt y todos los documentos del caso, y pulsa Combinar y copiar.', includes: [],
    text: `Actúa como asistente de análisis jurídico. Prepara un informe del estado actual del caso para el abogado responsable, basándote en todos los documentos que se incluyen a continuación. No presupongas que tienes acceso a archivos que no aparecen en el texto recibido.

1. Resume el asunto, las partes, sus posiciones, las pretensiones y el objetivo del cliente.
2. Ordena los hechos y actuaciones en una cronología, indicando para cada punto el documento y, cuando conste, la página o apartado que lo respalda.
3. Explica la situación procesal o extraprocesal actual: qué se ha hecho, qué está pendiente y qué resoluciones o comunicaciones se han recibido.
4. Identifica las pruebas disponibles, contradicciones, riesgos y documentos o datos que faltan.
5. Enumera plazos y fechas relevantes solo cuando estén documentados. Si no puedes calcular un plazo con certeza, explica qué datos debe verificar el abogado, sin inventar vencimientos.
6. Termina con un resumen ejecutivo y una lista priorizada de cuestiones pendientes para el abogado.

Distingue hechos acreditados, alegaciones e inferencias. No inventes hechos, normas, jurisprudencia ni citas. Expón cualquier incertidumbre y señala si falta información para valorar el estado del caso. Usa un lenguaje claro, preciso y profesional.`
  },
  {
    name: 'Cómo proceder — estrategia y próximos pasos',
    author: 'Consello da Abogacía Galega', category: 'Análisis del caso', date: '',
    comments: 'Selecciona este prompt y los documentos del caso para comparar vías de actuación.', includes: [],
    text: `Actúa como asistente del abogado responsable. A partir de todos los documentos del caso incluidos a continuación, responde: ¿cuál es la mejor forma de proceder ahora para defender los intereses del cliente? No presupongas acceso a archivos que no aparecen en el texto recibido.

1. Identifica el objetivo del cliente, la fase del asunto y las restricciones que constan en los documentos. Señala qué datos faltan, incluida la jurisdicción aplicable si no está clara.
2. Compara las alternativas viables (incluidas negociación, acuerdo o actuación procesal, cuando procedan). Para cada alternativa, explica sus ventajas, riesgos, pruebas necesarias, costes o tiempos que deban verificarse y posibles consecuencias.
3. Propón una vía de actuación motivada y alternativas de respaldo, vinculando el razonamiento a documentos concretos. Distingue los hechos acreditados de las hipótesis.
4. Presenta un plan priorizado: actuaciones inmediatas, información que debe recabarse, pruebas que preservar y decisiones que debe tomar el abogado con el cliente.
5. Destaca plazos y requisitos que deban comprobarse en fuentes oficiales actualizadas. No inventes plazos, normas, resoluciones ni citas y no garantices resultados.
6. Cierra con las preguntas concretas que necesitas resolver antes de formular una recomendación definitiva.

Si la documentación no permite recomendar una opción con suficiente fundamento, dilo y explica qué falta. La propuesta debe quedar sujeta a la revisión y decisión profesional del abogado.`
  }
];
async function installDefaultCasePrompts() {
  const saved = await chrome.storage.local.get([STORAGE_KEY, DEFAULT_PROMPTS_KEY]);
  if (saved[DEFAULT_PROMPTS_KEY]) return;
  const existing = saved[STORAGE_KEY] || [];
  const names = new Set(existing.map(prompt => prompt.name));
  await chrome.storage.local.set({
    [STORAGE_KEY]: [...existing, ...DEFAULT_CASE_PROMPTS.filter(prompt => !names.has(prompt.name))],
    [DEFAULT_PROMPTS_KEY]: true
  });
}
async function ensureDefaultCasePrompts() {
  const result = await chrome.runtime.sendMessage({ type: 'library:seedDefaults' });
  if (!result?.ok) throw Error(result?.error || 'No se pudieron cargar los prompts iniciales.');
}
