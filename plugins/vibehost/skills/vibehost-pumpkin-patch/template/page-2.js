/* ---------------- light + animation ---------------- */
let light = 0, anim = null, dirty = true, room = 0, carvePending = false, textPending = false;
function flicker(t) {
  if (reduced.matches) return 1;
  const s = t / 1000;
  const n = 0.08 * Math.sin(s * 2.3) + 0.06 * Math.sin(s * 6.1 + 1.3) + 0.045 * Math.sin(s * 13.7 + 0.4) + 0.03 * Math.sin(s * 23.1 + 2.2);
  return 0.86 + n;
}
function setLight(target, opts = {}) {
  const now = performance.now();
  anim = { from: light, to: target, start: now + (opts.delay || 0), dur: reduced.matches ? 400 : (opts.dur || (target ? 1300 : 600)), sputter: target === 1 && !reduced.matches };
}
function frame(t) {
  if (anim) {
    const p = Math.min(1, Math.max(0, (t - anim.start) / anim.dur));
    let v = anim.from + (anim.to - anim.from) * (1 - Math.pow(1 - p, 3));
    if (anim.sputter && p < 0.75) v *= 0.55 + 0.45 * Math.abs(Math.sin(p * 26 + Math.sin(p * 61)));
    light = v; dirty = true;
    if (p >= 1) { light = anim.to; anim = null; }
  }
  if (textPending && P && G) { textPending = false; carvePending = false; buildCarveLayers(false, true); }
  if (carvePending && P && G) { carvePending = false; buildCarveLayers(true); }
  if (P && G && (dirty || (light > 0 && !reduced.matches))) { render(t); dirty = false; }
  requestAnimationFrame(frame);
}
// draws the pumpkin into x (the page canvas by default; the share cards render it lit into their own canvas)
function render(t, x = ctx, lv = light, rm = room, f = flicker(t)) {
  const sh = G.sh;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, P, P);
  toPumpkin(x);
  const bottom = sh.bottom - 2;
  // the floor shadow / glow ellipses must fade out INSIDE the canvas: cut off by its box they showed as a hard-edged
  // rectangle under the pumpkin. fit(r, sy): the largest radius <= r whose ellipse (vertical scale sy) stays inside.
  const fit = (r, sy) => Math.max(1, Math.min(r, (sh.cx + G.ox / G.k) * 0.97, ((256 - G.ox) / G.k - sh.cx) * 0.97, ((256 - G.oy) / G.k - bottom) * 0.97 / sy));
  if (lv < 1) {
    const r = fit(sh.rx * 1.05, 0.12);
    let g = x.createRadialGradient(sh.cx, bottom, 0, sh.cx, bottom, r);
    g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.save(); x.translate(0, bottom); x.scale(1, 0.12); x.translate(0, -bottom);
    x.fillStyle = g; x.fillRect(-40, bottom - r * 1.05, 340, r * 2.1); x.restore();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(L.body, 0, 0); x.drawImage(L.carve, 0, 0);
    if (rm > 0) { x.globalCompositeOperation = "source-atop"; x.fillStyle = `rgba(6,4,10,${0.62 * rm})`; x.fillRect(0, 0, P, P); x.globalCompositeOperation = "source-over"; }
  }
  if (lv > 0) {
    if (litStale) buildLitLayers();
    toPumpkin(x);
    const r = fit(sh.rx * 1.25, 0.16);
    const g = x.createRadialGradient(sh.cx, bottom, 0, sh.cx, bottom, r);
    g.addColorStop(0, `rgba(255,170,70,${0.42 * f * lv})`); g.addColorStop(0.5, `rgba(255,130,40,${0.12 * f * lv})`); g.addColorStop(1, "rgba(255,120,30,0)");
    x.save(); x.translate(0, bottom); x.scale(1, 0.16); x.translate(0, -bottom);
    x.fillStyle = g; x.fillRect(-40, bottom - r * 1.05, 340, r * 2.1); x.restore();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = lv;
    x.drawImage(L.bodyLit, 0, 0); x.drawImage(L.carveLit, 0, 0);
    x.globalCompositeOperation = "lighter";
    x.globalAlpha = Math.min(1, lv * (0.35 + 0.45 * f));
    x.drawImage(L.glow, 0, 0);
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
  }
  if (x === ctx) spill.style.opacity = (lv * (0.55 + 0.45 * f)).toFixed(3);
}
function resize() {
  const r = canvas.getBoundingClientRect();
  if (r.width < 2) return;
  // every carve layer is a P x P canvas (a dozen of them), so P is capped: 3x (lite: 2x) and 1440 px
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.lite ? 2 : 3);
  const np = Math.max(64, Math.min(1440, Math.round(r.width * dpr)));
  placeTbox();
  if (np === P) return;
  P = np; U = P / 256; canvas.width = P; canvas.height = P; rebuildAll();
}
new ResizeObserver(resize).observe(canvas);
addEventListener("pumpkin:quality", resize);

/* ---------------- input: carve strokes, and move / size / turn carved words ---------------- */
const pointers = new Map();
let gesture = null;
function toSpace(e) {
  const r = canvas.getBoundingClientRect();
  const cu = ((e.clientX - r.left) / r.width) * 256, cv = ((e.clientY - r.top) / r.height) * 256;
  return [(cu - G.ox) / G.k, (cv - G.oy) / G.k];
}
const toGrid = (e) => toSpace(e).map((v) => Math.max(0, Math.min(255, Math.round(v))));
function hitText(p) {
  for (let i = state.texts.length - 1; i >= 0; i--) {
    const tx = state.texts[i], { w, h } = textBox(tx), a = (-tx.r * Math.PI) / 180;
    const dx = p[0] - tx.x * 256, dy = p[1] - tx.y * 256;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= w / 2 + 6 && Math.abs(ly) <= h / 2 + 6) return i;
  }
  return -1;
}
function select(i) { selected = i; placeTbox(); }
function placeTbox() {
  const box = $("tbox"), tx = state.texts[selected];
  if (!tx || mode !== "carve" || document.body.classList.contains("lit") || !G) { box.hidden = true; return; }
  const r = canvas.getBoundingClientRect(); if (r.width < 2) return;
  const px = (r.width / 256) * G.k, { w, h } = textBox(tx);
  const cx = (G.ox + G.k * tx.x * 256) * (r.width / 256), cy = (G.oy + G.k * tx.y * 256) * (r.width / 256);
  const bw = w * px + 16, bh = h * px + 12;
  box.hidden = false;
  Object.assign(box.style, { width: bw + "px", height: bh + "px", transform: `translate(${cx - bw / 2}px,${cy - bh / 2}px) rotate(${tx.r}deg)` });
}
const clampText = (tx) => {
  tx.x = Math.min(1, Math.max(0, tx.x)); tx.y = Math.min(1, Math.max(0, tx.y));
  tx.s = Math.min(TEXT.sMax, Math.max(TEXT.sMin, tx.s));
  tx.r = ((tx.r + 540) % 360) - 180;
};
/* ---- carve vs scroll (touch) ----
   The stage is touch-action: pan-y, so the page can always be dragged from it. The rule:
   1. A touch that starts OFF the pumpkin's body (the clear corners of the stage, the stem, the gutters) never
      carves: the browser scrolls the page natively.
   2. A touch that starts ON the body (or on a carved word / its handles, or as a second finger) is claimed:
      touchstart is cancelled, so the page can't scroll under a carve stroke.
   3. Except a flick from the body's edge: if the touch starts within EDGE_PX of the silhouette, the stroke is held
      back for FLICK_MS; if in that time it travels more than FLICK_PX, mostly vertically (|dy| > 2|dx|), it is a
      scroll: nothing is carved and the page follows the finger (with momentum). Otherwise it carves from the
      first point, so no mark is ever left by a scroll attempt. (A flick toward a page edge it can't scroll past,
      e.g. dragging down at the very top, stays a carve.)
   Mouse and pen keep the old behaviour (they don't scroll by dragging). */
const EDGE_PX = 26, FLICK_MS = 80, FLICK_PX = 12;
function bodyAlphaAt(cx, cy) {
  const r = canvas.getBoundingClientRect();
  if (!L.body || !P || cx < r.left || cy < r.top || cx >= r.right || cy >= r.bottom) return 0;
  const x = Math.floor(((cx - r.left) / r.width) * P), y = Math.floor(((cy - r.top) / r.height) * P);
  try { return L.body.getContext("2d").getImageData(x, y, 1, 1).data[3]; } catch (_) { return 255; }
}
function onBody(cx, cy) {
  if (!G) return false;
  if (toSpace({ clientX: cx, clientY: cy })[1] < G.sh.top - 2) return false; // the stem / a crown: not carvable
  return bodyAlphaAt(cx, cy) > 110;
}
function nearEdge(cx, cy) {
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; if (bodyAlphaAt(cx + Math.cos(a) * EDGE_PX, cy + Math.sin(a) * EDGE_PX) <= 110) return true; }
  return false;
}
// does the carve handler take this touch (and so block the page from scrolling on it)?
function ownsTouch(target, cx, cy) {
  if (mode !== "carve" || !G || document.body.classList.contains("lit")) return false;
  if (pointers.size > 0) return true; // a second finger: pinch / twist on a word
  if (target && target.closest && target.closest("#tbox")) return true;
  return hitText(toSpace({ clientX: cx, clientY: cy })) >= 0 || onBody(cx, cy);
}
stage.addEventListener("touchstart", (e) => {
  for (const t of e.changedTouches) if (ownsTouch(e.target, t.clientX, t.clientY)) { if (e.cancelable) e.preventDefault(); return; }
}, { passive: false });
// a flick turned into a scroll: the page follows the finger, then coasts
let coast = 0;
function stopCoast() { cancelAnimationFrame(coast); coast = 0; }
function coastFrom(v) {
  stopCoast();
  if (reduced.matches || Math.abs(v) < 0.05) return;
  let last = performance.now();
  const step = (t) => {
    const dt = Math.min(40, t - last); last = t;
    scrollBy(0, v * dt); v *= Math.pow(0.95, dt / 16.7);
    coast = Math.abs(v) > 0.03 ? requestAnimationFrame(step) : 0;
  };
  coast = requestAnimationFrame(step);
}
function startStroke(e, pts) {
  select(-1);
  pushUndo();
  active = { size: brush, points: pts };
  state.strokes.push(active);
  gesture = { kind: "carve" };
  buildCarveLayers(); syncButtons(); clearSend(); Sound.scrape();
}
stage.addEventListener("pointerdown", (e) => {
  stopCoast();
  if (mode !== "carve" || !G || document.body.classList.contains("lit")) return;
  if (e.button !== undefined && e.button > 0) return;
  const touch = e.pointerType === "touch";
  if (touch && !ownsTouch(e.target, e.clientX, e.clientY)) return; // rule 1: the page scrolls
  e.preventDefault();
  try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  const p = toSpace(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2 && selected >= 0) {
    // a second finger turns the gesture into pinch-to-size + twist-to-turn on the selected words
    if (active) { state.strokes.pop(); active = null; undoStack.pop(); buildCarveLayers(); }
    if (!gesture || gesture.kind !== "pinch") pushUndo();
    const [a, b] = [...pointers.values()], tx = state.texts[selected];
    gesture = { kind: "pinch", d0: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, a0: Math.atan2(b[1] - a[1], b[0] - a[0]), s0: tx.s, r0: tx.r, changed: true };
    return;
  }
  if (pointers.size > 1) return;
  const h = e.target.closest && e.target.closest("[data-h]");
  if (h && selected >= 0) {
    const tx = state.texts[selected];
    if (h.dataset.h === "del") { pushUndo(); state.texts.splice(selected, 1); select(-1); buildCarveLayers(); syncButtons(); clearSend(); gesture = null; return; }
    pushUndo();
    const c = [tx.x * 256, tx.y * 256];
    gesture = { kind: h.dataset.h, c, d0: Math.hypot(p[0] - c[0], p[1] - c[1]) || 1, a0: Math.atan2(p[1] - c[1], p[0] - c[0]), s0: tx.s, r0: tx.r, changed: false };
    return;
  }
  const hit = e.target === $("tbox") ? selected : hitText(p);
  if (hit >= 0) {
    select(hit); pushUndo();
    const tx = state.texts[hit];
    gesture = { kind: "move", p0: p, x0: tx.x, y0: tx.y, changed: false };
    return;
  }
  if (touch && nearEdge(e.clientX, e.clientY)) {
    // rule 3: hold the stroke back until we know it isn't a flick
    const g = { kind: "pending", id: e.pointerId, t0: performance.now(), x0: e.clientX, y0: e.clientY, pts: [toGrid(e)] };
    gesture = g;
    g.timer = setTimeout(() => { if (gesture === g) startStroke(e, g.pts); }, FLICK_MS);
    return;
  }
  startStroke(e, [toGrid(e)]);
});
stage.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  if (gesture.kind === "pending") {
    const g = gesture, dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    g.pts.push(toGrid(e));
    // a flick only counts if the page can actually move that way (dragging down at the very top is a carve)
    const room = dy < 0 ? document.documentElement.scrollHeight - innerHeight - scrollY : scrollY;
    if (performance.now() - g.t0 <= FLICK_MS && Math.abs(dy) > FLICK_PX && Math.abs(dy) > 2 * Math.abs(dx) && room > 1) {
      clearTimeout(g.timer);
      gesture = { kind: "scroll", y: e.clientY, v: 0, t: performance.now() };
      scrollBy(0, -dy);
    } else if (Math.hypot(dx, dy) > FLICK_PX || performance.now() - g.t0 > FLICK_MS) {
      clearTimeout(g.timer); startStroke(e, g.pts.filter((q, i, a) => i === 0 || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) >= 3));
    }
    return;
  }
  if (gesture.kind === "scroll") {
    const now = performance.now(), d = gesture.y - e.clientY, dt = Math.max(1, now - gesture.t);
    scrollBy(0, d);
    gesture.v = 0.7 * (d / dt) + 0.3 * gesture.v; gesture.y = e.clientY; gesture.t = now;
    return;
  }
  const p = toSpace(e);
  pointers.set(e.pointerId, p);
  const tx = state.texts[selected];
  if (gesture.kind === "carve" && active) {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    let changed = false;
    for (const ev of (evs.length ? evs : [e])) {
      const q = toGrid(ev), last = active.points[active.points.length - 1];
      if (Math.hypot(q[0] - last[0], q[1] - last[1]) >= 3) { active.points.push(q); changed = true; }
    }
    if (changed) { carvePending = true; Sound.scrape(); }
    return;
  }
  if (!tx) return;
  if (gesture.kind === "move") {
    tx.x = gesture.x0 + (p[0] - gesture.p0[0]) / 256; tx.y = gesture.y0 + (p[1] - gesture.p0[1]) / 256;
  } else if (gesture.kind === "size") {
    tx.s = gesture.s0 * (Math.hypot(p[0] - gesture.c[0], p[1] - gesture.c[1]) / gesture.d0);
  } else if (gesture.kind === "rot") {
    tx.r = gesture.r0 + ((Math.atan2(p[1] - gesture.c[1], p[0] - gesture.c[0]) - gesture.a0) * 180) / Math.PI;
  } else if (gesture.kind === "pinch" && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    tx.s = gesture.s0 * (Math.hypot(b[0] - a[0], b[1] - a[1]) / gesture.d0);
    tx.r = gesture.r0 + ((Math.atan2(b[1] - a[1], b[0] - a[0]) - gesture.a0) * 180) / Math.PI;
  } else return;
  clampText(tx);
  gesture.changed = true; textPending = true; placeTbox(); clearSend();
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size > 0) return;
  if (gesture && gesture.kind === "pending") { clearTimeout(gesture.timer); if (e.type === "pointerup") startStroke(e, gesture.pts); else { gesture = null; return; } } // a tap on the edge: a dot
  if (gesture && gesture.kind === "scroll") { const v = performance.now() - gesture.t < 80 ? gesture.v : 0; gesture = null; coastFrom(v); return; }
  if (gesture && gesture.kind === "carve" && active) { if (carvePending) { carvePending = false; buildCarveLayers(true); } active = null; buildCarveLayers(); }
  else if (gesture && gesture.kind !== "carve") {
    if (!gesture.changed) undoStack.pop();
    else { Sound.scrape(); for (const t of state.texts) clampText(t); buildCarveLayers(); }
  }
  gesture = null; syncButtons();
}
stage.addEventListener("pointerup", endPointer);
stage.addEventListener("pointercancel", endPointer);
stage.addEventListener("lostpointercapture", endPointer);

