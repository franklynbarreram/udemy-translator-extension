# Udemy Subtítulos en Español (extensión de Chrome)

Traduce en tiempo real el subtítulo que va apareciendo en el reproductor de Udemy y lo
muestra superpuesto sobre el video, en el idioma que elijas.

## Cómo instalarla (modo desarrollador)

1. Descomprime esta carpeta en tu computadora (o déjala como está si ya está sin comprimir).
2. Abre Chrome (o Edge/Brave) y ve a: `chrome://extensions`
3. Activa el interruptor **"Modo de desarrollador"** (arriba a la derecha).
4. Haz clic en **"Cargar descomprimida"** (Load unpacked).
5. Selecciona la carpeta `udemy-translate-ext`.
6. Listo — el ícono de la extensión aparecerá en tu barra de herramientas.

## Cómo usarla

1. Ve a cualquier curso de Udemy y **activa los subtítulos en inglés** (ícono CC del
   reproductor). La extensión traduce lo que ya está en pantalla, no genera subtítulos
   desde cero.
2. Haz clic en el ícono de la extensión.
3. Marca "Traducción activada" y elige el idioma (por defecto: Español).
4. Ajusta "Posición vertical (% desde arriba)" y "Posición horizontal (% desde la
   izquierda)" para que el subtítulo aparezca exactamente donde quieras: (50, 50) es el
   centro de la pantalla, (0, 0) es la esquina superior izquierda, (100, 100) la
   inferior derecha, etc.
5. Ajusta "Tamaño de letra (px)" a tu gusto.
6. En "Motor de traducción" elige:
   - **Gratis**: usa un endpoint gratuito de Google Translate, sin cuenta ni API key.
     Rápido pero traduce frase por frase, sin contexto del curso.
   - **Gemini**: usa la API de Gemini (Google) con tu propia API key gratuita. Buena
     calidad, límite de 15 solicitudes/minuto y ~1,500/día en el free tier.
   - **Groq**: usa la API de Groq (modelo Llama 3.3 70B) con tu propia API key gratuita.
     Sin tarjeta de crédito, límite más generoso (30 solicitudes/minuto, 14,400/día) y
     respuestas muy rápidas. Buena opción por defecto si Gemini te da problemas de cuota.
7. Si eliges Gemini o Groq:
   - Pega tu API key (el popup muestra el link exacto para conseguirla gratis según el
     motor elegido — ninguno de los dos pide tarjeta de crédito).
   - Opcional pero recomendado: escribe un contexto del curso en el cuadro de texto,
     por ejemplo: *"Este es un curso de certificación CCA-F sobre la API de Claude.
     Usa términos técnicos correctos como 'token', 'prompt', 'API key', etc."* — esto
     ayuda a que la traducción mantenga la terminología correcta.
8. Reproduce la clase — el subtítulo traducido aparecerá superpuesto sobre el video.

## Cómo funciona (por si quieres modificarla)

- `content.js` busca cada cierto tiempo el texto del subtítulo activo en el DOM de Udemy
  usando varios selectores de respaldo (por si Udemy cambia sus nombres de clase CSS).
- Cuando el texto cambia, lo traduce con el motor elegido:
  - **Gratis**: pide la traducción a `translate.googleapis.com` (endpoint no oficial).
  - **Gemini**: arma un prompt con el subtítulo + el contexto del curso, y llama a
    `generativelanguage.googleapis.com` (modelo `gemini-2.5-flash`).
  - **Groq**: mismo prompt, pero llama a `api.groq.com` (modelo `llama-3.3-70b-versatile`,
    API compatible con el formato de OpenAI).
- Muestra la traducción en un `<div>` superpuesto, fijo a la pantalla (no a la página),
  en la posición y tamaño de letra que elijas.
- Guarda en caché las traducciones ya hechas (separadas por motor e idioma) para no
  repetir peticiones si el subtítulo se repite.
- Si una llamada a Gemini/Groq falla (rate limit, cuota agotada, key inválida), la
  extensión NO vuelve a mostrar el subtítulo en inglés — se queda con la última
  traducción buena y muestra un aviso rojo en la esquina superior izquierda con el
  detalle del error, para saber exactamente qué pasó sin abrir la consola.

## Límites del free tier de cada motor

- **Gemini**: ~1,500 solicitudes/día y 15/minuto (modelo Flash). Si lo agotas, hay que
  esperar el reset (medianoche hora de California) o activar facturación en el proyecto
  (Gemini 2.5 Flash cuesta $0.30/$2.50 por millón de tokens — centavos para un curso
  completo). Google puede usar los prompts del free tier para mejorar sus modelos.
- **Groq**: 30 solicitudes/minuto y 14,400/día, sin tarjeta de crédito y sin fecha de
  vencimiento — para el volumen de subtítulos de un curso normal, prácticamente no se
  agota nunca. Solo modelos de código abierto (Llama, no Gemini/GPT/Claude), pero la
  calidad de traducción es buena.

## Limitaciones conocidas

- Si Udemy actualiza el diseño de su reproductor, puede que haya que agregar un nuevo
  selector CSS en `CAPTION_SELECTORS` dentro de `content.js`.
- El endpoint de traducción es gratuito pero no oficial: si traduces muchísimo texto muy
  rápido, Google puede empezar a devolver errores temporalmente (rate limit). Para un uso
  normal de estudio no debería pasar.
- Solo traduce subtítulos que ya existen en inglés (u otro idioma) — no genera
  subtítulos si el curso no tiene ninguno activado.

## Ideas para mejorarla más adelante

- Guardar el historial de subtítulos traducidos de una clase para repasar después.
- Botón para ocultar el subtítulo original y dejar solo la traducción.
- Ajustar tamaño/posición del overlay desde el popup.
