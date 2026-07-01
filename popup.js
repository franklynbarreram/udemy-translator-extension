const enabledBox = document.getElementById("enabled");
const langSelect = document.getElementById("lang");
const fontSizeInput = document.getElementById("fontSize");
const maxHistoryInput = document.getElementById("maxHistory");
const historyHeightInput = document.getElementById("historyHeight");
const providerSelect = document.getElementById("provider");
const apiKeyInput = document.getElementById("apiKey");
const apiKeyLabel = document.getElementById("apiKeyLabel");
const apiKeyHelp = document.getElementById("apiKeyHelp");
const contextInput = document.getElementById("context");
const aiFields = document.getElementById("aiFields");
const statusEl = document.getElementById("status");

const HELP_TEXT = {
  gemini:
    'Consíguela gratis en <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> (sin tarjeta).',
  groq:
    'Consíguela gratis en <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a> (sin tarjeta).',
};

const DEFAULTS = {
  enabled: true,
  targetLang: "es",
  fontSize: 20,
  maxHistory: 20,
  historyHeight: 200,
  provider: "free",
  geminiApiKey: "",
  groqApiKey: "",
  courseContext: "",
};

let loadedKeys = { geminiApiKey: "", groqApiKey: "" };

chrome.storage.sync.get(DEFAULTS, (items) => {
  enabledBox.checked = items.enabled;
  langSelect.value = items.targetLang;
  fontSizeInput.value = items.fontSize;
  maxHistoryInput.value = items.maxHistory;
  historyHeightInput.value = items.historyHeight;
  providerSelect.value = items.provider;

  contextInput.value = items.courseContext;
  loadedKeys.geminiApiKey = items.geminiApiKey;
  loadedKeys.groqApiKey = items.groqApiKey;
  updateProviderUI();
});

function keyFieldFor(provider) {
  return provider === "groq" ? "groqApiKey" : "geminiApiKey";
}

function updateProviderUI() {
  const provider = providerSelect.value;
  const isAiProvider = provider === "gemini" || provider === "groq";

  aiFields.classList.toggle("hidden", !isAiProvider);
  if (!isAiProvider) return;

  apiKeyLabel.textContent =
    "Tu API key de " + (provider === "groq" ? "Groq" : "Gemini") + ":";
  apiKeyHelp.innerHTML = HELP_TEXT[provider];
  apiKeyInput.value = loadedKeys[keyFieldFor(provider)] || "";
}

enabledBox.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledBox.checked });
});

langSelect.addEventListener("change", () => {
  chrome.storage.sync.set({ targetLang: langSelect.value });
});

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// Guardamos con un pequeño debounce para no escribir en storage en cada tecla
let saveTimer = null;
function debouncedSave(obj) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => chrome.storage.sync.set(obj), 400);
}

fontSizeInput.addEventListener("input", () => {
  const val = clamp(Number(fontSizeInput.value), 10, 60);
  debouncedSave({ fontSize: val });
});

maxHistoryInput.addEventListener("input", () => {
  const val = clamp(Number(maxHistoryInput.value), 1, 100);
  debouncedSave({ maxHistory: val });
});

historyHeightInput.addEventListener("input", () => {
  const val = clamp(Number(historyHeightInput.value), 40, 600);
  debouncedSave({ historyHeight: val });
});

providerSelect.addEventListener("change", () => {
  chrome.storage.sync.set({ provider: providerSelect.value });
  updateProviderUI();
  statusEl.textContent = "";
});

apiKeyInput.addEventListener("input", () => {
  const field = keyFieldFor(providerSelect.value);
  loadedKeys[field] = apiKeyInput.value.trim();
  debouncedSave({ [field]: apiKeyInput.value.trim() });
  statusEl.textContent = "";
});

contextInput.addEventListener("input", () => {
  debouncedSave({ courseContext: contextInput.value.trim() });
});
