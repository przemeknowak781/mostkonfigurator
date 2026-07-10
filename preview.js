/* =========================================================================
   DESIGN 2.0 — INTERACTIVE PREVIEW
   Color pickers wired to CSS custom properties, JSON export/import of the
   color set, and the animated Founders / Companies / Investors switcher.
   ========================================================================= */

(function () {
  "use strict";

  const rootEl = document.documentElement;
  const STORAGE_KEY = "most-design-preview-colors-v1";
  const EXPORT_FILENAME = "most-design-2.0-kolory.json";

  const TOKENS = [
    { cssVar: "--navy-deep", name: "Deep Navy" },
    { cssVar: "--navy", name: "Navy" },
    { cssVar: "--light", name: "Light" },
    { cssVar: "--orange", name: "Orange" },
    { cssVar: "--orange-soft", name: "Orange Soft" },
    { cssVar: "--glow", name: "Trail Glow" },
    { cssVar: "--purple-dark", name: "Purple Dark" },
    { cssVar: "--purple-light", name: "Purple Light" },
    { cssVar: "--accent-founders", name: "Akcent — Founders" },
    { cssVar: "--accent-companies", name: "Akcent — Companies" },
    { cssVar: "--accent-investors", name: "Akcent — Investors" },
  ];

  /* ---------- color helpers ---------- */

  function normalizeHex(value) {
    if (!value) return null;
    let v = String(value).trim().toLowerCase();

    const rgbMatch = v.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/);
    if (rgbMatch) {
      return (
        "#" +
        [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
          .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0"))
          .join("")
      );
    }

    if (v[0] !== "#") v = "#" + v;
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    return null;
  }

  function readTokenValue(cssVar) {
    const raw = getComputedStyle(rootEl).getPropertyValue(cssVar);
    return normalizeHex(raw);
  }

  /* ---------- state ---------- */

  const DEFAULTS = {};
  TOKENS.forEach((token) => {
    DEFAULTS[token.cssVar] = readTokenValue(token.cssVar) || "#000000";
  });

  function currentColors() {
    const out = {};
    TOKENS.forEach((token) => {
      out[token.cssVar] = readTokenValue(token.cssVar) || DEFAULTS[token.cssVar];
    });
    return out;
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentColors()));
    } catch (err) {
      /* private mode etc. — live preview still works */
    }
  }

  function readPersisted() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /* ---------- swatch UI ---------- */

  const swatches = Array.from(document.querySelectorAll(".dp-swatch[data-token]"));

  function syncSwatchUI() {
    swatches.forEach((swatch) => {
      const cssVar = swatch.dataset.token;
      const hex = readTokenValue(cssVar);
      if (!hex) return;
      const input = swatch.querySelector('input[type="color"]');
      const hexLabel = swatch.querySelector("[data-hex]");
      if (input) input.value = hex;
      if (hexLabel) hexLabel.textContent = hex.toUpperCase();
    });
  }

  function setToken(cssVar, hex, { save = true } = {}) {
    const normalized = normalizeHex(hex);
    if (!normalized) return false;
    rootEl.style.setProperty(cssVar, normalized);
    if (save) persist();
    return true;
  }

  swatches.forEach((swatch) => {
    const cssVar = swatch.dataset.token;
    const input = swatch.querySelector('input[type="color"]');
    const hexLabel = swatch.querySelector("[data-hex]");
    if (!input) return;

    input.addEventListener("input", () => {
      rootEl.style.setProperty(cssVar, input.value);
      if (hexLabel) hexLabel.textContent = input.value.toUpperCase();
    });

    input.addEventListener("change", () => {
      persist();
      showToast("Kolor zapisany w podglądzie");
    });
  });

  /* ---------- toast ---------- */

  const toastEl = document.querySelector("[data-dp-toast]");
  let toastTimer = 0;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("is-visible"), 2600);
  }

  /* ---------- download / upload / reset ---------- */

  function downloadColorSet() {
    const colors = currentColors();
    const names = {};
    TOKENS.forEach((token) => {
      names[token.cssVar] = token.name;
    });

    const payload = {
      project: "MOST Partners — Design 2.0",
      format: "most-color-set@1",
      exportedAt: new Date().toISOString(),
      colors,
      names,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = EXPORT_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast("Pobrano zestaw kolorów — odeślijcie nam plik JSON");
  }

  function extractColorMap(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    const source = parsed.colors && typeof parsed.colors === "object" ? parsed.colors : parsed;
    const map = {};
    Object.keys(source).forEach((key) => {
      const entry = source[key];
      const value = typeof entry === "string" ? entry : entry && entry.value;
      const cssVar = key.startsWith("--") ? key : "--" + key;
      const hex = normalizeHex(value);
      if (hex) map[cssVar] = hex;
    });
    return map;
  }

  function applyColorMap(map, { save = true } = {}) {
    if (!map) return 0;
    let applied = 0;
    TOKENS.forEach((token) => {
      if (map[token.cssVar] && setToken(token.cssVar, map[token.cssVar], { save: false })) {
        applied += 1;
      }
    });
    if (applied && save) persist();
    if (applied) syncSwatchUI();
    return applied;
  }

  function resetColors() {
    TOKENS.forEach((token) => rootEl.style.removeProperty(token.cssVar));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* noop */
    }
    syncSwatchUI();
    showToast("Przywrócono oryginalne kolory Design 2.0");
  }

  const fileInput = document.querySelector("[data-dp-file]");

  function requestUpload() {
    if (fileInput) fileInput.click();
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const applied = applyColorMap(extractColorMap(parsed));
          if (applied) {
            showToast("Wczytano zestaw: zaktualizowano " + applied + " " + (applied === 1 ? "kolor" : applied < 5 ? "kolory" : "kolorów"));
          } else {
            showToast("Ten plik nie zawiera rozpoznawalnych kolorów");
          }
        } catch (err) {
          showToast("Nie udało się odczytać pliku — to nie jest poprawny JSON");
        }
      };
      reader.readAsText(file);
    });
  }

  document.querySelectorAll("[data-dp-download]").forEach((btn) => btn.addEventListener("click", downloadColorSet));
  document.querySelectorAll("[data-dp-upload]").forEach((btn) => btn.addEventListener("click", requestUpload));
  document.querySelectorAll("[data-dp-reset]").forEach((btn) => btn.addEventListener("click", resetColors));

  /* ---------- boot colors: saved set wins over defaults ---------- */

  const saved = readPersisted();
  if (saved) applyColorMap(saved, { save: false });
  syncSwatchUI();

  /* ---------- animated audience tabs ---------- */

  function setupAudienceTabs() {
    const section = document.querySelector("[data-dp-aud]");
    if (!section) return;

    const tabs = Array.from(section.querySelectorAll("[data-aud-tab]"));
    const panels = Array.from(section.querySelectorAll("[data-aud-panel]"));
    const stage = section.querySelector(".dp-aud__stage");
    const ghost = section.querySelector("[data-aud-ghost]");
    if (!tabs.length || !panels.length || !stage) return;

    const INTERVAL_MS = 6000;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stage.parentElement.style.setProperty("--dp-aud-interval", INTERVAL_MS + "ms");

    const order = tabs.map((tab) => tab.dataset.audTab);
    let activeKey = order[0];
    let timer = 0;
    let inView = false;
    let manual = false;

    function drawRoutes(panel) {
      panel.querySelectorAll(".dp-draw").forEach((path) => {
        const length = path.getTotalLength();
        path.style.transition = "none";
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length);
        /* force reflow so the transition restarts from the hidden state */
        void path.getBoundingClientRect();
        path.style.transition = "";
        path.style.strokeDashoffset = "0";
      });
    }

    function restartProgress(tab) {
      const bar = tab.querySelector(".dp-aud__tab-progress");
      if (!bar) return;
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = "";
    }

    function activate(key, { fromUser = false } = {}) {
      if (!order.includes(key)) return;
      activeKey = key;

      tabs.forEach((tab) => {
        const isActive = tab.dataset.audTab === key;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
        if (isActive && !manual) restartProgress(tab);
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.audPanel === key;
        panel.classList.toggle("is-active", isActive);
        if (isActive) {
          panel.hidden = false;
          if (!reducedMotion) drawRoutes(panel);
        } else {
          /* keep in DOM for the crossfade, hide from a11y tree */
          panel.hidden = false;
          panel.setAttribute("aria-hidden", "true");
        }
        if (isActive) panel.removeAttribute("aria-hidden");
      });

      stage.dataset.active = key;
      if (ghost) ghost.textContent = key.charAt(0).toUpperCase() + key.slice(1);

      if (fromUser) {
        manual = true;
        section.classList.add("is-manual");
        stopAuto();
      }
    }

    function nextKey() {
      const idx = order.indexOf(activeKey);
      return order[(idx + 1) % order.length];
    }

    function startAuto() {
      if (manual || reducedMotion || timer || !inView) return;
      /* re-arm the progress bar on the active tab so it matches the timer */
      const activeTab = tabs.find((tab) => tab.dataset.audTab === activeKey);
      if (activeTab) restartProgress(activeTab);
      timer = window.setInterval(() => activate(nextKey()), INTERVAL_MS);
    }

    function stopAuto() {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activate(tab.dataset.audTab, { fromUser: true }));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const idx = order.indexOf(tab.dataset.audTab);
        const targetIdx = event.key === "ArrowRight" ? (idx + 1) % order.length : (idx - 1 + order.length) % order.length;
        const target = tabs[targetIdx];
        target.focus();
        activate(target.dataset.audTab, { fromUser: true });
      });
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            inView = entry.isIntersecting;
            if (inView) {
              if (!reducedMotion) drawRoutes(panels.find((p) => p.dataset.audPanel === activeKey) || panels[0]);
              startAuto();
            } else {
              stopAuto();
            }
          });
        },
        { threshold: 0.35 }
      );
      observer.observe(section);
    } else {
      inView = true;
      startAuto();
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAuto();
      } else {
        startAuto();
      }
    });

    activate(activeKey);
  }

  setupAudienceTabs();
})();