const snapshot = () => JSON.stringify({ s: state.strokes, t: state.texts });
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 100) undoStack.shift(); }
function syncButtons() {
  $("undo").disabled = !undoStack.length;
  $("clear").disabled = !state.strokes.length && !state.texts.length;
  $("addText").disabled = !cleanWord($("textIn").value) || state.texts.length >= MAX.texts;
  $("textIn").disabled = state.texts.length >= MAX.texts;
  $("textIn").placeholder = state.texts.length >= MAX.texts ? "Two words max" : "Carve a word";
}
$("undo").onclick = () => {
  if (!undoStack.length) return;
  const o = JSON.parse(undoStack.pop()); state.strokes = o.s; state.texts = o.t;
  select(-1); buildCarveLayers(); syncButtons(); clearSend();
};
$("clear").onclick = () => { if (!state.strokes.length && !state.texts.length) return; pushUndo(); state.strokes = []; state.texts = []; select(-1); buildCarveLayers(); syncButtons(); clearSend(); };
document.querySelectorAll("[data-brush]").forEach((b) => b.onclick = () => {
  brush = +b.dataset.brush;
  document.querySelectorAll("[data-brush]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
});
document.querySelectorAll("[data-stencil]").forEach((b) => b.onclick = () => {
  if (!G) return;
  pushUndo();
  placeStencil(b.dataset.stencil);
  Sound.stamp();
  buildCarveLayers(); syncButtons(); clearSend();
});
// A stencil replaces the previous stencil's strokes (and words) but keeps everything carved by hand.
function placeStencil(name) {
  const stencil = STENCILS[name](G.sh).map((s) => ({ ...s, st: name }));
  state.strokes = [...stencil, ...state.strokes.filter((s) => !s.st)];
  const keep = state.texts.filter((t) => !t.st);
  const words = name === "owner" ? ownerWords(G.sh).slice(0, Math.max(0, MAX.texts - keep.length)).map((t) => ({ ...t, st: name })) : [];
  if (words.length || keep.length !== state.texts.length) { state.texts = [...keep, ...words]; select(-1); }
}

const textIn = $("textIn");
function syncTextCount() { $("textCount").textContent = `${[...cleanWord(textIn.value)].length}/${MAX.textLen}`; syncButtons(); }
textIn.addEventListener("input", syncTextCount);
// Enter / Done on the keyboard carves the word, then closes the keyboard so the whole pumpkin is in view.
textIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); if (addText()) doneTyping(); } });
// iOS's keyboard "Done" bar just blurs the field: carve what was typed then too.
textIn.addEventListener("change", () => { if (document.activeElement !== textIn) addText(); });
function doneTyping() {
  textIn.blur();
  const show = () => stage.scrollIntoView({ block: "nearest", behavior: reduced.matches ? "auto" : "smooth" });
  if (window.visualViewport) { let done = false; const once = () => { if (!done) { done = true; show(); } }; visualViewport.addEventListener("resize", once, { once: true }); setTimeout(once, 350); }
  else show();
}
/* ---------------- tool tabs: Carve · Words · Stencils (one pane at a time, fixed height) ---------------- */
const TABS = [...document.querySelectorAll("[data-tab]")];
function setTab(name, focus) {
  for (const b of TABS) {
    const on = b.dataset.tab === name;
    b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    $(b.getAttribute("aria-controls")).hidden = !on;
    if (on && focus) b.focus();
  }
}
for (const b of TABS) {
  b.addEventListener("click", () => setTab(b.dataset.tab));
  b.addEventListener("keydown", (e) => {
    const i = TABS.indexOf(b), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (d) { e.preventDefault(); setTab(TABS[(i + d + TABS.length) % TABS.length].dataset.tab, true); }
  });
}
function addText() {
  const t = cleanWord(textIn.value);
  if (!t || !G || state.texts.length >= MAX.texts) return false;
  pushUndo();
  const sh = G.sh, tx = { t, x: sh.cx / 256, y: (sh.cy + sh.ry * (state.texts.length ? 0.45 : 0.05)) / 256, s: 0.16, r: 0 };
  const { w } = textBox(tx);
  tx.s = Math.max(TEXT.sMin, Math.min(0.16, 0.16 * ((sh.rx * 1.1) / Math.max(1, w))));
  clampText(tx);
  state.texts.push(tx);
  textIn.value = ""; syncTextCount();
  Sound.stamp();
  select(state.texts.length - 1);
  buildCarveLayers(); syncButtons(); clearSend();
  return true;
}
$("addText").onclick = () => { if (addText()) doneTyping(); };

/* ---------------- stencils (just pre-made strokes, fitted to the body box) ---------------- */
function scanFill(rings, size) {
  const w = BRUSH[size], out = [];
  const outer = rings[0];
  const c = outer.reduce((a, p) => [a[0] + p[0] / outer.length, a[1] + p[1] / outer.length], [0, 0]);
  const edge = outer.map(([x, y]) => { const d = Math.hypot(c[0] - x, c[1] - y) || 1; return [x + (c[0] - x) / d * 2, y + (c[1] - y) / d * 2]; });
  out.push({ size: 1, points: [...edge, edge[0]] });
  let ymin = Infinity, ymax = -Infinity;
  for (const r of rings) for (const p of r) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
  const H = ymax - ymin - w;
  const n = H <= 0 ? 1 : Math.ceil(H / (w * 0.7)) + 1;
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? (ymin + ymax) / 2 : ymin + w / 2 + H * i / (n - 1);
    const xs = [];
    for (const r of rings) for (let k = 0; k < r.length; k++) {
      const a = r[k], b = r[(k + 1) % r.length];
      if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = xs[k], b = xs[k + 1], len = b - a;
      if (len >= w) out.push({ size, points: [[a + w / 2, y], [b - w / 2, y]] });
      else {
        const s = len >= BRUSH[2] ? 2 : 1, ws = BRUSH[s];
        out.push({ size: s, points: len > ws ? [[a + ws / 2, y], [b - ws / 2, y]] : [[(a + b) / 2, y]] });
      }
    }
  }
  return out;
}
function finish(strokes) {
  return strokes.map((s) => {
    const pts = [];
    for (const p of s.points) {
      const q = [Math.max(0, Math.min(255, Math.round(p[0]))), Math.max(0, Math.min(255, Math.round(p[1])))];
      const l = pts[pts.length - 1];
      if (!l || l[0] !== q[0] || l[1] !== q[1]) pts.push(q);
    }
    return { size: s.size, points: pts };
  });
}
// Faces sit a touch below the body's centre and use its width more than its height,
// so they read on squat and tall varieties alike.
function faceMap(sh) { const r = Math.min(sh.rx * 0.74, sh.ry * 0.95); return (u, v) => [sh.cx + u * r * 1.05, sh.cy + sh.ry * 0.06 + v * r * 0.82]; }
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
function ellipseRing(F, cu, cv, ru, rv, n = 18) { return range(0, Math.PI * 2, n).slice(0, n).map((t) => F(cu + ru * Math.cos(t), cv + rv * Math.sin(t))); }
function lensRing(F, cu, cv, hw, hh, n = 10, vertical = false) {
  const top = range(0, 1, n).map((t) => vertical ? F(cu + hw * Math.sin(Math.PI * t), cv - hh + 2 * hh * t) : F(cu - hw + 2 * hw * t, cv - hh * Math.sin(Math.PI * t)));
  const bot = range(1, 0, n).slice(1, -1).map((t) => vertical ? F(cu - hw * Math.sin(Math.PI * t), cv - hh + 2 * hh * t) : F(cu - hw + 2 * hw * t, cv + hh * Math.sin(Math.PI * t)));
  return [...top, ...bot];
}
const mirror = (pts) => pts.map(([u, v]) => [-u, v]);
const STENCILS = {
  classic(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    const eye = [[-0.64, -0.14], [-0.16, -0.14], [-0.4, -0.6]];
    const up = (u) => 0.2 + 0.2 * (1 - (u / 0.76) ** 2), lo = (u) => 0.2 + 0.58 * (1 - (u / 0.76) ** 2);
    const mouth = [];
    for (const u of [-0.76, -0.64, -0.5, -0.38]) mouth.push([u, up(u)]);
    mouth.push([-0.38, up(-0.38) + 0.17], [-0.2, up(-0.2) + 0.17], [-0.2, up(-0.2)], [0, up(0)], [0.2, up(0.2)], [0.2, up(0.2) + 0.17], [0.38, up(0.38) + 0.17]);
    for (const u of [0.38, 0.5, 0.64, 0.76]) mouth.push([u, up(u)]);
    for (const u of [0.64, 0.46, 0.1]) mouth.push([u, lo(u)]);
    mouth.push([0.1, lo(0.1) - 0.16], [-0.1, lo(-0.1) - 0.16], [-0.1, lo(-0.1)]);
    for (const u of [-0.46, -0.64]) mouth.push([u, lo(u)]);
    return finish([
      ...scanFill([T(eye)], 3), ...scanFill([T(mirror(eye))], 3),
      ...scanFill([T([[-0.1, 0.06], [0.1, 0.06], [0, -0.1]])], 2),
      ...scanFill([T(mouth)], 2),
    ]);
  },
  spooky(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    const eye = [[-0.72, -0.46], [-0.12, -0.14], [-0.3, -0.04], [-0.6, -0.12]];
    const curve = (u) => -0.12 * (u / 0.74) ** 2;
    const top = range(-0.74, 0.74, 8).map((u, i) => [u, (i % 2 ? 0.46 : 0.26) + curve(u)]);
    const bot = range(0.66, -0.66, 7).map((u, i) => [u, (i % 2 ? 0.58 : 0.74) + curve(u)]);
    return finish([
      ...scanFill([T(eye)], 3), ...scanFill([T(mirror(eye))], 3),
      ...scanFill([T([[-0.12, 0.08], [0.12, 0.08], [0.06, -0.06], [0, 0.0], [-0.06, -0.06]])], 2),
      ...scanFill([T([...top, ...bot])], 2),
    ]);
  },
  surprised(sh) {
    const F = faceMap(sh);
    const brow = (s) => ({ size: 2, points: range(0, 1, 6).map((t) => F(s * (0.18 + 0.42 * t), -0.68 - 0.1 * Math.sin(Math.PI * t) + 0.04 * t)) });
    return finish([
      ...scanFill([ellipseRing(F, -0.38, -0.3, 0.17, 0.2)], 3),
      ...scanFill([ellipseRing(F, 0.38, -0.3, 0.17, 0.2)], 3),
      brow(-1), brow(1),
      ...scanFill([ellipseRing(F, 0, 0.44, 0.19, 0.27, 20)], 3),
    ]);
  },
  cat(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    const eye = (cu) => scanFill([lensRing(F, cu, -0.26, 0.26, 0.19, 10), lensRing(F, cu, -0.26, 0.05, 0.16, 6, true)], 2);
    const whiskers = [];
    for (const s of [-1, 1]) for (const [v0, v1] of [[0.12, 0.02], [0.2, 0.22], [0.28, 0.42]]) whiskers.push({ size: 1, points: [F(s * 0.42, v0), F(s * 0.66, (v0 + v1) / 2 - 0.02), F(s * 0.9, v1)] });
    return finish([
      ...eye(-0.38), ...eye(0.38),
      ...scanFill([T([[-0.13, 0.0], [0.13, 0.0], [0, 0.14]])], 2),
      { size: 2, points: range(0, 1, 10).map((t) => F(-0.34 + 0.68 * t, 0.24 + 0.14 * Math.abs(Math.sin(Math.PI * 2 * t)))) },
      { size: 1, points: [F(0, 0.14), F(0, 0.24)] },
      ...whiskers,
    ]);
  },
  bat(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    const right = [[0.04, -0.3], [0.13, -0.46], [0.17, -0.22], [0.36, -0.34], [0.62, -0.38], [0.9, -0.22], [0.82, 0.02], [0.7, -0.04], [0.6, 0.16], [0.46, 0.06], [0.32, 0.22], [0.2, 0.12], [0.08, 0.38]];
    const left = right.slice().reverse().map(([u, v]) => [-u, v]);
    return finish(scanFill([T([...right, [0, 0.46], ...left])], 2));
  },
  // ---- added in v4.1 (ids appended to STENCIL_IDS, never renumbered) ----
  vampire(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    const eye = [[-0.66, -0.36], [-0.14, -0.22], [-0.3, -0.12], [-0.54, -0.18]];
    const brow = (s) => ({ size: 2, points: range(0, 1, 6).map((t) => F(s * (0.76 - 0.6 * t), -0.6 + 0.16 * t - 0.12 * Math.sin(Math.PI * t))) });
    // a thin wicked smile, two long fangs hanging from it
    const smile = [...range(-0.62, 0.62, 12).map((u) => [u, 0.3 + 0.16 * (1 - (u / 0.62) ** 2) - 0.06]), ...range(0.56, -0.56, 12).map((u) => [u, 0.3 + 0.24 * (1 - (u / 0.62) ** 2)])];
    const fang = (c) => [[c - 0.11, 0.38], [c + 0.11, 0.38], [c + 0.01 * Math.sign(c), 0.74]];
    return finish([
      ...scanFill([T(eye)], 2), ...scanFill([T(mirror(eye))], 2), brow(-1), brow(1),
      ...scanFill([T([[-0.07, 0.08], [0.07, 0.08], [0, -0.04]])], 1),
      ...scanFill([T(smile)], 2), ...scanFill([T(fang(-0.24))], 1), ...scanFill([T(fang(0.24))], 1),
    ]);
  },
  ghost(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    // a sheet ghost: round head, straight sides, a scalloped hem; its eyes and "oo" mouth stay as skin (islands)
    const head = range(Math.PI, 0, 14).map((t) => [0.52 * Math.cos(t), -0.12 - 0.56 * Math.sin(t)]);
    const hem = range(0.52, -0.52, 24).map((u) => [u, 0.56 + 0.1 * Math.cos(((u + 0.52) / 1.04) * Math.PI * 6)]);
    const body = [...head, [0.54, 0.2], ...hem, [-0.54, 0.2]];
    return finish(scanFill([T(body), ellipseRing(F, -0.2, -0.2, 0.13, 0.17, 16), ellipseRing(F, 0.2, -0.2, 0.13, 0.17, 16), ellipseRing(F, 0, 0.17, 0.12, 0.17, 16)], 2));
  },
  spiderweb(sh) {
    const F = faceMap(sh);
    const c = [-0.08, -0.12], spokes = 8, rings = [0.24, 0.48, 0.72], out = [];
    const at = (k, r) => { const a = (k / spokes) * Math.PI * 2 - Math.PI / 2; return [c[0] + r * Math.cos(a) * 1.05, c[1] + r * Math.sin(a) * 0.86]; };
    for (let k = 0; k < spokes; k++) out.push({ size: 1, points: [F(...c), F(...at(k, 0.82))] });
    // each ring sags between spokes, as threads do
    for (const r of rings) for (let k = 0; k < spokes; k++) {
      const a = at(k, r), b = at(k + 1, r), m = at(k + 0.5, r * 0.88);
      out.push({ size: 1, points: range(0, 1, 5).map((t) => F((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * m[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * m[1] + t * t * b[1])) });
    }
    // a little spider dangling from its thread
    const sp = [0.5, 0.42];
    out.push({ size: 1, points: [F(0.5, -0.02), F(sp[0], sp[1] - 0.1)] });
    out.push(...scanFill([ellipseRing(F, sp[0], sp[1], 0.1, 0.12, 14)], 2));
    for (const s of [-1, 1]) for (const [dv, du1, dv1] of [[-0.06, 0.22, -0.16], [0, 0.26, 0], [0.06, 0.22, 0.16]]) out.push({ size: 1, points: [F(sp[0] + s * 0.08, sp[1] + dv), F(sp[0] + s * du1 * 0.7, sp[1] + dv + dv1 * 0.5 - 0.06), F(sp[0] + s * du1, sp[1] + dv + dv1)] });
    return finish(out);
  },
  witch(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    // a pointed hat with a bent tip on a wide brim, and a crooked grin with one tooth left standing (an island)
    const brim = [...range(-0.82, 0.82, 10).map((u) => [u, -0.22 - 0.05 * (1 - (u / 0.82) ** 2)]), ...range(0.76, -0.76, 10).map((u) => [u, -0.12 + 0.02 * (1 - (u / 0.82) ** 2)])];
    const cone = [[-0.36, -0.2], [-0.22, -0.46], [-0.08, -0.68], [0.06, -0.8], [0.32, -0.8], [0.14, -0.68], [0.12, -0.46], [0.34, -0.2]];
    const up = (u) => 0.2 + 0.1 * (1 - (u / 0.66) ** 2) + 0.04 * u, lo = (u) => 0.22 + 0.4 * (1 - (u / 0.66) ** 2) + 0.04 * u;
    const grin = [...range(-0.66, 0.1, 9).map((u) => [u, up(u)]), [0.1, up(0.1) + 0.16], [0.26, up(0.26) + 0.16],
      ...range(0.26, 0.66, 5).map((u) => [u, up(u)]), ...range(0.6, -0.6, 14).map((u) => [u, lo(u)])];
    return finish([...scanFill([T(brim)], 2), ...scanFill([T(cone)], 2), ...scanFill([T(grin)], 2)]);
  },
  skull(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    // deep round sockets, an upside-down heart of a nose, and a stitched row of teeth
    const nose = [[0, 0.02], [0.1, 0.2], [0.04, 0.24], [0, 0.2], [-0.04, 0.24], [-0.1, 0.2]];
    const out = [
      ...scanFill([ellipseRing(F, -0.36, -0.3, 0.24, 0.26, 20)], 3), ...scanFill([ellipseRing(F, 0.36, -0.3, 0.24, 0.26, 20)], 3),
      ...scanFill([T(nose)], 1),
      { size: 2, points: range(-0.56, 0.56, 10).map((u) => F(u, 0.46 + 0.05 * (u / 0.56) ** 2)) },
    ];
    for (const u of range(-0.42, 0.42, 6)) out.push({ size: 1, points: [F(u, 0.34 + 0.05 * (u / 0.56) ** 2), F(u, 0.6 + 0.05 * (u / 0.56) ** 2)] });
    return finish(out);
  },
  owl(sh) {
    const F = faceMap(sh), T = (pts) => pts.map(([u, v]) => F(u, v));
    // two big round eyes (the pupils stay as skin), feathery brows, a pointed beak and a few chest feathers
    const eye = (cu) => scanFill([ellipseRing(F, cu, -0.24, 0.28, 0.3, 22), ellipseRing(F, cu + 0.04, -0.2, 0.13, 0.14, 16)], 2);
    const brow = { size: 2, points: [F(-0.8, -0.8), F(-0.4, -0.7), F(0, -0.56), F(0.4, -0.7), F(0.8, -0.8)] };
    const chev = (cu, cv) => ({ size: 1, points: [F(cu - 0.1, cv - 0.06), F(cu, cv), F(cu + 0.1, cv - 0.06)] });
    return finish([...eye(-0.36), ...eye(0.36), brow, ...scanFill([T([[-0.12, 0.0], [0.12, 0.0], [0, 0.3]])], 1),
      chev(-0.26, 0.5), chev(0, 0.6), chev(0.26, 0.5)]);
  },
};
/* ---------------- the owner's carving as a stencil, refitted to whichever pumpkin is being carved ---------------- */
// Strokes and words live in pumpkin space, relative to the owner's pumpkin's body box; they are moved and
// scaled from that box onto the target body box (the owner's pumpkin may be squat, tall, flipped or smaller).
let ownerSh = null, ownerFull = [];
let ownerReady = Promise.resolve();
const fitFrom = (sh) => {
  const kx = sh.rx / ownerSh.rx, ky = sh.ry / ownerSh.ry;
  return { pt: ([x, y]) => [sh.cx + (x - ownerSh.cx) * kx, sh.cy + (y - ownerSh.cy) * ky], k: Math.sqrt(kx * ky) };
};
function ownerWords(sh) {
  if (!SHOWCASE || !ownerSh) return [];
  const f = fitFrom(sh);
  return SHOWCASE.texts.map((t) => { const [x, y] = f.pt([t.x * 256, t.y * 256]); const o = { t: t.t, x: x / 256, y: y / 256, s: t.s * f.k, r: t.r }; clampText(o); return o; });
}
if (SHOWCASE) {
  // the showcase's whole carving: a v4 showcase keeps its stencil as an id, so it is re-fitted to the owner's pumpkin first
  STENCILS.owner = (sh) => (ownerSh ? finish(ownerFull.map((s) => ({ size: s.size, points: s.points.map(fitFrom(sh).pt) }))) : []);
  $("ownerStencilName").textContent = OWNERS;
  $("ownerStencil").setAttribute("aria-label", `${OWNERS} carving as a stencil`);
  $("ownerStencil").hidden = false;
  ownerReady = Promise.all([loadArt(SHOWCASE.variety), loadArt("classic-orange")]).then(([own, plain]) => {
    ownerSh = lookOf(SHOWCASE.pseed).flip ? { ...own.sh, cx: 256 - own.sh.cx } : own.sh;
    ownerFull = [...stencilStrokes(SHOWCASE.stencil, ownerSh), ...SHOWCASE.strokes];
    $("ownerStencil").disabled = false;
    stencilThumb($("ownerStencil"), plain, STENCILS.owner(plain.sh), ownerWords(plain.sh));
  });
  litThumb($("showcaseCv"), SHOWCASE, 112);
}
// Stencil buttons show the stencil itself, glowing on a little lit pumpkin (no emoji).
function stencilThumb(b, art, strokes, words = []) {
  const c = document.createElement("canvas"); c.width = c.height = 96;
  const x = c.getContext("2d"), s = 96 / 256;
  x.drawImage(art.img, 0, 0, 96, 96);
  x.globalCompositeOperation = "source-atop"; x.fillStyle = "rgba(40,10,2,.45)"; x.fillRect(0, 0, 96, 96);
  const h = document.createElement("canvas"); h.width = h.height = 96;
  const hx = h.getContext("2d"); hx.setTransform(s, 0, 0, s, 0, 0); hx.lineCap = hx.lineJoin = "round";
  strokePass(hx, strokes, 0, "#ffd36b"); textPass(hx, words, 0, "#ffd36b");
  if (art.mask) { hx.setTransform(1, 0, 0, 1, 0, 0); hx.globalCompositeOperation = "destination-in"; hx.drawImage(art.mask, 0, 0, 96, 96); }
  x.globalCompositeOperation = "source-over"; x.shadowColor = "#ffb347"; x.shadowBlur = 6; x.drawImage(h, 0, 0);
  try { b.querySelector("img").src = c.toDataURL("image/png"); } catch (_) {}
}
// A small lit jack-o'-lantern of a decoded carving (the landing's showcase): dark skin warmed from inside,
// the cuts glowing in candle colours. A cheap cousin of the carving renderer, drawn once.
async function litThumb(cv, data, css) {
  const art = await loadArt(data.variety), look = lookOf(data.pseed);
  const dpr = Math.min(devicePixelRatio || 1, 3), n = Math.round(css * dpr), u = n / 256;
  const { k, ox, oy, sh } = placement(art, look);
  const T = [u * k, 0, 0, u * k, u * ox, u * oy];
  cv.width = cv.height = n;
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d"); x.setTransform(...T); return [c, x]; };
  const art2 = (x, src) => { x.save(); if (look.flip) { x.translate(256, 0); x.scale(-1, 1); } x.drawImage(src, 0, 0, 256, 256); x.restore(); };
  const [holes, hx] = mk();
  hx.lineCap = hx.lineJoin = "round"; strokePass(hx, [...stencilStrokes(data.stencil, sh), ...data.strokes], 0, "#000"); textPass(hx, data.texts, 0, "#000");
  hx.setTransform(1, 0, 0, 1, 0, 0); hx.globalCompositeOperation = "destination-in";
  const [m, mx] = mk(); art2(mx, art.mask || art.img); hx.drawImage(m, 0, 0);
  hx.globalCompositeOperation = "source-in"; hx.setTransform(...T);
  hx.fillStyle = candleGrad(hx, sh, [[0, "#fffbea"], [0.35, "#ffe08a"], [0.75, "#ffae45"], [1, "#ff8a2a"]]); hx.fillRect(-50, -50, 360, 360);
  const x = cv.getContext("2d");
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, n, n);
  const [body, bx] = mk(); art2(bx, art.img);
  bx.globalCompositeOperation = "source-atop"; bx.fillStyle = "rgba(26,7,3,.72)"; bx.fillRect(-50, -50, 360, 360);
  bx.fillStyle = candleGrad(bx, sh, [[0, "rgba(255,130,35,.4)"], [0.6, "rgba(210,80,12,.16)"], [1, "rgba(0,0,0,0)"]]); bx.fillRect(-50, -50, 360, 360);
  x.drawImage(body, 0, 0);
  x.globalCompositeOperation = "lighter"; x.shadowColor = "rgba(255,150,40,1)"; x.shadowBlur = 4 * dpr; x.drawImage(holes, 0, 0);
  x.globalCompositeOperation = "source-over"; x.shadowBlur = 0; x.drawImage(holes, 0, 0);
}
loadArt("classic-orange").then((art) => {
  for (const b of document.querySelectorAll("[data-stencil]:not([data-stencil=owner])")) {
    stencilThumb(b, art, STENCILS[b.dataset.stencil](art.sh));
  }
});

/* ================= share link: encode / decode ================= */
const b64u = {
  enc(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec(str) { const b = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
};
async function deflate(data) {
  const s = new Blob([typeof data === "string" ? new TextEncoder().encode(data) : data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function inflate(bytes) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX.inflated) { reader.cancel().catch(() => {}); throw new Error("too big"); }
    chunks.push(value);
  }
  const all = new Uint8Array(total); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  return all;
}
// the owner's carving as a stencil travels as an id plus this hash of the showcase it was cut from
const OWNER_HASH = SHOWCASE ? hashStr(SHOWCASE.frag) & 0xffff : -1;
async function decodeFragment(frag) {
  if (typeof frag !== "string" || !FRAG_RE.test(frag)) throw new Error("bad fragment");
  const d = validate(parsePayload(await inflate(b64u.dec(frag))));
  // cut with an owner stencil this patch no longer shows (the owner changed the showcase): it can't be redrawn
  if (d.stencil === "owner" && d.ownerHash !== OWNER_HASH) throw new Error("owner stencil changed");
  return d;
}
// Ramer–Douglas–Peucker, then drop points closer than `minGap`
function simplify(points, tol, minGap) {
  let pts = points;
  if (tol > 0 && pts.length > 2) {
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); let md = 0, mi = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b], L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = pts[i];
        const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / Math.sqrt(L2);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    pts = pts.filter((_, i) => keep[i]);
  }
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const l = out[out.length - 1], p = pts[i];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) >= minGap || i === pts.length - 1 && (p[0] !== l[0] || p[1] !== l[1])) out.push(p);
  }
  return out;
}
const r3 = (n) => Math.round(n * 1000) / 1000;
// The patch's own address for links, QR codes and "carve one back": tracking tags that chat apps and ads add on the
// way in (?fbclid=… from Instagram / Messenger, utm_*, …) and the ?quality test switch are left off, so they never
// ride along on every pumpkin link (a fbclid alone is 60-120 characters).
const DROP_PARAM = /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|twclid|ttclid|igshid|igsh|mc_cid|mc_eid|li_fat_id|_hsenc|_hsmsg|mkt_tok|ref_src|openexternalbrowser|quality)$/i;
function cleanSearch() {
  const q = new URLSearchParams(location.search);
  for (const k of [...q.keys()]) if (DROP_PARAM.test(k)) q.delete(k);
  const s = q.toString(); return s ? "?" + s : "";
}
const patchRoot = () => location.origin + location.pathname + cleanSearch();
// "Make your own patch": the config's growYourOwnUrl, tagged with where the visitor came from; null if it isn't http(s)
const growOwnUrl = () => {
  try { const u = new URL(CFG.growYourOwnUrl); if (!/^https?:$/.test(u.protocol)) return null; u.searchParams.set("from", location.host || "unknown"); return u.href; }
  catch (_) { return null; }
};
// v4 link: a stencil goes as its id (its strokes are re-fitted to the same pumpkin on open, so they draw the same);
// hand strokes are simplified (Ramer–Douglas–Peucker, tolerance in 0-255 pumpkin units). The tolerance follows the
// brush: a fifth of its width (small 1, medium 1.8, large 3 units). That drops the finger's tremor (about 1 unit
// either way, which a flat 1-unit tolerance kept point for point) while the cut's edge moves by well under a brush
// width. Only simplified harder if a link would still be too long.
const STROKE_TOL = (size, k) => Math.max(1, 0.2 * BRUSH[size]) * k;
async function buildLink() {
  const base = patchRoot();
  const stencil = (state.strokes.find((s) => s.st) || state.texts.find((t) => t.st) || {}).st;
  const texts = state.texts.map((tx) => ({ t: tx.t, x: r3(tx.x), y: r3(tx.y), s: Math.min(TEXT.sMax, Math.max(TEXT.sMin, r3(tx.s))), r: Math.round(tx.r), st: !!tx.st }));
  for (const k of [1, 1.5, 2.5, 4]) {
    const data = { variety: state.variety, pseed: state.pseed, stencil, ownerHash: OWNER_HASH,
      strokes: state.strokes.filter((s) => !s.st).map((s) => ({ size: s.size, points: simplify(s.points, STROKE_TOL(s.size, k), 0) })), texts, from: cleanText(state.from, MAX.from), msg: cleanText(state.msg, MAX.msg) };
    const frag = "#p=" + b64u.enc(await deflate(encodeV4(data)));
    if (frag.length <= MAX.frag) return base + frag;
  }
  return null;
}
// a stencil's strokes for the pumpkin whose body box is sh (tagged, so the stencil can be swapped or re-sent)
const stencilStrokes = (id, sh) => (id && has(STENCILS, id) ? STENCILS[id](sh).map((s) => ({ ...s, st: id })) : []);

