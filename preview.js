/* =========================================================================
   DESIGN — INTERACTIVE PREVIEW
   Color pickers + overlay opacity sliders wired to CSS custom properties,
   JSON export/import of the full set, the animated audience switcher, and
   the bottom edit dock (hover an element, click to edit it in place).
   Every control edits the same global tokens, so changes stay consistent
   across the whole system.
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
    { cssVar: "--text-accent", name: "Tekst akcentowy" },
    { cssVar: "--text-caps", name: "Kapitaliki" },
    { cssVar: "--accent-founders", name: "Akcent — Founders" },
    { cssVar: "--accent-companies", name: "Akcent — Companies" },
    { cssVar: "--accent-investors", name: "Akcent — Investors" },
  ];

  const OVERLAYS = [
    { cssVar: "--ov-sun", name: "Poświata słońca — intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--ov-wash", name: "Wash fotografii — intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--ov-trail", name: "Linia trasy — intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--anim-speed", name: "Oddychanie — prędkość", min: 25, max: 400, unit: "" },
    { cssVar: "--anim-depth", name: "Oddychanie — głębokość pulsu", min: 0, max: 150, unit: "" },
  ];

  const OVERLAY_BY_VAR = {};
  OVERLAYS.forEach((overlay) => (OVERLAY_BY_VAR[overlay.cssVar] = overlay));

  const TOKEN_NAMES = {};
  TOKENS.forEach((t) => (TOKEN_NAMES[t.cssVar] = t.name));
  const OVERLAY_NAMES = {
    "--ov-sun": "Słońce — intensywność",
    "--ov-wash": "Wash — intensywność",
    "--ov-trail": "Trasa — intensywność",
    "--anim-speed": "Oddychanie — prędkość",
    "--anim-depth": "Oddychanie — głębokość",
  };

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

  /* Accepts ratio numbers, percent numbers, and "63%" strings → ratio or null.
     maxRatio widens the accepted range for settings like animation speed. */
  function normalizeAlpha(value, maxRatio = 1) {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).trim();
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;
    const scaled = str.includes("%") || num > maxRatio ? num / 100 : num;
    return Math.max(0, Math.min(maxRatio, scaled));
  }

  function readTokenValue(cssVar) {
    const raw = getComputedStyle(rootEl).getPropertyValue(cssVar);
    return normalizeHex(raw);
  }

  function readAlphaValue(cssVar) {
    const entry = OVERLAY_BY_VAR[cssVar] || { min: 0, max: 100 };
    const raw = getComputedStyle(rootEl).getPropertyValue(cssVar);
    const parsed = normalizeAlpha(raw, entry.max / 100);
    const ratio = parsed === null ? 1 : parsed;
    return Math.max(entry.min / 100, Math.min(entry.max / 100, ratio));
  }

  function setOverlayValue(cssVar, ratio) {
    const entry = OVERLAY_BY_VAR[cssVar];
    if (!entry) return;
    const clamped = Math.max(entry.min / 100, Math.min(entry.max / 100, ratio));
    const pct = Math.round(clamped * 100);
    rootEl.style.setProperty(cssVar, entry.unit === "%" ? pct + "%" : String(pct / 100));
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

  /* ---------- SVG asset recoloring ----------
     The mountain / climbers / footer silhouettes are <img src="*.svg"> with
     a baked-in fill of #161822 — the Navy token. CSS can't reach into an
     <img>, so on a Navy change we fetch the SVG once, swap the fill for the
     current value and point the images at a recolored blob URL. */

  const SVG_BASE_COLOR = "#161822";
  const SVG_ASSET_URLS = ["gora-bez-tla-2000px.svg", "climbers.svg", "footer.svg"];
  const svgAssets = new Map(); /* url -> { text, imgs, blobUrl } */
  let svgAppliedColor = SVG_BASE_COLOR;
  let svgRecolorRaf = 0;

  function initSvgRecolor() {
    if (typeof window.fetch !== "function") return;
    const imgs = Array.from(document.querySelectorAll("img"));
    SVG_ASSET_URLS.forEach((url) => {
      const matched = imgs.filter((img) => (img.getAttribute("src") || "") === url);
      if (!matched.length) return;
      fetch(url)
        .then((response) => (response.ok ? response.text() : Promise.reject()))
        .then((text) => {
          svgAssets.set(url, { text, imgs: matched, blobUrl: null });
          svgAppliedColor = null; /* force a re-apply for the new asset */
          scheduleSvgRecolor(); /* a saved set may already override Navy */
        })
        .catch(() => {
          /* offline / file:// — silhouettes simply keep their baked color */
        });
    });
  }

  function applySvgRecolor() {
    const navy = readTokenValue("--navy") || SVG_BASE_COLOR;
    if (navy === svgAppliedColor) return;
    svgAppliedColor = navy;

    svgAssets.forEach((asset, url) => {
      const oldBlobUrl = asset.blobUrl;
      if (navy === SVG_BASE_COLOR && !oldBlobUrl) return; /* already original */

      if (navy === SVG_BASE_COLOR) {
        /* back to the original file (e.g. after reset) */
        asset.imgs.forEach((img) => {
          img.src = url;
        });
        asset.blobUrl = null;
      } else {
        const recolored = asset.text.replace(/#161822/gi, navy);
        const blobUrl = URL.createObjectURL(new Blob([recolored], { type: "image/svg+xml" }));
        asset.imgs.forEach((img) => {
          img.src = blobUrl;
        });
        asset.blobUrl = blobUrl;
      }

      if (oldBlobUrl) window.setTimeout(() => URL.revokeObjectURL(oldBlobUrl), 2000);
    });
  }

  function scheduleSvgRecolor() {
    if (svgRecolorRaf) return;
    svgRecolorRaf = window.requestAnimationFrame(() => {
      svgRecolorRaf = 0;
      applySvgRecolor();
    });
  }

  initSvgRecolor();

  /* ---------- control binding (palette swatches, overlay cards, dock) ----------
     Any element with [data-token] + <input type=color> or [data-alpha] +
     <input type=range> becomes a live control for the shared tokens. */

  const boundControls = new WeakSet();

  function syncControls() {
    document.querySelectorAll("[data-token]").forEach((card) => {
      const hex = readTokenValue(card.dataset.token);
      if (!hex) return;
      const input = card.querySelector('input[type="color"]');
      const hexLabel = card.querySelector("[data-hex]");
      if (input) input.value = hex;
      if (hexLabel) hexLabel.textContent = hex.toUpperCase();
    });

    document.querySelectorAll("[data-alpha]").forEach((card) => {
      const cssVar = card.dataset.alpha;
      const entry = OVERLAY_BY_VAR[cssVar] || { min: 0, max: 100 };
      const alpha = readAlphaValue(cssVar);
      const range = card.querySelector('input[type="range"]');
      const pctLabel = card.querySelector("[data-alpha-value]");
      const pct = Math.round(alpha * 100);
      if (range) {
        range.min = String(entry.min);
        range.max = String(entry.max);
        range.value = String(pct);
        const fill = ((pct - entry.min) / Math.max(1, entry.max - entry.min)) * 100;
        range.style.setProperty("--fill", fill.toFixed(1) + "%");
      }
      if (pctLabel) pctLabel.textContent = pct + "%";
    });

    /* silhouette SVGs follow the Navy token */
    scheduleSvgRecolor();
  }

  function bindColorControl(card) {
    const input = card.querySelector('input[type="color"]');
    if (!input || boundControls.has(input)) return;
    boundControls.add(input);
    const cssVar = card.dataset.token;

    input.addEventListener("input", () => {
      rootEl.style.setProperty(cssVar, input.value);
      syncControls(); /* the same token can live on several controls at once */
    });

    input.addEventListener("change", () => {
      persist();
      showToast("Kolor zapisany w podglądzie");
    });
  }

  function bindAlphaControl(card) {
    const range = card.querySelector('input[type="range"]');
    if (!range || boundControls.has(range)) return;
    boundControls.add(range);
    const cssVar = card.dataset.alpha;
    const entry = OVERLAY_BY_VAR[cssVar] || { min: 0, max: 100, unit: "%" };
    const pctLabel = card.querySelector("[data-alpha-value]");

    range.addEventListener("input", () => {
      const pct = Math.max(entry.min, Math.min(entry.max, parseInt(range.value, 10) || 0));
      rootEl.style.setProperty(cssVar, entry.unit === "%" ? pct + "%" : String(pct / 100));
      const fill = ((pct - entry.min) / Math.max(1, entry.max - entry.min)) * 100;
      range.style.setProperty("--fill", fill.toFixed(1) + "%");
      if (pctLabel) pctLabel.textContent = pct + "%";
      syncControls();
    });

    range.addEventListener("change", () => {
      persist();
      showToast("Ustawienie zapisane w podglądzie");
    });
  }

  function bindAllControls(scope) {
    (scope || document).querySelectorAll("[data-token]").forEach(bindColorControl);
    (scope || document).querySelectorAll("[data-alpha]").forEach(bindAlphaControl);
  }

  bindAllControls(document);

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
      const entry = OVERLAY_BY_VAR[cssVar];
      if (!entry) return;
      const alpha = normalizeAlpha(source[key], entry.max / 100);
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
        setOverlayValue(overlay.cssVar, overlayMap[overlay.cssVar]);
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
            showToast("Wczytano zestaw: zaktualizowano " + applied + " " + (applied === 1 ? "wartość" : "wartości"));
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

  /* ---------- edit dock: hover an element, click to edit it ---------- */

  function setupEditDock() {
    const dock = document.querySelector("[data-dp-dock]");
    if (!dock) return;

    const peek = dock.querySelector("[data-dock-peek]");
    const peekLabel = dock.querySelector("[data-dock-peek-label]");
    const panel = dock.querySelector("[data-dock-panel]");
    const titleEl = dock.querySelector("[data-dock-title]");
    const descEl = dock.querySelector("[data-dock-desc]");
    const controlsEl = dock.querySelector("[data-dock-controls]");
    const closeBtn = dock.querySelector("[data-dock-close]");
    if (!peek || !panel || !titleEl || !descEl || !controlsEl || !closeBtn) return;

    const color = (cssVar) => ({ type: "color", cssVar });
    const alpha = (cssVar) => ({ type: "alpha", cssVar });

    const EDITABLES = {
      hero: {
        label: "Scena hero",
        desc: "Niebo, słońce, wash, linia trasy i oddychanie światła. Te same tokeny działają w całym systemie.",
        controls: [color("--navy-deep"), color("--orange"), color("--orange-soft"), alpha("--ov-sun"), alpha("--ov-wash"), alpha("--ov-trail"), alpha("--anim-speed"), alpha("--anim-depth")],
      },
      "hero-typo": {
        label: "Typografia sceny",
        desc: "Światło tekstu i akcent eyebrow — wspólne dla całej strony.",
        controls: [color("--light"), color("--text-accent")],
      },
      stats: {
        label: "Statystyki hero",
        desc: "Liczby w świetle i kapitaliki etykiet — tokeny tekstu.",
        controls: [color("--light"), color("--text-caps")],
      },
      triptych: {
        label: "Trasy klientów — karty",
        desc: "Rozwijane karty segmentów: akcenty tras i światło szlaku łączników.",
        controls: [color("--accent-founders"), color("--accent-companies"), color("--accent-investors"), color("--glow")],
      },
      sections: {
        label: "Sekcje podglądu",
        desc: "Nocne tła sekcji i światło szlaku budują głębię strony.",
        controls: [color("--navy-deep"), color("--navy"), color("--glow")],
      },
      "type-urbanist": {
        label: "Urbanist — nagłówki",
        desc: "Głos nagłówków i liczb. Kolor światła wspólny dla całej strony.",
        controls: [color("--light")],
      },
      "type-outfit": {
        label: "Outfit — treść i etykiety",
        desc: "Głos treści oraz etykiet z wersalikami — tokeny tekstu.",
        controls: [color("--light"), color("--text-accent"), color("--text-caps")],
      },
      "d-trail": {
        label: "Linia trasy",
        desc: "Świetlisty szlak, punkty kontrolne i przerywane pomocnicze.",
        controls: [color("--glow"), alpha("--ov-trail")],
      },
      "d-sun": {
        label: "Słońce i poświata",
        desc: "Animowany blask za granią — kolory, intensywność i rytm oddychania.",
        controls: [color("--orange-soft"), color("--orange"), alpha("--ov-sun"), alpha("--anim-speed"), alpha("--anim-depth")],
      },
      "d-duotone": {
        label: "Góra jako scena",
        desc: "Duotonowy wash na fotografii: ciepły pomarańcz na granacie.",
        controls: [color("--orange"), color("--navy-deep"), alpha("--ov-wash")],
      },
      "d-surfaces": {
        label: "Plany głębi",
        desc: "Nocne tło, panele treści i światło typografii.",
        controls: [color("--navy-deep"), color("--navy"), color("--light")],
      },
      "d-buttons": {
        label: "Przyciski pill",
        desc: "Obrys w świetle, wypełnienie światłem po najechaniu.",
        controls: [color("--light"), color("--navy"), color("--orange")],
      },
      "d-numerals": {
        label: "Numeracja i eyebrow",
        desc: "Wyciszone numery i sygnały w kolorze tekstu akcentowego.",
        controls: [color("--text-accent"), color("--light")],
      },
      segments: {
        label: "Segmenty klientów",
        desc: "Akcenty tras Founders / Companies / Investors — z palety.",
        controls: [color("--accent-founders"), color("--accent-companies"), color("--accent-investors")],
      },
      footer: {
        label: "Stopka",
        desc: "Powierzchnia navy, tytuły w tekście akcentowym, treść w świetle.",
        controls: [color("--navy"), color("--text-accent"), color("--light")],
      },
    };

    let hoverKey = null;
    let hoverEl = null;
    let pinnedEl = null;
    let pinned = false;

    function clearHover() {
      if (hoverEl && hoverEl !== pinnedEl) hoverEl.classList.remove("dp-edit-hover");
      hoverEl = null;
      hoverKey = null;
    }

    function showPeek(key) {
      const entry = EDITABLES[key];
      if (!entry) return;
      peekLabel.textContent = entry.label;
      dock.hidden = false;
      peek.hidden = false;
      panel.hidden = true;
    }

    function hideDock() {
      dock.hidden = true;
      peek.hidden = true;
      panel.hidden = true;
    }

    function buildControls(entry) {
      controlsEl.replaceChildren();

      entry.controls.forEach((control) => {
        const wrap = document.createElement("div");

        if (control.type === "color") {
          wrap.className = "dp-dock__control";
          wrap.setAttribute("data-token", control.cssVar);
          const name = TOKEN_NAMES[control.cssVar] || control.cssVar;
          wrap.innerHTML =
            '<label class="dp-overlay__chip" style="--chip: var(' + control.cssVar + ')">' +
            '<input type="color" aria-label="Zmień kolor: ' + name + '" />' +
            "</label>" +
            '<div class="dp-dock__control-meta">' +
            '<span class="dp-dock__control-name">' + name + "</span>" +
            '<span class="dp-dock__control-hex" data-hex></span>' +
            "</div>";
        } else {
          wrap.className = "dp-dock__control dp-dock__control--alpha";
          wrap.setAttribute("data-alpha", control.cssVar);
          const name = OVERLAY_NAMES[control.cssVar] || control.cssVar;
          const entry = OVERLAY_BY_VAR[control.cssVar] || { min: 0, max: 100 };
          wrap.innerHTML =
            '<div class="dp-dock__control-meta">' +
            '<span class="dp-dock__control-name">' + name + "</span>" +
            '<span class="dp-dock__control-pct" data-alpha-value></span>' +
            "</div>" +
            '<input class="dp-overlay__range" type="range" min="' + entry.min + '" max="' + entry.max + '" step="1" aria-label="' + name + '" />';
        }

        controlsEl.appendChild(wrap);
      });

      bindAllControls(controlsEl);
      syncControls();
    }

    function pin(key, el) {
      const entry = EDITABLES[key];
      if (!entry) return;

      if (pinnedEl) pinnedEl.classList.remove("dp-edit-pinned");
      pinned = true;
      pinnedEl = el;
      pinnedEl.classList.add("dp-edit-pinned");
      document.body.classList.add("dp-dock-pinned");

      titleEl.textContent = entry.label;
      descEl.textContent = entry.desc;
      buildControls(entry);

      dock.hidden = false;
      peek.hidden = true;
      panel.hidden = false;
    }

    function unpin() {
      pinned = false;
      if (pinnedEl) {
        pinnedEl.classList.remove("dp-edit-pinned");
        pinnedEl = null;
      }
      document.body.classList.remove("dp-dock-pinned");
      hideDock();
      clearHover();
    }

    document.addEventListener("mouseover", (event) => {
      if (event.target.closest("[data-dp-dock]")) return; /* keep state over the dock */

      const el = event.target.closest("[data-edit]");
      if (!el) {
        if (!pinned) hideDock();
        clearHover();
        return;
      }

      const key = el.dataset.edit;
      if (el === hoverEl) return;

      clearHover();
      hoverKey = key;
      hoverEl = el;
      if (el !== pinnedEl) el.classList.add("dp-edit-hover");
      if (!pinned) showPeek(key);
    });

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-dp-dock]")) return;

      if (event.target.closest("[data-edit-ignore]")) return;

      const el = event.target.closest("[data-edit]");
      if (!el) {
        /* clicks on the toolbar or other editors shouldn't close the dock */
        if (pinned && !event.target.closest(".top-nav, .dp-swatch, .dp-overlay, .dp-transfer")) unpin();
        return;
      }

      /* sample links inside editable regions shouldn't navigate away */
      const link = event.target.closest("a");
      if (link) event.preventDefault();

      el.classList.remove("dp-edit-hover");
      pin(el.dataset.edit, el);
    });

    peek.addEventListener("click", () => {
      if (hoverKey && hoverEl) pin(hoverKey, hoverEl);
    });

    closeBtn.addEventListener("click", unpin);

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && pinned) unpin();
    });
  }

  setupEditDock();

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
