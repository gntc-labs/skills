// Haunted Farm — game feel: sounds (synthesised with WebAudio, no files),
// particles, arcs, shake, flash and haptics. Pure presentation: nothing here
// reads or writes game state. Everything is drawn in one fixed overlay
// (#fx) so a village re-render never cuts an effect short.
//
// prefers-reduced-motion: no wobble, shake, arcs or particles — callers ask
// `reducedMotion()` and fall back to a quick fade + counter bump. Sound is
// not motion: reduced motion changes nothing here.
//
// Sound: every effect goes through ONE entry point, `sfx(name)`, which looks
// the name up in RECIPES. Nothing makes a sound before the player's first
// gesture (the AudioContext is only created by `wakeAudio()`, called from a
// pointerdown/keydown), and mute silences everything, ambience included.

const MUTE_KEY = "haunted-farm:muted";
const AMBIENCE_KEY = "haunted-farm:ambience";

export const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const stored = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: defaults, choice forgotten
  }
};
const store = (key, v) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* not remembered, still applied */
  }
};

let muted = stored(MUTE_KEY) === "1";
export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  store(MUTE_KEY, muted ? "1" : "0");
  if (amb) amb.out.gain.setTargetAtTime(muted ? 0 : AMBIENCE_VOLUME, ac.currentTime, 0.05);
}

// ── sound ─────────────────────────────────────────────────────────────

let ac = null;
let pending = []; // sfx asked for before the first gesture with { queue: true }
/** Create/resume the AudioContext. Call from a user gesture (pointerdown). */
export function wakeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume();
  } catch {
    ac = null;
    return;
  }
  if (ambienceWanted) startAmbience();
  const later = pending;
  pending = [];
  for (const p of later) {
    if (!muted && RECIPES[p.name]) RECIPES[p.name](p.opts);
    p.entry.played = !muted;
  }
}
export const audioReady = () => !!ac;

/** One oscillator through an envelope; `freqs` ramp over `dur` seconds. */
function voice(type, freqs, dur, peak = 0.25, { at = 0, dest = null } = {}) {
  if (!ac) return null;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freqs[0], t);
  freqs.slice(1).forEach((f, k) => o.frequency.exponentialRampToValueAtTime(f, t + (dur * (k + 1)) / (freqs.length - 1)));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
  return { o, g, t };
}

let noiseBuf = null;
/** Filtered white noise: `filter` sweeps `from` → `to` Hz over `dur`. */
function noise(dur, { type = "bandpass", from = 1000, to = from, q = 1, peak = 0.2, attack = 0.01, at = 0, dest = null, loop = false } = {}) {
  if (!ac) return null;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = loop;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  if (to !== from) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  if (!loop) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest || ac.destination);
  src.start(t);
  if (!loop) src.stop(t + dur + 0.05);
  return { src, f, g, t };
}

/** A bell-ish partial stack (music box, chimes, the old bell). */
function bell(freq, { at = 0, dur = 1.2, peak = 0.12, partials = [1, 2.76, 5.4], dest = null } = {}) {
  partials.forEach((m, k) => voice("sine", [freq * m, freq * m], dur / (k + 1), peak / (k + 1.5), { at, dest }));
}