/* ================= carve / light / send / view flow ================= */
const fromIn = $("from"), msgIn = $("msg");
function syncCounts() { $("fromCount").textContent = `${fromIn.value.length}/${MAX.from}`; $("msgCount").textContent = `${msgIn.value.length}/${MAX.msg}`; }
fromIn.addEventListener("input", () => { state.from = fromIn.value; syncCounts(); clearSend(); prepCards(); });
msgIn.addEventListener("input", () => { state.msg = msgIn.value; syncCounts(); clearSend(); prepCards(); });
fromIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); msgIn.focus(); } });
msgIn.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); msgIn.blur(); } });
function clearSend() { $("sendMsg").textContent = ""; $("linkRow").hidden = true; $("linkOut").value = ""; $("err").textContent = ""; }

// Light it first; the name and message come after, when the pumpkin is glowing (the natural moment to sign it).
$("light").onclick = () => {
  Sound.unlock();
  select(-1);
  if (document.activeElement === textIn) textIn.blur();
  document.body.classList.add("lit", "dark"); room = 1; setLight(1); clearSend();
  Sound.light();
  requestAnimationFrame(() => $("send").scrollIntoView({ block: "nearest", behavior: reduced.matches ? "auto" : "smooth" }));
  prepCards(900);
};
$("unlight").onclick = () => { document.body.classList.remove("lit", "dark"); room = 0; setLight(0); clearSend(); };

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
  try {
    const row = $("linkRow"), t = $("linkOut"), keep = t.value, wasHidden = row.hidden;
    row.hidden = false; t.value = text; t.focus({ preventScroll: true }); t.select();
    const ok = document.execCommand("copy"); t.value = keep; t.blur(); row.hidden = wasHidden && !keep;
    return ok;
  } catch (_) { return false; }
}
async function makeLink() {
  let url;
  try { url = await buildLink(); } catch (_) { url = undefined; }
  if (url === null) { $("err").textContent = "That's a very detailed pumpkin. Try fewer strokes."; return null; }
  if (!url) { $("err").textContent = "Sorry, this browser can't make pumpkin links."; return null; }
  return url;
}
function showLink(url) { $("linkOut").value = url; $("linkRow").hidden = false; }
$("send").onclick = async () => {
  clearSend();
  const url = await makeLink(); if (!url) return;
  Sound.send();
  showLink(url);
  const text = shareText(VAR.get(state.variety));
  const phone = matchMedia("(pointer: coarse)").matches;
  if (phone && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "A pumpkin for you 🎃", text, url });
      $("sendMsg").textContent = "Sent!";
      return;
    } catch (e) { if (e && e.name === "AbortError") { $("sendMsg").textContent = "Here's your link:"; return; } }
  }
  $("sendMsg").textContent = (await copyText(`${text} ${url}`)) ? "Link copied!" : "Copy your link below:";
};
let copiedTimer = 0;
$("copyLink").onclick = async () => {
  const ok = await copyText($("linkOut").value);
  $("sendMsg").textContent = ok ? "Link copied!" : "Select the link above and copy it.";
  if (!ok) return;
  setUi($("copyLink"), "check"); clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => setUi($("copyLink"), "copy"), 1600);
};
$("linkOut").addEventListener("focus", (e) => e.target.select());
// What goes with the link: the pumpkin, and where it was grown (the patch owner's credit).
function shareText(v) {
  return isSecret(v.id) ? `I grew the secret ${v.name}, which only grows in ${CREDIT} 🎃 Carve one back:`
    : `I grew ${article(v.tier)} ${v.tier} ${v.name} in ${CREDIT} 🎃 Carve one back:`;
}

/* ---------------- QR code (byte mode, error correction M), no dependencies ---------------- */
const QR = (() => {
  const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataWords = (v) => Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v];
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rsRemainder(data, deg) {
    let g = [1];
    for (let i = 0; i < deg; i++) { const n = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= mul(g[j], EXP[i]); } g = n; }
    const r = new Array(deg).fill(0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let j = 0; j < deg; j++) r[j] ^= mul(g[j + 1], f); }
    return r;
  }
  function alignment(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, out = [6];
    for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  function penalty(m) {
    const n = m.length; let p = 0, dark = 0;
    for (let a = 0; a < 2; a++) for (let i = 0; i < n; i++) {
      let run = 1, line = "";
      for (let j = 0; j < n; j++) {
        const v = a ? m[j][i] : m[i][j]; line += v ? "1" : "0"; if (!a && v) dark++;
        if (j && v === (a ? m[j - 1][i] : m[i][j - 1])) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
      }
      for (const pat of ["10111010000", "00001011101"]) for (let k = line.indexOf(pat); k !== -1; k = line.indexOf(pat, k + 1)) p += 40;
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
    return p + 10 * Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n));
  }
  function encode(text) {
    const bytes = new TextEncoder().encode(text);
    let v = 1;
    while (v <= 40 && 4 + (v < 10 ? 8 : 16) + bytes.length * 8 > dataWords(v) * 8) v++;
    if (v > 40) return null;
    const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
    const cap = dataWords(v) * 8;
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    const nb = BLOCKS[v], ecl = ECC[v], raw = Math.floor(rawModules(v) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k += shortLen - ecl + (i < nShort ? 0 : 1)); const e = rsRemainder(d, ecl); if (i < nShort) d.push(0); blocks.push(d.concat(e)); }
    const words = [];
    for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < nb; j++) if (i !== shortLen - ecl || j >= nShort) words.push(blocks[j][i]);
    const size = v * 4 + 17, base = [...Array(size)].map(() => new Array(size).fill(false)), fn = [...Array(size)].map(() => new Array(size).fill(false));
    const set = (x, y, d) => { base[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4);
    }
    const al = alignment(v), last = al.length - 1;
    for (let i = 0; i <= last; i++) for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const format = (m, mask) => {
      const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1, s = (x, y, on) => { m[y][x] = on; fn[y][x] = true; };
      for (let i = 0; i <= 5; i++) s(8, i, bit(i));
      s(8, 7, bit(6)); s(8, 8, bit(7)); s(7, 8, bit(8));
      for (let i = 9; i < 15; i++) s(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) s(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) s(8, size - 15 + i, bit(i));
      s(8, size - 8, true);
    };
    format(base, 0);
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (v << 12) | r;
      for (let i = 0; i < 18; i++) { const on = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, on); set(c, a, on); }
    }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn[y][x] && i < words.length * 8) { base[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
    let best = null, bestP = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const m = base.map((row, y) => row.map((d, x) => (fn[y][x] ? d : d !== MASKS[mask](x, y))));
      format(m, mask);
      const p = penalty(m); if (p < bestP) { bestP = p; best = m; }
    }
    return { version: v, size, modules: best };
  }
  return { encode };
})();

