const root = document.documentElement;

// All coords use the GORA SVG viewBox (2000 x 850). Trail SVG is positioned/sized
// to match the gora image rect at runtime, so trail path, dots, leaders, and climbers
// all live in the same coordinate space and stay aligned across viewport changes.
const TRAIL = {
  viewBox: { width: 2000, height: 850 },
  pathOffsetY: -120,
  start: { x: 0, y: 642, slope: -0.03 },
  end: { x: 2000, y: 264, slope: -0.16 },
  curve: [
    { x: 144, y: 638, slope: -0.02 },
    { x: 268, y: 631, slope: -0.08 },
    { x: 400, y: 623, slope: -0.04, checkpoint: { main: "20+", sub: "legal experts" } },
    { x: 574, y: 604, slope: -0.22 },
    { x: 712, y: 574, slope: -0.34 },
    { x: 850, y: 548, slope: -0.12, checkpoint: { main: "100+", sub: "clients served annually" } },
    { x: 956, y: 512, slope: -0.30 },
    { x: 1053, y: 501, slope: 0.02 },
    { x: 1124, y: 481, slope: -0.16 },
    { x: 1210, y: 438, slope: -0.48 },
    { x: 1280, y: 397, slope: -0.30, checkpoint: { main: "15+", sub: "years of experience" } },
    { x: 1392, y: 374, slope: -0.04 },
    { x: 1526, y: 361, slope: -0.16 },
    { x: 1633, y: 326, slope: -0.42 },
    { x: 1700, y: 302, slope: -0.22, checkpoint: { main: "Global", sub: "international reach" } },
    { x: 1858, y: 278, slope: -0.08 },
  ],
  heroLeaderEndY: 868,
  climbers: {
    x: 1278,
    y: 210,
    width: 220,
    viewBox: { width: 1024, height: 864 },
    anchor: { x: 132, y: 864 },
    sunOffset: { x: 210, y: 40 },
  },
};

