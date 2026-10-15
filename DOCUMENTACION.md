# Consello da Abogacía Galega — documentación detallada

> Referencia completa de funciones, formato del archivo JSON y límites. Para una introducción y la instalación, consulta el [README](README.md).

v0.3 · Autor: Jose Ferro

Extensión de Chrome con **Panel lateral** que combina dos colecciones — una biblioteca compartida de **prompts** de IA y un conjunto de trabajo de **documentos** de referencia — para que puedas seleccionar la combinación que necesites, unirla en un único bloque de texto y tenerla copiada en el portapapeles e insertada en la página en la que trabajas.

El panel lateral se ancla a la derecha de la ventana, ocupa todo el alto, permanece abierto al cambiar de pestaña y se puede redimensionar arrastrando su borde izquierdo (es una capacidad nativa de Chrome).

## Instalación (sin empaquetar, para uso personal o de desarrollo)

1. Descomprime esta carpeta en un lugar permanente (no la borres después: Chrome carga la extensión desde estos archivos).
2. Abre `chrome://extensions` en Chrome.
3. Activa el **Modo desarrollador** (interruptor arriba a la derecha).
4. Pulsa **Cargar descomprimida** y selecciona esta carpeta.
5. Pulsa el icono de la extensión en la barra de herramientas: se abre el **panel lateral**. (Si no se abre directamente, usa el icono de panel lateral de Chrome o el menú del puzle y elige "Consello da Abogacía Galega".)

Requiere **Chrome 114 o superior** (API de Side Panel). Funciona igual en Windows y en Mac.

## Las dos colecciones

### 📚 Prompts (azul)
- Pulsa **Subir JSON** para cargar un archivo `prompts.json` (formato abajo; hay ejemplos en `sample-prompts.json` con claves en inglés y `sample-prompts-es.json` con claves en español).
- Los prompts se conservan entre sesiones. Subir un archivo nuevo sustituye el conjunto actual; **Borrar** lo vacía.
- Cada prompt tiene una **casilla**: marca uno o varios para incluirlos en una combinación.
- Si algún prompt tiene `category`, la lista se convierte en un explorador desplegable por categorías; si no, es una lista plana.
- Un cuadro de búsqueda y un filtro por autor (con el número de prompts de cada uno) acotan la lista.
- **+ Añadir prompt** abre un formulario para añadir un prompt directamente, pudiendo elegir otros prompts existentes para **incluir** (prompts compuestos).
- **⬇ JSON** / **⬇ Texto** exportan todo lo cargado, en formato máquina o legible respectivamente.

### 📄 Documentos (ámbar)
- Pulsa **Subir documentos** para elegir uno o varios archivos de tu equipo. Formatos admitidos:
  - **PDF** (`.pdf`) — solo PDF con texto; los PDF escaneados (solo imagen) no tienen texto extraíble (no hay OCR).
  - **Word** (`.docx`) — el formato antiguo `.doc` no se admite; guárdalo antes como `.docx`.
  - **Excel** (`.xlsx`, `.xls`) y **LibreOffice Calc** (`.ods`) — cada hoja se convierte en una tabla Markdown (máximo 200 filas por hoja, con aviso si se recorta).
  - **LibreOffice Writer** (`.odt`) — extracción de párrafos y títulos lo mejor posible.
  - **Texto plano** (`.txt`, `.md`, `.csv`).
  - **Correo** (`.eml`) — solo correos de texto plano; no decodifica cuerpos multipart/base64/quoted-printable. El formato binario `.msg` de Outlook no se admite: expórtalo como `.eml` o `.txt`.
- Cada documento tiene su **casilla**. El botón **Seleccionar todos** (junto a "Subir documentos") marca todos los documentos de una vez; si ya están todos marcados, cambia a **Deseleccionar todos** y los desmarca. **Borrar** elimina todos; la ✕ de una fila elimina solo ese documento.
- Los documentos **no** forman parte del archivo compartido de prompts: son tu conjunto de trabajo local, guardado aparte en el navegador.

### Combinar y copiar
- Marca cualquier mezcla de prompts y/o documentos y pulsa **Combinar y copiar**.
- El resultado — primero los prompts marcados (cada uno ya resuelto, incluyendo lo que incluya), luego los documentos marcados (cada uno con su nombre de archivo) — se copia al portapapeles, se muestra en una vista previa y (solo desde el panel lateral) se inserta en el campo de texto activo de la página que hay detrás.
- La vista de biblioteca en pestaña completa muestra la misma vista previa y el botón de copiar, pero no intenta insertar en otra página.

### Tamaño de letra
- Los botones **A−** y **A+** de la cabecera reducen o amplían toda la interfaz (letra, botones, casillas y espacios) en pasos del 10 %, entre el 80 % y el 200 %. El valor por defecto es el **120 %**; pulsar el porcentaje lo restablece. Se recuerda entre sesiones y se comparte entre el panel lateral y la pestaña completa.

### Secciones desplegables
- Las secciones Prompts y Documentos tienen cada una su cabecera para contraerlas o expandirlas, de forma independiente entre sí y del despliegue por categorías. El estado se conserva entre sesiones.

