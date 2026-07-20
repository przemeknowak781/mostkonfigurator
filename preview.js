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
    { cssVar: "--hero-sky", name: "Hero — niebo" },
    { cssVar: "--hero-ridge", name: "Hero — granat gór" },
    { cssVar: "--hero-sun", name: "Hero — słońce" },
    { cssVar: "--hero-halo", name: "Hero — łuna" },
    { cssVar: "--hero-trail", name: "Hero — linia trasy" },
  ];

  const OVERLAYS = [
    { cssVar: "--ov-sun", name: "Poświata słońca — intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--ov-wash", name: "Wash fotografii — intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--ov-trail", name: "Linia trasy — intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--ov-photo", name: "Przezroczystość grafiki", min: 0, max: 100, unit: "%" },
    { cssVar: "--hero-ov-sun", name: "Hero — słońce intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--hero-ov-wash", name: "Hero — wash intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--hero-ov-trail", name: "Hero — trasa intensywność", min: 0, max: 100, unit: "%" },
    { cssVar: "--img-hue", name: "Grafiki — obrót barwy", min: 0, max: 360, unit: "deg" },
    { cssVar: "--img-sat", name: "Grafiki — nasycenie", min: 0, max: 200, unit: "%" },
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
    "--ov-photo": "Przezroczystość grafiki",
    "--hero-ov-sun": "Hero: słońce — intensywność",
    "--hero-ov-wash": "Hero: wash — intensywność",
    "--hero-ov-trail": "Hero: trasa — intensywność",
    "--img-hue": "Grafiki — obrót barwy",
    "--img-sat": "Grafiki — nasycenie",
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

  /* Accepts ratio numbers, percent numbers, and "63%" / "120deg" strings →
     ratio or null. maxRatio widens the accepted range for settings like
     animation speed; degree values map 100deg → ratio 1. */
  function normalizeAlpha(value, maxRatio = 1) {
    if (value === null || value === undefined || value === "") return null;
    const str = String(value).trim();
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;
    const scaled = str.includes("%") || str.includes("deg") || num > maxRatio ? num / 100 : num;
    return Math.max(0, Math.min(maxRatio, scaled));
  }

  /* One place decides how a slider's integer value is written to the CSS
     var ("62%", "140deg", or "1.4") and which suffix its label shows. */
  function overlayCssValue(entry, pct) {
    if (entry.unit === "%") return pct + "%";
    if (entry.unit === "deg") return pct + "deg";
    return String(pct / 100);
  }

  function overlaySuffix(entry) {
    return entry.unit === "deg" ? "°" : "%";
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
    rootEl.style.setProperty(cssVar, overlayCssValue(entry, pct));
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
        JSON.stringify({ colors: currentColors(), overlays: currentOverlays(), images: currentImages() })
      );
    } catch (err) {
      /* private mode / quota (large uploaded images) — live preview and
         the JSON export still work, only the auto-restore is skipped */
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
  /* Which token drives each silhouette: the hero scene's mountains and
     climbers follow the independent hero ridge token; the footer silhouette
     stays on the global Navy. */
  const SVG_ASSET_TOKENS = {
    "gora-bez-tla-2000px.svg": "--hero-ridge",
    "climbers.svg": "--hero-ridge",
    "footer.svg": "--navy",
  };
  const svgAssets = new Map(); /* url -> { text, imgs, blobUrl, appliedColor } */
  let svgRecolorRaf = 0;

  function initSvgRecolor() {
    if (typeof window.fetch !== "function") return;
    const imgs = Array.from(document.querySelectorAll("img"));
    Object.keys(SVG_ASSET_TOKENS).forEach((url) => {
      const matched = imgs.filter((img) => (img.getAttribute("src") || "") === url);
      if (!matched.length) return;
      fetch(url)
        .then((response) => (response.ok ? response.text() : Promise.reject()))
        .then((text) => {
          svgAssets.set(url, { text, imgs: matched, blobUrl: null, appliedColor: SVG_BASE_COLOR });
          scheduleSvgRecolor(); /* a saved set may already override the token */
        })
        .catch(() => {
          /* offline / file:// — silhouettes simply keep their baked color */
        });
    });
  }

  function applySvgRecolor() {
    svgAssets.forEach((asset, url) => {
      const color = readTokenValue(SVG_ASSET_TOKENS[url]) || SVG_BASE_COLOR;
      if (color === asset.appliedColor) return;
      asset.appliedColor = color;

      const oldBlobUrl = asset.blobUrl;
      if (color === SVG_BASE_COLOR) {
        /* back to the original file (e.g. after reset) */
        asset.imgs.forEach((img) => {
          img.src = url;
        });
        asset.blobUrl = null;
      } else {
        const recolored = asset.text.replace(/#161822/gi, color);
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

  /* ---------- custom image replacement ----------
     Uploaded images live as data URLs: applied live, persisted with the
     rest of the set (quota permitting) and included in the JSON export so
     the choice travels with the file. */

  const IMAGE_TARGETS = {
    "hero-bg": { label: "Tło hero — zdjęcie" },
    "ridge-photo": { label: "Zdjęcie pod hero" },
  };
  const heroBgImg = document.querySelector(".hero-bg");
  const HERO_BG_ORIGINAL = heroBgImg ? heroBgImg.getAttribute("src") : null;
  const customImages = {};

  function applyCustomImages() {
    if (heroBgImg) {
      const want = customImages["hero-bg"] || HERO_BG_ORIGINAL;
      if (heroBgImg.getAttribute("src") !== want) heroBgImg.src = want;
    }
    if (customImages["ridge-photo"]) {
      rootEl.style.setProperty("--ridge-photo", 'url("' + customImages["ridge-photo"] + '")');
    } else {
      rootEl.style.removeProperty("--ridge-photo");
    }
  }

  function setCustomImage(key, dataUrl) {
    if (!(key in IMAGE_TARGETS)) return;
    if (dataUrl) {
      customImages[key] = dataUrl;
    } else {
      delete customImages[key];
    }
    applyCustomImages();
  }

  function currentImages() {
    const out = {};
    Object.keys(customImages).forEach((key) => {
      out[key] = customImages[key];
    });
    return out;
  }

  /* ---------- control binding (palette swatches, overlay cards, dock) ----------
     Any element with [data-token] + <input type=color> or [data-alpha] +
     <input type=range> becomes a live control for the shared tokens. */

  const boundControls = new WeakSet();

  function syncControls() {
    /* The same token/overlay often backs several controls at once (palette
       swatch + dock copy). Read each unique CSS var once per sync instead of
       once per card — cheap on its own, but this runs on every drag tick of
       a color/range input (see scheduleSyncControls below), so redundant
       getComputedStyle + parsing per duplicate card adds up fast. */
    const tokenCache = new Map();
    document.querySelectorAll("[data-token]").forEach((card) => {
      const cssVar = card.dataset.token;
      if (!tokenCache.has(cssVar)) tokenCache.set(cssVar, readTokenValue(cssVar));
      const hex = tokenCache.get(cssVar);
      if (!hex) return;
      const input = card.querySelector('input[type="color"]');
      const hexLabel = card.querySelector("[data-hex]");
      if (input) input.value = hex;
      if (hexLabel) hexLabel.textContent = hex.toUpperCase();
    });

    const alphaCache = new Map();
    document.querySelectorAll("[data-alpha]").forEach((card) => {
      const cssVar = card.dataset.alpha;
      const entry = OVERLAY_BY_VAR[cssVar] || { min: 0, max: 100 };
      if (!alphaCache.has(cssVar)) alphaCache.set(cssVar, readAlphaValue(cssVar));
      const alpha = alphaCache.get(cssVar);
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
      if (pctLabel) pctLabel.textContent = pct + overlaySuffix(entry);
    });

    /* silhouette SVGs follow the Navy token */
    scheduleSvgRecolor();
  }

  /* Dragging a color wheel or range slider fires "input" many times per
     frame in some browsers. The token write below is immediate (so the
     scene repaints with zero latency), but resyncing every OTHER control
     showing the same token is just housekeeping — batching it to once per
     animation frame keeps a fast drag smooth instead of re-querying and
     re-reading every control on the page dozens of times a second. */
  let syncControlsRaf = 0;
  function scheduleSyncControls() {
    if (syncControlsRaf) return;
    syncControlsRaf = window.requestAnimationFrame(() => {
      syncControlsRaf = 0;
      syncControls();
    });
  }

  function bindColorControl(card) {
    const input = card.querySelector('input[type="color"]');
    if (!input || boundControls.has(input)) return;
    boundControls.add(input);
    const cssVar = card.dataset.token;

    input.addEventListener("input", () => {
      rootEl.style.setProperty(cssVar, input.value);
      scheduleSyncControls(); /* the same token can live on several controls at once */
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
      rootEl.style.setProperty(cssVar, overlayCssValue(entry, pct));
      const fill = ((pct - entry.min) / Math.max(1, entry.max - entry.min)) * 100;
      range.style.setProperty("--fill", fill.toFixed(1) + "%");
      if (pctLabel) pctLabel.textContent = pct + overlaySuffix(entry);
      scheduleSyncControls();
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
      images: currentImages(),
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

    const imageMap = parsed && typeof parsed === "object" && parsed.images && typeof parsed.images === "object" ? parsed.images : null;
    if (imageMap) {
      Object.keys(IMAGE_TARGETS).forEach((key) => {
        const value = imageMap[key];
        if (typeof value === "string" && value.startsWith("data:image/")) {
          setCustomImage(key, value);
          applied += 1;
        }
      });
    }

    if (applied) {
      syncControls();
      if (save) persist();
    }
    return applied;
  }

  function resetAll() {
    TOKENS.forEach((token) => rootEl.style.removeProperty(token.cssVar));
    OVERLAYS.forEach((overlay) => rootEl.style.removeProperty(overlay.cssVar));
    Object.keys(IMAGE_TARGETS).forEach((key) => setCustomImage(key, null));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* noop */
    }
    syncControls();
    showToast("Przywrócono oryginalne kolory, overlaye i grafiki");
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
    const image = (key) => ({ type: "image", key });

    /* Every entry's `controls` list was audited against the actual CSS/JS
       that paints its DOM region (including shared card chrome — the
       faint orange/light/glow card wash every .dp-swatch/.dp-type-card/
       .dp-decision shares — pseudo-elements, hover states, and the JS-driven
       Navy recolor of the mountain/climbers/footer SVG silhouettes) so the
       dock never hides a token that's actually rendered on screen. */
    const EDITABLES = {
      hero: {
        label: "Scena hero",
        desc: "Niezależne tokeny hero — niebo, granat gór, słońce, łuna i linia trasy osobno od globalnej palety. Plus tint grafik i podmiana zdjęć.",
        controls: [
          color("--hero-sky"), color("--hero-ridge"), color("--hero-sun"), color("--hero-halo"), color("--hero-trail"),
          alpha("--hero-ov-sun"), alpha("--hero-ov-wash"), alpha("--hero-ov-trail"), alpha("--ov-photo"),
          alpha("--img-hue"), alpha("--img-sat"), alpha("--anim-speed"), alpha("--anim-depth"),
          image("hero-bg"), image("ridge-photo"),
        ],
      },
      "hero-typo": {
        label: "Typografia sceny",
        desc: "Światło tekstu, akcent eyebrow i kolor tekstu na przycisku po najechaniu.",
        controls: [color("--light"), color("--text-accent"), color("--navy")],
      },
      stats: {
        label: "Statystyki hero",
        desc: "Liczby w świetle i kapitaliki etykiet — tokeny tekstu.",
        controls: [color("--light"), color("--text-caps")],
      },
      triptych: {
        label: "Trasy klientów — karty",
        desc: "Rozwijane karty segmentów, tło sceny i światło szlaku łączników.",
        controls: [
          color("--accent-founders"), color("--accent-companies"), color("--accent-investors"),
          color("--glow"), color("--orange"), color("--orange-soft"), color("--navy-deep"), color("--navy"),
          alpha("--ov-wash"), alpha("--ov-trail"),
        ],
      },
      sections: {
        label: "Sekcje podglądu",
        desc: "Nocne tła, tekst nagłówków i ambientowe słońce w tle intro.",
        controls: [
          color("--navy-deep"), color("--navy"), color("--light"), color("--text-accent"),
          color("--orange"), color("--orange-soft"), alpha("--ov-sun"), alpha("--anim-speed"), alpha("--anim-depth"),
        ],
      },
      "type-urbanist": {
        label: "Urbanist — nagłówki",
        desc: "Głos nagłówków i liczb, tło karty i litery-widmo w tle.",
        controls: [color("--light"), color("--text-accent"), color("--orange"), color("--glow")],
      },
      "type-outfit": {
        label: "Outfit — treść i etykiety",
        desc: "Głos treści oraz etykiet z wersalikami — tokeny tekstu i tło karty.",
        controls: [color("--light"), color("--text-accent"), color("--text-caps"), color("--orange"), color("--glow")],
      },
      "d-trail": {
        label: "Linia trasy",
        desc: "Świetlisty szlak, punkty kontrolne, przerywane pomocnicze i tło karty.",
        controls: [color("--glow"), color("--orange"), color("--light"), alpha("--ov-trail")],
      },
      "d-sun": {
        label: "Słońce i poświata",
        desc: "Animowany blask za granią, granat sylwetki gór, intensywność i rytm oddychania.",
        controls: [
          color("--orange-soft"), color("--orange"), color("--navy"), color("--hero-ridge"), color("--light"), color("--glow"),
          alpha("--ov-sun"), alpha("--anim-speed"), alpha("--anim-depth"),
        ],
      },
      "d-duotone": {
        label: "Góra jako scena",
        desc: "Duotonowy wash na fotografii: ciepły pomarańcz na granacie, tint barwy i nasycenia, plus podmiana zdjęcia.",
        controls: [
          color("--orange"), color("--navy-deep"), color("--light"), color("--glow"),
          alpha("--ov-wash"), alpha("--ov-photo"), alpha("--img-hue"), alpha("--img-sat"),
          image("ridge-photo"),
        ],
      },
      "d-surfaces": {
        label: "Plany głębi",
        desc: "Nocne tło, panele treści i światło typografii.",
        controls: [color("--navy-deep"), color("--navy"), color("--light"), color("--orange"), color("--glow")],
      },
      "d-buttons": {
        label: "Przyciski pill",
        desc: "Obrys w świetle, tekst po najechaniu, wypełnienie i tło karty.",
        controls: [color("--light"), color("--navy"), color("--orange"), color("--glow")],
      },
      "d-numerals": {
        label: "Numeracja i eyebrow",
        desc: "Wyciszone numery i sygnały w kolorze tekstu akcentowego, plus tło karty.",
        controls: [color("--text-accent"), color("--light"), color("--orange"), color("--glow")],
      },
      segments: {
        label: "Segmenty klientów",
        desc: "Akcenty tras Founders / Companies / Investors i tło paneli.",
        controls: [color("--accent-founders"), color("--accent-companies"), color("--accent-investors"), color("--light")],
      },
      footer: {
        label: "Stopka",
        desc: "Powierzchnia navy, granat sylwetki gór nad stopką, tytuły i treść.",
        controls: [color("--navy"), color("--navy-deep"), color("--text-accent"), color("--light"), color("--glow")],
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
        } else if (control.type === "image") {
          const target = IMAGE_TARGETS[control.key] || { label: control.key };
          wrap.className = "dp-dock__control dp-dock__control--image";
          wrap.innerHTML =
            '<div class="dp-dock__control-meta">' +
            '<span class="dp-dock__control-name">' + target.label + "</span>" +
            "</div>" +
            '<button type="button" class="dp-dock__upload">Wgraj własny obrazek</button>' +
            '<input type="file" accept="image/*" hidden />';
          const btn = wrap.querySelector(".dp-dock__upload");
          const fileEl = wrap.querySelector('input[type="file"]');
          btn.addEventListener("click", () => fileEl.click());
          fileEl.addEventListener("change", () => {
            const file = fileEl.files && fileEl.files[0];
            fileEl.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              setCustomImage(control.key, String(reader.result));
              persist();
              showToast("Podmieniono grafikę: " + target.label);
            };
            reader.readAsDataURL(file);
          });
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