/* ---------------- share card: a 1080×1920 Story, drawn client-side ----------------
   Story: Instagram's own UI covers the top ~250 px and bottom ~340 px, so everything that matters sits between,
   with the call to action as a band just above the bottom safe zone. */
const QR_MAX_VERSION = 10;
const CARD = {
  story: { W: 1080, H: 1920, top: 250, bottom: 1580, cta: 316, qr: 284, pumpkin: 640, k: 1 },
};
const BADGE = { Common: [["#2f4430"], "#cdeec0"], Uncommon: [["#174652"], "#a6eef7"], Rare: [["#35286a"], "#d2c3ff"],
  Legendary: [["#ffe08a", "#ffad3a"], "#3a1d00"], Secret: [["#1d1036", "#3a1f66", "#1d1036"], "#efe3ff"] };
let sceneArtP = null;
const sceneArt = () => sceneArtP || (sceneArtP = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = CFG.scene.image; }));
function rrect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
function fitFont(x, text, weightStyle, px, family, maxW) {
  let s = px; x.font = `${weightStyle} ${s}px ${family}`;
  while (s > 12 && x.measureText(text).width > maxW) { s -= 2; x.font = `${weightStyle} ${s}px ${family}`; }
  return s;
}
function wrapLines(x, text, maxW, maxLines) {
  const parts = /\s/.test(text) ? text.split(/(\s+)/) : [...text], lines = [];
  let cur = "";
  for (const p of parts) {
    const t = cur + p;
    if (!cur || x.measureText(t.trim()).width <= maxW) { cur = t; continue; }
    lines.push(cur.trim()); cur = p.trim();
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); let l = keep[maxLines - 1]; while (l && x.measureText(l + "…").width > maxW) l = l.slice(0, -1); keep[maxLines - 1] = l + "…"; return keep; }
  return lines;
}
const DISPLAY = '"Creepster", "Luckiest Guy", system-ui, sans-serif', HEAVY = '"Luckiest Guy", system-ui, sans-serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
// The farm badge on the Story card (and so in the video): measured first (farmLayout), then drawn (drawFarm). The
// name in its script face when it has one (a CJK face at 0.86 of Creepster's size: its glyphs fill the em), the owner
// in theirs (Gochi Hand for Latin), shrunk to fit; the badge is as wide as its words need, within the card's margins.
function farmLayout(x, k, secret, W) {
  const pic = 112 * k, pad = 20 * k, gapX = 24 * k, maxText = W - 160 * k - pic - gapX - 2 * pad;
  const kicker = (secret ? "Only grows in" : "Grown in").toUpperCase(), kickerFont = `800 ${24 * k}px ${UI}`;
  const nameFam = FONTS.name ? `${FONTS.name.family}, ${DISPLAY}` : DISPLAY, nameW = FONTS.name ? String(FONTS.name.weight) : "";
  const nameSize = fitFont(x, CFG.name, nameW, (FONTS.name && /^cjk$/.test(FONTS.name.script) ? 50 : 58) * k, nameFam, maxText);
  const nameFont = `${nameW} ${nameSize}px ${nameFam}`.trim(), nameWidth = Math.min(maxText, x.measureText(CFG.name).width);
  const owner = CFG.owner && !CFG.ownerInName ? `${CFG.owner}'s patch` : "";
  const ownerFam = FONTS.owner ? `${FONTS.owner.family}, ${UI}` : `"Gochi Hand", "Segoe Print", cursive`, ownerW = FONTS.owner ? String(FONTS.owner.weight) : "400";
  const ownerSize = owner ? fitFont(x, owner, ownerW, (FONTS.owner ? 34 : 42) * k, ownerFam, maxText) : 0;
  const ownerFont = `${ownerW} ${ownerSize}px ${ownerFam}`, ownerWidth = owner ? Math.min(maxText, x.measureText(owner).width) : 0;
  x.font = kickerFont; if ("letterSpacing" in x) x.letterSpacing = `${4 * k}px`;
  const kickerWidth = x.measureText(kicker).width; if ("letterSpacing" in x) x.letterSpacing = "0px";
  const kickerH = 30 * k, nameH = Math.round(nameSize * 1.12), ownerH = owner ? Math.round(ownerSize * 1.2) : 0;
  const textW = Math.max(kickerWidth, nameWidth, ownerWidth), textH = kickerH + nameH + ownerH;
  const w = Math.min(W - 160 * k, Math.max(560 * k, pic + gapX + textW + 2 * pad)), h = Math.max(pic, textH) + 2 * pad;
  return { w, h, pic, pad, gapX, kicker, kickerFont, kickerH, name: CFG.name, nameFont, nameH, nameWidth, owner, ownerFont, ownerH, ownerWidth, textH, maxText };
}
function drawFarm(x, F, l, t, art, k) {
  x.save();
  x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 24 * k; x.shadowOffsetY = 8 * k;
  const g = x.createLinearGradient(0, t, 0, t + F.h); g.addColorStop(0, "#7d5030"); g.addColorStop(0.55, "#663f25"); g.addColorStop(1, "#56331d");
  rrect(x, l, t, F.w, F.h, 24 * k); x.fillStyle = g; x.fill();
  x.shadowColor = "transparent";
  x.save(); rrect(x, l, t, F.w, F.h, 24 * k); x.clip(); x.strokeStyle = "rgba(30,14,4,.16)"; x.lineWidth = 2 * k;
  for (let yy = t + 9 * k; yy < t + F.h; yy += 13 * k) { x.beginPath(); x.moveTo(l, yy); x.lineTo(l + F.w, yy + 6 * k); x.stroke(); }
  x.restore();
  rrect(x, l, t, F.w, F.h, 24 * k); x.strokeStyle = "#3b2210"; x.lineWidth = 4 * k; x.stroke();
  // the scene, framed like the deed's picture
  const px = l + F.pad, py = t + (F.h - F.pic) / 2;
  x.save(); rrect(x, px, py, F.pic, F.pic, 16 * k); x.clip();
  x.fillStyle = CFG.scene.palette.bg; x.fillRect(px, py, F.pic, F.pic);
  if (art) { const sc = Math.max(F.pic / art.width, F.pic / art.height) * 1.5, dw = art.width * sc, dh = art.height * sc;
    x.drawImage(art, px + (F.pic - dw) * CFG.scene.focus, py + (F.pic - dh) * 0.62, dw, dh); }
  x.restore();
  rrect(x, px, py, F.pic, F.pic, 16 * k); x.strokeStyle = "#2a1709"; x.lineWidth = 5 * k; x.stroke();
  rrect(x, px - 3 * k, py - 3 * k, F.pic + 6 * k, F.pic + 6 * k, 18 * k); x.strokeStyle = "#c9a35a"; x.lineWidth = 1.5 * k; x.stroke();
  // the words, left-aligned beside it
  const tl = px + F.pic + F.gapX; let ty = t + (F.h - F.textH) / 2;
  x.textAlign = "left"; x.textBaseline = "middle"; x.shadowColor = "rgba(40,18,4,.9)"; x.shadowBlur = 0; x.shadowOffsetY = 2 * k;
  x.font = F.kickerFont; x.fillStyle = "#f0c98f"; if ("letterSpacing" in x) x.letterSpacing = `${4 * k}px`;
  x.fillText(F.kicker, tl, ty + F.kickerH / 2, F.maxText); if ("letterSpacing" in x) x.letterSpacing = "0px";
  ty += F.kickerH;
  x.font = F.nameFont; x.fillStyle = "#ffd27a"; x.fillText(F.name, tl, ty + F.nameH / 2, F.maxText);
  const name = [Math.round(tl), Math.round(ty), Math.round(F.nameWidth), Math.round(F.nameH)];
  ty += F.nameH;
  let owner = null;
  if (F.owner) { x.font = F.ownerFont; x.fillStyle = "#fff1d6"; x.fillText(F.owner, tl, ty + F.ownerH / 2, F.maxText); owner = [Math.round(tl), Math.round(ty), Math.round(F.ownerWidth), Math.round(F.ownerH)]; }
  x.restore();
  return { name, credit: [Math.round(l), Math.round(t), Math.round(F.w), Math.round(F.h)], ...(owner ? { owner } : {}) };
}
async function drawCard(kind) {
  const c = CARD[kind], { W, H, k } = c, v = VAR.get(state.variety), secret = isSecret(v.id);
  if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`40px Creepster`), document.fonts.load(`40px "Luckiest Guy"`),
    document.fonts.load(`400 40px "Gochi Hand"`), ...(FONTS.name ? [document.fonts.load(`${FONTS.name.weight} 40px ${FONTS.name.family}`, CFG.name)] : []),
    ...(FONTS.owner && CFG.owner ? [document.fonts.load(`${FONTS.owner.weight} 40px ${FONTS.owner.family}`, `${CFG.owner}'s patch`)] : [])]).catch(() => {}), new Promise((r) => setTimeout(r, 1200))]);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), boxes = {};
  // the patch's scene, blurred and darkened
  x.fillStyle = CFG.scene.palette.bg; x.fillRect(0, 0, W, H);
  const art = await sceneArt();
  if (art) {
    const sc = Math.max(W / art.width, H / art.height), dw = art.width * sc, dh = art.height * sc;
    const dx = (W - dw) * CFG.scene.focus, dy = (H - dh) * 0.7;
    if (typeof x.filter === "string") { x.filter = "blur(26px) saturate(.9)"; x.drawImage(art, dx - 40, dy - 40, dw + 80, dh + 80); x.filter = "none"; }
    else { const t = document.createElement("canvas"); t.width = Math.round(W / 16); t.height = Math.round(H / 16); t.getContext("2d").drawImage(art, dx / 16, dy / 16, dw / 16, dh / 16); x.imageSmoothingQuality = "high"; x.drawImage(t, 0, 0, W, H); }
  }
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(6,4,14,.72)"); g.addColorStop(0.35, "rgba(6,4,14,.5)"); g.addColorStop(0.7, "rgba(6,4,14,.6)"); g.addColorStop(1, "rgba(6,4,14,.9)");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // the words under the pumpkin, measured first so the pumpkin gets whatever room is left
  const who = cleanText(state.from, MAX.from) || "I", msg = cleanText(state.msg, MAX.msg);
  const whoH = 58 * k, badgeH = 52 * k, varH = 92 * k, msgLineH = 54 * k, gap = 14 * k;
  const farm = farmLayout(x, k, secret, W), farmH = farm.h;
  const msgFont = `${CJK.test(msg) ? "" : "italic "}500 ${42 * k}px ${UI}`;
  x.font = msgFont;
  const msgLines = msg ? wrapLines(x, `“${msg}”`, W - 200, 2) : [];
  const ctaTop = c.bottom - c.cta, areaTop = c.top, areaBottom = ctaTop - 26 * k;
  const textH = farmH + gap + gap + whoH + 8 * k + badgeH + 8 * k + varH + (msgLines.length ? gap + msgLines.length * msgLineH : 0);
  const S = Math.max(300 * k, Math.min(c.pumpkin, areaBottom - areaTop - textH));
  let y = areaTop + Math.max(0, (areaBottom - areaTop - textH - S) / 2);
  const center = (text, top, h, font, color, maxW = W - 140) => {
    x.font = font; x.fillStyle = color; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, W / 2, top + h / 2, maxW);
    const w = Math.min(maxW, x.measureText(text).width); return [Math.round(W / 2 - w / 2), Math.round(top), Math.round(w), Math.round(h)];
  };
  // where it grew: the farm badge, as on the page (scene thumbnail, patch name, owner), at the top of the card
  Object.assign(boxes, drawFarm(x, farm, Math.round(W / 2 - farm.w / 2), Math.round(y), art, k));
  y += farmH + gap;
  x.shadowColor = "rgba(0,0,0,.75)"; x.shadowBlur = 14 * k; x.shadowOffsetY = 3 * k;
  // the lit pumpkin: the carving renderer drawn at full light into its own canvas, with a glow behind it
  x.shadowColor = "transparent";
  const pcx = W / 2, pcy = y + S / 2;
  g = x.createRadialGradient(pcx, pcy, 0, pcx, pcy, S * 0.78);
  if (secret) { g.addColorStop(0, "rgba(175,130,255,.55)"); g.addColorStop(0.5, "rgba(120,80,220,.2)"); g.addColorStop(1, "rgba(120,80,220,0)"); }
  else { g.addColorStop(0, "rgba(255,176,80,.5)"); g.addColorStop(0.5, "rgba(255,130,40,.18)"); g.addColorStop(1, "rgba(255,110,30,0)"); }
  x.fillStyle = g; x.fillRect(pcx - S, pcy - S, S * 2, S * 2);
  if (secret) {
    x.save(); x.strokeStyle = "rgba(190,150,255,.55)"; x.lineWidth = 3 * k; x.shadowColor = "rgba(190,150,255,.9)"; x.shadowBlur = 12 * k;
    for (const r of [0.53, 0.47]) { x.beginPath(); x.arc(pcx, pcy, S * r, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = "#d9c4ff";
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = S * 0.5, d = 5 * k; x.save(); x.translate(pcx + Math.cos(a) * r, pcy + Math.sin(a) * r); x.rotate(a); x.fillRect(-d / 2, -d * 1.4, d, d * 2.8); x.restore(); }
    x.restore();
  }
  // drawn at the card's own resolution by the page's renderer (see surfaces), lit, feathered and trimmed
  if (G) drawPumpkin(pumpkinSurface(surfaceFor(S)), x, pcx - S / 2, pcy - S / 2, S, 1, 0, 1);
  boxes.pumpkin = [Math.round(pcx - S / 2), Math.round(y), Math.round(S), Math.round(S)];
  y += S + gap;
  x.shadowColor = "rgba(0,0,0,.75)"; x.shadowBlur = 12 * k;
  boxes.who = center(secret ? `${who} grew the secret` : `${who} grew ${article(v.tier)}`, y, whoH, `650 ${46 * k}px ${UI}`, "#f4ead8");
  y += whoH + 8 * k;
  // tier badge (the Secret one gets its own purple glow)
  x.font = `800 ${28 * k}px ${UI}`; if ("letterSpacing" in x) x.letterSpacing = `${4 * k}px`;
  const tierText = v.tier.toUpperCase(), bw = x.measureText(tierText).width + 52 * k, bl = W / 2 - bw / 2;
  const [fills, ink] = BADGE[v.tier] || BADGE.Common;
  const bg = x.createLinearGradient(bl, 0, bl + bw, 0); fills.forEach((f, i) => bg.addColorStop(fills.length === 1 ? 0 : i / (fills.length - 1), f));
  x.save(); x.shadowColor = secret ? "rgba(180,140,255,.8)" : v.tier === "Legendary" ? "rgba(255,200,90,.6)" : "transparent"; x.shadowBlur = 20 * k; x.shadowOffsetY = 0;
  rrect(x, bl, y, bw, badgeH, badgeH / 2); x.fillStyle = bg; x.fill(); x.restore();
  if (secret) { rrect(x, bl, y, bw, badgeH, badgeH / 2); x.strokeStyle = "#b48cff"; x.lineWidth = 2.5 * k; x.stroke(); }
  x.save(); x.shadowColor = "transparent"; x.fillStyle = ink; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(tierText, W / 2 + 2 * k, y + badgeH / 2 + 1); x.restore();
  if ("letterSpacing" in x) x.letterSpacing = "0px";
  boxes.badge = [Math.round(bl), Math.round(y), Math.round(bw), Math.round(badgeH)];
  y += badgeH + 8 * k;
  const varSize = fitFont(x, v.name, "", 84 * k, HEAVY, W - 160);
  boxes.variety = center(v.name, y, varH, `${varSize}px ${HEAVY}`, secret ? "#e6d6ff" : "#ffd27a");
  y += varH;
  if (msgLines.length) {
    y += gap;
    const tops = msgLines.map((l, i) => center(l, y + i * msgLineH, msgLineH, msgFont, "#ffe9c4", W - 200));
    boxes.message = [Math.min(...tops.map((b) => b[0])), tops[0][1], Math.max(...tops.map((b) => b[2])), msgLines.length * msgLineH];
    y += msgLines.length * msgLineH;
  }
  // call to action: make your own patch, the campaign's address, and a QR code to it (the end screen's "Make your own
  // patch" link); if growYourOwnUrl isn't a usable link, the old one: carve one back, the patch's address and its QR
  x.shadowColor = "transparent";
  const bandL = 56 * k, bandW = W - 2 * bandL;
  rrect(x, bandL, ctaTop, bandW, c.cta, 40 * k); x.fillStyle = "rgba(14,10,24,.84)"; x.fill();
  x.strokeStyle = "rgba(255,210,122,.55)"; x.lineWidth = 2.5 * k; x.stroke();
  boxes.cta = [Math.round(bandL), Math.round(ctaTop), Math.round(bandW), Math.round(c.cta)];
  const q = c.qr, qx = bandL + bandW - q - (c.cta - q) / 2, qy = ctaTop + (c.cta - q) / 2;
  // only a code phones scan easily (version <= 10, error correction M)
  let qrUrl = growOwnUrl(), code = qrUrl && QR.encode(qrUrl);
  const own = !!code && code.version <= QR_MAX_VERSION && Math.floor(q / (code.size + 6)) >= 4;
  if (!own) { qrUrl = patchRoot(); code = QR.encode(qrUrl); }
  x.fillStyle = "#fff"; rrect(x, qx, qy, q, q, 18 * k); x.fill();
  if (code) {
    const ms = Math.max(1, Math.floor(q / (code.size + 6))), off0x = Math.round(qx + (q - ms * code.size) / 2), off0y = Math.round(qy + (q - ms * code.size) / 2);
    x.fillStyle = "#000";
    code.modules.forEach((row, r) => row.forEach((on, col) => { if (on) x.fillRect(off0x + col * ms, off0y + r * ms, ms, ms); }));
  }
  boxes.qr = [Math.round(qx), Math.round(qy), q, q];
  const tl = bandL + 44 * k, tw = qx - tl - 30 * k;
  x.textAlign = "left"; x.textBaseline = "alphabetic"; x.fillStyle = "#ffe3a0";
  const head = own ? "Make your own patch →" : "Carve one back →", host = own ? new URL(qrUrl).host : location.host;
  const ctaSize = fitFont(x, head, "", 58 * k, HEAVY, tw);
  const lineY = ctaTop + c.cta / 2;
  x.fillText(head, tl, lineY - 18 * k);
  x.fillStyle = "#f4ead8"; fitFont(x, host, "600", 32 * k, "ui-monospace, SFMono-Regular, Menlo, monospace", tw);
  x.fillText(host, tl, lineY + 30 * k);
  x.fillStyle = "rgba(244,234,216,.7)"; x.font = `500 ${26 * k}px ${UI}`;
  x.fillText("Scan to grow your own", tl, lineY + 76 * k, tw);
  boxes.ctaText = [Math.round(tl), Math.round(lineY - 18 * k - ctaSize), Math.round(tw), Math.round(ctaSize + 100 * k)];
  return { canvas: cv, boxes, qr: { url: qrUrl, own, version: code && code.version } };
}
// The Story card is drawn ahead (as soon as the pumpkin is lit, and again after the name / message change), so Share to
// Story opens the share sheet straight from the tap: Safari only allows navigator.share right after a gesture.
let cardCache = {}, prepTimer = 0;
const cardKey = () => JSON.stringify([state.variety, state.pseed, snapshot(), state.from, state.msg]);
function cardFile(kind) {
  const key = cardKey(), hit = cardCache[kind];
  if (hit && hit.key === key) return hit.p;
  const p = (async () => {
    const url = await buildLink(); if (!url) return null;
    const r = await drawCard(kind);
    const blob = await new Promise((res) => r.canvas.toBlob(res, "image/png"));
    return blob && { url, file: new File([blob], `pumpkin-${state.variety}-${kind}.png`, { type: "image/png" }) };
  })().catch(() => null);
  cardCache[kind] = { key, p, ready: false };
  p.then(() => { if (cardCache[kind] && cardCache[kind].p === p) cardCache[kind].ready = true; });
  return p;
}
const storyReady = () => !!(cardCache.story && cardCache.story.key === cardKey() && cardCache.story.ready);
function prepCards(ms = 600) {
  clearTimeout(prepTimer);
  prepTimer = setTimeout(() => { if (document.body.classList.contains("lit") && G && mode === "carve") cardFile("story"); }, ms);
}
function saveFile(file) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.hidden = true;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
// one line over the bottom of the screen for a few seconds (never in the layout)
let toastTimer = 0;
function toast(text, ms = 4200) {
  const t = $("toast"); clearTimeout(toastTimer);
  t.textContent = text || ""; t.classList.toggle("on", !!text);
  if (text) toastTimer = setTimeout(() => t.classList.remove("on"), ms);
}
// phones share files through the system sheet; desktops (even ones with Web Share) download them
const isPhone = () => matchMedia("(pointer: coarse)").matches;
const canShareFile = (f) => { try { return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] }); } catch (_) { return false; } };
// Share to Story, one tap: the 9:16 picture (drawn ahead) goes to the share sheet on a phone, with the link copied
// first for a link sticker; on a desktop it downloads straight away.
async function shareStory() {
  const btn = $("story");
  if (btn.getAttribute("aria-busy") === "true") return;
  clearSend(); btn.setAttribute("aria-busy", "true");
  try {
    const c = await cardFile("story");
    if (!c) { if (!(await makeLink())) return; toast("Sorry, this browser can't draw the picture."); return; }
    Sound.send();
    // first: the link sticker needs it, and sharing ends the gesture. The link row only appears if copying failed
    // (it would push the buttons down while the share sheet is up)
    const copied = await copyText(c.url); if (!copied) showLink(c.url);
    if (isPhone() && canShareFile(c.file)) {
      try { await navigator.share({ files: [c.file] }); toast(copied ? "Link copied. Add it as a link sticker." : "Shared! Copy your link below for a link sticker."); return; }
      catch (e) { if (e && e.name === "AbortError") { toast(copied ? "Link copied. Add it as a link sticker." : ""); return; } }
    }
    saveFile(c.file);
    toast(copied ? "Story picture saved and link copied. Add it as a link sticker." : "Story picture saved. Copy your link below for a link sticker.");
  } finally { btn.removeAttribute("aria-busy"); }
}
$("story").onclick = shareStory;

