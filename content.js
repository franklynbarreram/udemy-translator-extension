// ===== Udemy: Traductor de Subtítulos =====
// Detecta el subtítulo activo en el reproductor de Udemy, lo traduce
// al idioma elegido y lo muestra superpuesto sobre el video.

(function () {
  // Espaciado mínimo entre llamadas a cada API para no chocar con sus
  // límites gratis de solicitudes por minuto.
  const MIN_INTERVAL_MS = {
    gemini: 4300, // free tier: 15 RPM
    groq: 2200, // free tier: 30 RPM
  };


  const PROVIDER_LABELS = { gemini: "Gemini", groq: "Groq" };

  const STATE = {
    enabled: true,
    targetLang: "es",
    positionPercent: 50,
    positionPercentX: 50,
    fontSize: 20,
    provider: "free",
    geminiApiKey: "",
    groqApiKey: "",
    courseContext: "",
    lastOriginalText: "",
    lastGoodTranslation: "",
    lastApiCallAt: 0,
    lastApiError: "",
    cache: new Map(),
    history: [],
    maxHistory: 20,
    historyHeight: 200,
  };

  // Varios selectores de respaldo por si Udemy cambia los nombres de clase.
  const CAPTION_SELECTORS = [
    '[data-purpose="captions-cue-text"]',
    '[data-purpose*="captions-cue"]',
    '.captions-display--captions-cue-text--TQ0DK',
    '[class*="captions-display"] [class*="cue-text"]',
    '[class*="captions"] [class*="cue"]',
  ];

  function findCaptionNode() {
    for (const sel of CAPTION_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 0) return el;
    }
    return null;
  }

  // Con position:fixed el overlay se ancla a la ventana (viewport), no a la
  // página, así que siempre aparece donde estás mirando, sin importar el
  // largo de la página ni el scroll.
  function ensureOverlay() {
    let overlay = document.getElementById("udemy-translate-overlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "udemy-translate-overlay";

    const handle = document.createElement("div");
    handle.id = "udemy-translate-handle";
    handle.textContent = "⠿";
    overlay.appendChild(handle);

    const content = document.createElement("div");
    content.id = "udemy-translate-content";
    overlay.appendChild(content);

    document.body.appendChild(overlay);
    setupDrag(overlay, handle);
    return overlay;
  }

  function setupDrag(overlay, handle) {
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener("mousedown", (e) => {
      dragging = true;
      const rect = overlay.getBoundingClientRect();
      offsetX = e.clientX - (rect.left + rect.width / 2);
      offsetY = e.clientY - (rect.top + rect.height / 2);
      handle.style.cursor = "grabbing";
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const cx = e.clientX - offsetX;
      const cy = e.clientY - offsetY;
      STATE.positionPercentX = Math.min(100, Math.max(0, (cx / window.innerWidth) * 100));
      STATE.positionPercent = Math.min(100, Math.max(0, (cy / window.innerHeight) * 100));
      applyPosition(overlay);
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = "";
      chrome.storage.sync.set({
        positionPercent: STATE.positionPercent,
        positionPercentX: STATE.positionPercentX,
      });
    });
  }

  function applyPosition(overlay) {
    overlay.style.top = STATE.positionPercent + "%";
    overlay.style.left = STATE.positionPercentX + "%";
    overlay.style.bottom = "";
    overlay.style.right = "";
    overlay.style.transform = "translate(-50%, -50%)";
    overlay.style.fontSize = STATE.fontSize + "px";
    const content = overlay.querySelector("#udemy-translate-content");
    if (content) content.style.maxHeight = STATE.historyHeight + "px";
  }

  function renderHistory(overlay) {
    const content = overlay.querySelector("#udemy-translate-content");
    if (!content) return;
    content.innerHTML = "";
    const ul = document.createElement("ul");
    STATE.history.forEach((item, i) => {
      const li = document.createElement("li");
      li.textContent = item;
      li.className =
        i === STATE.history.length - 1
          ? "udemy-history-item current"
          : "udemy-history-item";
      ul.appendChild(li);
    });
    content.appendChild(ul);
    content.scrollTop = content.scrollHeight;
  }

  function ensureErrorBadge() {
    let badge = document.getElementById("udemy-translate-error-badge");
    if (badge) return badge;
    badge = document.createElement("div");
    badge.id = "udemy-translate-error-badge";
    document.body.appendChild(badge);
    return badge;
  }

  function updateErrorBadge() {
    const badge = ensureErrorBadge();
    const isAiProvider = STATE.provider === "gemini" || STATE.provider === "groq";
    const shouldShow = isAiProvider && !!STATE.lastApiError;
    const label = PROVIDER_LABELS[STATE.provider] || STATE.provider;
    const newText = shouldShow ? "⚠ " + label + ": " + STATE.lastApiError : "";

    // Solo tocamos el DOM si algo realmente cambió, para no generar
    // escrituras innecesarias en cada ciclo (evita bucles con cualquier
    // observador de DOM que pudiera existir).
    if (badge.dataset.lastText !== newText) {
      badge.textContent = newText;
      badge.style.display = shouldShow ? "block" : "none";
      badge.dataset.lastText = newText;
    }
  }

  const LANG_NAMES = {
    es: "español",
    en: "inglés",
    pt: "portugués",
    fr: "francés",
    de: "alemán",
    it: "italiano",
  };

  function buildPrompt(text) {
    const langName = LANG_NAMES[STATE.targetLang] || STATE.targetLang;
    const contextLine = STATE.courseContext
      ? `Contexto del curso: ${STATE.courseContext}\n`
      : "";

    return (
      `Traduce el siguiente subtítulo de un video educativo al ${langName}. ` +
      `${contextLine}` +
      `Mantén los términos técnicos correctos según el contexto del curso. ` +
      `Responde ÚNICAMENTE con la traducción, sin comillas ni explicaciones.\n\n` +
      `Subtítulo: "${text}"`
    );
  }

  function cleanOutput(text) {
    return text.trim().replace(/^["']|["']$/g, "");
  }

  async function translateFree(text) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
      encodeURIComponent(STATE.targetLang) +
      "&dt=t&q=" +
      encodeURIComponent(text);

    const res = await fetch(url);
    const data = await res.json();
    return data[0].map((chunk) => chunk[0]).join("");
  }

  async function translateWithGemini(text) {
    if (!STATE.geminiApiKey) {
      STATE.lastApiError = "Falta la API key.";
      return "";
    }

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": STATE.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(text) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn("[Udemy Translate] Error de Gemini:", res.status, errBody);
      STATE.lastApiError = `HTTP ${res.status}: ${errBody.slice(0, 150)}`;
      return "";
    }

    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!out) {
      const finishReason = data?.candidates?.[0]?.finishReason || "desconocida";
      console.warn("[Udemy Translate] Gemini respondió vacío. Razón:", finishReason, data);
      STATE.lastApiError = `Respuesta vacía (razón: ${finishReason})`;
      return "";
    }

    STATE.lastApiError = "";
    return cleanOutput(out);
  }

  async function translateWithGroq(text) {
    if (!STATE.groqApiKey) {
      STATE.lastApiError = "Falta la API key.";
      return "";
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + STATE.groqApiKey,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: buildPrompt(text) }],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn("[Udemy Translate] Error de Groq:", res.status, errBody);
      STATE.lastApiError = `HTTP ${res.status}: ${errBody.slice(0, 150)}`;
      return "";
    }

    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content || "";

    if (!out) {
      console.warn("[Udemy Translate] Groq respondió vacío.", data);
      STATE.lastApiError = "Respuesta vacía";
      return "";
    }

    STATE.lastApiError = "";
    return cleanOutput(out);
  }

  const AI_TRANSLATORS = {
    gemini: translateWithGemini,
    groq: translateWithGroq,
  };

  async function translate(text) {
    if (!text) return "";
    const cacheKey = STATE.provider + "|" + STATE.targetLang + "|" + text;
    if (STATE.cache.has(cacheKey)) {
      const cached = STATE.cache.get(cacheKey);
      STATE.lastGoodTranslation = cached;
      return cached;
    }

    const isAiProvider = STATE.provider === "gemini" || STATE.provider === "groq";

    if (isAiProvider) {
      const minInterval = MIN_INTERVAL_MS[STATE.provider] || 4000;
      const elapsed = Date.now() - STATE.lastApiCallAt;
      if (elapsed < minInterval) {
        // Demasiado pronto para otra llamada (evita el error 429 de rate
        // limit). En vez de mostrar el inglés, nos quedamos con la última
        // traducción buena mientras esperamos el próximo turno.
        return STATE.lastGoodTranslation;
      }
      STATE.lastApiCallAt = Date.now();
    }

    let translated = "";
    try {
      translated = isAiProvider
        ? await AI_TRANSLATORS[STATE.provider](text)
        : await translateFree(text);
    } catch (err) {
      console.warn("[Udemy Translate] fallo al traducir:", err);
      if (isAiProvider) {
        STATE.lastApiError = "Error de red/permisos: " + (err?.message || err);
      }
      return STATE.lastGoodTranslation;
    }

    if (translated) {
      STATE.cache.set(cacheKey, translated);
      STATE.lastGoodTranslation = translated;
      return translated;
    }

    // La API respondió pero sin traducción utilizable (error 429/403/404,
    // etc. — ya se guardó el detalle en STATE.lastApiError). Nos quedamos
    // con la última traducción buena en vez de mostrar inglés.
    return STATE.lastGoodTranslation;
  }

  async function tick() {
    if (!STATE.enabled) return;

    const captionNode = findCaptionNode();
    const overlay = ensureOverlay();
    if (!overlay) return;

    applyPosition(overlay);
    updateErrorBadge();

    const text = captionNode ? captionNode.textContent.trim() : "";

    if (!text) {
      STATE.lastOriginalText = "";
      if (STATE.history.length === 0) overlay.style.display = "none";
      return;
    }

    if (text === STATE.lastOriginalText) return; // sin cambios, no re-traducir
    STATE.lastOriginalText = text;

    const translated = await translate(text);
    const displayText = translated || text;

    const last = STATE.history[STATE.history.length - 1];
    if (last !== displayText) {
      STATE.history.push(displayText);
      if (STATE.history.length > STATE.maxHistory) STATE.history.shift();
    }

    renderHistory(overlay);
    overlay.style.display = "block";
    updateErrorBadge();
  }

  function loadSettings(cb) {
    chrome.storage.sync.get(
      {
        enabled: true,
        targetLang: "es",
        positionPercent: 50,
        positionPercentX: 50,
        fontSize: 20,
        maxHistory: 20,
        historyHeight: 200,
        provider: "free",
        geminiApiKey: "",
        groqApiKey: "",
        courseContext: "",
      },
      (items) => {
        STATE.enabled = items.enabled;
        STATE.targetLang = items.targetLang;
        STATE.positionPercent = items.positionPercent;
        STATE.positionPercentX = items.positionPercentX;
        STATE.fontSize = items.fontSize;
        STATE.maxHistory = items.maxHistory;
        STATE.historyHeight = items.historyHeight;
        STATE.provider = items.provider;
        STATE.geminiApiKey = items.geminiApiKey;
        STATE.groqApiKey = items.groqApiKey;
        STATE.courseContext = items.courseContext;
        cb && cb();
      }
    );
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) STATE.enabled = changes.enabled.newValue;
    if (changes.positionPercent) STATE.positionPercent = changes.positionPercent.newValue;
    if (changes.positionPercentX) STATE.positionPercentX = changes.positionPercentX.newValue;
    if (changes.fontSize) STATE.fontSize = changes.fontSize.newValue;
    if (changes.maxHistory) {
      STATE.maxHistory = changes.maxHistory.newValue;
      while (STATE.history.length > STATE.maxHistory) STATE.history.shift();
    }
    if (changes.historyHeight) STATE.historyHeight = changes.historyHeight.newValue;
    if (changes.provider) {
      STATE.provider = changes.provider.newValue;
      STATE.lastOriginalText = "";
      STATE.lastGoodTranslation = "";
      STATE.lastApiError = "";
      STATE.history = [];
    }
    if (changes.geminiApiKey) STATE.geminiApiKey = changes.geminiApiKey.newValue;
    if (changes.groqApiKey) STATE.groqApiKey = changes.groqApiKey.newValue;
    if (changes.courseContext) {
      STATE.courseContext = changes.courseContext.newValue;
      STATE.cache.clear();
      STATE.lastOriginalText = "";
      STATE.lastGoodTranslation = "";
      STATE.history = [];
    }
    if (changes.targetLang) {
      STATE.targetLang = changes.targetLang.newValue;
      STATE.cache.clear();
      STATE.lastOriginalText = "";
      STATE.lastGoodTranslation = "";
      STATE.history = [];
    }
    if (!STATE.enabled) {
      const overlay = document.getElementById("udemy-translate-overlay");
      if (overlay) overlay.style.display = "none";
    }
  });

  loadSettings(() => {
    // Revisa el subtítulo varias veces por segundo. Esto es suficiente:
    // los subtítulos de Udemy cambian cada 3-4s como mínimo, así que 400ms
    // de polling los detecta con margen de sobra. (Deliberadamente NO
    // usamos MutationObserver: causaba un bucle infinito porque la propia
    // extensión escribe texto en su overlay/badge, lo que re-disparaba el
    // observer sobre sí mismo.)
    setInterval(tick, 400);
  });
})();
