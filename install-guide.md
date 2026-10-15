# Cómo instalar "Consello da Abogacía Galega"

Una guía sencilla, sin conocimientos técnicos. Basta con seguir los pasos en orden.

---

## Antes de empezar

- Solo funciona en **Google Chrome**, versión 114 o superior (no en Safari, Edge ni Firefox). Vale tanto en Windows como en Mac.
- Necesitas el archivo zip de la extensión: guárdalo antes en tu equipo (en el Escritorio o en Descargas).

---

## Paso 1 — Descomprimir el archivo

1. Busca el archivo zip (normalmente en **Descargas**).
2. Haz **doble clic** para descomprimirlo en una carpeta nueva.
3. **Mueve esa carpeta a un lugar permanente**, por ejemplo Escritorio o Documentos.
   - ⚠️ Importante: no borres esta carpeta ni la cambies de sitio después de instalar. Chrome la necesita en su lugar.

---

## Paso 2 — Abrir la página de extensiones de Chrome

1. Abre **Google Chrome**.
2. Haz clic en la barra de direcciones.
3. Escribe exactamente esto y pulsa **Intro**:
   ```
   chrome://extensions
   ```

---

## Paso 3 — Activar el "Modo desarrollador"

1. Mira la **esquina superior derecha** de la página.
2. Activa el interruptor **Modo desarrollador** (se pondrá azul).

---

## Paso 4 — Cargar la extensión

1. Pulsa **Cargar descomprimida** (aparece arriba a la izquierda al activar el modo desarrollador).
2. Selecciona la carpeta del Paso 1 (la carpeta en sí, no un archivo de dentro).
3. Pulsa **Seleccionar carpeta** (Windows) o **Abrir** (Mac).

Aparecerá una tarjeta llamada **"Consello da Abogacía Galega"**: ¡ha funcionado!

---

## Paso 5 — Fijarla en la barra de herramientas

1. Pulsa el **icono del puzle** 🧩 arriba a la derecha de Chrome.
2. Busca **"Consello da Abogacía Galega"** en la lista.
3. Pulsa la **chincheta** 📌 que hay a su lado.

---

## Paso 6 — Probarla

1. Pulsa el icono de la extensión en la barra de herramientas.
2. Se abre un panel anclado a la **derecha de la ventana** (no una ventanita emergente). Sigue abierto mientras navegas y puedes cambiar su ancho arrastrando su borde izquierdo.
3. Pulsa **Ayuda** para leer una explicación breve de qué hace y de la estructura del archivo JSON.
4. En **📚 Prompts**, pulsa **Subir JSON** y elige un archivo de prompts (o usa `sample-prompts.json`, incluido con la extensión).
5. En **📄 Documentos**, pulsa **Subir documentos** y elige uno o varios archivos (PDF, Word, Excel, texto…; o prueba con `sample-document.txt`).
6. **Marca** un prompt y un documento (casillas) y pulsa **Combinar y copiar**.
7. El texto combinado aparece en la vista previa, se copia al portapapeles y (si tenías un cuadro de texto seleccionado en una web) se escribe allí automáticamente.

¡Listo! 🎉

---

## ¿Algo no funciona?

- **"No veo Cargar descomprimida"** → Comprueba que el Modo desarrollador (Paso 3) está realmente activado.
- **La extensión desapareció al reiniciar Chrome** → Probablemente moviste o borraste su carpeta. Devuélvela a su sitio o repite el Paso 4 apuntando a la nueva ubicación.
- **Al pulsar el icono no se abre nada** → Comprueba que Chrome esté actualizado (Configuración → Información de Chrome).
- **Un documento da error al subirlo** → Revisa que el tipo de archivo sea compatible (ver README) y que no sea un PDF escaneado ni un `.doc`/`.msg` antiguo: no se admiten; consulta la Ayuda.
- **No pasa nada al pulsar Combinar y copiar en algunas webs** → Es normal en páginas restringidas (como las de configuración de Chrome). El texto sí se copia: pégalo a mano con Ctrl+V (Windows) o Cmd+V (Mac).