function resetLight() { anim = null; light = 0; room = 0; dirty = true; spill.style.opacity = 0; document.body.classList.remove("lit", "dark", "ignited"); }
function setCarveHead(v) {
  setTier($("carveTier"), v.tier);
  $("carveVariety").textContent = v.name;
  $("carveSig").hidden = v.id !== CFG.signature;
}
function resetCarving() {
  state.strokes = []; state.texts = []; state.from = ""; state.msg = ""; undoStack = []; active = null; gesture = null; pointers.clear(); select(-1);
  fromIn.value = ""; msgIn.value = ""; textIn.value = ""; syncCounts(); syncTextCount();
}
function startCarve(p) {
  mode = "carve"; show("carve"); showNote("");
  resetLight();
  $("carvePanel").hidden = false; $("viewPanel").hidden = true; $("viewHead").hidden = true; $("carveHead").hidden = false;
  canvas.setAttribute("aria-label", "Pumpkin. Drag on it to carve.");
  document.title = CFG.name;
  resetCarving(); clearSend(); syncButtons(); setTab("carve");
  setCarveHead(VAR.get(p.variety));
  setPumpkin(p.variety, p.pseed).then(() => resize());
  requestAnimationFrame(resize);
  scrollTo({ top: 0 });
}
function showLanding(note) {
  mode = "idle"; resetLight(); show("landing"); showNote(note || "");
  document.title = CFG.name;
  resetCarving();
}
async function enterView(data) {
  mode = "view"; show("view"); showNote(""); resetLight(); select(-1);
  room = 1; document.body.classList.add("dark");
  $("carvePanel").hidden = true; $("viewPanel").hidden = false; $("carveHead").hidden = true;
  state.strokes = data.strokes; state.texts = data.texts; state.from = data.from; state.msg = data.msg;
  const v = VAR.get(data.variety);
  // the owner's showcase opens like any link; it is signed by the owner when the link itself isn't
  if (!data.from && SHOWCASE && CFG.owner && location.hash === "#p=" + SHOWCASE.frag) data = { ...data, from: CFG.owner };
  const head = $("viewHead"); head.textContent = ""; head.hidden = false;
  const tier = document.createElement("span"); tier.className = "tier"; setTier(tier, v.tier);
  const who = document.createElement("span"); who.className = "name"; who.textContent = data.from || "Someone";
  head.append(who, ` grew ${article(v.tier)} `, tier, ` ${v.name} and carved it for you`);
  document.title = `${data.from || "Someone"} carved you a pumpkin 🎃`;
  const m = $("msgLine"); m.textContent = data.msg ? `“${data.msg}”` : ""; m.hidden = !data.msg; m.classList.toggle("cjk-text", CJK.test(data.msg || ""));
  $("credit").href = patchRoot(); // the patch itself, no pumpkin
  $("farmKicker").textContent = isSecret(v.id) ? "Only grows in" : "Grown in";
  $("credit").setAttribute("aria-label", `${isSecret(v.id) ? "Only grows in" : "Grown in"} ${CREDIT}. Visit this patch`);
  const words = data.texts.map((t) => t.t).join(", ");
  canvas.setAttribute("aria-label", `A carved ${v.name} jack-o'-lantern` + (words ? `. Carved words: ${words}` : "") + (data.msg ? ". Message: " + data.msg : ""));
  requestAnimationFrame(resize);
  if (data.stencil === "owner") await ownerReady;
  // a v4 link's stencil is cut again for this same pumpkin, under the hand strokes
  if (!(await setPumpkin(data.variety, data.pseed, (sh) => { if (data.stencil) state.strokes = [...stencilStrokes(data.stencil, sh), ...data.strokes]; }))) return;
  resize();
  setLight(1, { delay: 800, dur: 1500 });
  setTimeout(() => { if (mode === "view") { document.body.classList.add("ignited"); Sound.candle(); } }, 900);
}
$("carveBack").onclick = () => {
  Sound.unlock();
  history.pushState(null, "", location.pathname + cleanSearch());
  showLanding();
  scrollTo({ top: 0 });
};
async function route() {
  const m = /^#p=(.*)$/s.exec(location.hash);
  if (!m) { if (mode === "view") showLanding(); return; }
  try { await enterView(await decodeFragment(m[1])); }
  catch (e) {
    history.replaceState(null, "", location.pathname + location.search);
    showLanding(/foreign secret/.test(e && e.message) ? "That secret pumpkin only grows in another patch. Grow one here!" : "This pumpkin got squashed on the way. Grow a fresh one!");
  }
}
addEventListener("hashchange", route);
addEventListener("popstate", route);

/* ---- endscreen ---- what a visitor sees after lighting: Send to a friend (the one primary action), then Share
   to Story (one tap, see shareStory) and Save video side by side, Grow another (back to planting in this patch,
   their name kept), Blow it out, then a quieter "make your own patch" card. Self-contained: it reuses the page's own
   functions and ids. The video records on its own button: a ring fills over its icon, then the same button turns
   into Share video (phones: the share sheet needs a fresh tap) or the clip downloads (desktop). ---- */