function buildTrailPath(trail) {
  const anchors = [
    trail.start,
    ...trail.curve,
    trail.end,
  ].map((point) => getTrailPoint(point));
  let d = `M${anchors[0].x} ${anchors[0].y}`;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    const dx = b.x - a.x;
    const t = dx / 3;
    const cp1x = a.x + t;
    const cp1y = a.y + a.slope * t;
    const cp2x = b.x - t;
    const cp2y = b.y - b.slope * t;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${b.x} ${b.y}`;
  }
  return d;
}

function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

let trailDots = [];
let trailLabels = [];
let trailOverlayRaf = 0;
let trailOverlaySettleTimer = 0;

function getTrailPoint(point) {
  return {
    ...point,
    y: point.y + TRAIL.pathOffsetY,
  };
}

function scheduleTrailOverlay(settle = false) {
  if (!trailOverlayRaf) {
    trailOverlayRaf = window.requestAnimationFrame(() => {
      trailOverlayRaf = 0;
      positionTrailOverlay();
      if (settle) window.requestAnimationFrame(positionTrailOverlay);
    });
  }

  if (settle) {
    window.clearTimeout(trailOverlaySettleTimer);
    trailOverlaySettleTimer = window.setTimeout(positionTrailOverlay, 140);
  }
}

function setupHeroTrail() {
  const pathEls = document.querySelectorAll(".hero-trail__path");
  const trailSvg = document.querySelector(".hero-trail");
  const heroLeaders = document.querySelector(".hero-trail__leaders");
  const ridgeLeaders = document.querySelector(".ridge-edge__leaders");
  const pointsHost = document.querySelector(".hero-trail-points");
  const labelsHost = document.querySelector(".hero-trail-labels");
  if (!pathEls.length || !trailSvg || !heroLeaders || !ridgeLeaders || !pointsHost || !labelsHost) return;

  const trailPath = buildTrailPath(TRAIL);
  pathEls.forEach((pathEl) => pathEl.setAttribute("d", trailPath));

  const checkpoints = TRAIL.curve.filter((p) => p.checkpoint);

  const SVG_NS = "http://www.w3.org/2000/svg";
  clearChildren(heroLeaders);
  clearChildren(ridgeLeaders);
  clearChildren(pointsHost);
  clearChildren(labelsHost);

  trailDots = [];
  trailLabels = [];

  if ("ResizeObserver" in window && !setupHeroTrail._observer) {
    setupHeroTrail._observer = new ResizeObserver(() => scheduleTrailOverlay(true));
    setupHeroTrail._observer.observe(trailSvg);
    if (labelsHost) setupHeroTrail._observer.observe(labelsHost);
    const ridgesImg = document.querySelector(".hero-ridges__img");
    const ridges = document.querySelector(".hero-ridges");
    if (ridges) setupHeroTrail._observer.observe(ridges);
    if (ridgesImg) {
      setupHeroTrail._observer.observe(ridgesImg);
      ridgesImg.addEventListener("load", () => scheduleTrailOverlay(true));
      if (ridgesImg.complete) scheduleTrailOverlay(true);
    }
  }

  checkpoints.forEach((cp, i) => {
    const trailCp = getTrailPoint(cp);
    const heroLine = document.createElementNS(SVG_NS, "line");
    heroLine.setAttribute("class", "hero-trail__leader");
    heroLine.setAttribute("x1", String(trailCp.x));
    heroLine.setAttribute("y1", String(trailCp.y));
    heroLine.setAttribute("x2", String(trailCp.x));
    heroLine.setAttribute("y2", String(TRAIL.heroLeaderEndY));
    heroLeaders.appendChild(heroLine);

    const dot = document.createElement("span");
    dot.className = "hero-trail-point";
    dot.style.animationDelay = `${-i * 0.8}s`;
    pointsHost.appendChild(dot);
    trailDots.push({ el: dot, cp: trailCp });

    const label = document.createElement("div");
    label.className = "hero-trail-label";
    if (i === checkpoints.length - 1) label.classList.add("hero-trail-label--last");
    const strong = document.createElement("strong");
    strong.textContent = cp.checkpoint.main;
    const sub = document.createElement("span");
    sub.textContent = cp.checkpoint.sub;
    label.append(strong, sub);
    labelsHost.appendChild(label);
    trailLabels.push({ el: label, cp });
  });

  positionTrailOverlay();
}

function syncTrailContainersToRidge() {
  const ridgesImg = document.querySelector(".hero-ridges__img");
  const trailSvg = document.querySelector(".hero-trail");
  const pointsHost = document.querySelector(".hero-trail-points");
  if (!ridgesImg || !trailSvg) return;

  const heroRect = trailSvg.parentElement.getBoundingClientRect();
  const imgRect = ridgesImg.getBoundingClientRect();
  if (imgRect.width === 0 || imgRect.height === 0) return;

  const left = imgRect.left - heroRect.left;
  const top = imgRect.top - heroRect.top;

  for (const el of [trailSvg, pointsHost]) {
    if (!el) continue;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.width = `${imgRect.width}px`;
    el.style.height = `${imgRect.height}px`;
  }
}

function positionTrailOverlay() {
  syncTrailContainersToRidge();

  const trailSvg = document.querySelector(".hero-trail");
  const pointsHost = document.querySelector(".hero-trail-points");
  const labelsHost = document.querySelector(".hero-trail-labels");
  if (!trailSvg || !pointsHost || !labelsHost) return;

  const ctm = trailSvg.getScreenCTM();
  if (!ctm) return;
  const pointsRect = pointsHost.getBoundingClientRect();
  const labelsRect = labelsHost.getBoundingClientRect();
  const pt = trailSvg.createSVGPoint();

  trailDots.forEach(({ el, cp }) => {
    pt.x = cp.x;
    pt.y = cp.y;
    const screen = pt.matrixTransform(ctm);
    el.style.left = `${screen.x - pointsRect.left}px`;
    el.style.top = `${screen.y - pointsRect.top}px`;
  });

  trailLabels.forEach(({ el, cp }) => {
    pt.x = cp.x;
    pt.y = cp.y;
    const screen = pt.matrixTransform(ctm);
    el.style.left = `${screen.x - labelsRect.left}px`;
  });

  const climbers = document.querySelector(".hero-climbers");
  const climbersSun = document.querySelector(".hero-climbers-sun");
  if (TRAIL.climbers) {
    const ridgesImg = document.querySelector(".hero-ridges__img");
    if (!ridgesImg) return;

    const imgRect = ridgesImg.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;

    const climberViewBox = TRAIL.climbers.viewBox;
    const climberScale = ((TRAIL.climbers.width / TRAIL.viewBox.width) * imgRect.width) / climberViewBox.width;
    const widthPx = climberViewBox.width * climberScale;
    const anchor = TRAIL.climbers.anchor;
    const screen = {
      x: imgRect.left + (TRAIL.climbers.x / TRAIL.viewBox.width) * imgRect.width,
      y: imgRect.top + (TRAIL.climbers.y / TRAIL.viewBox.height) * imgRect.height,
    };

    if (climbers) {
      const climbersHostRect = climbers.parentElement.getBoundingClientRect();
      climbers.style.width = `${widthPx}px`;
      climbers.style.left = `${screen.x - climbersHostRect.left - anchor.x * climberScale}px`;
      climbers.style.top = `${screen.y - climbersHostRect.top - anchor.y * climberScale}px`;
    }

    if (climbersSun) {
      const sunScreen = {
        x: imgRect.left + ((TRAIL.climbers.x + TRAIL.climbers.sunOffset.x) / TRAIL.viewBox.width) * imgRect.width,
        y: imgRect.top + ((TRAIL.climbers.y + TRAIL.climbers.sunOffset.y) / TRAIL.viewBox.height) * imgRect.height,
      };
      const sunHostRect = climbersSun.parentElement.getBoundingClientRect();
      climbersSun.style.width = `${widthPx * 5.6}px`;
      climbersSun.style.left = `${sunScreen.x - sunHostRect.left}px`;
      climbersSun.style.top = `${sunScreen.y - sunHostRect.top}px`;
    }
  }
}

const topNav = document.querySelector(".top-nav");
const heroEl = document.querySelector(".hero");
const ridgeEdgeEl = document.querySelector(".ridge-edge");

function updateScroll() {
  const scrollY = window.scrollY || 0;
  const scrollHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  const maxScroll = Math.max(1, scrollHeight - window.innerHeight);
  const scrollProgress = Math.min(1, scrollY / maxScroll);

  root.style.setProperty("--scroll-y", `${scrollY}px`);
  root.style.setProperty("--scroll-progress", scrollProgress.toFixed(4));
  root.style.setProperty("--scroll-progress-percent", `${(scrollProgress * 100).toFixed(2)}%`);

  if (heroEl) {
    const heroHeight = heroEl.offsetHeight || window.innerHeight;
    const heroProgress = Math.min(1, Math.max(0, scrollY / heroHeight));
    root.style.setProperty("--hero-progress", heroProgress.toFixed(4));
  }

  if (ridgeEdgeEl) {
    const rect = ridgeEdgeEl.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const total = rect.height + vh;
    const offset = vh - rect.top;
    const ridgeProgress = Math.min(1, Math.max(0, offset / total));
    root.style.setProperty("--ridge-progress", ridgeProgress.toFixed(4));
  }

  if (topNav) topNav.classList.toggle("is-scrolled", scrollY > 12);
}

function setupSectionReveal() {
  const targets = document.querySelectorAll(".basecamp, .route-stage");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.18 }
  );

  targets.forEach((el) => observer.observe(el));
}

function setupRouteMap() {
  const root = document.querySelector(".route-map");
  if (!root) return;

  const items = Array.from(root.querySelectorAll(".route-map__item"));
  const nodes = Array.from(root.querySelectorAll(".route-map__node"));
  const activeNum = root.querySelector("[data-active-num]");
  const activeLabel = root.querySelector("[data-active-label]");
  const detailDesc = root.querySelector("[data-detail-desc]");
  const detailList = root.querySelector("[data-detail-list]");

  function activate(target) {
    items.forEach((item) => {
      const isActive = item.dataset.target === target;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
      if (isActive) {
        if (activeNum) activeNum.textContent = item.querySelector(".route-map__item-num").textContent;
        if (activeLabel) activeLabel.textContent = item.querySelector(".route-map__item-name").textContent;
        if (detailDesc && item.dataset.desc) {
          detailDesc.textContent = item.dataset.desc;
        }
        if (detailList && item.dataset.list) {
          while (detailList.firstChild) detailList.removeChild(detailList.firstChild);
          item.dataset.list.split("|").forEach((entry) => {
            const li = document.createElement("li");
            li.textContent = entry.trim();
            detailList.appendChild(li);
          });
        }
      }
    });
    nodes.forEach((node) => {
      node.classList.toggle("is-active", node.dataset.node === target);
    });
  }

  items.forEach((item) => {
    item.addEventListener("click", () => activate(item.dataset.target));
    item.addEventListener("focus", () => activate(item.dataset.target));
  });

  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      const target = node.dataset.node;
      activate(target);
      const matchingItem = items.find((i) => i.dataset.target === target);
      if (matchingItem) matchingItem.focus();
    });
  });

  // Auto-cycle while section is in view (subtle scroll-driven progression)
  if ("IntersectionObserver" in window) {
    let cycleIndex = 0;
    let cycleTimer = 0;
    const cycleObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !cycleTimer) {
            cycleTimer = window.setInterval(() => {
              cycleIndex = (cycleIndex + 1) % items.length;
              activate(items[cycleIndex].dataset.target);
            }, 3200);
          } else if (!entry.isIntersecting && cycleTimer) {
            window.clearInterval(cycleTimer);
            cycleTimer = 0;
          }
        });
      },
      { threshold: 0.5 }
    );
    cycleObserver.observe(root);
  }
}


function setupTransitionMarker() {
  const marker = document.querySelector(".transition-marker");
  if (!marker) return;
  const active = marker.querySelector(".transition-marker__active");
  const head = marker.querySelector(".transition-marker__head");
  if (!active || !head) return;

  function update() {
    const rect = marker.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const progress = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
    const x = Math.round(progress * 1200);
    active.setAttribute("x2", String(x));
    head.setAttribute("cx", String(x));
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
}

function setupMobileMenu() {
  const menu = document.querySelector(".mobile-menu");
  const openButton = document.querySelector(".icon-button");
  const closeButton = document.querySelector(".close-button");
  const links = document.querySelectorAll(".mobile-menu a");

  if (!menu || !openButton || !closeButton) return;

  function setOpen(isOpen) {
    menu.hidden = !isOpen;
    document.body.classList.toggle("menu-open", isOpen);
    openButton.setAttribute("aria-expanded", String(isOpen));
  }

  openButton.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));
  links.forEach((link) => link.addEventListener("click", () => setOpen(false)));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

let ticking = false;

window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;

    window.requestAnimationFrame(() => {
      updateScroll();
      scheduleTrailOverlay();
      ticking = false;
    });
    ticking = true;
  },
  { passive: true }
);

let resizeRaf = 0;
window.addEventListener("resize", () => {
  if (resizeRaf) return;
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = 0;
    updateScroll();
    scheduleTrailOverlay(true);
  });
}, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => scheduleTrailOverlay(true), { passive: true });
}

window.addEventListener("orientationchange", () => scheduleTrailOverlay(true), { passive: true });

if (document.fonts) {
  document.fonts.ready.then(() => scheduleTrailOverlay(true));
}

function setupAboutfold() {
  const section = document.querySelector(".aboutfold");
  if (!section) return;
  const items = Array.from(section.querySelectorAll(".aboutfold__item"));
  const pattern = section.querySelector("[data-aboutfold-pattern]");
  const rail = section.querySelector(".aboutfold__rail");
  if (!items.length || !pattern || !rail) return;

  section.style.setProperty("--aboutfold-steps", items.length);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stripeStops = [
    { at: 0, color: "#b9c1cd" },
    { at: 0.055, color: "#7d89a4" },
    { at: 0.14, color: "#56617f" },
    { at: 0.24, color: "#555263" },
    { at: 0.33, color: "#493f48" },
    { at: 0.41, color: "#865241" },
    { at: 0.49, color: "#c65f38" },
    { at: 0.56, color: "#e4532b" },
    { at: 0.64, color: "#de5e36" },
    { at: 0.71, color: "#b9877d" },
    { at: 0.79, color: "#857a7d" },
    { at: 0.88, color: "#b4b8be" },
    { at: 1, color: "#e4e7e7" },
  ];

  let bars = [];
  let routeProgressPath = null;
  let routeLength = 0;
  let railDots = [];
  let railProgressPath = null;
  let railLength = 0;
  let lastStepProgress = 0;
  let patternWidth = 0;
  let seed = 0x4d4f5354;
  const SVG_NS = "http://www.w3.org/2000/svg";

  function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ];
  }

  function mixChannel(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function mixColor(a, b, t) {
    return [
      mixChannel(a[0], b[0], t),
      mixChannel(a[1], b[1], t),
      mixChannel(a[2], b[2], t),
    ];
  }

  function shadeColor(rgb, amount) {
    const target = amount >= 0 ? 255 : 0;
    const strength = Math.abs(amount);
    return rgb.map((channel) => Math.round(channel + (target - channel) * strength));
  }

  function colorAt(position) {
    const x = clamp(position, 0, 1);
    for (let i = 1; i < stripeStops.length; i++) {
      const prev = stripeStops[i - 1];
      const next = stripeStops[i];
      if (x <= next.at) {
        const t = (x - prev.at) / (next.at - prev.at);
        return mixColor(prev.rgb, next.rgb, clamp(t, 0, 1));
      }
    }
    return stripeStops[stripeStops.length - 1].rgb;
  }

  function rgbToCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  stripeStops.forEach((stop) => {
    stop.rgb = hexToRgb(stop.color);
  });

  function buildOrnamentRoutePath() {
    const source = [
      TRAIL.start,
      ...TRAIL.curve,
      TRAIL.end,
    ].map((point) => getTrailPoint(point));
    const minY = Math.min(...source.map((point) => point.y));
    const maxY = Math.max(...source.map((point) => point.y));
    const yTop = 18;
    const ySpan = 48;
    const yScale = ySpan / Math.max(1, maxY - minY);
    const anchors = source.map((point) => ({
      ...point,
      y: yTop + (point.y - minY) * yScale,
      slope: point.slope * yScale,
    }));

    let d = `M${anchors[0].x} ${anchors[0].y.toFixed(1)}`;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const dx = b.x - a.x;
      const t = dx / 3;
      const cp1x = a.x + t;
      const cp1y = a.y + a.slope * t;
      const cp2x = b.x - t;
      const cp2y = b.y - b.slope * t;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${b.x} ${b.y.toFixed(1)}`;
    }
    return d;
  }

  function createSvgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  function buildScrollTrail() {
    const trailD = "M112 24 C 86 56, 62 78, 66 124 C 69 160, 104 190, 118 230 C 132 270, 91 296, 72 334 C 54 370, 75 397, 104 430 C 134 464, 129 500, 101 532 C 74 564, 66 602, 96 634 C 128 668, 141 702, 142 736";
    const svg = createSvgEl("svg", {
      class: "aboutfold__trail-svg",
      viewBox: "0 0 180 760",
      preserveAspectRatio: "xMidYMid meet",
      "aria-hidden": "true",
    });
    const base = createSvgEl("path", {
      class: "aboutfold__trail-path aboutfold__trail-path--base",
      d: trailD,
    });
    railProgressPath = createSvgEl("path", {
      class: "aboutfold__trail-path aboutfold__trail-path--active",
      d: trailD,
    });

    rail.replaceChildren();
    svg.append(base, railProgressPath);
    rail.appendChild(svg);

    railLength = railProgressPath.getTotalLength();
    railProgressPath.style.strokeDasharray = railLength.toFixed(2);
    railProgressPath.style.strokeDashoffset = railLength.toFixed(2);

    railDots = items.map((_, idx) => {
      const ratio = items.length === 1 ? 0 : idx / (items.length - 1);
      const point = railProgressPath.getPointAtLength(railLength * ratio);
      const dot = createSvgEl("circle", {
        class: "aboutfold__trail-dot",
        cx: point.x.toFixed(1),
        cy: point.y.toFixed(1),
        r: "11",
      });
      svg.appendChild(dot);
      return dot;
    });

    updateRailState(lastStepProgress);
  }

  function buildRouteOverlay(routeD) {
    const svg = createSvgEl("svg", {
      class: "aboutfold__pattern-route",
      viewBox: "0 0 2000 100",
      preserveAspectRatio: "none",
      "aria-hidden": "true",
    });
    const cut = createSvgEl("path", {
      class: "aboutfold__pattern-cut",
      d: `${routeD} L 2000 0 L 0 0 Z`,
    });
    const base = createSvgEl("path", {
      class: "aboutfold__pattern-path aboutfold__pattern-path--base",
      d: routeD,
    });
    routeProgressPath = createSvgEl("path", {
      class: "aboutfold__pattern-path aboutfold__pattern-path--active",
      d: routeD,
    });

    svg.append(cut, base, routeProgressPath);
    pattern.appendChild(svg);

    routeLength = routeProgressPath.getTotalLength();
    routeProgressPath.style.strokeDasharray = routeLength.toFixed(2);
    routeProgressPath.style.strokeDashoffset = routeLength.toFixed(2);

  }

  function buildPattern(force = false) {
    const nextWidth = Math.ceil(pattern.getBoundingClientRect().width || window.innerWidth);
    if (!force && bars.length && Math.abs(nextWidth - patternWidth) < 16) return;

    patternWidth = Math.max(320, nextWidth);
    seed = 0x4d4f5354;
    bars = [];
    pattern.replaceChildren();

    let x = 0;
    while (x < patternWidth * 1.025) {
      const xNorm = clamp(x / patternWidth, 0, 1);
      const isHairline = rand() > 0.76;
      const isLightStreak = rand() > 0.89;
      const width = isHairline
        ? 0.8 + rand() * 1.8
        : 2.2 + Math.pow(rand(), 1.45) * 8.2;
      const sample = clamp(xNorm + (rand() - 0.5) * 0.034, 0, 1);
      const shade = isLightStreak ? 0.2 + rand() * 0.28 : (rand() - 0.5) * 0.3;
      const baseAlpha = isLightStreak ? 0.72 + rand() * 0.2 : 0.58 + rand() * 0.34;
      const baseColor = shadeColor(colorAt(sample), shade);
      const bar = document.createElement("span");

      bar.className = "aboutfold__bar";
      bar.style.width = `${width.toFixed(2)}px`;
      bar.style.backgroundColor = rgbToCss(baseColor);
      bar.style.opacity = baseAlpha.toFixed(3);
      pattern.appendChild(bar);

      bars.push({
        el: bar,
        xNorm,
        sample,
        shade,
        baseAlpha,
        phase: rand(),
      });

      x += width;
    }

    buildRouteOverlay(buildOrnamentRoutePath());
    updateRouteState(lastStepProgress);
  }

  function updatePattern(progress) {
    const t = reducedMotion ? 0 : progress;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const shimmer = Math.sin((b.phase + t * 1.65) * Math.PI * 2);
      const sweep = Math.cos((b.xNorm * 9.5 - t * 3.2) * Math.PI * 2);
      const pulse = Math.sin((b.xNorm * 18 + b.phase * 2.4 + t * 4.1) * Math.PI * 2);
      const sample = clamp(b.sample + shimmer * 0.012 + sweep * 0.018, 0, 1);
      const color = shadeColor(colorAt(sample), b.shade + shimmer * 0.075 + sweep * 0.065 + pulse * 0.035);
      const opacity = clamp(b.baseAlpha + shimmer * 0.055 + sweep * 0.04 + pulse * 0.03, 0.42, 1);

      b.el.style.backgroundColor = rgbToCss(color);
      b.el.style.opacity = opacity.toFixed(3);
      b.el.style.transform = `scaleX(${(1 + sweep * 0.1 + pulse * 0.045).toFixed(3)})`;
    }
  }

  function updateRouteState(stepProgress) {
    lastStepProgress = stepProgress;
    if (!routeProgressPath || !routeLength) return;

    const routeProgress = clamp(stepProgress / Math.max(1, items.length - 1), 0, 1);
    routeProgressPath.style.strokeDashoffset = (routeLength * (1 - routeProgress)).toFixed(2);
  }

  function updateRailState(stepProgress) {
    lastStepProgress = stepProgress;
    if (!railProgressPath || !railLength || !railDots.length) return;

    const railProgress = clamp(stepProgress / Math.max(1, items.length - 1), 0, 1);
    railProgressPath.style.strokeDashoffset = (railLength * (1 - railProgress)).toFixed(2);

    railDots.forEach((dot, idx) => {
      const isVisible = stepProgress >= idx - 0.05;
      const isActive = idx === Math.min(items.length - 1, Math.max(0, Math.floor(stepProgress + 0.2)));
      dot.classList.toggle("is-visible", isVisible);
      dot.classList.toggle("is-active", isActive);
    });
  }

  buildScrollTrail();
  buildPattern(true);

  if (reducedMotion) {
    items.forEach((it) => it.classList.add("is-active", "is-expanded"));
    updatePattern(0);
    updateRouteState(items.length - 1);
    updateRailState(items.length - 1);
    return;
  }

  function update() {
    const rect = section.getBoundingClientRect();
    const scrollable = section.offsetHeight - window.innerHeight;
    let progress = 0;
    if (scrollable > 0) {
      progress = Math.max(0, Math.min(1, -rect.top / scrollable));
    }
    section.style.setProperty("--aboutfold-progress", progress.toFixed(4));

    // Step progression: (items.length) reveals stretched across most of progress, last 8% reserved for outro.
    const stepProgress = Math.max(0, Math.min(items.length, progress * (items.length + 0.6)));
    section.style.setProperty("--aboutfold-step", Math.min(items.length - 1, Math.floor(stepProgress)));

    items.forEach((item, idx) => {
      const itemProg = Math.max(0, Math.min(1, stepProgress - idx));
      const isLast = idx === items.length - 1;
      const isActive = isLast ? stepProgress >= idx - 0.3 : (stepProgress >= idx - 0.3 && stepProgress < idx + 0.7);
      
      item.style.setProperty("--item-progress", itemProg.toFixed(3));
      item.classList.toggle("is-expanded", isActive);
      item.classList.toggle("is-active", isActive);
    });

    updatePattern(progress);
    updateRouteState(stepProgress);
    updateRailState(stepProgress);
  }

  let raf = 0;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", () => {
    buildPattern();
    schedule();
  }, { passive: true });
  update();
}

updateScroll();
setupSectionReveal();
setupRouteMap();
setupTransitionMarker();
setupMobileMenu();
setupHeroTrail();
setupAboutfold();
window.addEventListener("load", () => scheduleTrailOverlay(true));
