/* =========================================================================
   DESIGN — INTERACTIVE PREVIEW
   Color pickers + overlay opacity sliders wired to CSS custom properties,
   JSON export/import of the full set, and the animated audience switcher.
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

  const OVERLAYS = [
    { cssVar: "--ov-sun", name: "Poświata słońca — intensywność" },
    { cssVar: "--ov-wash", name: "Wash fotografii — intensywność" },
    { cssVar: "--ov-trail", name: "Linia trasy — intensywność" },
  ];

  /* ---------- value helpers ---------- */

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

  /* Accepts 0–1 numbers, 0–100 numbers, and "63%" strings → 0–1 or null. */
  function normalizeAlpha(value) {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).trim();
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;
    const scaled = str.includes("%") || num > 1 ? num / 100 : num;
    return Math.max(0, Math.min(1, scaled));
  }

  function readTokenValue(cssVar) {
    const raw = getComputedStyle(rootEl).getPropertyValue(cssVar);
    return normalizeHex(raw);
  }

  function readAlphaValue(cssVar) {
    const raw = getComputedStyle(rootEl).getPropertyValue(cssVar);
    const parsed = normalizeAlpha(raw);
    return parsed === null ? 1 : parsed;
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

  function currentOverlays() {
    const out = {};
    OVERLAYS.forEach((overlay) => {
      out[overlay.cssVar] = readAlphaValue(overlay.cssVar);
    });
    return out;
  }

  function persist() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ colors: currentColors(), overlays: currentOverlays() })
      );
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

  /* ---------- color + alpha UI (palette swatches AND overlay cards) ---------- */

  const colorCards = Array.from(document.querySelectorAll("[data-token]"));
  const alphaCards = Array.from(document.querySelectorAll("[data-alpha]"));

  function syncControls() {
    colorCards.forEach((card) => {
      const hex = readTokenValue(card.dataset.token);
      if (!hex) return;
      const input = card.querySelector('input[type="color"]');
      const hexLabel = card.querySelector("[data-hex]");
      if (input) input.value = hex;
      if (hexLabel) hexLabel.textContent = hex.toUpperCase();
    });

    alphaCards.forEach((card) => {
      const alpha = readAlphaValue(card.dataset.alpha);
      const range = card.querySelector('input[type="range"]');
      const pctLabel = card.querySelector("[data-alpha-value]");
      const pct = Math.round(alpha * 100);
      if (range) {
        range.value = String(pct);
        range.style.setProperty("--fill", pct + "%");
      }
      if (pctLabel) pctLabel.textContent = pct + "%";
    });
  }

  colorCards.forEach((card) => {
    const cssVar = card.dataset.token;
    const input = card.querySelector('input[type="color"]');
    if (!input) return;

    input.addEventListener("input", () => {
      rootEl.style.setProperty(cssVar, input.value);
      syncControls(); /* the same token can live on a palette swatch AND an overlay card */
    });

    input.addEventListener("change", () => {
      persist();
      showToast("Kolor zapisany w podglądzie");
    });
  });

  alphaCards.forEach((card) => {
    const cssVar = card.dataset.alpha;
    const range = card.querySelector('input[type="range"]');
    const pctLabel = card.querySelector("[data-alpha-value]");
    if (!range) return;

    range.addEventListener("input", () => {
      const pct = Math.max(0, Math.min(100, parseInt(range.value, 10) || 0));
      rootEl.style.setProperty(cssVar, pct + "%");
      range.style.setProperty("--fill", pct + "%");
      if (pctLabel) pctLabel.textContent = pct + "%";
    });

    range.addEventListener("change", () => {
      persist();
      showToast("Przezroczystość zapisana w podglądzie");
    });
  });

  /* ---------- download / upload / reset ---------- */

  function downloadColorSet() {
    const names = {};
    TOKENS.forEach((token) => {
      names[token.cssVar] = token.name;
    });
    OVERLAYS.forEach((overlay) => {
      names[overlay.cssVar] = overlay.name;
    });

    const payload = {
      project: "MOST Partners — Design Preview",
      format: "most-color-set@2",
      exportedAt: new Date().toISOString(),
      colors: currentColors(),
      overlays: currentOverlays(),
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

  function extractOverlayMap(parsed) {
    if (!parsed || typeof parsed !== "object") return null;
    const source = parsed.overlays && typeof parsed.overlays === "object" ? parsed.overlays : parsed;
    const map = {};
    Object.keys(source).forEach((key) => {
      const cssVar = key.startsWith("--") ? key : "--" + key;
      const alpha = normalizeAlpha(source[key]);
      if (alpha !== null) map[cssVar] = alpha;
    });
    return map;
  }

  function applySet(parsed, { save = true } = {}) {
    const colorMap = extractColorMap(parsed) || {};
    const overlayMap = extractOverlayMap(parsed) || {};
    let applied = 0;

    TOKENS.forEach((token) => {
      if (colorMap[token.cssVar]) {
        rootEl.style.setProperty(token.cssVar, colorMap[token.cssVar]);
        applied += 1;
      }
    });
    OVERLAYS.forEach((overlay) => {
      if (overlay.cssVar in overlayMap) {
        rootEl.style.setProperty(overlay.cssVar, Math.round(overlayMap[overlay.cssVar] * 100) + "%");
        applied += 1;
      }
    });

    if (applied) {
      syncControls();
      if (save) persist();
    }
    return applied;
  }

  function resetAll() {
    TOKENS.forEach((token) => rootEl.style.removeProperty(token.cssVar));
    OVERLAYS.forEach((overlay) => rootEl.style.removeProperty(overlay.cssVar));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* noop */
    }
    syncControls();
    showToast("Przywrócono oryginalne kolory i overlaye");
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
          const applied = applySet(parsed);
          if (applied) {
            showToast("Wczytano zestaw: zaktualizowano " + applied + " " + (applied === 1 ? "wartość" : applied < 5 ? "wartości" : "wartości"));
          } else {
            showToast("Ten plik nie zawiera rozpoznawalnych wartości");
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
  document.querySelectorAll("[data-dp-reset]").forEach((btn) => btn.addEventListener("click", resetAll));

  /* ---------- boot: saved set wins over defaults ---------- */

  const saved = readPersisted();
  if (saved) applySet(saved, { save: false });
  syncControls();

  /* ---------- animated audience tabs ---------- */

  function setupAudienceTabs() {
    const section = document.querySelector("[data-dp-aud]");
    if (!section) return;

    const tabs = Array.from(section.querySelectorAll("[data-aud-tab]"));
    const panels = Array.from(section.querySelectorAll("[data-aud-panel]"));
    const stage = section.querySelector(".dp-aud__stage");
    if (!tabs.length || !panels.length || !stage) return;

    const INTERVAL_MS = 6000;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    section.style.setProperty("--dp-aud-interval", INTERVAL_MS + "ms");

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
        panel.hidden = false;
        if (isActive) {
          panel.removeAttribute("aria-hidden");
          if (!reducedMotion) drawRoutes(panel);
        } else {
          /* keep in DOM for the crossfade, hide from the a11y tree */
          panel.setAttribute("aria-hidden", "true");
        }
      });

      stage.dataset.active = key;

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