const ES = (() => {
  const vBtn = $("esVideo"), vLabel = $("esVideoLabel"), ring = $("esRing");
  const V = { W: 1080, H: 1920, MS: 5000, RING: 119.38 };
  const LABEL = { idle: "Save video", prep: "Preparing…", ready: "Share video", saved: "Saved ✓" };

  // ---- video: dark -> match strike -> candle catches -> glow + flicker -> words -> the call to action ----
  function pickMime(audio) {
    if (typeof MediaRecorder !== "function" || typeof MediaRecorder.isTypeSupported !== "function") return null;
    const list = audio ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (_) { /* next */ } }
    return null;
  }
  const canVideo = typeof HTMLCanvasElement === "function" && typeof HTMLCanvasElement.prototype.captureStream === "function" && typeof MediaStream === "function" && !!pickMime(false);
  vBtn.hidden = !canVideo;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const ease = (p) => 1 - Math.pow(1 - clamp01(p), 3);
  const inOut = (p) => { p = clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  const span = (t, a, b) => clamp01((t - a) / (b - a));
  // the page's candle flicker, without the reduced-motion freeze (the clip always flickers; the page UI stays calm)
  const flick = (t) => { const s = t / 1000; return 0.86 + 0.08 * Math.sin(s * 2.3) + 0.06 * Math.sin(s * 6.1 + 1.3) + 0.045 * Math.sin(s * 13.7 + 0.4) + 0.03 * Math.sin(s * 23.1 + 2.2); };
  // the same catch as Light it: a sputter, then a steady glow
  const lightAt = (t) => { const p = span(t, 1900, 2900); let v = ease(p); if (p > 0 && p < 0.75) v *= 0.55 + 0.45 * Math.abs(Math.sin(p * 26 + Math.sin(p * 61))); return p >= 1 ? 1 : v; };

  async function assets(url) {
    const r = await drawCard("story"); // the Story card: the words, badge and call to action are cut from it
    const card = r.canvas, B = r.boxes, W = V.W, H = V.H, pb = B.pumpkin;
    // the backdrop, by the card's own recipe (scene blurred, dark gradient), without the pumpkin's glow
    const bg = document.createElement("canvas"); bg.width = W; bg.height = H;
    const x = bg.getContext("2d");
    x.fillStyle = CFG.scene.palette.bg; x.fillRect(0, 0, W, H);
    const art = await sceneArt();
    if (art) {
      const sc = Math.max(W / art.width, H / art.height), dw = art.width * sc, dh = art.height * sc, dx = (W - dw) * CFG.scene.focus, dy = (H - dh) * 0.7;
      if (typeof x.filter === "string") { x.filter = "blur(26px) saturate(.9)"; x.drawImage(art, dx - 40, dy - 40, dw + 80, dh + 80); x.filter = "none"; }
      else { const t = document.createElement("canvas"); t.width = Math.round(W / 16); t.height = Math.round(H / 16); t.getContext("2d").drawImage(art, dx / 16, dy / 16, dw / 16, dh / 16); x.imageSmoothingQuality = "high"; x.drawImage(t, 0, 0, W, H); }
    }
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(6,4,14,.72)"); g.addColorStop(0.35, "rgba(6,4,14,.5)"); g.addColorStop(0.7, "rgba(6,4,14,.6)"); g.addColorStop(1, "rgba(6,4,14,.9)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // full-width bands of the finished card round each group of words, feathered top and bottom so they melt in
    const band = (top, bottom, at, dur, rise = 0) => {
      top = Math.max(0, Math.floor(top)); bottom = Math.min(H, Math.ceil(bottom));
      const h = Math.max(2, bottom - top), c = document.createElement("canvas"); c.width = W; c.height = h;
      const cx = c.getContext("2d"); cx.drawImage(card, 0, top, W, h, 0, 0, W, h);
      const f = Math.min(16, h / 4) / h, fg = cx.createLinearGradient(0, 0, 0, h);
      fg.addColorStop(0, "rgba(0,0,0,0)"); fg.addColorStop(f, "#000"); fg.addColorStop(1 - f, "#000"); fg.addColorStop(1, "rgba(0,0,0,0)");
      cx.globalCompositeOperation = "destination-in"; cx.fillStyle = fg; cx.fillRect(0, 0, W, h);
      return { c, top, at, dur, rise };
    };
    const below = pb[1] + pb[3], varEnd = B.variety[1] + B.variety[3], ctaTop = B.cta[1], ctaEnd = B.cta[1] + B.cta[3];
    const lastWords = (B.message || B.variety), wordsEnd = lastWords[1] + lastWords[3];
    const bands = [
      band(B.credit[1] - 30, pb[1] + 16, 2600, 500),                   // the farm badge (where it grew)
      band(below - 16, varEnd + 8, 2950, 500),                        // "… grew a", the badge, the variety
      band(varEnd + 8, Math.min(wordsEnd + 24, ctaTop - 28), 3300, 500), // the message
      band(ctaTop - 26, ctaEnd + 26, 3850, 550, 28),                  // Make your own patch · the campaign's host · QR
    ];
    const img = (src) => new Promise((res) => { if (!src) { res(null); return; } const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const mk = CFG.match || {}, [unlit, lit, flameImg, box] = await Promise.all([img(mk.unlit), img(mk.lit), img(mk.flame), img(mk.box)]);
    const match = unlit && lit && flameImg ? { unlit, lit, flame: flameImg, box } : null;
    return { bg, bands, pb, match, sf: G ? pumpkinSurface(surfaceFor(pb[2])) : null, secret: isSecret(state.variety), sparks: Array.from({ length: 16 }, (_, i) => ({ a: -Math.PI * (0.25 + 0.6 * ((i * 37) % 16) / 16), v: 520 + ((i * 53) % 16) * 38, r: 3 + (i % 4) })) };
  }

  // Where the stick lies in each 768-px match sprite (head centre -> butt end), and where the lit one's own flame sits,
  // so the unlit and lit sprites land on the same line and the flame sprite covers the painted one.
  const MATCH = { unlit: { head: [115, 115], tail: [698, 690] }, lit: { head: [150, 295], tail: [678, 712], flameBase: [155, 282], flameH: 250 }, len: 360 };
  function stick(x, img, m, tip, ang, alpha) {
    if (alpha <= 0) return 1;
    const u = img.width / 768, [hx, hy] = m.head, [tx, ty] = m.tail, k = MATCH.len / Math.hypot(tx - hx, ty - hy);
    x.save(); x.globalAlpha *= alpha;
    x.translate(tip[0], tip[1]); x.rotate(ang - Math.atan2(ty - hy, tx - hx)); x.scale(k / u, k / u); x.translate(-hx * u, -hy * u);
    x.drawImage(img, 0, 0); x.restore();
    return k;
  }
  function drawMatch(x, M, tip, ang, t, flame, f) {
    const swap = span(t, 990, 1090); // struck: the red head chars as the lit sprite fades in
    stick(x, M.unlit, MATCH.unlit, tip, ang, 1 - swap);
    const k = stick(x, M.lit, MATCH.lit, tip, ang, swap);
    if (flame <= 0 || swap <= 0) return;
    // the flame sprite over the painted one, breathing with the candle flicker and swaying a little
    const L = MATCH.lit, rot = ang - Math.atan2(L.tail[1] - L.head[1], L.tail[0] - L.head[0]);
    const bx = (L.flameBase[0] - L.head[0]) * k, by = (L.flameBase[1] - L.head[1]) * k;
    const base = [tip[0] + bx * Math.cos(rot) - by * Math.sin(rot), tip[1] + bx * Math.sin(rot) + by * Math.cos(rot)];
    const s = t / 1000, h = L.flameH * k * 1.16 * (0.4 + 0.6 * flame) * (0.95 + 0.06 * Math.sin(s * 9.3) + 0.03 * Math.sin(s * 23.7 + 1.1) + 0.12 * (f - 0.86));
    const w = h * M.flame.width / M.flame.height;
    x.save(); x.globalAlpha *= swap; x.translate(base[0], base[1] + h * 0.07); x.rotate(0.05 * Math.sin(s * 3.1) + 0.03 * Math.sin(s * 7.7));
    x.drawImage(M.flame, -w / 2, -h, w, h); x.restore();
  }

  function drawFrame(x, A, t) {
    const { W, H } = V, [px, py, S] = A.pb, cx = px + S / 2, cy = py + S / 2, lv = lightAt(t), f = flick(t);
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over"; x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(A.bg, 0, 0);
    // the pumpkin's glow (the card's own gradient, scaled by the light)
    if (lv > 0) {
      x.globalAlpha = lv;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, S * 0.78);
      if (A.secret) { g.addColorStop(0, "rgba(175,130,255,.55)"); g.addColorStop(0.5, "rgba(120,80,220,.2)"); g.addColorStop(1, "rgba(120,80,220,0)"); }
      else { g.addColorStop(0, "rgba(255,176,80,.5)"); g.addColorStop(0.5, "rgba(255,130,40,.18)"); g.addColorStop(1, "rgba(255,110,30,0)"); }
      x.fillStyle = g; x.fillRect(cx - S, cy - S, S * 2, S * 2);
      if (A.secret) {
        x.save(); x.strokeStyle = "rgba(190,150,255,.55)"; x.lineWidth = 3; x.shadowColor = "rgba(190,150,255,.9)"; x.shadowBlur = 12;
        for (const r of [0.53, 0.47]) { x.beginPath(); x.arc(cx, cy, S * r, 0, Math.PI * 2); x.stroke(); }
        x.fillStyle = "#d9c4ff";
        for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; x.save(); x.translate(cx + Math.cos(a) * S * 0.5, cy + Math.sin(a) * S * 0.5); x.rotate(a); x.fillRect(-2.5, -7, 5, 14); x.restore(); }
        x.restore();
      }
      x.globalAlpha = 1;
    }
    // the pumpkin itself, from the carving renderer (unlit -> lit), feathered and trimmed like the card's
    // drawn at the clip's resolution from the original art (the layers are built once per clip, in assets)
    if (A.sf) drawPumpkin(A.sf, x, px, py, S, lv, 1 - lv, f);
    // the words and the call to action fade in once it glows
    for (const b of A.bands) {
      const p = span(t, b.at, b.at + b.dur); if (p <= 0) continue;
      x.globalAlpha = ease(p); x.drawImage(b.c, 0, b.top + b.rise * (1 - ease(p)));
    }
    x.globalAlpha = 1;
    // the dark: black, opening to a dim room, then lifting as the candle takes
    const dark = t < 450 ? 1 - 0.22 * ease(t / 450) : 0.78 * (1 - inOut(span(t, 1900, 3000)));
    if (dark > 0) { x.fillStyle = `rgba(0,0,0,${dark.toFixed(3)})`; x.fillRect(0, 0, W, H); }
    // the match: in from the bottom right, struck, carried to the pumpkin, then away
    if (t >= 450 && t < 2750) {
      const strike = [cx + S * 0.36, cy + S * 0.42], inside = [cx + S * 0.03, cy + S * 0.14], enter = [W + 90, cy + S * 0.95], gone = [W + 140, H * 0.92];
      const lerp = (a, b, p) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p];
      let tip;
      if (t < 950) tip = lerp(enter, strike, ease(span(t, 450, 950)));
      else if (t < 1060) { const p = span(t, 950, 1060); tip = [strike[0] - 52 * Math.sin(p * Math.PI) - 10 * p, strike[1] - 22 * Math.sin(p * Math.PI)]; }
      else if (t < 1350) tip = [strike[0] - 10, strike[1] + 4 * Math.sin(t / 90)];
      else if (t < 1850) tip = lerp([strike[0] - 10, strike[1]], inside, inOut(span(t, 1350, 1850)));
      else if (t < 2100) tip = inside;
      else tip = lerp(inside, gone, inOut(span(t, 2100, 2750)));
      const alpha = 1 - span(t, 2350, 2750), flame = t < 1000 ? 0 : ease(span(t, 1000, 1160)) * (0.88 + 0.22 * (f - 0.72) / 0.28);
      x.save(); x.globalAlpha = alpha;
      // the matchbox the match is struck on: in with the match, gone soon after the strike
      if (A.match && A.match.box && t < 1700) {
        const bA = ease(span(t, 520, 860)) * (1 - span(t, 1350, 1700)), bw = 250, bh = bw * A.match.box.height / A.match.box.width;
        if (bA > 0) { x.save(); x.globalAlpha = alpha * bA; x.translate(strike[0] + 34, strike[1] + bh * 0.42); x.rotate(-0.2); x.drawImage(A.match.box, -bw / 2, -bh * 0.12, bw, bh); x.restore(); }
      }
      if (flame > 0) {
        // the flame lights the room round it
        x.globalCompositeOperation = "lighter";
        const h = x.createRadialGradient(tip[0], tip[1] - 30, 0, tip[0], tip[1] - 30, 420);
        h.addColorStop(0, `rgba(255,170,70,${(0.42 * flame).toFixed(3)})`); h.addColorStop(0.45, `rgba(255,120,30,${(0.12 * flame).toFixed(3)})`); h.addColorStop(1, "rgba(255,110,30,0)");
        x.fillStyle = h; x.fillRect(tip[0] - 420, tip[1] - 450, 840, 840);
        x.globalCompositeOperation = "source-over";
      }
      // the stick, angled down to the right: the sticker match (unlit, then struck and lit, its flame flickering),
      // or a drawn one when the art is missing
      const ang = 0.72;
      if (A.match) drawMatch(x, A.match, tip, ang, t, flame, f);
      else {
        const len = 330, tail = [tip[0] + Math.cos(ang) * len, tip[1] + Math.sin(ang) * len];
        const sg = x.createLinearGradient(tip[0], tip[1], tail[0], tail[1]);
        sg.addColorStop(0, t > 1000 ? "#3b2416" : "#d7b07a"); sg.addColorStop(0.12, "#d7b07a"); sg.addColorStop(1, "#b98a52");
        x.strokeStyle = sg; x.lineWidth = 15; x.lineCap = "round";
        x.beginPath(); x.moveTo(tip[0], tip[1]); x.lineTo(tail[0], tail[1]); x.stroke();
        x.fillStyle = t > 1000 ? "#2a120a" : "#9b2a16";
        x.beginPath(); x.ellipse(tip[0], tip[1], 14, 19, ang + Math.PI / 2, 0, Math.PI * 2); x.fill();
        if (flame > 0) {
          const fh = 92 * flame, fw = 30 * flame, fx = tip[0], fy = tip[1] - 6;
          const fg = x.createRadialGradient(fx, fy - fh * 0.28, 0, fx, fy - fh * 0.35, fh * 0.75);
          fg.addColorStop(0, "#fffbea"); fg.addColorStop(0.3, "#ffe08a"); fg.addColorStop(0.65, "#ff9a2a"); fg.addColorStop(1, "rgba(255,90,0,0)");
          x.fillStyle = fg; x.beginPath(); x.moveTo(fx, fy - fh);
          x.bezierCurveTo(fx + fw * 0.35, fy - fh * 0.6, fx + fw, fy - fh * 0.2, fx, fy + 6);
          x.bezierCurveTo(fx - fw, fy - fh * 0.2, fx - fw * 0.35, fy - fh * 0.6, fx, fy - fh); x.fill();
        }
      }
      // the strike's sparks
      if (t >= 1000 && t < 1500) {
        const s = (t - 1000) / 1000;
        x.fillStyle = "#ffd98a";
        for (const sp of A.sparks) {
          const d = sp.v * s, sx = strike[0] - 10 + Math.cos(sp.a) * d, syy = strike[1] + Math.sin(sp.a) * d + 900 * s * s;
          x.globalAlpha = alpha * (1 - s * 2); x.beginPath(); x.arc(sx, syy, sp.r, 0, Math.PI * 2); x.fill();
        }
      }
      x.restore();
    }
  }

  // ---- record, then share or save ----
  let job = null, vid = null; // job: the recording in flight; vid: { key, file, webm, url } of the last finished clip
  // while recording, Story waits (both draw big canvases); the video button stays pressable but ignores taps
  const busy = (on) => { vBtn.setAttribute("aria-busy", String(on)); $("story").disabled = on; };
  function setVideo(s, label) {
    vBtn.dataset.state = s; vLabel.textContent = label || LABEL[s] || LABEL.idle;
    if (s !== "rec" && s !== "prep") ring.style.strokeDashoffset = V.RING;
  }
  function progress(p) {
    p = clamp01(p); if (reduced.matches) p = Math.floor(p * 10) / 10; // calm: the ring steps instead of sweeping
    ring.style.strokeDashoffset = (V.RING * (1 - p)).toFixed(2);
    const left = Math.max(1, Math.ceil((V.MS / 1000) * (1 - p)));
    const label = `Recording… ${left} s`; if (vLabel.textContent !== label) vLabel.textContent = label;
  }
  const savedMsg = () => (vid.webm ? "Saved as WebM. Some apps may not open it." : "Video saved.");
  function cancel() { job = null; vid = null; setVideo("idle"); busy(false); }
  // the name / message changed after a clip was made: that clip is out of date
  const stale = () => { if (!job && vid && vid.key !== cardKey()) { vid = null; setVideo("idle"); } };
  fromIn.addEventListener("input", stale); msgIn.addEventListener("input", stale);

  async function record() {
    const token = {}; job = token; busy(true);
    setVideo("prep");
    const key = cardKey();
    // the candle's sound, made inside this tap (so the browser lets it run) and sent only into the clip
    let actx = null, dest = null, eng = null;
    if (!Sound.state().muted) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC(); dest = actx.createMediaStreamDestination();
        eng = createAudio(actx, { theme: CFG.scene.id, event: null, masterGain: 0.9 });
        eng.master.disconnect(); eng.master.connect(dest);
      } catch (_) { try { if (actx) actx.close(); } catch (__) { /* gone */ } actx = null; dest = null; eng = null; }
    }
    let cv = null, rec = null, tracks = [];
    try {
      const url = await buildLink();
      if (!url) throw new Error("no link");
      const A = await assets(url);
      if (job !== token) return;
      cv = document.createElement("canvas"); cv.width = V.W; cv.height = V.H; cv.className = "es-rec"; cv.setAttribute("aria-hidden", "true");
      document.body.append(cv);
      const x = cv.getContext("2d");
      drawFrame(x, A, 0);
      let mime = pickMime(!!dest);
      if (!mime && dest) { mime = pickMime(false); dest = null; }
      tracks = cv.captureStream(30).getVideoTracks();
      if (dest) tracks.push(...dest.stream.getAudioTracks());
      const stream = new MediaStream(tracks);
      try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }); } catch (_) { rec = new MediaRecorder(stream); }
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error("recorder")); });
      rec.start(250);
      if (eng && actx) { const t = actx.currentTime; eng.at(t + 1.0, () => eng.fx.light()); eng.at(t + 1.9, () => eng.fx.candle()); }
      setVideo("rec"); progress(0);
      const t0 = performance.now();
      await new Promise((res) => {
        const step = () => {
          if (job !== token) { res(); return; }
          const t = performance.now() - t0;
          drawFrame(x, A, Math.min(t, V.MS)); progress(t / V.MS);
          if (t >= V.MS + 80) { res(); return; } // hold the last frame a moment so it is captured
          if (document.hidden) setTimeout(step, 33); else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      rec.stop(); await stopped;
      if (job !== token) return;
      const type = (rec.mimeType || mime || "video/webm").split(";")[0].trim() || "video/webm";
      const webm = !/mp4/i.test(type);
      vid = { key, webm, url, file: new File(chunks, `pumpkin-${state.variety}.${webm ? "webm" : "mp4"}`, { type }) };
      job = null; busy(false);
      // phones: the share sheet needs a fresh tap, so the same button becomes Share video; desktops download it now
      if (isPhone() && canShareFile(vid.file)) { setVideo("ready"); toast(vid.webm ? "Your video is ready. It's WebM, so some apps may not open it. Tap Share video." : "Your video is ready. Tap Share video."); }
      else { saveFile(vid.file); setVideo("saved"); toast(savedMsg()); }
    } catch (_) {
      if (job === token) { job = null; busy(false); setVideo("idle"); toast("Sorry, this browser couldn't record the video. Share to Story still works."); }
    } finally {
      try { if (rec && rec.state !== "inactive") rec.stop(); } catch (_) { /* done */ }
      for (const tr of tracks) { try { tr.stop(); } catch (_) { /* done */ } }
      if (cv) cv.remove();
      if (actx) setTimeout(() => { try { actx.close(); } catch (_) { /* done */ } }, 300);
    }
  }
  async function shareVideo() {
    clearSend();
    const copied = await copyText(vid.url); if (!copied) showLink(vid.url); // first: sharing ends the gesture
    try {
      await navigator.share({ files: [vid.file] });
      toast((vid.webm ? "Shared as WebM. Some apps may not open it." : "Shared!") + (copied ? " Link copied. Add it as a link sticker." : ""));
    } catch (e) {
      if (e && e.name === "AbortError") { toast(copied ? "Link copied. Add it as a link sticker." : ""); return; }
      saveFile(vid.file); setVideo("saved"); toast(savedMsg());
    }
  }
  vBtn.onclick = () => {
    Sound.unlock();
    if (job) return;
    if (vid && vid.key === cardKey()) { if (vBtn.dataset.state === "ready" && canShareFile(vid.file)) shareVideo(); else { saveFile(vid.file); toast(savedMsg()); } return; }
    vid = null; record();
  };

  // ---- Grow another: the same patch, from the plant step, with their name kept ----
  let keepFrom = "";
  $("esAgain").onclick = () => {
    keepFrom = cleanText(fromIn.value, MAX.from);
    cancel(); toast("");
    resetLight(); clearSend();
    startGrow();
  };
  const carveFresh = startCarve;
  startCarve = (p) => { carveFresh(p); if (keepFrom) { fromIn.value = keepFrom; state.from = keepFrom; syncCounts(); } };
  $("unlight").addEventListener("click", () => { cancel(); toast(""); });
  // after Light it, bring the whole action group (Send + the two secondaries) on screen, not just Send
  $("light").addEventListener("click", () => requestAnimationFrame(() => requestAnimationFrame(() =>
    $("esMore").scrollIntoView({ block: "nearest", behavior: reduced.matches ? "auto" : "smooth" }))));

  // ---- Make your own patch: the config's growYourOwnUrl, tagged with where the visitor came from ----
  const ownUrl = growOwnUrl() || "https://vibehost.com/";
  $("esOwnBtn").href = ownUrl; $("growOwn").href = ownUrl;

  // test hook (read-only): the clip's frames at the given times (ms), as PNG data URLs scaled to width w
  async function frames(times, w = 360) {
    const url = await buildLink(); if (!url) return null;
    const A = await assets(url), cv = document.createElement("canvas"); cv.width = V.W; cv.height = V.H;
    const x = cv.getContext("2d"), o = document.createElement("canvas"); o.width = w; o.height = Math.round(w * V.H / V.W);
    const ox = o.getContext("2d"); ox.imageSmoothingQuality = "high";
    return times.map((t) => { drawFrame(x, A, t); ox.clearRect(0, 0, o.width, o.height); ox.drawImage(cv, 0, 0, o.width, o.height); return { t, png: o.toDataURL("image/png"), match: !!A.match }; });
  }
  return Object.freeze({ pickMime, canVideo, ownUrl, frames, video: () => vid && { file: vid.file, webm: vid.webm, type: vid.file.type, size: vid.file.size }, recording: () => !!job });
})();
window.__pumpkinEnd = ES;
/* ---- /endscreen ---- */

