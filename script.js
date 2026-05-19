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
  const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);

  root.style.setProperty("--scroll-y", `${scrollY}px`);
  root.style.setProperty("--scroll-progress", Math.min(1, scrollY / maxScroll).toFixed(4));

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
  if (!items.length || !pattern) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    items.forEach((it) => it.classList.add("is-active", "is-expanded"));
    return;
  }

  section.style.setProperty("--aboutfold-steps", items.length);

  // Parametric vertical bar pattern. Seed-driven so it's stable per render.
  const palette = [
    "#161822", "#1F2236", "#2F3754", "#5B7AB0", "#6A6E86",
    "#9B8B95", "#C4B6B4", "#E2D6CF", "#F0EBE9",
    "#FF612C", "#FFB077", "#D17E5F", "#7A5246"
  ];
  const stripeCount = Math.max(60, Math.min(180, Math.round(window.innerWidth / 9)));
  const bars = [];
  // Deterministic pseudo-random with mulberry32.
  let seed = 0x9e3779b9;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pattern.replaceChildren();
  for (let i = 0; i < stripeCount; i++) {
    const width = 2 + rand() * 10; // 2-12 px
    const colorIdx = Math.floor(rand() * palette.length);
    const baseAlpha = 0.32 + rand() * 0.55;
    const baseHeight = 0.55 + rand() * 0.45;
    const phase = rand();
    const hueShift = rand() * 6 - 3;
    const bar = document.createElement("span");
    bar.className = "aboutfold__bar";
    bar.style.width = width.toFixed(2) + "px";
    bar.style.backgroundColor = palette[colorIdx];
    bar.style.opacity = baseAlpha.toFixed(3);
    bar.style.transform = `scaleY(${baseHeight.toFixed(3)})`;
    pattern.appendChild(bar);
    bars.push({
      el: bar,
      colorIdx,
      baseAlpha,
      baseHeight,
      phase,
      hueShift
    });
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
      item.style.setProperty("--item-progress", itemProg.toFixed(3));
      item.classList.toggle("is-expanded", itemProg > 0.05);
      item.classList.toggle("is-active", itemProg > 0.05 && itemProg < 0.98);
    });

    // Parametric stripes: hue rotation + opacity wave + vertical scale wave.
    const t = progress;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const wave = Math.sin((b.phase + t) * Math.PI * 2);
      const wave2 = Math.cos((b.phase * 1.6 + t * 1.8) * Math.PI * 2);
      const op = Math.max(0.08, Math.min(1, b.baseAlpha + wave * 0.22));
      const sy = Math.max(0.2, Math.min(1, b.baseHeight + wave2 * 0.18));
      // Cycle through palette as progress advances.
      const idxShift = Math.floor(t * 8 + b.phase * 4);
      const colorIdx = (b.colorIdx + idxShift) % palette.length;
      b.el.style.opacity = op.toFixed(3);
      b.el.style.transform = `scaleY(${sy.toFixed(3)})`;
      b.el.style.backgroundColor = palette[colorIdx];
    }
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
  window.addEventListener("resize", schedule, { passive: true });
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
