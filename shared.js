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