// Opening a link or reloading always starts at the top of the screen, never at a remembered scroll position.
try { history.scrollRestoration = "manual"; } catch (_) {}
// Test hooks (read-only helpers, plus forceNext and harvest, which only tests call: they pick or draw the next harvest).
window.__pumpkinPatch = Object.freeze({
  config: CFG,
  // the quality tier ("lite" on weak devices) and why; whether this grow is a quicker repeat run
  storyReady: () => storyReady(),
  quality: () => ({ lite: QUALITY.lite, forced: QUALITY.forced, signals: QUALITY.signals.slice(), frameMs: QUALITY.frameMs, reason: QUALITY.reason }),
  fastGrow: () => grow.fast,
  computeWeights,
  rollVariety,
  rollMany(n, opts, byId) {
    const w = computeWeights(opts || {}), counts = {};
    if (!byId) { for (const t of CFG.tiers) counts[t.id] = 0; if (SECRET) counts[SECRET.tier] = 0; }
    for (let i = 0; i < n; i++) { const id = rollVariety(w), k = byId ? id : VAR.get(id).tier; counts[k] = (counts[k] || 0) + 1; }
    return counts;
  },
  boltBoxes: (n) => (boltProbe ? boltProbe(n) : null),
  forceNext(id) { forcedNext = VAR.has(id) ? id : null; return forcedNext; },
  // a fresh harvest exactly as Plant draws it (plain roll + this browser's luck), without growing it; luckKey holds that luck
  harvest: () => newPumpkin().variety,
  luckKey: LUCK_KEY,
  look() { return G && { variety: state.variety, pseed: state.pseed, scale: G.look.scale, hue: G.look.hue, flip: G.look.flip, strokes: JSON.stringify(state.strokes.map((s) => [s.size, s.points])), texts: JSON.stringify(state.texts.map((t) => [t.t, r3(t.x), r3(t.y), r3(t.s), Math.round(t.r)])) }; },
  body() { return G && { ...G.sh }; },
  audio: Sound.state,
  renderAudio,
  themes: () => Object.keys(THEMES),
  // the share card exactly as Share to Story draws it (plus where each part landed, for the safe-zone checks)
  async shareCard(kind = "story") {
    if (!has(CARD, kind)) return null; // the Story card is the only one (the square post was dropped)
    const link = await buildLink(); if (!link) return null;
    const r = await drawCard(kind);
    return { dataUrl: r.canvas.toDataURL("image/png"), w: r.canvas.width, h: r.canvas.height, boxes: r.boxes, link, root: patchRoot(), own: growOwnUrl(), qrUrl: r.qr.url, qrOwn: r.qr.own, qrVersion: r.qr.version };
  },
  // the owner's showcase as the page draws it: every cut (its stencil re-fitted to its own pumpkin, plus hand strokes)
  showcaseStrokes: async () => { await ownerReady; return SHOWCASE ? ownerFull.length : 0; },
  // where the open soil starts on screen (viewport y), the line the plot and the showcase stand on
  groundLine: () => groundLine(),
  // decode any fragment exactly as opening it would (the validated object), or the error
  decode: async (frag) => { try { return await decodeFragment(frag); } catch (e) { return { error: String(e.message) }; } },
  // which icons are sticker art and which are still SVG fallbacks (and what each name renders as)
  icons: () => ({ art: Object.keys(UI_ART), names: Object.keys(ICONS), kinds: Object.fromEntries(Object.keys(ICONS).map((n) => [n, uiIcon(n).tagName.toLowerCase()])) }),
  qr: (text) => { const q = QR.encode(text); return q && { version: q.version, size: q.size, rows: q.modules.map((r) => r.map((m) => (m ? 1 : 0)).join("")) }; },
  // the carved holes of the pumpkin on screen, in pumpkin space (256 x 256, the art's own box, un-flipped): "0"/"1" per cell
  holeMask: () => (G && L.hole ? holeBits(L.hole, P) : null),
  // nothing is ever cut off: a pumpkin drawn by the page's renderer (carve / lit / view, and the surfaces the Story card,
  // the clip and the brand images use) at size x size, Classic stencil. The strongest alpha of the bare ART (no glow)
  // and of the whole render, along the canvas's outer edge and along the cards' trim line (SURFACE_TRIM)
  async clipProbe({ variety, pseed, light = 1, size = 512, stencil = "classic" }) {
    if (!VAR.has(variety)) return null;
    const ok = await setPumpkin(variety, pseed >>> 0, (sh) => { state.strokes = stencilStrokes(stencil, sh); state.texts = []; });
    if (!ok) return null;
    state.strokes = stencilStrokes(stencil, G.sh); state.texts = []; active = null; undoStack = []; syncButtons(); buildCarveLayers();
    const sf = pumpkinSurface(size), n = sf.P, m = Math.round(n * SURFACE_TRIM);
    const c = document.createElement("canvas"); c.width = c.height = n;
    onSurface(sf, () => render(0, c.getContext("2d"), light, 1 - light, 1));
    const ring = (cv, k) => { const d = cv.getContext("2d").getImageData(0, 0, n, n).data; let mx = 0;
      for (let i = k; i < n - k; i++) for (const [a, b] of [[i, k], [i, n - 1 - k], [k, i], [n - 1 - k, i]]) mx = Math.max(mx, d[(b * n + a) * 4 + 3]); return mx; };
    return { art: { edge: ring(sf.L.body, 0), trim: ring(sf.L.body, m) }, render: { edge: ring(c, 0), trim: ring(c, m) }, place: { k: +G.k.toFixed(3), ox: +G.ox.toFixed(1), oy: +G.oy.toFixed(1) }, scale: +G.look.scale.toFixed(3) };
  },
  // brand.mjs: a pumpkin carved with a stencil (fitted exactly as the Stencils tab fits it) and lit, drawn by this
  // renderer at size x size output pixels, the same way the Story card draws it (lit, feathered glow, trimmed).
  // Also its holes in pumpkin space, and where pumpkin space lands in the image (x = a * u + e, y = a * v + f).
  async brandPumpkin({ variety, pseed, stencil = "classic", size, light = 1 }) {
    if (!VAR.has(variety)) return null;
    const ok = await setPumpkin(variety, pseed >>> 0, (sh) => { state.strokes = stencilStrokes(stencil, sh); state.texts = []; });
    if (!ok) return null;
    // set again right before drawing: the page's own start-up (route -> a fresh carve state) may land in between
    state.strokes = stencilStrokes(stencil, G.sh); state.texts = []; active = null;
    const S = Math.round(size), sf = pumpkinSurface(surfaceFor(S));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    drawPumpkin(sf, cv.getContext("2d"), 0, 0, S, light, 0, 1);
    const n = sf.P, m = n * SURFACE_TRIM, sc = S / (n - 2 * m), u = n / 256;
    return { png: cv.toDataURL("image/png"), hole: holeBits(sf.L.hole, n), flip: G.look.flip,
      map: { a: sc * u * G.k, e: sc * (u * G.ox - m), f: sc * (u * G.oy - m) } };
  },
});

