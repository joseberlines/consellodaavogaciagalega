// Handles turning uploaded documents (PDF, Word, Excel, ODS, ODT, .txt, .eml)
// into plain text, using locally bundled libraries (libs/) — no network calls,
// no remote code, consistent with Manifest V3's local-code requirement.

const DOCS_STORAGE_KEY = "promptLauncher.documents";

// Configure pdf.js's worker to load from the extension's own files.
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.min.js");
}

function getExtension(filename) {
  const match = /\.([^.]+)$/.exec(filename || "");
  return match ? match[1].toLowerCase() : "";
}

// ---------- Per-format extractors ----------

async function extractFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    pages.push(pageText);
  }
  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error(
      "No se encontró texto — este PDF puede ser una imagen escaneada sin capa de texto (no hay OCR)."
    );
  }
  return text;
}

async function extractFromDocx(file) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return (result.value || "").trim();
}

function sheetToMarkdownTable(sheet, maxRows = 200) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  if (!rows.length) return "(hoja vacía)";

  const header = rows[0].map((h) => String(h ?? "").trim() || " ");
  const body = rows.slice(1);
  const truncated = body.length > maxRows;
  const shownBody = truncated ? body.slice(0, maxRows) : body;

  const lines = [];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);
  shownBody.forEach((row) => {
    const cells = header.map((_, i) => String(row[i] ?? "").replace(/\|/g, "\\|"));
    lines.push(`| ${cells.join(" | ")} |`);
  });
  if (truncated) {
    lines.push("");
    lines.push(`_...recortado — ${body.length - maxRows} fila(s) más no se muestran._`);
  }
  return lines.join("\n");
}

async function extractFromSpreadsheet(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const parts = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const table = sheetToMarkdownTable(sheet);
    return workbook.SheetNames.length > 1 ? `### Hoja: ${name}\n\n${table}` : table;
  });
  return parts.join("\n\n").trim();
}

// Best-effort plain-text extraction from an OpenDocument Text (.odt) file.
// .odt is a zip archive with the actual text in a "content.xml" entry inside
// it; we unzip with JSZip and pull text out of its paragraph/heading tags.
async function extractFromOdt(file) {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file("content.xml");
  if (!contentFile) throw new Error("No se encontró content.xml dentro de este archivo .odt — puede estar dañado.");

  const xmlText = await contentFile.async("string");
  const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");

  // ODT uses namespaced tags like <text:p> and <text:h>; browsers' DOMParser
  // keeps the literal tag name (including prefix) for non-namespace-aware
  // lookups, so matching the prefixed tag name directly works in practice.
  const paragraphs = Array.from(xmlDoc.getElementsByTagName("text:p"));
  const headings = Array.from(xmlDoc.getElementsByTagName("text:h"));
  const all = [...headings, ...paragraphs].sort((a, b) => {
    const pos = a.compareDocumentPosition(b);
    return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  const text = (all.length ? all : paragraphs)
    .map((el) => el.textContent.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!text) throw new Error("No se encontró texto legible en este archivo .odt.");
  return text;
}

// Very basic .eml handling: plain-text emails only. Does not decode
// multipart MIME, base64, or quoted-printable bodies — those will show up
// as raw encoded text. Outlook's binary .msg format isn't supported at all.
async function extractFromEml(file) {
  const raw = await file.text();
  const splitIndex = raw.indexOf("\n\n");
  if (splitIndex === -1) return raw.trim();

  const headerBlock = raw.slice(0, splitIndex);
  const body = raw.slice(splitIndex + 2).trim();

  const getHeader = (name) => {
    const match = new RegExp(`^${name}:\\s*(.*)$`, "im").exec(headerBlock);
    return match ? match[1].trim() : "";
  };

  const subject = getHeader("Subject");
  const from = getHeader("From");
  const date = getHeader("Date");

  const lines = [];
  if (subject) lines.push(`Asunto: ${subject}`);
  if (from) lines.push(`De: ${from}`);
  if (date) lines.push(`Fecha: ${date}`);
  if (lines.length) lines.push("");
  lines.push(body || "(no se encontró cuerpo de texto plano legible)");
  return lines.join("\n");
}

async function extractFromPlainText(file) {
  return (await file.text()).trim();
}

// ---------- Dispatcher ----------

async function extractDocumentText(file) {
  const ext = getExtension(file.name);

  switch (ext) {
    case "pdf":
      return extractFromPdf(file);
    case "docx":
      return extractFromDocx(file);
    case "odt":
      return extractFromOdt(file);
    case "xlsx":
    case "xls":
    case "ods":
      return extractFromSpreadsheet(file);
    case "txt":
    case "md":
    case "csv":
      return extractFromPlainText(file);
    case "eml":
      return extractFromEml(file);
    case "msg":
      throw new Error("Los archivos .msg de Outlook no se admiten — guarda/exporta el correo como .eml o .txt.");
    case "doc":
      throw new Error("El formato antiguo .doc no se admite — solo .docx. Vuelve a guardarlo como .docx.");
    default:
      throw new Error(`Tipo de archivo no admitido: .${ext || "desconocido"}`);
  }
}

// ---------- Storage ----------

async function loadDocuments() {
  const data = await chrome.storage.local.get(DOCS_STORAGE_KEY);
  return data[DOCS_STORAGE_KEY] || [];
}

async function saveDocuments(docs) {
  await chrome.storage.local.set({ [DOCS_STORAGE_KEY]: docs });
}

// Processes a FileList (from an <input type="file" multiple"> change event),
// extracting text from each and returning { added, errors } — added is an
// array of { name, ext, text, size, addedAt }; errors is [{ name, message }].
async function processUploadedFiles(fileList) {
  const added = [];
  const errors = [];

  for (const file of Array.from(fileList)) {
    try {
      const text = await extractDocumentText(file);
      added.push({
        name: file.name,
        ext: getExtension(file.name),
        text,
        size: file.size,
        addedAt: new Date().toISOString(),
      });
    } catch (err) {
      errors.push({ name: file.name, message: err.message });
    }
  }

  return { added, errors };
}