### Abrir en pestaña
- **⤢ Abrir en pestaña** abre todo — prompts *y* documentos — en una pestaña propia a tamaño completo (`library.html`), con exactamente los mismos datos que el panel lateral.

## Estructura del archivo JSON

Puede ser un objeto con la lista `prompts` (y, opcionalmente, un bloque `metadata`) o, directamente, una lista de prompts. Esta misma descripción está también en **Ayuda → Estructura del archivo JSON**.

**Todas las claves se aceptan en español o en inglés.**

**Claves de cada prompt**

| Español | Inglés | ¿Obligatoria? | Descripción |
|---|---|---|---|
| `texto` | `text` | **Sí** | Texto del prompt. Es la única clave imprescindible. |
| `nombre` | `name` | No | Nombre mostrado en la lista (si falta, "Prompt N"). También es la referencia que usan otros prompts para incluirlo. |
| `autor` | `author` | No | Autor. Alimenta el filtro por autor y su contador. |
| `fecha` | `date` | No | Fecha de creación del prompt (p. ej. `2026-08-01`). |
| `categoria` | `category` | No | Categoría; si alguno la tiene, la lista se agrupa en carpetas. |
| `comentarios_del_autor` | `author_comments` | No | Nota del autor sobre para qué sirve el prompt (en cursiva bajo el nombre). |
| `incluye` | `includes` | No | Lista de **nombres** de otros prompts cuyo texto se añade tras el de este. |

**Claves del bloque `metadata` (opcional)**: `nombre_archivo` / `file_name` y `fecha_creacion` / `creation_date` (se muestran bajo el título), `creado_por` / `created_by`, `proyecto` / `project` y `total_prompts` (se leen y conservan al descargar, sin mostrarse). Si no hay `metadata`, se usan el nombre y la fecha de modificación del propio archivo.

**Otros sinónimos aceptados**: nombre: `prompt_name`, `title` · texto: `prompt_text`, `content` · autor: `prompt_author` · fecha: `date_of_creation`, `created_at` · categoría: `categoría`, `prompt_category` · comentarios: `comentarios`, `comments` · incluye: `include`, `composed_of`.

Se pueden mezclar claves en español y en inglés dentro del mismo archivo. Al **descargar** (⬇ JSON), el archivo se genera con las claves en inglés, que son las internas de la extensión; al volver a subirlo se leen igual.

```json
{
  "prompts": [
    {
      "nombre": "Resumir artículo",
      "fecha": "2026-08-01",
      "autor": "Alex",
      "categoria": "Redacción",
      "comentarios_del_autor": "Para sacar 3 ideas clave.",
      "incluye": ["Tono corporativo"],
      "texto": "Resume el siguiente artículo en 3 puntos."
    }
  ],
  "metadata": {
    "nombre_archivo": "prompts.json",
    "fecha_creacion": "2026-08-05",
    "creado_por": "Jose Ferro",
    "proyecto": "Consello da Abogacía Galega",
    "total_prompts": 1
  }
}
```

## Prompts compuestos

Un prompt puede **incluir** otros por su nombre (clave `includes` o selector del formulario Añadir prompt). El texto de los incluidos se añade automáticamente allí donde se use ese prompt: en la combinación, la exportación de texto, la copia y la inserción. Es recursivo y está protegido contra referencias circulares. Se indica con una insignia 🔗. Las referencias son por nombre: si renombras un prompt que otros incluyen, esas referencias se omiten con un aviso (no dan error).

## Cómo se procesan los documentos (y sus límites)

Todos los formatos se procesan **dentro del navegador**: ningún archivo se sube ni se envía por la red. Se usan librerías JavaScript pequeñas y consolidadas, incluidas dentro de la extensión (carpeta `libs/`) en lugar de cargarse desde internet, como exige Manifest V3.

Límites:
- **PDF escaneados** (sin capa de texto real): no se extrae nada; haría falta OCR, que no está incluido.
- **`.doc` antiguo**: no se admite, solo `.docx`.
- **`.eml` básico**: los correos de texto plano funcionan bien; los multipart/HTML/base64 mostrarán contenido codificado.
- **`.msg` de Outlook**: no se admite; expórtalo como `.eml` o texto.
- **Hojas de cálculo**: se muestran valores, no fórmulas.
- Las hojas grandes se limitan a 200 filas por hoja para evitar un prompt combinado inmanejable.

## Notas y limitaciones

- Requiere Chrome 114 o posterior.
- La inserción automática no funciona en páginas internas de Chrome (`chrome://...`) ni en la Chrome Web Store; el portapapeles sí funciona, así que pega manualmente (Cmd/Ctrl+V).
- Todos los datos — prompts, documentos y su texto extraído — permanecen en tu navegador; no se envía nada a ningún sitio.

## Posibles mejoras futuras

- Editar/borrar prompts individuales desde el panel.
- OCR para PDF escaneados.
- Análisis MIME completo de `.eml` (cuerpos multipart/HTML, adjuntos).
- Reordenar los elementos marcados antes de combinar (ahora: primero todos los prompts, luego todos los documentos, en el orden de la lista).
