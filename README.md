# Udemy: Traductor de Subtítulos (extensión de Chrome)

Traduce en tiempo real el subtítulo que va apareciendo en el reproductor de Udemy y lo
muestra superpuesto sobre el video, en el idioma que elijas.

## Cómo instalarla (modo desarrollador)

1. Descomprime esta carpeta en tu computadora (o déjala como está si ya está sin comprimir).
2. Abre Chrome (o Edge/Brave) y ve a: `chrome://extensions`
3. Activa el interruptor **"Modo de desarrollador"** (arriba a la derecha).
4. Haz clic en **"Cargar descomprimida"** (Load unpacked).
5. Selecciona la carpeta `udemy-translate-extension`.
6. Listo — el ícono de la extensión aparecerá en tu barra de herramientas.

## Cómo usarla

1. Ve a cualquier curso de Udemy y **activa los subtítulos en inglés** (ícono CC del
   reproductor). La extensión traduce lo que ya está en pantalla, no genera subtítulos
   desde cero.
2. Haz clic en el ícono de la extensión.
3. Marca "Traducción activada" y elige el idioma destino.
4. Ajusta "Tamaño de letra" y "Máximo de mensajes en historial" a tu gusto.
5. Para **mover** el panel de subtítulos: arrastra el ícono `⠿` que aparece en la parte
   superior del panel. La posición se guarda automáticamente.
6. Para **cambiar el tamaño** del panel: arrastra el ícono `◢` de la esquina inferior
   derecha. El tamaño también se guarda.
7. En "Motor de traducción" elige:
   - **Gratis**: usa un endpoint gratuito de Google Translate, sin cuenta ni API key.
     Rápido pero traduce frase por frase, sin contexto del curso.
   - **Gemini**: usa la API de Gemini (Google) con tu propia API key gratuita. Buena
     calidad, límite de 15 solicitudes/minuto y ~1,500/día en el free tier.
   - **Groq**: usa la API de Groq (modelo Llama 3.3 70B) con tu propia API key gratuita.
     Sin tarjeta de crédito, límite más generoso (30 solicitudes/minuto, 14,400/día) y
     respuestas muy rápidas.
8. Si eliges Gemini o Groq:
   - Pega tu API key (el popup muestra el link exacto para conseguirla según el motor —
     ninguno pide tarjeta de crédito).
   - Opcional pero recomendado: escribe un contexto del curso en el cuadro de texto,
     por ejemplo: *"Este es un curso de certificación CCA-F sobre la API de Claude.
     Usa términos técnicos correctos como 'token', 'prompt', 'API key', etc."* — ayuda
     a que la traducción mantenga la terminología correcta.
9. Reproduce la clase — el subtítulo traducido aparece superpuesto sobre el video.

## Cómo funciona

- `content.js` busca cada cierto tiempo el texto del subtítulo activo en el DOM de Udemy
  usando varios selectores de respaldo (por si Udemy cambia sus nombres de clase CSS).
- Cuando el texto cambia, lo traduce con el motor elegido:
  - **Gratis**: pide la traducción a `translate.googleapis.com` (endpoint no oficial).
  - **Gemini**: arma un prompt con el subtítulo + el contexto del curso, y llama a
    `generativelanguage.googleapis.com` (modelo `gemini-2.5-flash`).
  - **Groq**: mismo prompt, pero llama a `api.groq.com` (modelo `llama-3.3-70b-versatile`,
    API compatible con el formato de OpenAI).
- Muestra las traducciones en un panel flotante con historial de hasta N subtítulos
  (configurable). El panel se puede mover arrastrando el handle superior y redimensionar
  desde la esquina inferior derecha — posición y tamaño se persisten en storage.
- Mientras el narrador hace pausa y el subtítulo desaparece, el panel sigue visible con
  el historial acumulado.
- Guarda en caché las traducciones ya hechas (separadas por motor e idioma) para no
  repetir peticiones si el subtítulo se repite.
- Si una llamada a Gemini/Groq falla (rate limit, cuota agotada, key inválida), la
  extensión NO vuelve a mostrar el subtítulo en inglés — se queda con la última
  traducción buena y muestra un aviso rojo en la esquina superior izquierda con el
  detalle del error.

## Límites del free tier de cada motor

- **Gemini**: ~1,500 solicitudes/día y 15/minuto (modelo Flash). Si lo agotas, hay que
  esperar el reset (medianoche hora de California) o activar facturación en el proyecto
  (Gemini 2.5 Flash cuesta $0.30/$2.50 por millón de tokens — centavos para un curso
  completo). Google puede usar los prompts del free tier para mejorar sus modelos.
- **Groq**: 30 solicitudes/minuto y 14,400/día, sin tarjeta de crédito y sin fecha de
  vencimiento — para el volumen de subtítulos de un curso normal, prácticamente no se
  agota nunca. Solo modelos de código abierto (Llama), pero la calidad de traducción
  es buena.

## Limitaciones conocidas

- Si Udemy actualiza el diseño de su reproductor, puede que haya que agregar un nuevo
  selector CSS en `CAPTION_SELECTORS` dentro de `content.js`.
- El endpoint gratuito de Google Translate no es oficial: con uso muy intensivo puede
  devolver errores temporales. Para estudio normal no debería pasar.
- Solo traduce subtítulos que ya existen — no genera subtítulos si el curso no tiene
  ninguno activado.