buildQuirk();
syncCounts(); syncButtons();
route();
requestAnimationFrame(frame);
})();
/* ---- fog ---- */
// Ground mist in the mood of Identity V: a slow, thick, rolling bank that hugs the soil, three depths of
// domain-warped noise drifting on the wind, now and then a wisp rolling across, lit by the scene's lanterns,
// the moon, fireflies, ghosts, lightning and the lit pumpkin. One full-screen WebGL fragment shader drawn at
// reduced resolution (upscaled by the browser), capped at 30 fps, paused while the tab is hidden, a single still
// frame under reduced motion. Falls back to drifting pre-rendered noise tiles on a 2D canvas without WebGL or on a
// slow device.
// Self-contained: reads the patch config and watches the page's own classes / elements; the app never calls it.
// ?fog=off disables it, ?fog=2d forces the fallback (QA), ?fogk=<0..2> scales the whole effect (density, colour
// grade, vignette; default 1) for tuning live. window.__pumpkinFog exposes read-only stats + test hooks.
(() => {
"use strict";
const cfgEl = document.getElementById("patch");
let CFG = null;
try { CFG = JSON.parse(cfgEl.textContent); } catch (_) { return; }
const QS = new URLSearchParams(location.search), MODE = QS.get("fog");
if (MODE === "off" || !CFG || !CFG.scene) return;
// the user's knob (?fogk=0..2) on top of the house level: the bank is kept thin (x0.55) so the scene art reads through it
const FOGK = (() => { const v = parseFloat(QS.get("fogk")); return Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : 1; })();
const DENSITY = 0.55 * FOGK;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);

// ---- per-scene tuning ----
// density: thickness · height: how far up the screen the bank's rolling top reaches (fraction of the viewport from the floor; the art's horizon sits near 0.5) ·
// wind: drift (screen heights per second, + = to the right) · stretch: horizontal smear (sea mist is long and flat) ·
// swirl: how much the bank curls · color: the mist · glow: a tint it picks up low down [colour, amount] ·
// grade: [tint, lifted black, saturation] for the backdrop · lights: lamps in the scene art, [u, v] in the 16:9 art,
// radius (fraction of the viewport height), colour, strength.
const LAMP = "#ffb45a";
const SCENES = {
  "moonlit-graveyard": { density: 1.3, height: 0.62, wind: 0.016, stretch: 1.9, swirl: 1.0, color: "#a4b1c6", glow: ["#7f9bc4", 0.12], grade: ["#3a6c7a", "#121a26", 0.66],
    lights: [[0.08, 0.15, 0.1, LAMP, 0.9], [0.93, 0.4, 0.1, LAMP, 0.9]] },
  "bayou-swamp": { density: 1.35, height: 0.62, wind: 0.011, stretch: 2.2, swirl: 0.9, color: "#a2b5a6", glow: ["#86a86a", 0.2], grade: ["#3d6f5e", "#111c18", 0.7],
    lights: [[0.68, 0.31, 0.08, LAMP, 1], [0.715, 0.35, 0.08, LAMP, 1], [0.94, 0.31, 0.07, LAMP, 0.8]] },
  "foggy-greenhouse": { density: 0.95, height: 0.86, wind: 0.007, stretch: 1.3, swirl: 0.7, color: "#cfd0dc", glow: ["#b59bd9", 0.16], grade: ["#5c7484", "#1a1c26", 0.8],
    lights: [[0.056, 0.2, 0.07, LAMP, 0.9], [0.65, 0.34, 0.07, LAMP, 0.8], [0.825, 0.31, 0.07, LAMP, 0.8], [0.4, 0.42, 0.1, LAMP, 0.6]] },
  "haunted-mansion": { density: 1.05, height: 0.66, wind: 0.014, stretch: 1.7, swirl: 0.9, color: "#a9adc6", glow: ["#8f86b8", 0.1], grade: ["#3f6878", "#131726", 0.7],
    lights: [[0.09, 0.26, 0.08, LAMP, 0.9], [0.8, 0.42, 0.12, LAMP, 0.8], [0.94, 0.29, 0.08, LAMP, 0.9], [0.58, 0.48, 0.06, LAMP, 0.6]] },
  "enchanted-forest": { density: 1.05, height: 0.7, wind: 0.009, stretch: 1.5, swirl: 1.1, color: "#aeaad0", glow: ["#9a7cff", 0.26], grade: ["#4a5f86", "#141327", 0.72],
    lights: [[0.21, 0.46, 0.12, LAMP, 1], [0.075, 0.5, 0.08, "#8fa2ff", 0.9], [0.375, 0.42, 0.07, "#9c8cff", 0.8], [0.85, 0.42, 0.08, "#a68cff", 0.9]] },
  "shipwreck-cove": { density: 1.1, height: 0.62, wind: 0.028, stretch: 3.2, swirl: 0.7, color: "#a3bacb", glow: ["#6fa6c4", 0.14], grade: ["#336c80", "#0f1a24", 0.7],
    lights: [[0.044, 0.32, 0.07, LAMP, 0.9], [0.17, 0.27, 0.08, "#fff1b8", 0.9], [0.66, 0.31, 0.08, LAMP, 0.9], [0.9, 0.4, 0.06, LAMP, 0.7]] },
  "witch-yard": { density: 1.1, height: 0.66, wind: 0.013, stretch: 1.6, swirl: 1.0, color: "#a6b0bc", glow: ["#6fe060", 0.16], grade: ["#3d6a66", "#131a1e", 0.7],
    lights: [[0.08, 0.36, 0.22, "#5cff52", 1.25], [0.75, 0.2, 0.07, LAMP, 0.8], [0.85, 0.34, 0.07, LAMP, 0.8], [0.975, 0.28, 0.07, LAMP, 0.8]] },
  "scarecrow-field": { density: 0.85, height: 0.58, wind: 0.02, stretch: 1.9, swirl: 0.8, color: "#b2b6ba", glow: ["#b8a27a", 0.1], grade: ["#4a6c6c", "#161a1c", 0.76],
    lights: [[0.89, 0.39, 0.09, LAMP, 1]] },
};
const S = SCENES[CFG.scene.id] || SCENES["haunted-mansion"];
// weather: how it changes the mist (lightning + ghosts + fireflies + the moon are lights, found live on the page)
const EV = (CFG.event && CFG.event.id) || "";
const EVENT = {
  thunderstorm: { density: 1.08, wind: 2.2, shade: 0.82 },
  "full-moon": { back: 1 },
  "firefly-swarm": { glow: ["#d8f27a", 0.1] },
  "ghost-parade": { glow: ["#bcd4ff", 0.08] },
}[EV] || {};

// ---- per-screen strength: strongest on the landing and the night step; thin behind the reveal and the carving ----
function screenTarget() {
  const b = document.body.classList;
  let k = 0.55, h = 1;
  if (b.contains("s-grow")) { k = b.contains("night") ? 0.75 : 0.45; h = b.contains("night") ? 1.02 : 0.95; }
  else if (b.contains("s-carve")) { k = b.contains("lit") ? 0.25 : 0.15; h = 0.85; }
  else if (b.contains("s-view")) { k = 0.25; h = 0.85; }
  const rev = $("reveal"), col = $("collection");
  if ((rev && !rev.hidden) || (col && !col.hidden)) k *= 0.4;
  return { k, h };
}

const hex = (c) => { const n = parseInt(c.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const lerp = (a, b, t) => a + (b - a) * t;

// ---- layers ----
const scene = document.querySelector(".scene");
if (!scene) return;
const tint = document.createElement("div"); tint.className = "fog-tint";
const lift = document.createElement("div"); lift.className = "fog-lift";
scene.append(tint, lift);
const root = document.documentElement.style;
// the grade at half strength (desaturation and tint), times the knob
root.setProperty("--fog-k", String(FOGK));
root.setProperty("--fog-tint", S.grade[0]); root.setProperty("--fog-lift", S.grade[1]);
root.setProperty("--fog-sat", String(+(1 - (1 - S.grade[2]) * 0.5 * FOGK).toFixed(3))); root.setProperty("--fog-con", String(+(1 - 0.025 * FOGK).toFixed(3)));
const wrap = document.createElement("div"); wrap.className = "fog"; wrap.setAttribute("aria-hidden", "true");
const vig = document.createElement("div"); vig.className = "fog-vig";
const ev = $("event");
(ev ? ev.parentNode : document.body).insertBefore(wrap, ev || null);
document.body.classList.add("fog-on");

// ---- shared live state: screen strength, lights, text boxes ----
const st = { k: 0.55, h: 1, flash: 0, dark: 0, t: 7.3, frames: 0, ms: [], mode: "", scale: 0.5 };
const MAXL = 10, MAXR = 24;
const lights = new Float32Array(MAXL * 4), lightCol = new Float32Array(MAXL * 4), rects = new Float32Array(MAXR * 4);
let nLights = 0, nRects = 0;
let W = innerWidth, H = innerHeight;

// where a point of the 16:9 scene art lands on screen (the backdrop is background-size:cover at its own position)
function artToScreen(u, v) {
  const img = $("sceneImg"); if (!img) return null;
  const pos = getComputedStyle(img).backgroundPosition.split(" ").map((s) => parseFloat(s) / 100);
  const s = Math.max(W / 16, H / 9), iw = 16 * s, ih = 9 * s;
  return [(W - iw) * (pos[0] || 0.5) + u * iw, (H - ih) * (isNaN(pos[1]) ? 0.7 : pos[1]) + v * ih];
}
const centre = (el) => { const r = el.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height] : null; };
function addLight(x, y, r, col, s) {
  if (nLights >= MAXL || s <= 0.003 || x < -r * H || x > W + r * H || y < -r * H || y > H + r * H) return;
  const i = nLights++ * 4, c = typeof col === "string" ? hex(col) : col;
  lights[i] = x / H; lights[i + 1] = y / H; lights[i + 2] = r; lights[i + 3] = s;
  lightCol[i] = c[0]; lightCol[i + 1] = c[1]; lightCol[i + 2] = c[2]; lightCol[i + 3] = 0;
}
let ffPick = [];
function gatherLights() {
  nLights = 0;
  const b = document.body.classList, inWork = b.contains("s-carve") || b.contains("s-view");
  // the lit pumpkin: its spill's opacity is the candle (it already flickers), its glow sits low in the stage
  const spill = $("spill"), stage = $("stage");
  if (inWork && spill && stage) {
    const o = parseFloat(spill.style.opacity) || 0, c = centre(stage);
    if (o > 0.01 && c) addLight(c[0], c[1] + c[3] * 0.1, (c[2] / H) * 0.62, "#ff9440", o * 3.2);
  }
  const moon = document.querySelector(".ev-moon img");
  if (moon) { const c = centre(moon); if (c) addLight(c[0], c[1], (c[2] / H) * 1.9, "#e3e9ff", 1.15); }
  for (const g of document.querySelectorAll(".ev-ghost")) { const c = centre(g); if (c) addLight(c[0], c[1], (c[2] / H) * 0.9, "#cfe0ff", 0.55); }
  const ffs = document.querySelectorAll(".ev-ff");
  if (ffs.length) {
    if (st.frames % 90 === 0 || ffPick.length === 0) ffPick = [...ffs].filter((_, i) => i % Math.ceil(ffs.length / 5) === 0).slice(0, 5);
    for (const f of ffPick) { const c = centre(f); if (c) addLight(c[0], c[1], 0.07, "#e6ff8a", 0.55); }
  }
  // the scene's own lamps (dimmed with the blurred backdrop on the carve / view screens)
  const dim = inWork ? 0.35 : 0.75;
  for (const [u, v, r, col, s] of S.lights) { const p = artToScreen(u, v); if (p) addLight(p[0], p[1], r, col, s * dim); }
}
// text and controls on the current screen: the mist thins behind them so it never costs them contrast
const TEXT_SEL = "#note, #landing .eyebrow, #patchName, #tagline, #welcome, #landing .sig, #landing .dice li, #landing .linkbtn, footer p, " +
  "#grow .step, #growTitle, #growCaption, #growSkip, #patchTag, #carveHead, #viewHead, #msgLine, #credit, #work .panehint, #work .lithead, #work .field, #sendMsg, #err, #work .linkbtn";
function gatherRects() {
  nRects = 0;
  for (const e of document.querySelectorAll(TEXT_SEL)) {
    if (nRects >= MAXR) break;
    if (!e.offsetParent && getComputedStyle(e).position !== "fixed") continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > H) continue;
    const i = nRects++ * 4;
    rects[i] = r.left / H; rects[i + 1] = r.top / H; rects[i + 2] = r.right / H; rects[i + 3] = r.bottom / H;
  }
}
function events() {
  const fl = document.querySelector(".ev-flash"), dk = document.querySelector(".ev-dark");
  return { flash: fl && fl.classList.contains("on") ? 1 : 0, dark: dk && dk.classList.contains("on") ? 1 : 0 };
}

// ---- WebGL ----
const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uScale,uTime,uDensity,uHeight,uWind,uStretch,uSwirl,uFlash,uDark,uBack,uShade,uNL,uNR;
uniform vec3 uColor;uniform vec4 uGlow;uniform vec4 uL[${MAXL}];uniform vec4 uLC[${MAXL}];uniform vec4 uR[${MAXR}];
float h(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
const mat2 M=mat2(1.62,1.18,-1.18,1.62);
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*n(p);p=M*p+vec2(3.1,1.7);a*=.5;}return s;}
float fbm3(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*n(p);p=M*p+vec2(3.1,1.7);a*=.5;}return s/.875;}
void main(){
  vec2 fc=gl_FragCoord.xy/uScale;                 // CSS pixels
  vec2 p=vec2(fc.x,uRes.y-fc.y)/uRes.y;            // y down, in viewport heights
  float g=1.-p.y;                                  // height above the floor
  float t=uTime;
  float dens=0.,rim=0.,cov0=0.;
  // the bank lies along the horizon of the art and rolls forward over the soil, thinning toward the very front
  float front=mix(.04,1.,smoothstep(.06,.42,g));
  for(int k=0;k<3;k++){
    float fk=float(k);
    float sc=2.1+fk*1.6, spd=1.-fk*.28;
    vec2 q=vec2(p.x/uStretch,p.y*1.35)*sc+vec2(fk*17.1,fk*5.3);
    q.x-=t*uWind*spd*sc;
    // domain warp: the bank curls slowly on itself
    vec2 w=vec2(fbm3(q*.55+vec2(0.,t*.05)),fbm3(q*.55+vec2(5.2,1.3)-vec2(t*.04,0.)));
    float v=fbm(q+uSwirl*2.2*(w-.5)+vec2(t*.012,0.));
    float cover=smoothstep(.36,.74,v);
    // the bank's top edge rolls with the warp field; farther layers reach a little higher
    float ridge=fbm3(vec2(p.x/uStretch*1.6-t*uWind*spd*1.4+fk*3.7,t*.02+fk));
    float top=uHeight*(.78+fk*.17)+(ridge-.5)*.34+(w.y-.5)*.16;
    float hm=smoothstep(top,top-.22-fk*.05,g)*front;
    float amp=k==0?1.:(k==1?.75:.5);
    dens+=cover*hm*amp;
    rim+=cover*(1.-cover)*hm*amp*4.;
    if(k==0)cov0=cover*hm;
  }
  // a thin haze always lies along the horizon, between the billows
  dens+=.16*smoothstep(uHeight*1.1,uHeight*.45,g)*front;
  // now and then a wisp rolls across at mid height, faster than the bank
  float dir=uWind<0.?-1.:1.;
  for(int j=0;j<2;j++){
    float fj=float(j), per=14.+fj*9., ph=fract(t/per+fj*.43);
    float span=uRes.x/uRes.y+1.6, cx=dir>0.?ph*span-.8:uRes.x/uRes.y+.8-ph*span;
    float cy=1.-uHeight*(.7+fj*.25);
    vec2 d=vec2((p.x-cx)/.6,(p.y-cy)/.075);
    float env=exp(-dot(d,d))*smoothstep(0.,.15,ph)*smoothstep(1.,.85,ph);
    float wn=fbm3(vec2(p.x*2.2-t*.16*dir,p.y*9.+fj*9.));
    dens+=env*smoothstep(.3,.7,wn)*1.1;
  }
  dens*=uDensity;
  float a=1.-exp(-dens*1.5);
  // colour: cool grey mist, a touch darker in the thick of it, tinted low down, rim-lit when the moon is behind
  vec3 col=uColor*(.62+.28*smoothstep(0.,.9,g+.25))*(1.-.18*cov0)*uShade;
  col=mix(col,uGlow.rgb,uGlow.a*smoothstep(.65,0.,g));
  col+=uBack*vec3(.75,.8,.95)*min(rim,1.)*.35;
  // lamps, moon, fireflies, ghosts, the lit pumpkin: light scattered in the mist (+ a faint halo in thin air)
  vec3 lit=vec3(0.);float halo=0.;
  for(int i=0;i<${MAXL};i++){
    if(float(i)>=uNL)break;
    vec4 L=uL[i];vec2 d=p-L.xy;float r2=L.z*L.z;
    float f=L.w*exp(-dot(d,d)/r2);
    lit+=uLC[i].rgb*f;halo+=f*.14;
  }
  col+=lit*(.32+.7*a);
  a=max(a,min(.42,halo*.9)*min(1.,uDensity)*smoothstep(uHeight*1.3,uHeight*.7,g)); // halos live in the mist, not in clear sky
  // lightning: the whole bank lights up from inside
  col+=vec3(.78,.84,1.)*uFlash*(.6+1.2*a);
  a=max(a,uFlash*.25*smoothstep(0.,.6,g));
  col*=1.-.45*uDark;
  a=min(a,.9);
  // thin out behind text and controls (soft edges), so the mist never costs them contrast
  // (the boxes are melted together with a smooth union so the thinning reads as mist parting, not as holes)
  float sdu=1.;
  for(int i=0;i<${MAXR};i++){
    if(float(i)>=uNR)break;
    vec4 r=uR[i];vec2 c=(r.xy+r.zw)*.5,hs=(r.zw-r.xy)*.5;
    vec2 dd=abs(p-c)-hs;float sd=length(max(dd,0.))+min(max(dd.x,dd.y),0.);
    float hh=clamp(.5+.5*(sdu-sd)/.05,0.,1.);sdu=mix(sdu,sd,hh)-.05*hh*(1.-hh);
  }
  a*=mix(.22,1.,smoothstep(-.02,.1,sdu));
  col/=max(1.,max(col.r,max(col.g,col.b))); // keep the hue when a light overexposes
  gl_FragColor=vec4(col*a,a);
}`;

function startGL() {
  const cv = document.createElement("canvas");
  const gl = cv.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.warn("fog shader:", gl.getShaderInfoLog(s)), null); };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ["uRes", "uScale", "uTime", "uDensity", "uHeight", "uWind", "uStretch", "uSwirl", "uFlash", "uDark", "uBack", "uShade", "uNL", "uNR", "uColor", "uGlow", "uL", "uLC", "uR"]) U[n] = gl.getUniformLocation(pr, n);
  wrap.append(cv, vig);
  const color = hex(S.color), glow = EVENT.glow ? hex(EVENT.glow[0]).map((c, i) => lerp(hex(S.glow[0])[i], c, 0.5)) : hex(S.glow[0]);
  const glowA = S.glow[1] + (EVENT.glow ? EVENT.glow[1] : 0);
  gl.uniform3fv(U.uColor, color); gl.uniform4f(U.uGlow, glow[0], glow[1], glow[2], glowA);
  gl.uniform1f(U.uStretch, S.stretch); gl.uniform1f(U.uSwirl, S.swirl);
  gl.uniform1f(U.uBack, EVENT.back || 0); gl.uniform1f(U.uShade, EVENT.shade || 1);
  let lost = false;
  cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  cv.addEventListener("webglcontextrestored", () => { lost = false; teardown(); start(); });
  function size() {
    W = innerWidth; H = innerHeight;
    // ~half resolution, and never more than ~200k fog pixels (a big desktop window costs the same as a phone x2)
    st.scale = Math.min(st.cap, Math.sqrt(200000 / (W * H)));
    const w = Math.max(16, Math.round(W * st.scale)), h = Math.max(16, Math.round(H * st.scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
  }
  function draw(measure) {
    if (lost) return 0;
    const t0 = performance.now();
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uScale, cv.width / W); gl.uniform1f(U.uTime, st.t);
    gl.uniform1f(U.uDensity, S.density * DENSITY * (EVENT.density || 1) * st.k); gl.uniform1f(U.uHeight, S.height * st.h);
    gl.uniform1f(U.uWind, 1.6 * S.wind * (EVENT.wind || 1)); gl.uniform1f(U.uFlash, st.flash); gl.uniform1f(U.uDark, st.dark);
    gl.uniform1f(U.uNL, nLights); gl.uniform1f(U.uNR, nRects);
    gl.uniform4fv(U.uL, lights); gl.uniform4fv(U.uLC, lightCol); gl.uniform4fv(U.uR, rects);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (measure) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); // forces the GPU to finish
    return performance.now() - t0;
  }
  return { kind: "webgl", size, draw, el: cv, destroy() { const x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); cv.remove(); } };
}

// Fallback (no WebGL, or a device too slow for the shader): three seamless noise tiles rendered once, drifting at
// three speeds on a small 2D canvas, shaped into the same bank, thinned behind text, lit by the same lights.
function start2D() {
  const cv = document.createElement("canvas"), x = cv.getContext("2d");
  if (!x) return null;
  const tile = (size, cells, seed, rgb) => {
    const c = document.createElement("canvas"); c.width = c.height = size;
    const tx = c.getContext("2d"), img = tx.createImageData(size, size);
    let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const oct = [cells, cells * 2, cells * 4].map((n) => { const g = []; for (let i = 0; i < n * n; i++) g.push(rnd()); return { n, g }; });
    const val = ({ n, g }, u, v) => {
      const fx = u * n, fy = v * n, ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
      const sx = ax * ax * (3 - 2 * ax), sy = ay * ay * (3 - 2 * ay), at = (i, j) => g[(j % n) * n + (i % n)];
      return lerp(lerp(at(ix, iy), at(ix + 1, iy), sx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), sx), sy);
    };
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const f = val(oct[0], i / size, j / size) * 0.57 + val(oct[1], i / size, j / size) * 0.29 + val(oct[2], i / size, j / size) * 0.14;
      const a = Math.max(0, Math.min(1, (f - 0.3) / 0.42)), k = (j * size + i) * 4;
      img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = a * a * (3 - 2 * a) * 255;
    }
    tx.putImageData(img, 0, 0);
    return c;
  };
  const rgb = hex(S.color).map((c) => Math.round(c * 235));
  // [tile, drift speed (x wind), top of the band (x height), opacity]
  const layers = [[tile(96, 3, 11, rgb), 1, 0.8, 0.8], [tile(96, 4, 23, rgb), 0.62, 0.95, 0.65], [tile(96, 4, 37, rgb), 0.38, 1.08, 0.5]];
  wrap.append(cv, vig);
  let w = 0, h = 0, sc = document.documentElement.classList.contains("lite") ? 0.25 : 0.35;
  function size() {
    W = innerWidth; H = innerHeight;
    w = Math.max(16, Math.round(W * sc)); h = Math.max(16, Math.round(H * sc));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function draw() {
    const t = st.t, top = S.height * st.h, wind = 1.6 * S.wind * (EVENT.wind || 1);
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.clearRect(0, 0, w, h);
    layers.forEach(([tl, spd, hk, o], k) => {
      const tw = h * (1.2 - k * 0.25), th = tw * 0.42;              // tiles are drawn wide and flat
      const y0 = h * (1 - top * hk), off = (((t * wind * spd * h) % tw) + tw) % tw;
      x.globalAlpha = Math.min(1, o * S.density * DENSITY * (EVENT.density || 1) * st.k);
      for (let y = y0; y < h; y += th) for (let xx = -tw + off; xx < w; xx += tw) x.drawImage(tl, xx, y, tw, th);
    });
    // the bank's shape: soft top, thinning toward the very front (same profile as the shader)
    x.globalAlpha = 1; x.globalCompositeOperation = "destination-in";
    const yTop = h * (1 - top * 1.05), gr = x.createLinearGradient(0, yTop, 0, h);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.3, "#000"); gr.addColorStop(0.7, "#000"); gr.addColorStop(1, "rgba(0,0,0,.05)");
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    // lights, only where there is mist
    x.globalCompositeOperation = "source-atop";
    for (let i = 0; i < nLights; i++) {
      const lx = lights[i * 4] * H * sc, ly = lights[i * 4 + 1] * H * sc, r = lights[i * 4 + 2] * H * sc * 1.6, s = Math.min(1, lights[i * 4 + 3] * 0.6);
      const c = [0, 1, 2].map((j) => Math.round(lightCol[i * 4 + j] * 255)).join(","), g = x.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, `rgba(${c},${s})`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    if (st.flash > 0.01) { x.fillStyle = `rgba(200,214,255,${(0.6 * st.flash).toFixed(3)})`; x.fillRect(0, 0, w, h); }
    if (st.dark > 0.01) { x.fillStyle = `rgba(4,5,12,${(0.45 * st.dark).toFixed(3)})`; x.fillRect(0, 0, w, h); }
    // thin out behind text and controls: each box is cut as a blurred shadow (drawn from far off-canvas, so only the
    // shadow lands), so the mist parts with a soft edge and never leaves a rectangular clearing
    x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000";
    const far = w * 4 + 1000, soft = Math.max(4, H * sc * 0.035);
    x.shadowColor = "rgba(0,0,0,.78)"; x.shadowBlur = soft; x.shadowOffsetX = far; x.shadowOffsetY = 0;
    for (let i = 0; i < nRects; i++) {
      const l = rects[i * 4] * H * sc, tp = rects[i * 4 + 1] * H * sc, rr = rects[i * 4 + 2] * H * sc, bt = rects[i * 4 + 3] * H * sc;
      x.fillRect(l - far - soft * 0.5, tp - soft * 0.5, rr - l + soft, bt - tp + soft);
    }
    x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetX = 0;
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    return 0;
  }
  return { kind: "2d", size, draw, el: cv, destroy() { cv.remove(); } };
}

// ---- loop: 30 fps cap, paused while hidden, one still frame under reduced motion ----
let R = null, raf = 0, last = 0, still = reduced.matches, sinceRects = 99, poll = 0;
st.cap = 0.5;
function inputs(dt) {
  const tgt = screenTarget(), e = events(), ease = still ? 1 : 1 - Math.exp(-dt / 1.1);
  st.k = lerp(st.k, tgt.k, ease); st.h = lerp(st.h, tgt.h, ease);
  st.flash = e.flash ? 1 : st.flash * Math.exp(-dt / 0.18);
  st.dark = lerp(st.dark, e.dark, still ? 1 : 1 - Math.exp(-dt / 0.25));
  gatherLights();
  if (++sinceRects > 10) { sinceRects = 0; gatherRects(); }
}
function tick(now) {
  raf = requestAnimationFrame(tick);
  if (now - last < 1000 / 30 - 3) return;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  st.t += dt; st.frames++;
    inputs(dt);
  // measure a frame now and then (GPU included); a device that can't afford the shader steps down, then falls back
  const measure = R.kind === "webgl" && st.frames % 30 === 5;
  const ms = R.draw(measure);
  if (measure) {
    st.ms.push(ms); if (st.ms.length > 20) st.ms.shift();
    const recent = st.ms.slice(-3);
    if (recent.length === 3 && Math.min(...recent) > 12) {
      if (st.cap > 0.3) { st.cap = 0.3; st.ms = []; R.size(); } else { swap("2d"); }
    }
  }
}
function renderStill() { sinceRects = 99; inputs(1); R.draw(false); }
function run() {
  cancelAnimationFrame(raf); clearInterval(poll);
  if (document.hidden) return;
  if (still) { renderStill(); poll = setInterval(renderStill, 500); return; } // re-lit (screen, pumpkin), never moved
  last = performance.now() - 34; raf = requestAnimationFrame(tick);
}
function start() {
  const lite = document.documentElement.classList.contains("lite");
  R = (MODE !== "2d" && !lite && !(navigator.deviceMemory && navigator.deviceMemory <= 1) && startGL()) || start2D();
  if (!R) { wrap.remove(); return; }
  st.mode = R.kind; R.size(); gatherRects(); run();
}
function teardown() { cancelAnimationFrame(raf); clearInterval(poll); if (R) R.destroy(); R = null; vig.remove(); }
function swap(kind) { teardown(); R = kind === "2d" ? start2D() : startGL() || start2D(); if (!R) return; st.mode = R.kind; R.size(); gatherRects(); run(); }
addEventListener("resize", () => { if (!R) return; R.size(); gatherRects(); if (still) renderStill(); });
// the page went lite (a weak device, measured): the cheap 2D mist at low resolution
addEventListener("pumpkin:quality", (e) => { if (R && e.detail && e.detail.lite) swap("2d"); });
document.addEventListener("visibilitychange", run);
reduced.addEventListener("change", () => { still = reduced.matches; run(); });
new MutationObserver(() => { sinceRects = 99; }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
start();

// read-only stats + test hooks (the test suites / the perf probe use them)
window.__pumpkinFog = Object.freeze({
  fogk: FOGK,
  stats: () => ({ mode: st.mode, fogk: FOGK, scale: R && R.kind === "webgl" ? +st.scale.toFixed(3) : null, k: +st.k.toFixed(3), frames: st.frames, time: +st.t.toFixed(2), lights: nLights, rects: nRects, gpuMs: st.ms.slice(), running: !!raf && !still && !document.hidden }),
  // draw one frame on demand and time it: inputs + draw, and with sync the GPU too (perf probe)
  timeFrame: (sync = true) => { if (!R) return 0; const t0 = performance.now(); inputs(1 / 30); R.draw(sync); return performance.now() - t0; },
  hide(on) { wrap.style.visibility = on ? "hidden" : ""; tint.hidden = lift.hidden = !!on; document.body.classList.toggle("fog-on", !on); },
  freeze(t) { if (typeof t === "number") st.t = t; cancelAnimationFrame(raf); raf = 0; renderStill(); },
  resume: run,
});
})();
/* ---- /fog ---- */