// name → recipe. Short, cozy-spooky; each one distinct.
const RECIPES = {
  /** Harvest: a pumpkin popping out of the soil. */
  harvest: ({ soft = false } = {}) => {
    voice("triangle", [520, 170], 0.13, soft ? 0.12 : 0.25);
    voice("sine", [90, 60], 0.08, soft ? 0.08 : 0.18);
  },
  /** A successful steal: a soft pop and a two-note chime. */
  treat: () => {
    RECIPES.harvest({ soft: true });
    voice("sine", [880, 880], 0.12, 0.12, { at: 0.02 });
    voice("sine", [1320, 1320], 0.16, 0.1, { at: 0.11 });
  },
  /** Trick: the ghost's scream, a wobbling saw that rises then falls. */
  scream: () => {
    const v = voice("sawtooth", [240, 900, 160], 0.6, 0.18);
    if (!v) return;
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 28;
    depth.gain.value = 60;
    lfo.connect(depth).connect(v.o.frequency);
    lfo.start(v.t);
    lfo.stop(v.t + 0.62);
  },
  /** A hidden guard pops out: breathy whoosh under a low sliding "booo". */
  boo: () => {
    noise(0.65, { from: 1800, to: 300, q: 1.2, peak: 0.22, attack: 0.08 });
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(ac.destination);
    voice("triangle", [260, 130], 0.6, 0.3, { at: 0.03, dest: lp });
  },
  /** Plant a seed: a soft dig, then a tiny sprout "plip". */
  plant: () => {
    noise(0.12, { type: "lowpass", from: 600, to: 250, peak: 0.25 });
    noise(0.1, { type: "lowpass", from: 500, to: 200, peak: 0.18, at: 0.12 });
    voice("sine", [700, 1500], 0.07, 0.14, { at: 0.26 });
  },
  /** Water / help a neighbour: two water droplets. */
  water: () => {
    voice("sine", [1200, 2400], 0.06, 0.16);
    voice("sine", [950, 2000], 0.07, 0.13, { at: 0.14 });
  },
  /** Shoo your own ghost: a whoosh away, then a relieved little chime. */
  shoo: () => {
    noise(0.35, { from: 400, to: 2600, q: 0.8, peak: 0.2, attack: 0.05 });
    voice("sine", [784, 784], 0.25, 0.1, { at: 0.32 });
    voice("sine", [1047, 1047], 0.35, 0.09, { at: 0.42 });
  },
  /** Post a guard ghost: a low eerie hum and the "click" of its lantern. */
  guard: () => {
    voice("sine", [110, 104], 0.7, 0.16);
    voice("sine", [165, 160], 0.7, 0.07);
    noise(0.025, { type: "highpass", from: 3500, peak: 0.3, at: 0.45 });
    voice("square", [1800, 1200], 0.02, 0.05, { at: 0.45 });
  },
  /** Clear a rotten pumpkin: a wet squelch. */
  clear: () => {
    noise(0.22, { type: "lowpass", from: 900, to: 160, q: 6, peak: 0.3, attack: 0.02 });
    voice("sine", [200, 70], 0.18, 0.18);
  },
  /** A crop turns ripe while you watch: a small twinkle. */
  ripe: () => {
    [1568, 2093, 2637].forEach((f, k) => voice("sine", [f, f], 0.18, 0.06, { at: k * 0.07 }));
  },
  /** A crop goes off or rots: a low, sad "bwomp". */
  rot: () => {
    voice("triangle", [180, 90], 0.4, 0.2);
  },
  /** Open a house from the map: a creaky door. */
  door: () => {
    const v = voice("sawtooth", [140, 210, 120], 0.45, 0.05);
    if (!v) return;
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = 17;
    depth.gain.value = 25;
    lfo.connect(depth).connect(v.o.frequency);
    lfo.start(v.t);
    lfo.stop(v.t + 0.47);
    noise(0.04, { type: "lowpass", from: 300, peak: 0.25, at: 0.42 });
  },
  /** Back to the map: a short gust of wind. */
  wind: () => {
    noise(0.5, { from: 300, to: 900, q: 0.6, peak: 0.14, attack: 0.18 });
  },
  /** Tapped something you can't do: a soft, dull thunk. */
  nope: () => {
    voice("sine", [150, 95], 0.09, 0.2);
    noise(0.03, { type: "lowpass", from: 400, peak: 0.08 });
  },
  /** "While you were away": an old bell's ding. */
  bell: () => bell(523, { dur: 1.6, peak: 0.16 }),
  /** The candy counter changing: one tiny tick per candy, at most 6. */
  tick: ({ count = 1 } = {}) => {
    for (let k = 0; k < Math.min(6, Math.max(1, count)); k++) voice("square", [2600, 2600], 0.015, 0.03, { at: k * 0.05 });
  },
};
export const SFX_NAMES = Object.keys(RECIPES);

/**
 * Play one named sound. Every call is logged (window.__hauntedFarmSfx, last 100)
 * with whether it actually played — muted, or before the first gesture, it
 * doesn't. `queue: true` keeps it until that first gesture instead.
 */
export function sfx(name, opts = {}) {
  if (!RECIPES[name]) throw new Error(`unknown sfx: ${name}`);
  const entry = { name, played: !muted && !!ac, at: Date.now() };
  const log = (window.__hauntedFarmSfx ||= []);
  log.push(entry);
  if (log.length > 100) log.splice(0, log.length - 100);
  if (!ac && opts.queue && !muted) pending.push({ name, opts, entry });
  if (!entry.played) return;
  try {
    RECIPES[name](opts);
  } catch {
    /* audio hiccup: the game goes on */
  }
}

// ── ambience: wind, sparse owl and crickets, a slow minor music box ───

const AMBIENCE_VOLUME = 0.35;
let ambienceWanted = stored(AMBIENCE_KEY) === "1";
let amb = null; // { out, timers } while playing
export const ambienceOn = () => ambienceWanted;
export const ambiencePlaying = () => !!amb;
/** The ambience's current output level (0 while muted or off). */
export const ambienceGain = () => (amb ? amb.out.gain.value : 0);
/** Turn the ambience on or off (remembered). It starts only once audio is awake. */
export function setAmbience(on) {
  ambienceWanted = !!on;
  store(AMBIENCE_KEY, ambienceWanted ? "1" : "0");
  if (ambienceWanted) startAmbience();
  else stopAmbience();
}
// A minor: A C E D C B A … and a resolve.
const MOTIF = [440, 523.25, 659.25, 587.33, 523.25, 493.88, 440, 0, 329.63, 392, 440];
function startAmbience() {
  if (!ac || amb) return;
  const out = ac.createGain();
  out.gain.value = muted ? 0 : AMBIENCE_VOLUME;
  out.connect(ac.destination);
  const wind = noise(1, { type: "lowpass", from: 420, q: 0.7, peak: 0.12, attack: 2, dest: out, loop: true });
  // The wind breathes: a slow LFO on its filter.
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = 0.07;
  depth.gain.value = 180;
  lfo.connect(depth).connect(wind.f.frequency);
  lfo.start();
  const timers = [];
  const every = (ms, fn) => timers.push(setInterval(fn, ms));
  every(1700, () => {
    if (Math.random() < 0.18) [0, 0.09, 0.18].forEach((at) => voice("sine", [4400, 4300], 0.05, 0.02, { at, dest: out })); // cricket
  });
  every(9000, () => {
    if (Math.random() < 0.3) [0, 0.45].forEach((at, k) => voice("sine", [k ? 370 : 392, k ? 330 : 370], 0.38, 0.05, { at, dest: out })); // owl
  });
  const box = () => MOTIF.forEach((f, k) => f && bell(f, { at: k * 0.55, dur: 1.4, peak: 0.05, partials: [1, 3.9], dest: out }));
  box();
  every(16000, box);
  amb = { out, wind, lfo, timers };
}
function stopAmbience() {
  if (!amb) return;
  amb.timers.forEach(clearInterval);
  try {
    amb.wind.src.stop();
    amb.lfo.stop();
  } catch {
    /* already stopped */
  }
  amb.out.disconnect();
  amb = null;
}

export function buzz(pattern = 15) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

// ── overlay helpers ───────────────────────────────────────────────────

function layer() {
  let el = document.getElementById("fx");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const done = (anim) => new Promise((ok) => (anim.onfinish = anim.oncancel = ok));

function sprite(src, rect, cls = "") {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.className = `fx-sprite ${cls}`;
  Object.assign(img.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  layer().appendChild(img);
  return img;
}

// ── effects ───────────────────────────────────────────────────────────

/** Pop the crop out in a little arc and fly it to the candy counter. */
export async function popAndFly(src, from, to, { sneaky = false } = {}) {
  const img = sprite(src, from, sneaky ? "sneaky" : "");
  if (reducedMotion()) {
    await done(img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }));
    img.remove();
    return;
  }
  const a = centre(from);
  const b = to ? centre(to) : { x: a.x, y: a.y - 200 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  await done(
    img.animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)" },
        { transform: `translate(${dx * 0.15}px, ${-70 - from.height * 0.3}px) scale(1.15) rotate(${sneaky ? -12 : 10}deg)`, offset: 0.35 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(${sneaky ? -40 : 60}deg)`, opacity: 0.7 },
      ],
      { duration: 720, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" },
    ),
  );
  img.remove();
}

/** Clods of dirt (or, soft, a few dust specks) bursting from the tile. */
export function dirt(rect, { soft = false } = {}) {
  if (reducedMotion()) return;
  const c = centre(rect);
  const n = soft ? 6 : 12;
  const colours = soft ? ["#9a93a6", "#7a4b2e"] : ["#4a2f22", "#7a4b2e", "#5b8a3a", "#4a2f22"];
  for (let k = 0; k < n; k++) {
    const d = document.createElement("div");
    d.className = "fx-clod";
    const size = soft ? 4 : 6 + Math.floor(Math.random() * 4);
    Object.assign(d.style, { left: `${c.x}px`, top: `${rect.bottom - 14}px`, width: `${size}px`, height: `${size}px`, background: colours[k % colours.length] });
    layer().appendChild(d);
    const ang = Math.PI * (0.15 + 0.7 * Math.random());
    const dist = (soft ? 25 : 45) + Math.random() * (soft ? 20 : 40);
    const x = Math.cos(ang) * dist * (k % 2 ? 1 : -1);
    const up = Math.sin(ang) * dist;
    d.animate(
      [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: `translate(${x * 0.6}px, ${-up}px)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x}px, ${-up * 0.2 + 30}px)`, opacity: 0 },
      ],
      { duration: 560 + Math.random() * 160, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => d.remove();
  }
}

/** A sprite after a float's number (the candy), at 2×: pixel art, never an emoji. */
function withIcon(d, text, icon) {
  d.textContent = text;
  if (!icon) return;
  const img = document.createElement("img");
  img.src = icon;
  img.alt = "candy";
  img.className = "ico";
  img.dataset.icon = "candy";
  Object.assign(img.style, { width: "32px", height: "32px" });
  d.append(" ", img);
}

/** "+4 (candy)" rising from the tile; `victim` = big red "-1" on a robbed pumpkin. */
export function floatText(rect, text, { victim = false, icon = null } = {}) {
  const d = document.createElement("div");
  d.className = victim ? "fx-float fx-victim" : "fx-float";
  withIcon(d, text, icon);
  const c = centre(rect);
  // A robbed pumpkin's loss starts on the pumpkin itself, not above the tile.
  Object.assign(d.style, { left: `${c.x}px`, top: `${victim ? rect.top + rect.height * 0.35 : rect.top}px` });
  layer().appendChild(d);
  d.animate(
    reducedMotion()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { transform: "translate(-50%, 0) scale(.8)", opacity: 0 },
          { transform: "translate(-50%, -18px) scale(1.15)", opacity: 1, offset: 0.2 },
          { transform: "translate(-50%, -60px) scale(1)", opacity: 0 },
        ],
    { duration: 1100, easing: "ease-out", fill: "forwards" },
  ).onfinish = () => d.remove();
}

/** A "+1 (candy)" that flies from a tile to the candy counter. */
export async function flyText(text, from, to, { icon = null } = {}) {
  const d = document.createElement("div");
  d.className = "fx-float fx-gain";
  withIcon(d, text, icon);
  const a = centre(from);
  Object.assign(d.style, { left: `${a.x}px`, top: `${a.y}px` });
  layer().appendChild(d);
  if (!to || reducedMotion()) {
    await done(d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" }));
    d.remove();
    return;
  }
  const b = centre(to);
  await done(
    d.animate(
      [
        { transform: "translate(-50%, -50%) scale(.8)", opacity: 0 },
        { transform: `translate(calc(-50% + ${(b.x - a.x) * 0.2}px), calc(-50% - 50px)) scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(calc(-50% + ${b.x - a.x}px), calc(-50% + ${b.y - a.y}px)) scale(.6)`, opacity: 0.4 },
      ],
      { duration: 800, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" },
    ),
  );
  d.remove();
}

/** A sprite settling onto a tile (a guard ghost taking its post). */
export async function fadeIn(src, rect) {
  const img = sprite(src, rect, "fx-ghost");
  await done(
    img.animate(
      reducedMotion()
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { transform: "translateY(-30px) scale(.6)", opacity: 0 },
            { transform: "translateY(4px) scale(1.05)", opacity: 1, offset: 0.7 },
            { transform: "none", opacity: 1 },
          ],
      { duration: 420, easing: "ease-out", fill: "forwards" },
    ),
  );
  img.remove();
}

/** A handful of candies bursting out: a steal that worked. */
export function confetti(rect, candySrc) {
  if (reducedMotion()) return;
  const c = centre(rect);
  for (let k = 0; k < 9; k++) {
    const img = document.createElement("img");
    img.src = candySrc;
    img.alt = "";
    img.className = "fx-candy";
    Object.assign(img.style, { left: `${c.x - 12}px`, top: `${c.y - 12}px` });
    layer().appendChild(img);
    const ang = (Math.PI * 2 * k) / 9 + Math.random() * 0.4;
    const r = 50 + Math.random() * 30;
    img.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(.6)", opacity: 1 },
        { transform: `translate(${Math.cos(ang) * r}px, ${Math.sin(ang) * r - 30}px) rotate(${200 + k * 40}deg) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(ang) * r * 1.2}px, ${Math.sin(ang) * r + 20}px) rotate(${300 + k * 40}deg) scale(.8)`, opacity: 0 },
      ],
      { duration: 900, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => img.remove();
  }
}

/** A ghost bursting up out of a tile. */
export async function ghostBurst(rect, ghostSrc) {
  const g = sprite(ghostSrc, rect, "fx-ghost");
  if (reducedMotion()) {
    await done(g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: "forwards" }));
    return g;
  }
  await done(
    g.animate(
      [
        { transform: "translateY(30%) scale(.3)", opacity: 0 },
        { transform: "translateY(-40%) scale(1.9)", opacity: 1, offset: 0.55 },
        { transform: "translateY(-30%) scale(1.6)", opacity: 1 },
      ],
      { duration: 420, easing: "cubic-bezier(.2,1.4,.4,1)", fill: "forwards" },
    ),
  );
  return g;
}

/**
 * A hidden guard ghost jumps out of the pumpkin with a comic "BOO!" bubble.
 * Reduced motion: no rise and no shake — the ghost and bubble just appear.
 */
export async function booPop(rect, ghostSrc) {
  const g = sprite(ghostSrc, rect, "fx-guard-pop");
  const bubble = document.createElement("div");
  bubble.className = "fx-boo";
  bubble.textContent = "BOO!";
  const c = centre(rect);
  Object.assign(bubble.style, { left: `${c.x + rect.width * 0.35}px`, top: `${rect.top - rect.height * 0.55}px` });
  layer().appendChild(bubble);
  if (reducedMotion()) {
    await Promise.all([
      done(g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: "forwards" })),
      done(bubble.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: "forwards" })),
    ]);
    await new Promise((ok) => setTimeout(ok, 700));
  } else {
    await Promise.all([
      done(
        g.animate(
          [
            { transform: "translateY(20%) scale(.4)", opacity: 0 },
            { transform: "translateY(-75%) scale(1.5)", opacity: 1, offset: 0.4 },
            { transform: "translateY(-60%) scale(1.35)", opacity: 1 },
          ],
          { duration: 380, easing: "cubic-bezier(.2,1.6,.4,1)", fill: "forwards" },
        ),
      ),
      done(
        bubble.animate(
          [
            { transform: "translate(-50%, -50%) scale(0) rotate(-14deg)", opacity: 0 },
            { transform: "translate(-50%, -50%) scale(1.25) rotate(4deg)", opacity: 1, offset: 0.45 },
            { transform: "translate(-50%, -50%) scale(1) rotate(-3deg)", opacity: 1 },
          ],
          { duration: 360, delay: 120, easing: "cubic-bezier(.2,1.5,.4,1)", fill: "forwards" },
        ),
      ),
    ]);
    // …and a little shake while it hangs there.
    await done(
      bubble.animate(
        [
          { transform: "translate(-50%, -50%) rotate(-3deg)" },
          { transform: "translate(calc(-50% + 3px), calc(-50% - 2px)) rotate(2deg)" },
          { transform: "translate(calc(-50% - 3px), -50%) rotate(-4deg)" },
          { transform: "translate(calc(-50% + 2px), calc(-50% + 2px)) rotate(1deg)" },
          { transform: "translate(-50%, -50%) rotate(-3deg)" },
        ],
        { duration: 420, iterations: 1, fill: "forwards" },
      ),
    );
    await new Promise((ok) => setTimeout(ok, 250));
  }
  await Promise.all([
    done(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" })),
    done(bubble.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" })),
  ]);
  g.remove();
  bubble.remove();
}

/** Fly a ghost sprite to a target rect (your farm) and fade into it. */
export async function ghostFlyTo(g, to) {
  if (!g) return;
  if (!to || reducedMotion()) {
    await done(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }));
    g.remove();
    return;
  }
  const from = g.getBoundingClientRect();
  const a = centre(from);
  const b = centre(to);
  await done(
    g.animate(
      [
        { transform: getComputedStyle(g).transform === "none" ? "none" : getComputedStyle(g).transform, opacity: 1 },
        { transform: `translate(${(b.x - a.x) * 0.5}px, ${(b.y - a.y) * 0.5 - 90}px) scale(1.2) rotate(-10deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(.6)`, opacity: 0.2 },
      ],
      { duration: 900, easing: "ease-in-out", fill: "forwards" },
    ),
  );
  g.remove();
}

/** Shake the page and flash plum → blood. Never under reduced motion. */
export function shakeAndFlash(target) {
  if (reducedMotion()) return Promise.resolve();
  target.classList.add("shake");
  const f = document.createElement("div");
  f.className = "fx-flash";
  layer().appendChild(f);
  const anim = f.animate(
    [
      { background: "rgba(107,61,122,0)" },
      { background: "rgba(107,61,122,.55)", offset: 0.25 },
      { background: "rgba(163,36,59,.5)", offset: 0.6 },
      { background: "rgba(163,36,59,0)" },
    ],
    { duration: 320, fill: "forwards" },
  );
  return done(anim).then(() => {
    f.remove();
    target.classList.remove("shake");
  });
}

/** The candy counter in the HUD jumps. */
export function bump(el) {
  if (!el) return;
  el.animate(
    reducedMotion()
      ? [{ opacity: 0.4 }, { opacity: 1 }]
      : [{ transform: "scale(1)" }, { transform: "scale(1.45)", offset: 0.35 }, { transform: "scale(1)" }],
    { duration: 380, easing: "ease-out" },
  );
}
