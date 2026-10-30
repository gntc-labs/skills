(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const rand = (a, b) => a + Math.random() * (b - a);

/* ================= patch config ================= */
const CFG = JSON.parse($("patch").textContent);
// The patch's own secret variety (1%, only grows here) is a variety like any other once rolled: it can be
// carved, linked and opened. A link carrying ANOTHER patch's secret is refused (see validate).
const SECRET = CFG.secret || null;
const SECRET_IDS = Array.isArray(CFG.secretIds) ? CFG.secretIds : [];
const ALL_VARIETIES = SECRET ? [...CFG.varieties, SECRET] : CFG.varieties;
const VAR = new Map(ALL_VARIETIES.map((v) => [v.id, v]));
const isSecret = (id) => !!SECRET && id === SECRET.id;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const article = (w) => (/^[AEIOU]/i.test(w) ? "an" : "a");

// link v4 names a variety by its place in this list: dice.json's varieties, then its secrets (keep both append-only)
const VARIETY_ORDER = [...CFG.varieties.map((v) => v.id), ...SECRET_IDS.filter((id) => !CFG.varieties.some((v) => v.id === id))];
/* ---- link rules: everything that decides whether a pumpkin link is valid. Pure, no DOM. build.mjs runs this
   exact block in Node (between the markers) to validate an owner's showcase link with the same rules. ---- */
//@link-rules-start
const BRUSH = { 1: 5, 2: 9, 3: 15 };
const MAX = { from: 24, msg: 60, frag: 4000, strokes: 400, pts: 1000, totalPts: 8000, inflated: 300000, texts: 2, textLen: 12 };
const TEXT = { sMin: 0.04, sMax: 0.5 };
const FRAG_RE = /^[A-Za-z0-9_-]{4,6000}$/;
/* carved words: up to 12 characters of any script; emoji, control and format characters are dropped */
const STRIP = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\p{C}⃣︎️]/gu;
function cleanWord(s) {
  if (typeof s !== "string") return "";
  return [...s.replace(STRIP, "").replace(/\s+/g, " ").trim()].slice(0, MAX.textLen).join("").trim();
}
function cleanText(s, max) {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
// Link versions: v2 = strokes only (still opens), v3 = strokes + up to 2 carved words (both JSON),
// v4 = the binary payload below (stencils by id). validate() checks every version's decoded object.
function validate(o) {
  const bad = (why) => { throw new Error("invalid: " + why); };
  if (!o || typeof o !== "object" || Array.isArray(o)) bad("root");
  if (o.v !== 2 && o.v !== 3 && !(o.v === 4 && o.binary === true)) bad("version");
  if (o.v === 4 && o.stencil !== undefined && !STENCIL_IDS.includes(o.stencil) && o.stencil !== "owner") bad("stencil");
  if (o.v === 4 && o.stencil === "owner" && !(Number.isInteger(o.ownerHash) && o.ownerHash >= 0 && o.ownerHash <= 0xffff)) bad("owner stencil");
  if (typeof o.variety === "string" && !VAR.has(o.variety) && SECRET_IDS.includes(o.variety)) bad("foreign secret");
  if (typeof o.variety !== "string" || !VAR.has(o.variety)) bad("variety");
  if (!Number.isInteger(o.pseed) || o.pseed < 0 || o.pseed > 0xffffffff) bad("pseed");
  if (!Array.isArray(o.strokes) || o.strokes.length > MAX.strokes) bad("strokes");
  let total = 0;
  const strokes = o.strokes.map((s) => {
    if (!s || typeof s !== "object" || Array.isArray(s)) bad("stroke");
    if (!Number.isInteger(s.size) || !has(BRUSH, s.size)) bad("size");
    if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > MAX.pts) bad("points");
    total += s.points.length; if (total > MAX.totalPts) bad("total");
    return { size: s.size, points: s.points.map((p) => {
      if (!Array.isArray(p) || p.length !== 2) bad("point");
      for (const n of p) if (!Number.isInteger(n) || n < 0 || n > 255) bad("coord");
      return [p[0], p[1]];
    }) };
  });
  let texts = [];
  if (o.v >= 3) {
    if (o.texts !== undefined && (!Array.isArray(o.texts) || o.texts.length > MAX.texts)) bad("texts");
    const num = (n, lo, hi) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;
    texts = (o.texts || []).map((tx) => {
      if (!tx || typeof tx !== "object" || Array.isArray(tx)) bad("text");
      if (typeof tx.t !== "string" || tx.t.length > 64) bad("text t");
      const t = cleanWord(tx.t);
      if (!t || t !== tx.t) bad("text chars");
      if (!num(tx.x, 0, 1) || !num(tx.y, 0, 1) || !num(tx.s, TEXT.sMin, TEXT.sMax) || !num(tx.r, -180, 180)) bad("text numbers");
      return o.v === 4 && tx.st ? { t, x: tx.x, y: tx.y, s: tx.s, r: tx.r, st: o.stencil } : { t, x: tx.x, y: tx.y, s: tx.s, r: tx.r };
    });
  }
  for (const k of ["from", "msg"]) if (o[k] !== undefined && (typeof o[k] !== "string" || o[k].length > MAX[k] * 2)) bad(k);
  const out = { variety: o.variety, pseed: o.pseed, strokes, texts, from: cleanText(o.from, MAX.from), msg: cleanText(o.msg, MAX.msg) };
  if (o.v === 4 && o.stencil) { out.stencil = o.stencil; if (o.stencil === "owner") out.ownerHash = o.ownerHash; }
  return out;
}
/* ---- link v4 ---- a compact binary payload, deflate-raw'd and base64url'd like v3 (the inflated bytes tell the
   versions apart: v2/v3 start with "{", v4 with the byte 4). All integers are LEB128 varints unless noted.
     4 | variety: index in VARIETY_ORDER (dice varieties, then dice secrets: append-only) | pseed: 4 bytes LE |
     flags: 1 stencil, 2 from, 4 msg, 8 words |
     [stencil: 1 byte, index in STENCIL_IDS, or 255 = the owner's carving + 2 bytes LE: hash of the showcase link] |
     strokes: count, then per stroke ((points - 1) << 2 | brush size), first point x, y (1 byte each), then each
       next point as zigzag dx, dy (strokes a stencil made are NOT stored: the stencil is re-fitted on open) |
     [words: count, then per word (utf8 length << 1 | made by the stencil), utf8, round(x * 1000), round(y * 1000),
       round(s * 1000), round(r) + 180] | [from: utf8 length, utf8] | [msg: utf8 length, utf8] */
// append only: a link stores the index, so existing ids keep their numbers forever
const STENCIL_IDS = ["classic", "spooky", "surprised", "cat", "bat", "vampire", "ghost", "spiderweb", "witch", "skull", "owl"];
const OWNER_STENCIL = 255;
function encodeV4(d) {
  const out = [], u8 = (n) => out.push(n & 255), vint = (n) => { n = Math.max(0, Math.floor(n)); do { let b = n & 127; n = Math.floor(n / 128); if (n) b |= 128; out.push(b); } while (n); };
  const zz = (n) => (n < 0 ? -2 * n - 1 : 2 * n), utf = (t) => { const b = new TextEncoder().encode(t); vint(b.length); out.push(...b); }, utfFlag = (t, f) => { const b = new TextEncoder().encode(t); vint(b.length * 2 + (f ? 1 : 0)); out.push(...b); };
  const vi = VARIETY_ORDER.indexOf(d.variety); if (vi < 0) throw new Error("variety");
  u8(4); vint(vi); for (let i = 0; i < 4; i++) u8(d.pseed >>> (8 * i));
  u8((d.stencil ? 1 : 0) | (d.from ? 2 : 0) | (d.msg ? 4 : 0) | (d.texts.length ? 8 : 0));
  if (d.stencil) { if (d.stencil === "owner") { u8(OWNER_STENCIL); u8(d.ownerHash); u8(d.ownerHash >>> 8); } else u8(STENCIL_IDS.indexOf(d.stencil)); }
  vint(d.strokes.length);
  for (const s of d.strokes) {
    const p = s.points; vint(((p.length - 1) << 2) | s.size); u8(p[0][0]); u8(p[0][1]);
    for (let i = 1; i < p.length; i++) { vint(zz(p[i][0] - p[i - 1][0])); vint(zz(p[i][1] - p[i - 1][1])); }
  }
  if (d.texts.length) { vint(d.texts.length); for (const t of d.texts) { utfFlag(t.t, !!t.st); vint(Math.round(t.x * 1000)); vint(Math.round(t.y * 1000)); vint(Math.round(t.s * 1000)); vint(Math.round(t.r) + 180); } }
  if (d.from) utf(d.from);
  if (d.msg) utf(d.msg);
  return Uint8Array.from(out);
}
function decodeV4(b) {
  const bad = (why) => { throw new Error("invalid: " + why); };
  let i = 0;
  const u8 = () => { if (i >= b.length) bad("short"); return b[i++]; };
  const vint = () => { let n = 0, m = 1; for (let k = 0; k < 5; k++) { const x = u8(); n += (x & 127) * m; if (!(x & 128)) return n; m *= 128; } bad("varint"); };
  const unzz = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);
  const utf = (len) => { if (len > 400 || i + len > b.length) bad("text length"); const t = new TextDecoder("utf-8", { fatal: true }).decode(b.subarray(i, i + len)); i += len; return t; };
  if (u8() !== 4) bad("version");
  const vi = vint(); if (vi >= VARIETY_ORDER.length) bad("variety");
  const o = { v: 4, binary: true, variety: VARIETY_ORDER[vi], pseed: (u8() | (u8() << 8) | (u8() << 16) | (u8() << 24)) >>> 0, strokes: [], texts: [] };
  const flags = u8(); if (flags & ~15) bad("flags");
  if (flags & 1) { const st = u8(); if (st === OWNER_STENCIL) { o.stencil = "owner"; o.ownerHash = u8() | (u8() << 8); } else if (st < STENCIL_IDS.length) o.stencil = STENCIL_IDS[st]; else bad("stencil"); }
  const ns = vint(); if (ns > MAX.strokes) bad("strokes");
  for (let k = 0; k < ns; k++) {
    const h = vint(), n = Math.floor(h / 4) + 1; if (n > MAX.pts) bad("points");
    const pts = [[u8(), u8()]];
    for (let j = 1; j < n; j++) { const l = pts[j - 1]; pts.push([l[0] + unzz(vint()), l[1] + unzz(vint())]); }
    o.strokes.push({ size: h & 3, points: pts });
  }
  if (flags & 8) {
    const nt = vint(); if (nt > MAX.texts) bad("texts");
    for (let k = 0; k < nt; k++) { const h = vint(); const t = utf(Math.floor(h / 2)); o.texts.push({ t, x: vint() / 1000, y: vint() / 1000, s: vint() / 1000, r: vint() - 180, st: h % 2 === 1 }); }
  }
  if (flags & 2) o.from = utf(vint());
  if (flags & 4) o.msg = utf(vint());
  if (i !== b.length) bad("trailing bytes");
  return o;
}
// the inflated bytes of any link -> its (unvalidated) object
function parsePayload(bytes) {
  if (bytes.length && bytes[0] === 4) return decodeV4(bytes);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
/* ---- /link v4 ---- */
//@link-rules-end

function computeWeights({ signature = CFG.signature, event = CFG.event.id } = {}) {
  const tierW = Object.fromEntries(CFG.tiers.map((t) => [t.id, t.weight]));
  const raw = CFG.varieties.map((v) => {
    const n = CFG.varieties.filter((o) => o.tier === v.tier).length;
    return [v, (tierW[v.tier] / n) * (v.id === signature ? CFG.signatureMultiplier : 1)];
  });
  const total = raw.reduce((a, [, w]) => a + w, 0);
  // the weather multiplies a tier's share (x2 = exactly twice as likely); the other tiers shrink in proportion
  const mods = has(CFG.eventMods, event) ? CFG.eventMods[event] : {};
  const boosted = raw.reduce((a, [v, w]) => a + (mods[v.tier] ? (w / total) * mods[v.tier] : 0), 0);
  const plain = raw.reduce((a, [v, w]) => a + (mods[v.tier] ? 0 : w / total), 0);
  const shrink = (1 - boosted) / plain;
  // the secret takes a flat share that no weather changes; everything else shrinks in proportion
  const S = SECRET ? SECRET.chance : 0;
  const out = raw.map(([v, w]) => [v.id, (w / total) * (mods[v.tier] ?? shrink) * (100 - S)]);
  if (SECRET) out.push([SECRET.id, S]);
  return out;
}
const WEIGHTS = computeWeights();
const fmtOdds = (w) => `${w < 10 && Math.round(w) !== w ? w.toFixed(1) : Math.round(w)}%`;
const oddsOf = (id) => fmtOdds(WEIGHTS.find(([k]) => k === id)[1]);
const u32 = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0]; };
function rollVariety(weights = WEIGHTS) {
  let r = (u32() / 4294967296) * 100;
  for (const [id, w] of weights) { r -= w; if (r < 0) return id; }
  return weights[weights.length - 1][0];
}
let forcedNext = null; // test hook only (__pumpkinPatch.forceNext): the next harvest is this variety
// Per-visitor luck, on top of the plain roll (fresh harvests in this browser only; a shared link carries its own
// variety and never reads or writes this): never the same variety twice in a row (the secret may repeat), and after
// LUCK_DRY Common/Uncommon harvests in a row the next one is Rare or better. Kept in localStorage per patch, never
// sent anywhere; if storage fails it is the plain roll.
const LUCK_KEY = `pumpkin-patch:luck:${CFG.seed}`, LUCK_DRY = 4, LOW_TIERS = new Set(["Common", "Uncommon"]);
// a draw from some of the varieties, each keeping its share of WEIGHTS
const rollAmong = (keep) => { const w = WEIGHTS.filter(([id]) => keep(id)), t = w.reduce((a, [, x]) => a + x, 0); return rollVariety(w.map(([id, x]) => [id, (x / t) * 100])); };
function luckyRoll() {
  let luck;
  try { luck = JSON.parse(localStorage.getItem(LUCK_KEY) || "{}"); } catch (_) { return rollVariety(); }
  const last = typeof luck.last === "string" ? luck.last : "", dry = Number.isInteger(luck.dry) ? luck.dry : 0;
  const isSecret = (id) => !!SECRET && id === SECRET.id;
  let variety = rollVariety();
  // pity: the secret keeps its own flat chance; otherwise Rare or Legendary, in their usual proportions
  if (dry >= LUCK_DRY && !isSecret(variety)) variety = rollAmong((id) => !isSecret(id) && !LOW_TIERS.has(VAR.get(id).tier));
  // no repeats: a re-draw among the other varieties (not the secret, so its chance stays flat)
  else if (variety === last && !isSecret(variety)) variety = rollAmong((id) => id !== last && !isSecret(id));
  const next = { last: variety, dry: LOW_TIERS.has(VAR.get(variety).tier) ? dry + 1 : 0 };
  try { localStorage.setItem(LUCK_KEY, JSON.stringify(next)); } catch (_) {}
  return variety;
}
const newPumpkin = () => { const variety = forcedNext && VAR.has(forcedNext) ? forcedNext : luckyRoll(); forcedNext = null; return { variety, pseed: u32() }; };
// Small, deterministic per-pumpkin variation; the link carries pseed, so the friend sees the same one.
function lookOf(pseed) {
  return { scale: 0.92 + 0.16 * ((pseed & 0xff) / 255), hue: -6 + 12 * (((pseed >>> 8) & 0xff) / 255), flip: ((pseed >>> 16) & 1) === 1 };
}

/* ================= quality: "full", or "lite" for weak devices ================= */
// Lite: fog drawn by the cheap 2D fallback at low resolution, half the rain, fewer fireflies / ghosts, no blur
// filters (pre-darkened panels instead), the carving canvas at <= 2x. Chosen from device signals (<= 4 cores,
// <= 4 GB, Save-Data, prefers-reduced-data), or measured: an average frame over 22 ms in the first 2 s.
// ?quality=lite|full overrides both. Sets html.lite + html[data-quality] and fires "pumpkin:quality" on change.
const QUALITY = (() => {
  const q = new URLSearchParams(location.search).get("quality"), nav = navigator;
  const mm = (m) => { try { return matchMedia(m).matches; } catch (_) { return false; } };
  const signals = [];
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) signals.push("cores");
  if (nav.deviceMemory && nav.deviceMemory <= 4) signals.push("memory");
  if (nav.connection && nav.connection.saveData) signals.push("save-data");
  if (mm("(prefers-reduced-data: reduce)")) signals.push("reduced-data");
  const st = { forced: q === "lite" || q === "full" ? q : null, signals, frameMs: null, lite: false, reason: "" };
  const set = (lite, why) => {
    const changed = st.lite !== lite; st.lite = lite; st.reason = why;
    document.documentElement.classList.toggle("lite", lite); document.documentElement.dataset.quality = lite ? "lite" : "full";
    if (changed) dispatchEvent(new CustomEvent("pumpkin:quality", { detail: { lite } }));
  };
  if (st.forced) set(st.forced === "lite", "?quality"); else set(signals.length > 0, signals.join(","));
  if (!st.forced && !st.lite) {
    const dts = []; let last = 0, start = 0;
    const tick = (now) => {
      if (!start) start = now;
      if (last && now - start > 300) { const dt = now - last; if (dt < 250) dts.push(dt); } // skip load jank and paused tabs
      last = now;
      if (now - start < 2300) { requestAnimationFrame(tick); return; }
      const avg = dts.reduce((a, b) => a + b, 0) / Math.max(1, dts.length); st.frameMs = +avg.toFixed(1);
      if (dts.length >= 20 && avg > 22) set(true, `frame ${st.frameMs} ms`);
    };
    requestAnimationFrame(tick);
  }
  return st;
})();

/* ================= sound: all synthesised with Web Audio, no files ================= */
// One theme per scene (key, tempo, meter, voices, a looped 16-24 bar tune) + a continuous ambience bed,
// weather layers on top, and a tier-blind suspense build before the harvest reveal.
// createAudio() works on any BaseAudioContext, so an OfflineAudioContext can render it without a gesture;
// the page itself still only creates its AudioContext inside a user gesture (Sound.unlock).
const BUILD_S = 2.4; // suspense build length; the reveal card flips when it resolves
const prng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const MODES = { minor: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], blues: [0, 3, 5, 6, 7, 10], pentatonic: [0, 2, 4, 7, 9] };
// Scene themes. chords: one per bar; rhythms: one bar each ("x" note, "-" hold, "." rest); bass / comp: per step
// ("R" root, "5" fifth, "3" third, "8" octave, "c" chord); form: which 4-bar phrases share a melody seed.
// mix / ambMix even out loudness between themes (plucked voices measure much quieter than sustained ones).
const THEMES = {
  "moonlit-graveyard": { mix: 1, ambMix: 1.4, key: "D minor", root: 62, mode: "minor", bpm: 66, beats: 4, sub: 2, meter: "4/4",
    chords: "Dm Bb Gm A Dm F C A Bb F Gm Dm Bb Gm Asus4 A", form: "ABAC",
    lead: "celesta", range: [69, 86], leadVel: 0.3, rhythms: ["x-x-x---", "x---x-x-", "x-xxx---", "x-----x-", "x--xx---"], end: "x-------",
    pad: "organ", padLo: 50, padVel: 0.2, bass: "R---5---", bassVoice: "sub", bassLo: 38, bassVel: 0.24,
    amb: "wind", echo: 0.28, reverb: 0.35, instruments: "celesta bell lead, soft organ pad, sine bass" },
  "witch-yard": { mix: 2.2, ambMix: 2.25, key: "E harmonic minor", root: 64, mode: "harmonic", bpm: 126, beats: 3, sub: 2, meter: "3/4 waltz",
    chords: "Em Am B7 Em Em C F#dim B7 Am Em C B7 Em Am B7 B7", form: "AABA",
    lead: "pizz", range: [64, 83], leadVel: 0.42, rhythms: ["x---x-", "x-x-x-", "x-xxx-", "x----x", "xxx-x-"], end: "x-----",
    bass: "R-----", bassVoice: "pizzbass", bassLo: 40, bassVel: 0.36, comp: "..c.c.", compVoice: "pizz", compLo: 55, compVel: 0.2,
    amb: "cauldron", echo: 0.18, reverb: 0.3, instruments: "pizzicato lead, pizzicato oom-pah-pah, plucked cello bass" },
  "scarecrow-field": { mix: 4.1, ambMix: 7, key: "A Dorian", root: 57, mode: "dorian", bpm: 100, beats: 4, sub: 2, meter: "4/4",
    chords: "Am D Am D G C Em D Am D Am D C G D D", form: "AABA",
    lead: "banjo", range: [64, 84], leadVel: 0.36, rhythms: ["xxx-x-x-", "x-xxx-x-", "xx-xx-x-", "x-x-xxx-", "x-x-x---"], end: "x---x---",
    bass: "R---5---", bassVoice: "upright", bassLo: 40, bassVel: 0.4, comp: "..c...c.", compVoice: "strum", compLo: 55, compVel: 0.16,
    amb: "crickets", echo: 0.12, reverb: 0.22, instruments: "Karplus-Strong banjo lead, strummed guitar on 2 and 4, plucked upright bass" },
  "foggy-greenhouse": { mix: 1.12, ambMix: 5.6, key: "C Lydian", root: 60, mode: "lydian", bpm: 72, beats: 4, sub: 2, meter: "4/4",
    chords: "Cmaj7 D Cmaj7 D Em7 D Am7 D Cmaj7 D G Bm Em D Cmaj7 D", form: "ABAC",
    lead: "softbell", range: [67, 88], leadVel: 0.26, rhythms: ["x---x---", "x-------", "x---x-x-", "x-x-x---", "..x-x---"], end: "x-------",
    pad: "glass", padLo: 55, padVel: 0.2, bass: "R-------", bassVoice: "sub", bassLo: 36, bassVel: 0.18,
    amb: "drips", echo: 0.32, reverb: 0.5, instruments: "glass-harmonica pad, soft bell lead, quiet sine bass" },
  "haunted-mansion": { mix: 4.5, ambMix: 5.4, key: "B♭ minor", root: 58, mode: "harmonic", bpm: 104, beats: 3, sub: 2, meter: "3/4 minuet",
    chords: "Bbm Fm Bbm F Gb Db Ebm F Bbm Ebm Ab Db Gb Ebm F F", form: "AABA",
    lead: "harpsi", range: [65, 84], leadVel: 0.32, rhythms: ["x-x-x-", "xxx-x-", "x-xxx-", "x---x-", "xxxxx-"], end: "x-----",
    bass: "R---5-", bassVoice: "harpsibass", bassLo: 41, bassVel: 0.3, comp: "..c.c.", compVoice: "harpsi", compLo: 58, compVel: 0.14,
    amb: "creaks", echo: 0.1, reverb: 0.4, instruments: "harpsichord lead and continuo (Karplus-Strong)" },
  "bayou-swamp": { mix: 3.7, ambMix: 4.6, key: "E minor blues", root: 64, mode: "blues", bpm: 72, beats: 4, sub: 2, swing: 0.3, meter: "4/4 slow swing",
    chords: "Em7 Em7 Em7 Em7 Am7 Am7 Em7 Em7 B7 Am7 Em7 B7 Em7 Em7 Em7 Em7 Am7 Am7 Em7 Em7 B7 Am7 Em7 B7", form: "ABCABD",
    lead: "slide", range: [59, 79], leadVel: 0.38, rhythms: ["x--x-x--", ".x-x-x--", "x---x-x-", "x-x--x--", "..x-x-x-"], end: "x---x---",
    bass: "R--.5--.", bassVoice: "upright", bassLo: 40, bassVel: 0.4, comp: "..c...c.", compVoice: "muted", compLo: 52, compVel: 0.13,
    amb: "swamp", echo: 0.2, reverb: 0.3, instruments: "slide guitar lead with pitch glides, muted guitar chops, upright bass" },
  "enchanted-forest": { mix: 0.69, ambMix: 5, key: "F major pentatonic", root: 65, mode: "pentatonic", bpm: 84, beats: 4, sub: 2, meter: "4/4",
    chords: "F Dm Bb C F Am Bb C Dm Bb F C Bb F Gm7 C", form: "ABAC",
    lead: "flute", range: [65, 86], leadVel: 0.3, rhythms: ["x---x---", "x-x-x---", "x---x-x-", "x-----x-", "x-xxx---"], end: "x-------",
    pad: "warm", padLo: 53, padVel: 0.16, bass: "R---5---", bassVoice: "sub", bassLo: 41, bassVel: 0.2, chimes: true,
    amb: "forest", echo: 0.3, reverb: 0.4, instruments: "breathy flute lead with vibrato, wind chimes, warm pad" },
  "shipwreck-cove": { mix: 1.24, ambMix: 2.1, key: "D minor (Dorian)", root: 62, mode: "dorian", bpm: 56, beats: 2, sub: 3, meter: "6/8 shanty",
    chords: "Dm Dm C C Dm Dm Am Dm F C Dm Am Dm C Am Dm", form: "AABA",
    lead: "accordion", range: [62, 81], leadVel: 0.26, rhythms: ["x-xx-x", "x--x-x", "x-xx--", "x--x--", "xxxx-x"], end: "x-----",
    bass: "R--5--", bassVoice: "accbass", bassLo: 38, bassVel: 0.2, comp: "...c--", compVoice: "acc", compLo: 57, compVel: 0.15, drone: [38, 45],
    amb: "waves", echo: 0.15, reverb: 0.3, instruments: "squeezebox (detuned pulse) lead and chords, low D-A drone" },
};
const FALLBACK_THEME = "moonlit-graveyard";
const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7] };
function parseChord(s) {
  const m = /^([A-G])([b#]?)(maj7|m7|m|7|dim|sus4)?$/.exec(s);
  if (!m) throw new Error("bad chord " + s);
  const root = (NOTE_PC[m[1]] + (m[2] === "b" ? 11 : m[2] === "#" ? 1 : 0)) % 12;
  return { name: s, root, pcs: QUAL[m[3] || ""].map((i) => (root + i) % 12) };
}
const inWindow = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12;
// Pre-computes the whole loop (deterministic per theme), so it repeats seamlessly bar for bar.
function compose(id, th) {
  const steps = th.beats * th.sub, chords = th.chords.split(/\s+/).map(parseChord), bars = chords.length, total = bars * steps;
  const ev = Array.from({ length: total }, () => []);
  const scalePc = new Set(MODES[th.mode].map((i) => (th.root + i) % 12));
  const pool = []; for (let m = th.range[0]; m <= th.range[1]; m++) if (scalePc.has(m % 12)) pool.push(m);
  let prev = pool[Math.floor(pool.length / 2)];
  const parse = (pat, fn) => { for (let s = 0; s < pat.length; s++) { if (pat[s] === "-" || pat[s] === ".") continue; let d = 1; while (s + d < pat.length && pat[s + d] === "-") d++; fn(s, d, pat[s]); } };
  for (let b = 0; b < bars; b++) {
    const c = chords[b], base = b * steps;
    if (th.pad) ev[base].push({ p: "pad", v: th.pad, m: c.pcs.map((pc) => inWindow(pc, th.padLo)), d: steps, g: th.padVel });
    const bassNote = (sym) => { const r = inWindow(c.root, th.bassLo); return sym === "5" ? r + 7 - (r + 7 > th.bassLo + 14 ? 12 : 0) : sym === "3" ? inWindow(c.pcs[1], th.bassLo) : sym === "8" ? r + 12 : r; };
    if (th.bass) parse(th.bass, (s, d, sym) => ev[base + s].push({ p: "bass", v: th.bassVoice, m: bassNote(sym), d, g: th.bassVel * (s ? 0.85 : 1) }));
    if (th.comp) parse(th.comp, (s, d) => ev[base + s].push({ p: "comp", v: th.compVoice, m: c.pcs.map((pc) => inWindow(pc, th.compLo)), d, g: th.compVel }));
    const letter = th.form[Math.floor(b / 4) % th.form.length], r = prng(hashStr(`${id}:${letter}:${b % 4}`));
    const last = b === bars - 1;
    const rhythm = last ? th.end : th.rhythms[Math.floor(r() * th.rhythms.length)];
    const chordTones = pool.filter((m) => c.pcs.includes(m % 12));
    parse(rhythm, (s, d) => {
      const strong = s % th.sub === 0;
      let cand = (strong || last) && chordTones.length ? chordTones : pool;
      if (prev > th.range[1] - 4 && cand.some((m) => m < prev)) cand = cand.filter((m) => m < prev);
      else if (prev < th.range[0] + 4 && cand.some((m) => m > prev)) cand = cand.filter((m) => m > prev);
      const near = cand.filter((m) => m !== prev || r() < 0.12).sort((a, z) => Math.abs(a - prev) - Math.abs(z - prev));
      const pick = near.length ? near[Math.min(near.length - 1, Math.floor(r() * r() * Math.min(4, near.length)))] : prev;
      const e = { p: "lead", v: th.lead, m: pick, d, g: th.leadVel * (s === 0 ? 1.1 : 0.85 + r() * 0.15) };
      if (th.lead === "slide" && pick > prev && r() < 0.45) e.from = pick - (r() < 0.5 ? 1 : 2);
      ev[base + s].push(e); prev = pick;
    });
    if (th.chimes && b % 2 === 1) ev[base + 4].push({ p: "chime", v: "chime", m: [0, 1, 2].map(() => pool[pool.length - 1 - Math.floor(r() * 5)] + 12), d: 4, g: 0.07 });
  }
  return { steps, total, bars, chords, ev, stepDur: 60 / (th.bpm * th.sub), loopSec: total * 60 / (th.bpm * th.sub) };
}

function createAudio(ac, { theme: themeId, event = null, masterGain = 0.85 } = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, realtime = !(OAC && ac instanceof OAC);
  const themeKnown = Object.prototype.hasOwnProperty.call(THEMES, themeId);
  const TID = themeKnown ? themeId : FALLBACK_THEME, th = THEMES[TID], song = compose(TID, th);
  let forcedT = null, lastScrape = 0, lastQuirk = -Infinity, stings = 0, moodName = "landing", curChord = song.chords[0], build = null;
  const now = () => (forcedT !== null ? forcedT : ac.currentTime);
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const R = realtime ? Math.random : prng(0xd1ce); // offline renders are reproducible
  // ---- graph ----
  const master = ac.createGain(); master.gain.value = masterGain;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ac.destination);
  const duckG = ac.createGain(); duckG.connect(master);
  const mMood = ac.createGain(), aMood = ac.createGain(), aMoodW = ac.createGain();
  mMood.connect(duckG); aMood.connect(duckG);
  const musicBus = ac.createGain(); musicBus.gain.value = 0.063 * (th.mix || 1); musicBus.connect(mMood); // about -24 dB
  const ambBus = ac.createGain(); ambBus.gain.value = 0.042 * (th.ambMix || 1); ambBus.connect(aMood);
  const ambWet = ac.createGain(); ambWet.gain.value = 0.042 * (th.ambMix || 1); ambWet.connect(aMoodW);
  const wxBus = ac.createGain(); wxBus.gain.value = 0.05; wxBus.connect(aMood);
  const sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  const noise = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate);
  { const d = noise.getChannelData(0), r = prng(0x5eed); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
  // echo (tempo-synced dotted eighth) + a generated-noise convolution reverb, both after the mood gain
  const dl = ac.createDelay(2), fb = ac.createGain(), dlp = ac.createBiquadFilter(), echoSend = ac.createGain();
  dl.delayTime.value = Math.min(1.5, song.stepDur * 3 / Math.max(1, th.sub / 2)); fb.gain.value = 0.3; dlp.frequency.value = 2400; echoSend.gain.value = th.echo || 0;
  mMood.connect(echoSend); echoSend.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(duckG);
  const conv = ac.createConvolver();
  { const len = Math.round(ac.sampleRate * 2.6), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch), r = prng(0xa11 + ch); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.exp(-3.2 * i / ac.sampleRate) * Math.min(1, i / 200); }
    conv.buffer = ir; }
  const revOut = ac.createGain(); revOut.gain.value = 0.9; conv.connect(revOut); revOut.connect(duckG);
  const mRev = ac.createGain(); mRev.gain.value = th.reverb || 0; mMood.connect(mRev); mRev.connect(conv);
  const aRev = ac.createGain(); aRev.gain.value = 0.3; aMood.connect(aRev); aRev.connect(conv);
  aMoodW.connect(conv);
  const panTo = (node, p, dest) => { if (ac.createStereoPanner) { const s = ac.createStereoPanner(); s.pan.value = p; node.connect(s); s.connect(dest); } else node.connect(dest); };

  // ---- small helpers (shared by music, ambience and SFX) ----
  function env(g, t, a, peak, d, hold = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  }
  function osc(type, f, t, dur, peak, o = {}) {
    const s = ac.createOscillator(), g = ac.createGain();
    if (type === "pulse") s.setPeriodicWave(pulseWave()); else s.type = type;
    s.frequency.setValueAtTime(f, t);
    if (o.detune) s.detune.value = o.detune;
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
    if (o.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibDepth || 6; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + dur + 0.1); }
    let node = s;
    if (o.lp) { const f2 = ac.createBiquadFilter(); f2.frequency.value = o.lp; s.connect(f2); node = f2; }
    if (o.bp) { for (const [fr, q] of o.bp) { const b = ac.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = fr; b.Q.value = q; node.connect(b); b.connect(g); } }
    else node.connect(g);
    const a = o.a || 0.005;
    env(g, t, a, peak, Math.max(0.02, dur - a - (o.hold || 0)), o.hold || 0);
    if (o.pan !== undefined) panTo(g, o.pan, o.dest || sfxBus); else g.connect(o.dest || sfxBus);
    s.start(t); s.stop(t + dur + 0.1);
    return s;
  }
  function hiss(t, dur, peak, o = {}) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = o.type || "bandpass";
    f.frequency.setValueAtTime(o.f || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain(); const a = o.a || 0.005;
    env(g, t, a, peak, Math.max(0.02, dur - a - (o.hold || 0)), o.hold || 0);
    s.connect(f); f.connect(g);
    if (o.pan !== undefined) panTo(g, o.pan, o.dest || sfxBus); else g.connect(o.dest || sfxBus);
    s.start(t, o.offset !== undefined ? o.offset : R() * 2.5); s.stop(t + dur + 0.1);
  }
  function bell(t, f, peak, dest = sfxBus, dec = 1.2) {
    osc("sine", f, t, dec, peak, { dest });
    osc("sine", f * 2.005, t, dec * 0.6, peak * 0.3, { dest });
    osc("triangle", f * 4.01, t, dec * 0.25, peak * 0.06, { dest });
  }
  let pw = null;
  function pulseWave() {
    if (pw) return pw;
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 * Math.sin(k * Math.PI * 0.25)) / (k * Math.PI);
    return (pw = ac.createPeriodicWave(re, im));
  }
  // a looping noise bed through a filter into a gain (for wind, rain, waves, insects…)
  function bed(dest, { type = "lowpass", f = 500, q = 0.7, gain = 1, pan, offset = 0 } = {}) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain(); g.gain.value = gain;
    s.connect(fl); fl.connect(g);
    if (pan !== undefined) panTo(g, pan, dest); else g.connect(dest);
    s.start(now(), offset);
    return { s, f: fl, g };
  }

  // ---- Karplus-Strong plucked strings, rendered once per pitch into a buffer ----
  const KS = { banjo: { len: 1.1, bright: 0.6, tau: 0.45, pick: 0.13 }, harpsi: { len: 1.6, bright: 0.65, tau: 0.8, pick: 0.09 },
    slide: { len: 2.4, bright: 0.45, tau: 1.3, pick: 0.2 }, warm: { len: 1.5, bright: 0.3, tau: 0.7, pick: 0.25 } };
  const ksCache = new Map();
  function ksBuf(kind, m) {
    const key = kind + m; if (ksCache.has(key)) return ksCache.get(key);
    const k = KS[kind], sr = ac.sampleRate, f = N(m), P = Math.max(4, Math.floor(sr / f - 0.5));
    const n = Math.round(sr * k.len), y = new Float32Array(n), r = prng(m * 7919 + kind.length);
    const exc = new Float32Array(P); let lp = 0;
    for (let i = 0; i < P; i++) { lp += k.bright * (r() * 2 - 1 - lp); exc[i] = lp; }
    const pk = Math.max(1, Math.round(P * k.pick)); for (let i = P - 1; i >= pk; i--) exc[i] -= exc[i - pk];
    const decay = Math.exp(-1 / (k.tau * f));
    for (let i = 0; i < n; i++) y[i] = i < P ? exc[i] : decay * 0.5 * (y[i - P] + (i - P - 1 >= 0 ? y[i - P - 1] : 0));
    let dc = 0, prevX = 0, peak = 1e-6;
    for (let i = 0; i < n; i++) { const x = y[i]; dc = x - prevX + 0.995 * dc; prevX = x; y[i] = dc; peak = Math.max(peak, Math.abs(dc)); }
    const fade = Math.round(sr * 0.05);
    for (let i = 0; i < n; i++) y[i] = (y[i] / peak) * 0.9 * (i > n - fade ? (n - i) / fade : 1);
    const buf = ac.createBuffer(1, n, sr); buf.getChannelData(0).set(y);
    const out = { buf, rate: (f * (P + 0.5)) / sr };
    ksCache.set(key, out); return out;
  }
  function pluck(kind, t, m, d, v, dest, o = {}) {
    const { buf, rate } = ksBuf(kind, m), s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = buf;
    if (o.from !== undefined) { s.playbackRate.setValueAtTime(rate * N(o.from) / N(m), t); s.playbackRate.exponentialRampToValueAtTime(rate, t + 0.11); }
    else s.playbackRate.value = rate;
    const end = Math.min(buf.duration / rate - 0.05, d + (o.ring || 0.25));
    g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + Math.max(0.02, end - 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + end);
    let node = s;
    if (o.lp) { const f = ac.createBiquadFilter(); f.frequency.value = o.lp; s.connect(f); node = f; }
    node.connect(g); if (o.pan !== undefined) panTo(g, o.pan, dest); else g.connect(dest);
    s.start(t); s.stop(t + end + 0.05);
  }

  // ---- instruments: (t, midi | [midi], seconds, velocity, dest, opts) ----
  const V = {
    celesta: (t, m, d, v, dest) => bell(t, N(m), v, dest, 1.9),
    softbell: (t, m, d, v, dest) => { osc("sine", N(m), t, 2.6, v, { dest, a: 0.01 }); osc("sine", N(m) * 3.0, t, 0.9, v * 0.08, { dest }); osc("sine", N(m) * 2.005, t, 1.4, v * 0.18, { dest }); },
    pizz: (t, m, d, v, dest) => {
      const f = N(m), lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(480, t + 0.22);
      for (const [type, k] of [["triangle", 1], ["sawtooth", 0.35]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = f; og.gain.value = k; o.connect(og); og.connect(lp); o.start(t); o.stop(t + 0.5); }
      env(g, t, 0.004, v, 0.36); lp.connect(g); g.connect(dest);
    },
    pizzbass: (t, m, d, v, dest) => V.pizz(t, m, d, v, dest),
    banjo: (t, m, d, v, dest) => pluck("banjo", t, m, d, v, dest, { ring: 0.4, lp: 3800 }),
    harpsi: (t, m, d, v, dest) => pluck("harpsi", t, m, d, v, dest, { ring: 0.35, lp: 3000 }),
    harpsibass: (t, m, d, v, dest) => pluck("harpsi", t, m, d, v, dest, { ring: 0.5, lp: 1800 }),
    upright: (t, m, d, v, dest) => pluck("warm", t, m, d, v, dest, { ring: 0.2, lp: 900 }),
    slide: (t, m, d, v, dest, o) => pluck("slide", t, m, d, v, dest, { ring: 0.6, from: o.from, lp: 2600 }),
    flute: (t, m, d, v, dest) => {
      const f = N(m), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.4); lfo.connect(lg);
      for (const [type, k] of [["sine", 1], ["triangle", 0.12]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = f; og.gain.value = k; lg.connect(o.frequency); o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.4); }
      lfo.start(t); lfo.stop(t + d + 0.4);
      env(g, t, 0.07, v, 0.2, Math.max(0, d - 0.07)); g.connect(dest);
      hiss(t, 0.14, v * 0.18, { f: f * 1.6, q: 1.4, a: 0.02, dest });
    },
    accordion: (t, m, d, v, dest, o = {}) => {
      const f = N(m), lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.frequency.value = o.lp || 1500; lp.Q.value = 0.7;
      for (const [k, det, mul] of [[0.5, -8, 1], [0.5, 8, 1], [0.22, 0, 0.5]]) { const s = ac.createOscillator(), sg = ac.createGain(); s.setPeriodicWave(pulseWave()); s.frequency.value = f * mul; s.detune.value = det; sg.gain.value = k; s.connect(sg); sg.connect(lp); s.start(t); s.stop(t + d + 0.25); }
      env(g, t, 0.035, v, 0.12, Math.max(0, d * 0.92 - 0.035)); lp.connect(g); g.connect(dest);
    },
    accbass: (t, m, d, v, dest) => V.accordion(t, m, d, v, dest, { lp: 700 }),
    sub: (t, m, d, v, dest) => { osc("sine", N(m), t, d + 0.3, v, { dest, a: 0.05, hold: Math.max(0, d - 0.1), lp: 600 }); osc("triangle", N(m), t, d + 0.3, v * 0.2, { dest, a: 0.05, hold: Math.max(0, d - 0.1), lp: 600 }); },
    chime: (t, ms, d, v, dest) => ms.forEach((m, i) => bell(t + i * 0.13, N(m), v, dest, 2.2)),
  };
  const PADS = {
    organ: (t, ms, d, v, dest) => {
      const lp = ac.createBiquadFilter(), g = ac.createGain(); lp.frequency.value = 1300;
      for (const m of ms) for (const [mul, k] of [[1, 1], [2, 0.35], [0.5, 0.25]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = "sine"; o.frequency.value = N(m) * mul; og.gain.value = k / ms.length; o.connect(og); og.connect(lp); o.start(t); o.stop(t + d + 1); }
      env(g, t, 0.6, v, 0.8, Math.max(0, d - 0.7)); lp.connect(g); g.connect(dest);
    },
    glass: (t, ms, d, v, dest) => {
      const g = ac.createGain(), trem = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      trem.gain.value = 0.8; lfo.frequency.value = 4.2; lg.gain.value = 0.2; lfo.connect(lg); lg.connect(trem.gain); lfo.start(t); lfo.stop(t + d + 1.2);
      for (const m of ms) for (const [mul, k] of [[1, 1], [2.003, 0.18], [1.0035, 0.5]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = "sine"; o.frequency.value = N(m + 12) * mul; og.gain.value = k / ms.length; o.connect(og); og.connect(trem); o.start(t); o.stop(t + d + 1.2); }
      env(g, t, 0.9, v, 1.0, Math.max(0, d - 0.8)); trem.connect(g); g.connect(dest);
    },
    warm: (t, ms, d, v, dest) => {
      const lp = ac.createBiquadFilter(), g = ac.createGain(); lp.frequency.value = 900;
      for (const m of ms) for (const det of [-6, 6]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = "triangle"; o.frequency.value = N(m); o.detune.value = det; og.gain.value = 0.5 / ms.length; o.connect(og); og.connect(lp); o.start(t); o.stop(t + d + 1.2); }
      env(g, t, 1.0, v, 1.0, Math.max(0, d - 0.9)); lp.connect(g); g.connect(dest);
    },
  };
  const COMPS = {
    pizz: (t, ms, d, v, dest) => ms.forEach((m) => V.pizz(t, m, d, v / ms.length * 1.6, dest)),
    strum: (t, ms, d, v, dest) => ms.forEach((m, i) => pluck("warm", t + i * 0.018, m, d, v / ms.length * 1.8, dest, { ring: 0.15, lp: 2200 })),
    muted: (t, ms, d, v, dest) => ms.forEach((m, i) => pluck("warm", t + i * 0.012, m, 0.12, v / ms.length * 1.8, dest, { ring: 0.08, lp: 1400 })),
    harpsi: (t, ms, d, v, dest) => ms.forEach((m, i) => pluck("harpsi", t + i * 0.012, m, d, v / ms.length * 1.6, dest, { ring: 0.2, lp: 2600 })),
    acc: (t, ms, d, v, dest) => ms.forEach((m) => V.accordion(t, m, d, v / ms.length * 1.6, dest, { lp: 1100 })),
  };

  // ---- moods: how loud music / ambience are on each screen, and which weather layers run ----
  const MOODS = { landing: [1, 1], grow: [1, 1], night: [1, 1], harvest: [0.3, 0.6], reveal: [0.03, 0.4], carve: [1, 0.5], view: [1, 0.5] };
  const NIGHTLY = new Set(["night", "harvest"]);
  const layerOn = {
    rain: () => event === "thunderstorm" && ["night", "harvest", "reveal", "carve"].includes(moodName),
    moon: () => event === "full-moon" && NIGHTLY.has(moodName),
    fireflies: () => event === "firefly-swarm" && NIGHTLY.has(moodName),
    ghosts: () => event === "ghost-parade" && NIGHTLY.has(moodName),
  };
  function setLevel(param, v, t, tc) {
    if (!realtime && param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); }
    param.setTargetAtTime(v, t, tc);
  }
  let rainG = null;
  function mood(name, instant) {
    if (!MOODS[name]) return;
    if (build && name !== "reveal") cutBuild();
    moodName = name;
    const [m, a] = MOODS[name], t = now(), tc = instant ? 0.001 : name === "reveal" ? 0.12 : 0.6;
    setLevel(mMood.gain, m, t, tc); setLevel(aMood.gain, a, t, tc); setLevel(aMoodW.gain, a, t, tc);
    if (rainG) setLevel(rainG.gain, layerOn.rain() ? 1 : 0, t, instant ? 0.001 : 1.2);
  }

  // ---- music sequencer (pump schedules everything that starts before `until`) ----
  const seq = { k: 0, t: 0 };
  function startMusic(t, offsetSec = 0) { seq.t = t; seq.k = Math.round(offsetSec / song.stepDur) % song.total; }
  function playEv(e, t) {
    const sd = song.stepDur, d = e.d * sd * 0.95;
    if (e.p === "pad") return PADS[e.v](t, e.m, d, e.g, musicBus);
    if (e.p === "comp") return COMPS[e.v](t, e.m, d, e.g, musicBus);
    if (e.p === "lead" && layerOn.moon()) return V[e.v](t, e.m + 12, d, e.g * 0.8, musicBus, { from: e.from !== undefined ? e.from + 12 : undefined });
    V[e.v](t, e.m, d, e.g, musicBus, e);
  }
  function pumpMusic(until) {
    if (realtime && seq.t < ac.currentTime - 0.3) seq.t = ac.currentTime + 0.05;
    while (seq.t < until) {
      const k = seq.k, sw = th.swing && k % th.sub === 1 ? th.swing * song.stepDur : 0;
      if (k % song.steps === 0) curChord = song.chords[k / song.steps];
      for (const e of song.ev[k]) playEv(e, seq.t + sw);
      seq.k = (k + 1) % song.total; seq.t += song.stepDur;
    }
  }
  if (th.drone) {
    const lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    lp.frequency.value = 360; g.gain.value = 0.14; lfo.frequency.value = 0.12; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(g.gain);
    for (const m of th.drone) { const o = ac.createOscillator(); o.setPeriodicWave(pulseWave()); o.frequency.value = N(m); o.detune.value = m % 2 ? 4 : -4; o.connect(lp); o.start(now()); }
    lp.connect(g); g.connect(musicBus); lfo.start(now());
  }

  // ---- ambience: a continuous bed per scene plus scattered events ----
  const timers = [];
  const every = (gap, fire, when = () => true, first = 0.2) => timers.push({ next: now() + first, gap, fire, when });
  function pumpTimers(until) {
    for (const tm of timers) {
      if (realtime && tm.next < ac.currentTime - 0.3) tm.next = ac.currentTime + 0.05;
      while (tm.next < until) { if (tm.when()) tm.fire(tm.next); tm.next += tm.gap(); }
    }
  }
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const AMB = {
    wind() {
      for (const [pan, off] of [[-0.6, 0], [0.6, 1.3]]) {
        const w = bed(ambBus, { f: 520, gain: 0.5, pan, offset: off });
        const wh = bed(ambBus, { type: "bandpass", f: 900, q: 9, gain: 0.25, pan, offset: off + 0.6 });
        every(() => 1.6 + R() * 3, (t) => {
          const k = 0.15 + R() * 0.85;
          w.g.gain.setTargetAtTime(0.25 + 0.75 * k, t, 1.1); w.f.frequency.setTargetAtTime(260 + 900 * k, t, 1.4);
          wh.g.gain.setTargetAtTime(0.08 + 0.4 * k * k, t, 1.2); wh.f.frequency.setTargetAtTime(600 + 900 * k, t, 1.6);
        });
      }
    },
    cauldron() {
      bed(ambBus, { f: 170, gain: 0.5 });
      every(() => (R() < 0.25 ? 0.05 + R() * 0.08 : 0.15 + R() * 0.5), (t) => {
        const big = R() < 0.15, f = big ? 90 + R() * 80 : 200 + R() * 380;
        osc("sine", f, t, big ? 0.22 : 0.1, big ? 0.9 : 0.5 + R() * 0.4, { to: f * (1.8 + R()), glide: big ? 0.16 : 0.07, lp: 1600, dest: ambBus, pan: R() * 0.8 - 0.4 });
      });
    },
    crickets() {
      bed(ambBus, { f: 900, gain: 0.12 }); // still night air
      [[-0.55, 3500], [0.45, 3750], [0.1, 3150]].forEach(([pan, f], ci) => every(() => 0.55 + R() * 0.6 + (R() < 0.12 ? 2 : 0), (t) => {
        const n = 3 + Math.floor(R() * 2), amp = ci === 2 ? 0.1 : 0.17;
        for (let i = 0; i < n; i++) osc("sine", f, t + i * 0.034, 0.024, amp, { a: 0.004, dest: ambBus, pan });
      }, () => true, 0.2 + ci * 0.31));
    },
    drips() {
      bed(ambBus, { f: 380, gain: 0.25 });
      every(() => 0.5 + R() * 2.2, (t) => {
        const plink = (s) => { const f = 900 + R() * 1100; osc("sine", f, s, 0.13, 0.55, { to: f * 1.6, glide: 0.035, a: 0.002, dest: ambWet, pan: R() * 1.2 - 0.6 }); };
        plink(t); if (R() < 0.25) plink(t + 0.11 + R() * 0.1);
      });
    },
    creaks() {
      bed(ambBus, { f: 140, gain: 0.45 });
      every(() => 5 + R() * 8, (t) => {
        const dur = 0.6 + R() * 0.9, s = ac.createOscillator(), g = ac.createGain(), b1 = ac.createBiquadFilter(), b2 = ac.createBiquadFilter();
        s.type = "sawtooth"; const f0 = 16 + R() * 14;
        s.frequency.setValueAtTime(f0, t); s.frequency.linearRampToValueAtTime(f0 * (1.4 + R() * 0.8), t + dur * 0.6); s.frequency.linearRampToValueAtTime(f0 * 0.9, t + dur);
        b1.type = b2.type = "bandpass"; b1.frequency.value = 450 + R() * 450; b1.Q.value = 7; b2.frequency.value = b1.frequency.value * 2.3; b2.Q.value = 9;
        env(g, t, dur * 0.3, 0.9, dur * 0.6, dur * 0.1);
        s.connect(b1); s.connect(b2); b1.connect(g); b2.connect(g); panTo(g, R() * 1.4 - 0.7, ambWet); s.start(t); s.stop(t + dur + 0.1);
      }, () => true, 2.5);
    },
    swamp() {
      for (const [f, rate, pan] of [[3900, 27, -0.4], [2900, 17, 0.5]]) {
        const ins = bed(ambBus, { type: "bandpass", f, q: 6, gain: 0.07, pan }), lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.frequency.value = rate; lg.gain.value = 0.06; lfo.connect(lg); lg.connect(ins.g.gain); lfo.start(now());
      }
      bed(ambBus, { f: 260, gain: 0.35 }); // warm, humid low air
      every(() => 1.2 + R() * 3.2, (t) => {
        const f = 85 + R() * 60, pan = R() * 1.4 - 0.7, twice = R() < 0.6;
        for (const s0 of twice ? [0, 0.32] : [0]) {
          const s = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter();
          s.type = "sawtooth"; s.frequency.setValueAtTime(f, t + s0); s.frequency.linearRampToValueAtTime(f * 0.85, t + s0 + 0.2);
          bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 3;
          g.gain.setValueAtTime(0.0001, t + s0);
          for (let i = 0; i < 6; i++) { const p = t + s0 + i * 0.032; g.gain.exponentialRampToValueAtTime(0.9, p + 0.008); g.gain.exponentialRampToValueAtTime(0.02, p + 0.028); }
          g.gain.exponentialRampToValueAtTime(0.0001, t + s0 + 0.24);
          s.connect(bp); bp.connect(g); panTo(g, pan, ambBus); s.start(t + s0); s.stop(t + s0 + 0.3);
        }
      });
    },
    forest() {
      const leaves = bed(ambBus, { f: 1100, gain: 0.12 });
      every(() => 2 + R() * 3, (t) => leaves.g.gain.setTargetAtTime(0.04 + R() * 0.14, t, 1.2));
      const PENTA = [84, 86, 89, 91, 93, 96];
      every(() => 1.8 + R() * 4, (t) => { const n = 1 + Math.floor(R() * 4); for (let i = 0; i < n; i++) bell(t + i * (0.1 + R() * 0.2), N(pick(PENTA)), 0.22 + R() * 0.12, ambWet, 2); });
      every(() => 9 + R() * 10, (t) => {
        const n = 3 + Math.floor(R() * 4), f = 1700 + R() * 700;
        for (let i = 0; i < n; i++) osc("sine", f * (1 + R() * 0.15), t + i * 0.13, 0.09, 0.25, { to: f * 1.45, glide: 0.06, lp: 4500, dest: ambWet, pan: 0.5 });
      }, () => true, 4);
    },
    waves() {
      for (const [pan, off] of [[-0.5, 0], [0.5, 1.7]]) {
        const w = bed(ambBus, { f: 300, gain: 0.15, pan, offset: off }), foam = bed(ambBus, { type: "bandpass", f: 2200, q: 0.6, gain: 0.0, pan, offset: off + 0.4 });
        every(() => 6 + R() * 3.5, (t) => {
          const crest = 0.55 + R() * 0.45, rise = 2.2 + R() * 0.8;
          w.g.gain.setTargetAtTime(0.25 + 0.75 * crest, t, rise / 2.5); w.f.frequency.setTargetAtTime(700 + 900 * crest, t, rise / 2.5);
          foam.g.gain.setTargetAtTime(0.08 * crest, t + rise * 0.7, 0.3);
          w.g.gain.setTargetAtTime(0.12, t + rise, 1.4); w.f.frequency.setTargetAtTime(260, t + rise, 1.6); foam.g.gain.setTargetAtTime(0, t + rise + 0.2, 0.8);
        }, () => true, pan < 0 ? 0.1 : 3.4);
      }
    },
  };
  (AMB[th.amb] || AMB.wind)();

  // ---- weather layers (gated by mood) ----
  if (event === "thunderstorm") {
    rainG = ac.createGain(); rainG.gain.value = 0; rainG.connect(wxBus);
    bed(rainG, { type: "bandpass", f: 1800, q: 0.7, gain: 0.8, pan: -0.3, offset: 0.2 });
    bed(rainG, { type: "bandpass", f: 2300, q: 0.7, gain: 0.8, pan: 0.3, offset: 1.6 });
    bed(rainG, { f: 700, gain: 0.5, offset: 2.4 });
  }
  every(() => 3.4 + R() * 2.2, (t) => {
    const g = ac.createGain(), trem = ac.createOscillator(), tg = ac.createGain();
    trem.frequency.value = 6; tg.gain.value = 0.3; trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(t + 3.2);
    env(g, t, 1.2, 0.5, 1.8); g.connect(wxBus);
    for (const pc of curChord.pcs.slice(0, 3)) { const o = ac.createOscillator(); o.frequency.value = N(inWindow(pc, 79) + 12) * (1 + (R() - 0.5) * 0.004); o.connect(g); o.start(t); o.stop(t + 3.2); }
  }, layerOn.moon, 0.6);
  every(() => 0.35 + R() * 1.4, (t) => { const pcs = curChord.pcs; bell(t, N(inWindow(pick(pcs), 91)), 0.35 + R() * 0.3, wxBus, 0.5 + R() * 0.4); }, layerOn.fireflies, 0.3);
  every(() => 3.2, (t) => {
    const m = inWindow(pick(curChord.pcs), 60), f = N(m), dur = 5.5, g = ac.createGain();
    const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(); f1.type = f2.type = "bandpass"; f1.frequency.value = 330; f1.Q.value = 4; f2.frequency.value = 780; f2.Q.value = 6;
    const s = ac.createOscillator(); s.type = "sawtooth"; s.frequency.setValueAtTime(f, t); s.frequency.linearRampToValueAtTime(f * 0.97, t + dur);
    const v = ac.createOscillator(), vg = ac.createGain(); v.frequency.value = 4.5; vg.gain.value = f * 0.006; v.connect(vg); vg.connect(s.frequency);
    const sg = ac.createGain(); sg.gain.value = 0.6; s.connect(sg); sg.connect(f1); sg.connect(f2);
    hiss(t, dur, 0.5, { f: 600, q: 0.8, a: 2, dest: f1, offset: R() * 2 });
    f1.connect(g); f2.connect(g); env(g, t, 2, 0.9, 2.6, 0.9); panTo(g, R() * 1.2 - 0.6, wxBus);
    s.start(t); s.stop(t + dur + 0.1); v.start(t); v.stop(t + dur + 0.1);
  }, layerOn.ghosts, 0.5);
  // harvest wait: the music has ducked; a slow, soft heartbeat while the plant is ready
  const thump = (t, amp, dest) => { osc("sine", 64, t, 0.26, amp, { to: 38, glide: 0.16, a: 0.008, lp: 160, dest }); };
  every(() => 1.15, (t) => { thump(t, 0.22, sfxBus); thump(t + 0.17, 0.13, sfxBus); }, () => moodName === "harvest", 0.4);

  // ---- suspense build: no tier argument, fixed seeds only, so it is identical for every rarity ----
  // dur: the build's length (BUILD_S, or the shorter repeat-run build); it never depends on the tier
  function suspense(dur = BUILD_S) {
    if (build) cutBuild();
    const t0 = now() + 0.02, D = dur, ts = D / BUILD_S, g = ac.createGain(), sig = [], srcs = [], r = prng(0xb017d);
    g.gain.value = 0.4; g.connect(master); // peaks well under the stings it leads into
    const mk = (type) => { const n = ac["create" + type](); sig.push(type); return n; };
    const go = (n, at, stop, off) => { sig.push(`@${(at - t0).toFixed(3)}-${(stop - t0).toFixed(3)}`); if (off !== undefined) n.start(at, off); else n.start(at); n.stop(stop); srcs.push(n); };
    // heartbeat: lub-dub thumps that speed up and swell
    [0, 0.6, 1.08, 1.47, 1.78, 2.03, 2.23].forEach((b, i) => {
      for (const [dt, k] of [[0, 1], [0.17 - i * 0.012, 0.6]]) {
        const at = t0 + b * ts + dt, o = mk("Oscillator"), lp = mk("BiquadFilter"), eg = mk("Gain"), amp = (0.34 + i * 0.05) * k;
        o.type = "triangle"; o.frequency.setValueAtTime(70, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.16); lp.frequency.value = 320;
        env(eg, at, 0.008, amp, 0.24); o.connect(lp); lp.connect(eg); eg.connect(g); go(o, at, at + 0.3);
      }
    });
    // rising filtered-noise whoosh
    { const s = mk("BufferSource"), bp = mk("BiquadFilter"), eg = mk("Gain"); s.buffer = noise; s.loop = true;
      bp.type = "bandpass"; bp.Q.value = 1.3; bp.frequency.setValueAtTime(200, t0); bp.frequency.exponentialRampToValueAtTime(3400, t0 + D);
      eg.gain.setValueAtTime(0.0001, t0); eg.gain.exponentialRampToValueAtTime(0.2, t0 + D - 0.04); eg.gain.exponentialRampToValueAtTime(0.0001, t0 + D + 0.07);
      s.connect(bp); bp.connect(eg); eg.connect(g); go(s, t0, t0 + D + 0.12, 0.37); }
    // slowly rising detuned shimmer cluster with a quickening tremolo
    { const trem = mk("Gain"), lfo = mk("Oscillator"), lg = mk("Gain"), eg = mk("Gain");
      trem.gain.value = 0.55; lfo.frequency.setValueAtTime(3.5, t0); lfo.frequency.exponentialRampToValueAtTime(13, t0 + D); lg.gain.value = 0.45;
      lfo.connect(lg); lg.connect(trem.gain); go(lfo, t0, t0 + D + 0.12);
      eg.gain.setValueAtTime(0.0001, t0); eg.gain.exponentialRampToValueAtTime(0.09, t0 + D - 0.05); eg.gain.exponentialRampToValueAtTime(0.0001, t0 + D + 0.08);
      for (const [m, det] of [[74, 0], [75, 6], [81, -5], [86, 4], [87, -7]]) {
        const o = mk("Oscillator"); o.frequency.setValueAtTime(N(m), t0); o.frequency.exponentialRampToValueAtTime(N(m + 3), t0 + D); o.detune.value = det;
        o.connect(trem); go(o, t0, t0 + D + 0.12);
      }
      trem.connect(eg); eg.connect(g); }
    // soft magical rustle in the soil
    for (let i = 0; i < 10; i++) {
      const at = t0 + (0.3 + i * 0.17 + r() * 0.08) * ts, s = mk("BufferSource"), bp = mk("BiquadFilter"), eg = mk("Gain");
      s.buffer = noise; bp.type = "bandpass"; bp.frequency.value = 2200 + r() * 2200; bp.Q.value = 2.5;
      env(eg, at, 0.012, 0.05 + 0.05 * (i / 9), 0.08); s.connect(bp); bp.connect(eg);
      if (ac.createStereoPanner) { const p = mk("StereoPanner"); p.pan.value = r() * 1.4 - 0.7; eg.connect(p); p.connect(g); } else eg.connect(g);
      go(s, at, at + 0.12, r() * 2);
    }
    build = { t0, dur: D, g, srcs, cut: false, sig: sig.join(" ") };
    return D;
  }
  function cutBuild() {
    if (!build || build.cut || build.done) return;
    const t = now();
    if (t >= build.t0 + build.dur - 0.05) { build.done = true; return; }
    setLevel(build.g.gain, 0, t, 0.012);
    for (const s of build.srcs) { try { s.stop(t + 0.08); } catch (_) {} }
    build.cut = true; build.cutAt = t;
  }

  function duck(d) {
    const t = now();
    setLevel(duckG.gain, 0.3, t, 0.03);
    duckG.gain.setTargetAtTime(1, t + d, 0.35);
  }
  function play(d, fn) { const t = forcedT !== null ? forcedT : ac.currentTime + 0.02; duck(d); fn(t); }
  const fx = {
    plant: () => play(0.4, (t) => { osc("sine", 130, t, 0.22, 0.9, { to: 48 }); hiss(t, 0.16, 0.35, { type: "lowpass", f: 500 }); }),
    water: () => play(0.9, (t) => {
      hiss(t, 0.75, 0.12, { f: 900, q: 0.8, a: 0.08 });
      for (let i = 0; i < 11; i++) { const s = t + R() * 0.65, f = 380 + R() * 520; osc("sine", f, s, 0.07, 0.18, { to: f * 1.7, glide: 0.05 }); }
    }),
    stage: (n) => play(0.6, (t) => { const f = N([67, 71, 74, 79][n] || 72); osc("triangle", f, t, 0.5, 0.4); bell(t + 0.07, f * 2, 0.12); }),
    night: () => play(2.6, (t) => {
      for (const f of [55, 82.4]) {
        const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
        o.type = "sawtooth"; o.frequency.value = f; lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.4);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 3.1);
      }
      hiss(t, 2.6, 0.06, { type: "lowpass", f: 300, f2: 900, a: 1.2 });
    }),
    caw: () => play(0.9, (t) => { for (const s of [0, 0.3]) osc("sawtooth", 920, t + s, 0.2, 0.32, { to: 560, bp: [[1300, 4], [2600, 6]], vib: 28, vibDepth: 40 }); }),
    thunder: (near = 1) => play(2.4, (t) => {
      if (near > 0.5) hiss(t, 0.12, 0.5, { type: "highpass", f: 1800 });
      hiss(t + 0.03, 2.8, 0.85 * near, { type: "lowpass", f: 220, f2: 70, a: 0.06, q: 0.7 });
      hiss(t + 0.4, 1.6, 0.5 * near, { type: "lowpass", f: 160, a: 0.25 });
      osc("sine", 52, t, 1.8, 0.4 * near, { to: 34, a: 0.05 });
    }),
    twinkle: () => play(0.9, (t) => { [88, 91, 95, 100].forEach((m, i) => bell(t + i * 0.07, N(m), 0.12, sfxBus, 0.6)); hiss(t, 0.7, 0.04, { type: "highpass", f: 5000, f2: 9000 }); }),
    shimmer: () => play(1.4, (t) => { for (let i = 0; i < 16; i++) osc("sine", 2000 + R() * 2200, t + R() * 1.3, 0.25, 0.045); }),
    ghost: () => play(2, (t) => {
      osc("sine", 340, t, 1.7, 0.2, { to: 250, glide: 1.6, a: 0.35, vib: 5, vibDepth: 9, lp: 1200 });
      osc("triangle", 342, t + 0.05, 1.6, 0.06, { to: 252, glide: 1.6, a: 0.4, vib: 5.3, vibDepth: 9 });
      hiss(t, 1.4, 0.12, { f: 400, f2: 1400, q: 2, a: 0.5 });
    }),
    moon: () => play(1.8, (t) => { bell(t, N(81), 0.22, sfxBus, 2); bell(t + 0.22, N(88), 0.16, sfxBus, 2); bell(t + 0.44, N(93), 0.12, sfxBus, 2.2); }),
    // the per-tier sting; the build (if any) resolves into it, and the music comes back afterwards
    reveal: (tier) => {
      if (build && !build.cut && !build.done) { if (now() < build.t0 + build.dur - 0.05) cutBuild(); else build.done = true; }
      stings++;
      play(tier === "Legendary" || tier === "Secret" ? 3 : 1.6, (t) => {
        if (tier === "Secret") {
          // its own sting, not a louder Legendary: a deep inharmonic gong, a hushed detuned choir in an odd key,
          // and a whole-tone run of glass bells falling through it, ending on a low unresolved shimmer
          osc("sine", 55, t, 2.6, 0.55, { to: 51, a: 0.01 });
          osc("sine", 55 * 2.76, t, 1.8, 0.14, { a: 0.01 }); osc("sine", 55 * 5.4, t, 1.1, 0.07, { a: 0.01 });
          hiss(t, 1.4, 0.16, { type: "lowpass", f: 700, f2: 180, a: 0.01 });
          for (const [m, det] of [[66, 0], [69, -7], [73, 6], [76, -4], [80, 5]]) osc("triangle", N(m), t + 0.3, 2.1, 0.05, { a: 0.7, hold: 0.5, detune: det, lp: 2200, vib: 5.2, vibDepth: 4, dest: sfxBus });
          [98, 96, 94, 92, 90, 88, 86].forEach((m, i) => bell(t + 0.45 + i * 0.1, N(m), 0.13, sfxBus, 1.5));
          for (let i = 0; i < 14; i++) osc("sine", 2600 + R() * 2600, t + 1.1 + R() * 1.3, 0.3, 0.035);
          const back = t + 2.4, lv = MOODS.night;
          setLevel(mMood.gain, lv[0], back, 0.8); setLevel(aMood.gain, lv[1], back, 0.8); setLevel(aMoodW.gain, lv[1], back, 0.8);
          return;
        }
        osc("sine", 620, t, 0.12, 0.6, { to: 130 }); hiss(t, 0.05, 0.3, { type: "highpass", f: 2500 });
        bell(t + 0.08, N(84), 0.2); bell(t + 0.16, N(88), 0.16);
        if (tier === "Uncommon") { bell(t + 0.3, N(91), 0.16); bell(t + 0.42, N(96), 0.14); }
        if (tier === "Rare") { [81, 84, 88, 93, 96].forEach((m, i) => bell(t + 0.3 + i * 0.08, N(m), 0.18, sfxBus, 1.4)); for (let i = 0; i < 10; i++) osc("sine", 2500 + R() * 2000, t + 0.5 + R() * 0.8, 0.25, 0.05); }
        if (tier === "Legendary") {
          const brass = (m, s, d, p) => osc("sawtooth", N(m), t + s, d, p, { lp: 1800, a: 0.03, hold: d * 0.5 });
          [[67, 0.3, 0.16], [72, 0.46, 0.16], [76, 0.62, 0.16]].forEach(([m, s, d]) => brass(m, s, d, 0.16));
          for (const m of [72, 76, 79, 84]) brass(m, 0.8, 1.5, 0.11);
          osc("sine", 90, t + 0.8, 0.6, 0.6, { to: 45 });
          for (let i = 0; i < 18; i++) osc("sine", 2500 + R() * 2500, t + 0.9 + R() * 1.4, 0.3, 0.05);
        }
        const back = t + ({ Legendary: 2.4, Rare: 1.3, Uncommon: 0.8 }[tier] || 0.5), lv = MOODS.night;
        setLevel(mMood.gain, lv[0], back, 0.8); setLevel(aMood.gain, lv[1], back, 0.8); setLevel(aMoodW.gain, lv[1], back, 0.8);
      });
    },
    scrape: () => { const t = now(); if (t - lastScrape < 0.075) return; lastScrape = t; hiss(t, 0.08, 0.07, { f: 2200 + R() * 1000, q: 1.4 }); },
    stamp: () => play(0.4, (t) => { osc("sine", 170, t, 0.14, 0.7, { to: 60 }); hiss(t, 0.03, 0.35, { type: "highpass", f: 3000 }); }),
    light: () => play(2.4, (t) => {
      hiss(t, 0.14, 0.45, { type: "highpass", f: 3200 }); hiss(t + 0.05, 0.08, 0.3, { type: "highpass", f: 5000 });
      hiss(t + 0.12, 0.55, 0.22, { f: 300, f2: 1600, q: 1.2, a: 0.12 });
      osc("sine", 110, t + 0.3, 2.2, 0.12, { a: 0.4, lp: 600 }); osc("sine", 165, t + 0.3, 2.2, 0.06, { a: 0.5, lp: 600 });
    }),
    candle: () => play(1.6, (t) => { hiss(t, 0.5, 0.16, { f: 300, f2: 1300, q: 1.2, a: 0.1 }); osc("sine", 110, t + 0.2, 1.6, 0.1, { a: 0.4, lp: 600 }); }),
    send: () => play(0.6, (t) => hiss(t, 0.45, 0.3, { f: 400, f2: 3200, q: 1.5, a: 0.06 })),
    quirk: (id) => {
      if (typeof document !== "undefined" && realtime) {
        if (!document.body.classList.contains("s-landing") || document.hidden) return;
        const p = performance.now(); if (p - lastQuirk < 12000) return; lastQuirk = p;
      }
      play(1.2, (t) => {
        if (id === "sneezing-pumpkins") {
          osc("sawtooth", 280, t, 0.35, 0.12, { to: 420, a: 0.12, bp: [[800, 5], [1250, 6]] });
          hiss(t + 0.38, 0.26, 0.4, { f: 2600, f2: 900, q: 0.9, a: 0.01 });
          osc("sine", 360, t + 0.38, 0.18, 0.12, { to: 190 });
        } else if (id === "hooting-owl") {
          osc("sine", 390, t, 0.28, 0.24, { to: 360, a: 0.05, lp: 900 });
          osc("sine", 410, t + 0.45, 0.6, 0.26, { to: 350, a: 0.06, lp: 900, vib: 6, vibDepth: 6 });
          hiss(t + 0.45, 0.5, 0.03, { type: "lowpass", f: 800, a: 0.06 });
        } else if (id === "black-cat") {
          const s = ac.createOscillator(), g = ac.createGain(), b1 = ac.createBiquadFilter(), b2 = ac.createBiquadFilter();
          s.type = "sawtooth"; s.frequency.setValueAtTime(520, t); s.frequency.linearRampToValueAtTime(820, t + 0.22); s.frequency.linearRampToValueAtTime(470, t + 0.62);
          b1.type = b2.type = "bandpass"; b1.frequency.setValueAtTime(900, t); b1.frequency.linearRampToValueAtTime(1500, t + 0.25); b1.frequency.linearRampToValueAtTime(800, t + 0.6); b1.Q.value = 5; b2.frequency.value = 2800; b2.Q.value = 7;
          env(g, t, 0.06, 0.32, 0.56);
          s.connect(b1); s.connect(b2); b1.connect(g); b2.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + 0.7);
        }
      });
    },
  };
  // runs `fn` as if it happened at audio time t (offline rendering schedules everything up front)
  function at(t, fn) { forcedT = t; try { fn(); } finally { forcedT = null; } }
  function pump(until) { pumpMusic(until); pumpTimers(until); }
  mood("landing", true);
  return {
    fx, mood, suspense, cutBuild, pump, at, startMusic, master, buses: { music: musicBus, ambience: ambBus, ambienceWet: ambWet, weather: wxBus, sfx: sfxBus },
    get moodName() { return moodName; },
    info: () => ({ stepDur: song.stepDur, steps: song.total, barSec: song.steps * song.stepDur, theme: TID, themeKnown, key: th.key, bpm: th.bpm, meter: th.meter, bars: song.bars, loopSec: +song.loopSec.toFixed(3), lead: th.lead, amb: th.amb, instruments: th.instruments }),
    state: () => ({ mood: moodName, music: +mMood.gain.value.toFixed(4), ambience: +aMood.gain.value.toFixed(4),
      layers: Object.keys(layerOn).filter((k) => layerOn[k]()), stings,
      build: build && { dur: build.dur, cut: !!build.cut, done: !!build.done, sig: build.sig, gain: +build.g.gain.value.toFixed(4), since: +(ac.currentTime - build.t0).toFixed(3) } }),
  };
}

// The page's sound: one AudioContext, made inside the first user gesture (unlock), never on page load.
const Sound = (() => {
  const KEY = "pumpkin-patch:muted";
  const AC = window.AudioContext || window.webkitAudioContext;
  const btn = $("mute");
  let ac = null, eng = null, timer = 0, moodName = "landing";
  let muted = false, away = document.visibilityState === "hidden", fadeTimer = 0;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (_) {}
  const MASTER = 0.85;
  function syncBtn() { btn.setAttribute("aria-pressed", String(muted)); btn.title = muted ? "Sound off" : "Sound on"; }
  function init() {
    if (ac || !AC) return;
    try { ac = new AC(); } catch (_) { ac = null; return; }
    eng = createAudio(ac, { theme: CFG.scene.id, event: CFG.event.id, masterGain: MASTER });
    eng.mood(moodName, true);
    eng.startMusic(ac.currentTime + 0.15);
    timer = setInterval(tick, 120); tick();
  }
  function tick() { if (eng && !away && ac.state === "running") eng.pump(ac.currentTime + 0.6); }
  function unlock() {
    if (muted || away) return;
    if (!ac) init();
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }
  // Leaving the page (tab in the background, phone locked, another app): fade out, then suspend the context.
  // A suspended context's clock stops, so the sequencer has no backlog to catch up on when it comes back.
  function sleep(now) {
    away = true; clearTimeout(fadeTimer);
    if (!ac) return;
    const g = eng.master.gain, t = ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    if (now) { g.setValueAtTime(0, t); ac.suspend().catch(() => {}); return; }
    g.linearRampToValueAtTime(0, t + 0.15);
    fadeTimer = setTimeout(() => { if (away) ac.suspend().catch(() => {}); }, 170);
  }
  // Coming back: only if sound was already on (a gesture made the context) and not muted; fade back in.
  function wake() {
    if (document.visibilityState === "hidden") return;
    away = false; clearTimeout(fadeTimer);
    if (!ac || muted) return;
    ac.resume().then(() => {
      if (away || muted) return;
      const g = eng.master.gain, t = ac.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(MASTER, t + 0.25);
      tick();
    }).catch(() => {});
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sleep(false); else wake(); });
  addEventListener("pagehide", () => sleep(true));
  document.addEventListener("freeze", () => sleep(true));
  addEventListener("pageshow", (e) => { if (e.persisted) wake(); });
  document.addEventListener("resume", wake);
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem(KEY, m ? "1" : "0"); } catch (_) {}
    syncBtn();
    if (m) { if (ac) { eng.master.gain.setValueAtTime(0, ac.currentTime); ac.suspend().catch(() => {}); } }
    else if (!away) { if (!ac) init(); if (ac) { eng.master.gain.setValueAtTime(MASTER, ac.currentTime); ac.resume().catch(() => {}); } }
  }
  btn.addEventListener("click", () => setMuted(!muted));
  syncBtn();
  const live = () => eng && !muted && !away; // nothing is scheduled while away, so nothing bursts out on return
  const fx = {};
  for (const k of ["plant", "water", "stage", "night", "caw", "thunder", "twinkle", "shimmer", "ghost", "moon", "reveal", "scrape", "stamp", "light", "candle", "send", "quirk"]) fx[k] = (...a) => { if (live()) eng.fx[k](...a); };
  return Object.assign(fx, {
    unlock, setMuted, BUILD_MS: BUILD_S * 1000,
    mood: (name) => { moodName = name; if (eng) eng.mood(name); },
    suspense: (dur) => { if (live()) eng.suspense(dur); },
    cutSuspense: () => { if (eng) eng.cutBuild(); },
    state: () => ({ created: !!ac, state: ac ? ac.state : "none", gain: ac ? eng.master.gain.value : null, muted, away, ...(eng ? { ...eng.info(), ...eng.state() } : { mood: moodName }) }),
  });
})();

// Renders the patch's sound into an OfflineAudioContext (no gesture, no AudioContext): a theme, a weather
// layer over it, or the suspense build + a tier's sting. Returns a 16-bit WAV (base64) plus a few facts.
async function renderAudio(o = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const sr = o.sampleRate || 44100, secs = o.seconds || 10, len = Math.round(sr * secs);
  const oac = new OAC(2, len, sr);
  const eng = createAudio(oac, { theme: o.scene || CFG.scene.id, event: o.event || null });
  const info = eng.info(), actions = [];
  if (o.solo) for (const [k, b] of Object.entries(eng.buses)) if (!k.startsWith(o.solo)) b.gain.value = 0;
  const act = (t, fn) => actions.push([t, fn]);
  let buildAt = null;
  eng.startMusic(0.05, o.kind === "seam" ? Math.max(0, info.loopSec - (o.before || 3)) : 0);
  if (o.kind === "weather") {
    act(0, () => eng.mood("night", true));
    act(0.2, () => eng.fx.night());
    const ev = o.event;
    if (ev === "full-moon") act(0.9, () => eng.fx.moon());
    if (ev === "crow-visit") { act(2.3, () => eng.fx.caw()); act(8.3, () => eng.fx.caw()); }
    if (ev === "thunderstorm") for (const t of [1.9, 6.1, 10.2]) act(t, () => eng.fx.thunder(0.85));
    if (ev === "shooting-star") for (const t of [0.1, 1.5, 3.2, 7.5]) act(t, () => eng.fx.twinkle());
    if (ev === "firefly-swarm") for (const t of [0.3, 3.2]) act(t, () => eng.fx.shimmer());
    if (ev === "ghost-parade") for (const t of [0.7, 2.6, 4.5]) act(t, () => eng.fx.ghost());
  } else if (o.kind === "suspense") {
    buildAt = 0.6;
    act(0, () => eng.mood("harvest", true));
    act(buildAt, () => { eng.mood("reveal"); eng.suspense(); });
    act(buildAt + 0.02 + BUILD_S, () => eng.fx.reveal(o.tier || "Common"));
  }
  actions.sort((a, b) => a[0] - b[0]);
  for (const [t, fn] of actions) { eng.pump(t); eng.at(t, fn); }
  eng.pump(secs);
  const st = eng.state();
  const buf = await oac.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
  const pcm = new Int16Array(len * 2);
  for (let i = 0; i < len; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, Rr[i])) * 32767; }
  const head = new DataView(new ArrayBuffer(44)), str = (p, s) => { for (let i = 0; i < s.length; i++) head.setUint8(p + i, s.charCodeAt(i)); };
  str(0, "RIFF"); head.setUint32(4, 36 + pcm.byteLength, true); str(8, "WAVE"); str(12, "fmt "); head.setUint32(16, 16, true);
  head.setUint16(20, 1, true); head.setUint16(22, 2, true); head.setUint32(24, sr, true); head.setUint32(28, sr * 4, true);
  head.setUint16(32, 4, true); head.setUint16(34, 16, true); str(36, "data"); head.setUint32(40, pcm.byteLength, true);
  const bytes = new Uint8Array(44 + pcm.byteLength); bytes.set(new Uint8Array(head.buffer), 0); bytes.set(new Uint8Array(pcm.buffer), 44);
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  // the build window (from the build's start to just before the sting), to prove it is tier-blind
  const win = buildAt === null ? null : [Math.round((buildAt + 0.03) * sr), Math.round((buildAt + BUILD_S - 0.01) * sr)];
  const seamAt = o.kind === "seam" ? 0.05 + (info.steps - (Math.round(Math.max(0, info.loopSec - (o.before || 3)) / info.stepDur) % info.steps)) * info.stepDur : null;
  return { wav: btoa(bin), seamAt, sampleRate: sr, seconds: secs, info, build: st.build, buildWindow: win, buildAt, buildSeconds: BUILD_S, ...(o.keepPcm ? { pcm } : {}) };
}

/* ================= static patch chrome ================= */
const root = document.documentElement.style;
root.setProperty("--bg", CFG.scene.palette.bg);
root.setProperty("--accent", CFG.scene.palette.accent);
root.setProperty("--ground", CFG.scene.palette.ground);
root.setProperty("--fx", `${(CFG.scene.focus * 100).toFixed(1)}%`);
document.body.classList.add("ev-" + CFG.event.id);
$("sceneImg").style.backgroundImage = `url("${encodeURI(CFG.scene.image)}")`;
$("patchName").textContent = CFG.name;
$("patchTag").textContent = CFG.name;
// the kicker is uppercase, but never the owner's name as typed: "乂煞氣a芭九九乂's" stays as it is, in the owner's face
if (CFG.owner) { const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = `${CFG.owner}'s`; $("owner").replaceChildren(nm, " pumpkin patch"); }
else $("owner").textContent = "A pumpkin patch";
// "899 的南瓜田" already names its owner: no "899'S PUMPKIN PATCH" kicker over it
$("owner").hidden = !!CFG.ownerInName;
// the patch name in a CJK face (see build.mjs / script-fonts.mjs): a little smaller, CJK glyphs fill their em box
const FONTS = CFG.fonts && typeof CFG.fonts === "object" ? CFG.fonts : {};
if (FONTS.name && /^cjk$/.test(FONTS.name.script)) document.documentElement.classList.add("cjk-name");
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u;
$("tagline").textContent = CFG.tagline;
const sigV = VAR.get(CFG.signature);
$("sigImg").src = sigV.image; $("sigImg").alt = sigV.name;
$("sigName").textContent = sigV.name;
setTier($("sigTier"), sigV.tier);
$("evIcon").src = CFG.event.icon; $("evIcon").alt = `Weather: ${CFG.event.name}.`;
$("evText").textContent = CFG.event.chip;
$("quirkIcon").src = CFG.quirk.icon; $("quirkIcon").alt = `Quirk: ${CFG.quirk.name}.`;
$("quirkText").textContent = CFG.quirk.chip;
$("varCount").textContent = ALL_VARIETIES.length;
// Owner-only touches. Everything here is set as text, never as HTML.
const CREDIT = CFG.credit || CFG.name; // "Maya's Scarecrow Field", or the patch name when there is no owner
const OWNERS = CFG.owner ? `${CFG.owner}'s` : "The owner's";
if (CFG.welcome) {
  $("welcomeText").textContent = CFG.welcome;
  $("welcomeSig").textContent = CFG.owner ? `~ ${CFG.owner}` : ""; $("welcomeSig").hidden = !CFG.owner;
  $("welcome").hidden = false;
}
const SHOWCASE = CFG.showcase && VAR.has(CFG.showcase.variety) ? CFG.showcase : null;
if (SHOWCASE) {
  $("showcase").href = "#p=" + SHOWCASE.frag;
  { const o = document.createElement("span"), w = document.createElement("span"); o.className = "o"; o.textContent = OWNERS; w.textContent = "pumpkin";
    $("showcaseName").replaceChildren(o, " ", w); }
  $("showcase").setAttribute("aria-label", `See ${CFG.owner ? OWNERS : "the owner's"} pumpkin`);
  $("showcase").classList.toggle("script", !!FONTS.owner);
  $("showcase").hidden = false;
  requestAnimationFrame(() => placeShowcase());
}
// the farm badge in view mode: where a shared pumpkin grew (the kicker and link are set per pumpkin in enterView)
$("credit").style.setProperty("--farm-pic", `url("${encodeURI(CFG.scene.image)}")`);
$("farmName").textContent = CFG.name;
if (CFG.owner && !CFG.ownerInName) {
  $("farmOwner").textContent = `${CFG.owner}'s patch`; $("farmOwner").hidden = false;
  $("farmOwner").classList.toggle("script", !!FONTS.owner);
}
$("footId").textContent = `${CFG.scene.name} · Seed ${CFG.seed} · ${CFG.hashtag}`;
$("growOwn").href = /^https?:\/\//i.test(CFG.growYourOwnUrl) ? CFG.growYourOwnUrl : "https://vibehost.com";
for (const img of document.querySelectorAll("img[data-icon]")) img.src = CFG.icons[img.dataset.icon];
// the plant step's art (dug soil + trowel, the golden ring, the tapping glove) replaces the CSS mound, ring and SVG hand
if (CFG.plant && CFG.plant.dig && CFG.plant.ring) {
  const dig = document.querySelector("#plot .dig"), mk = (cls, src) => { const i = document.createElement("img"); i.className = cls; i.src = src; i.alt = ""; i.draggable = false; return i; };
  dig.classList.add("art"); dig.append(mk("glowring", CFG.plant.ring), mk("mound", CFG.plant.dig));
  if (CFG.plant.hand) { const h = mk("hand", CFG.plant.hand); h.setAttribute("aria-hidden", "true"); document.querySelector("#plot svg.hand").replaceWith(h); }
}
function setTier(el, tier) { el.textContent = tier; el.dataset.tier = tier; }
// an icon from the page's one SVG set (see the sprite at the top of <body>)
function icon(name) {
  const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"), use = document.createElementNS(NS, "use");
  svg.setAttribute("class", "i"); svg.setAttribute("aria-hidden", "true"); use.setAttribute("href", "#i-" + name); svg.append(use);
  return svg;
}
/* ---- ui icons ---- every control icon goes through ICONS: name -> its SVG fallback (a symbol in the sprite). When
   build.mjs finds art/ui/<name>.webp it lists it in CFG.ui and the sticker replaces the SVG, so new art needs no code. */
const ICONS = { story: "story", square: "image", video: "video", close: "x", undo: "undo", clear: "trash", copy: "copy", check: "check",
  share: "share", download: "download", "sound-on": "sound-on", "sound-off": "sound-off", rotate: "turn", resize: "resize",
  words: "words", stencil: "stencil", brush: "brush", replay: "replay", link: "link", sparkle: "sparkle", star: "star" };
const UI_ART = CFG.ui && typeof CFG.ui === "object" ? CFG.ui : {};
function uiIcon(name) {
  if (has(UI_ART, name)) {
    const img = document.createElement("img");
    img.className = "i ui-art"; img.src = UI_ART[name]; img.alt = ""; img.draggable = false; img.dataset.ui = name; img.setAttribute("aria-hidden", "true");
    return img;
  }
  const svg = icon(has(ICONS, name) ? ICONS[name] : name); svg.dataset.ui = name;
  return svg;
}
// swap the icon inside a control (e.g. Copy -> Check after copying)
function setUi(el, name) { const cur = el.querySelector("[data-ui]"); if (cur) cur.replaceWith(uiIcon(name)); else el.prepend(uiIcon(name)); }
for (const s of document.querySelectorAll("svg[data-ui]")) if (has(UI_ART, s.dataset.ui)) s.replaceWith(uiIcon(s.dataset.ui));
if (has(UI_ART, "sound-on") && has(UI_ART, "sound-off")) {
  const m = $("mute"), on = uiIcon("sound-on"), off = uiIcon("sound-off");
  on.classList.add("on"); off.classList.add("off"); m.append(on, off); m.classList.add("art");
}
/* ---- /ui icons ---- */

function buildQuirk() {
  const q = $("quirk"), id = CFG.quirk.id;
  const el = (tag, cls, parent = q) => { const e = document.createElement(tag); if (cls) e.className = cls; parent.append(e); return e; };
  const deco = (e) => { e.dataset.deco = ""; return e; };
  const img = (src, parent) => { const i = el("img", "", parent); i.src = src; i.alt = ""; return i; };
  if (id === "waving-vines") {
    for (const side of ["l", "r"]) img(CFG.art.vine, deco(el("div", "q-vine " + side)));
  } else if (id === "sneezing-pumpkins") {
    for (const k of ["a", "b", "c"]) {
      const d = deco(el("div", "q-sneezer " + k));
      img(sigV.image, d);
      const puff = deco(el("span", "q-puff", d)); puff.textContent = "achoo!";
      if (k === "a") d.addEventListener("animationiteration", (e) => { if (e.target === d) Sound.quirk(id); });
    }
  } else if (id === "midnight-glow") {
    deco(el("div", "q-glow"));
    [[8, 30], [20, 62], [33, 22], [52, 55], [66, 18], [78, 48], [90, 28], [44, 74], [14, 82], [84, 76]].forEach(([x, y], i) => {
      const f = deco(el("i", "q-ff"));
      f.style.left = x + "%"; f.style.top = y + "%"; f.style.animationDelay = `${-i * 0.9}s, ${-i * 0.5}s`;
    });
  } else if (id === "hooting-owl" || id === "black-cat") {
    // Blink lids / tail flick need to know where the eyes / tail are in this drawing (art/sprites/<id>.json).
    // Without that, the owl tilts and squints and the cat's whole body twitches, which works for any art.
    const owl = id === "hooting-owl", key = owl ? "owl" : "black-cat", sp = CFG.sprites[key] || {}, meta = sp.meta || {};
    const d = deco(el("div", "q-perch " + (owl ? "q-owl" : "q-cat")));
    d.style.setProperty("--ar", ((sp.w || 1) / (sp.h || 1)).toFixed(4));
    const body = img(CFG.art[key], d);
    if (owl && Array.isArray(meta.eyes)) {
      for (const e of meta.eyes) { const l = el("i", "q-lid", d); Object.assign(l.style, { left: e[0] + "%", top: e[1] + "%", width: e[2] + "%", height: e[3] + "%" }); if (meta.lid) l.style.setProperty("--lid", meta.lid); }
    } else if (owl) d.classList.add("nolids");
    if (!owl && meta.tail && meta.body && Array.isArray(meta.pivot)) {
      body.style.clipPath = meta.body;
      const t = img(CFG.art[key], d); t.className = "tail"; t.style.clipPath = meta.tail;
      t.style.setProperty("--tx", meta.pivot[0] + "%"); t.style.setProperty("--ty", meta.pivot[1] + "%");
    } else if (!owl) d.classList.add("notail");
    d.addEventListener("animationiteration", (e) => { if (e.target === d || e.target.classList.contains("tail")) Sound.quirk(id); });
  }
  if (reduced.matches) setInterval(() => Sound.quirk(id), 13000);
}

/* ================= screens ================= */
const SCREENS = { landing: "landing", grow: "grow", carve: "work", view: "work" };
function show(name) {
  document.body.classList.remove("s-landing", "s-grow", "s-carve", "s-view");
  document.body.classList.add("s-" + name);
  Sound.mood(name);
  for (const id of new Set(Object.values(SCREENS))) $(id).hidden = id !== SCREENS[name];
  // every screen opens at its top (the window is the only scroller)
  scrollTo(0, 0);
  if (name === "grow") placePlot();
  if (name === "landing") placeShowcase();
  if (name !== "grow") { document.body.classList.remove("night"); stopEvent(); clearTimeout(grow.timer); clearTimeout(grow.hint); $("grow").classList.remove("nudge"); grow.phase = null; grow.queued = 0; }
  $("reveal").hidden = true; $("collection").hidden = true;
}
function showNote(text) { const n = $("note"); n.textContent = text; n.hidden = !text; }

/* ================= grow mini-game ================= */
const STAGE_ORDER = ["seed", "sprout", "vine", "flower"];
const grow = { phase: null, waters: 0, timer: 0, hint: 0, busy: false, queued: 0, pumpkin: null, fast: false };
// Repeat runs: once a pumpkin has been harvested in this tab, every later grow is quicker (animations ~2x, a short
// night with Skip ›, Water taps queue up, a shorter suspense build: still the same length for every tier).
// The first grow keeps the full experience. Remembered in memory and sessionStorage (it may be unavailable).
// ?fast=1 (test hook, check.mjs): the first grow is already a repeat run.
const FAST_KEY = "pumpkin-patch:fast-grow";
let fastGrow = /[?&]fast=1(&|$)/.test(location.search) || (() => { try { return sessionStorage.getItem(FAST_KEY) === "1"; } catch (_) { return false; } })();
const FAST = { anim: 2, step: 0.5, nightMs: 2500, buildMs: 1400 };
const pace = (ms) => (grow.fast ? Math.round(ms * FAST.step) : ms);
// every CSS animation now running inside el plays at the repeat-run speed
function hurry(el) { if (!grow.fast || !el.getAnimations) return; for (const a of el.getAnimations({ subtree: true })) a.playbackRate = FAST.anim; }
// After this long without a tap, the step's action gets a gentle cue (glow + a tapping finger). It never acts by itself.
const IDLE = { plant: 4000, water: 4000, harvest: 5000 };
const stageImg = $("stageImg"), growEl = $("grow"), growBtn = $("growBtn"), plot = $("plot");
const pips = [...$("pips").children];
const haptic = () => { try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {} };
// Where each stage drawing's soil mound visibly ends (alpha > 40 bottom / height; art/stages/*.webp) and how wide it is drawn, so every
// stage stands on the same base line and the mounds read the same size (the seed art fills its frame).
const STAGE_FIT = { seed: { b: 0.9, w: 0.64 }, sprout: { b: 0.918, w: 0.84 }, vine: { b: 0.947, w: 0.84 }, flower: { b: 0.965, w: 0.84 } };
function setStage(name, cls) {
  const f = STAGE_FIT[name] || { b: 0.95, w: 0.84 };
  stageImg.style.setProperty("--sb", f.b); stageImg.style.setProperty("--sw", f.w * 100 + "%");
  stageImg.dataset.stage = name;
  swapImg(stageImg, CFG.stages[name], cls);
}
/* ---- the plot stands on the scene's soil ----
   The backdrop is a fixed, cover-cropped image whose x focus is the scene's focus and y is its background-position.
   GROUND is where the open soil starts in the scene art (0-1 of its height, dice.json "ground"). From the cover math
   we know where that line lands in the viewport, and the plot is sized + pushed down so the mounds' base line sits
   DEPTH x plot below it: on the soil, under the fence / water / grass, and still above the caption + button.
   Recomputed on resize, orientation change and browser-bar changes (visualViewport resize). It assumes the grow
   screen at its top (every screen opens there); scrolling then moves the page over the fixed scene like any page. */
const GROUND = Number.isFinite(CFG.scene.ground) ? CFG.scene.ground : 0.64;
const PLOT_BASE = 0.08, PLOT_DEPTH = 0.16;
const sceneSize = { w: 1600, h: 900 };
{ const i = new Image(); i.onload = () => { if (i.naturalWidth) { sceneSize.w = i.naturalWidth; sceneSize.h = i.naturalHeight; placePlot(); placeShowcase(); } }; i.src = CFG.scene.image; }
function groundLine() {
  const el = $("sceneImg"), r = el.getBoundingClientRect();
  const k = Math.max(r.width / sceneSize.w, r.height / sceneSize.h), ih = sceneSize.h * k;
  const py = parseFloat(getComputedStyle(el).backgroundPositionY);
  return r.top + (r.height - ih) * (Number.isFinite(py) ? py / 100 : 0.7) + GROUND * ih;
}
// what sits under the plot: caption + button + skip link and their gaps (fixed, so hiding the button at night
// doesn't resize the plot)
const UNDER_PLOT = 150;
function placePlot() {
  if (growEl.hidden) return;
  plot.style.marginTop = "0px"; plot.style.width = "";
  // layout boxes (offset*), not getBoundingClientRect: the pressed look scales the plot
  const main = plot.offsetParent, S0 = plot.offsetWidth;
  const top0 = (main ? main.getBoundingClientRect().top + scrollY : 0) + plot.offsetTop;
  const g = groundLine(), H = innerHeight, fit = 1 - PLOT_BASE - PLOT_DEPTH, below = UNDER_PLOT;
  let S = Math.min(S0, (g - top0) / fit, (H - 6 - below - g) / (PLOT_BASE + PLOT_DEPTH));
  S = Math.max(Math.min(S0, 150), S);
  const top = Math.max(top0, g + PLOT_DEPTH * S - (1 - PLOT_BASE) * S);
  plot.style.width = Math.round(S) + "px";
  plot.style.marginTop = Math.round(top - top0) + "px";
}
/* ---- the owner's showcase pumpkin stands on the soil too ----
   Its base goes a little below the soil line, inside the landing's patch strip (between the welcome sign and the
   cards), on the side away from the quirk's character. When the soil starts below the strip (tall phones) the strip
   grows down to it, as far as Plant a seed can move and stay on screen; short screens get a smaller pumpkin. */
function placeShowcase() {
  const a = $("showcase");
  if (a.hidden || $("landing").hidden) return;
  const st = $("quirk"); st.style.minHeight = "";
  const desk = innerWidth >= 880;
  // the pumpkin is the hero of its spot: about the quirk character's height (else a set size), smaller only when it
  // would leave the strip (short phones) or touch the character
  const perch = document.querySelector("#quirk .q-perch"), ph = perch ? perch.getBoundingClientRect().height : 0;
  const quirkEls = () => [...document.querySelectorAll("#quirk .q-perch, #quirk .q-sneezer")].map((c) => c.getBoundingClientRect());
  // (the drawing fills about 80% of its square canvas, so the canvas is ~1.2x the character's height)
  // (measured before the strip grows, the character can still be short of its full 128 px: aim for that)
  for (let P = Math.round(ph ? Math.max(ph, 128) * 1.2 : desk ? 144 : 124); ; P -= 6) {
    placeShowcaseAt(a, st, desk, P);
    const A = a.getBoundingClientRect(), S = st.getBoundingClientRect();
    const hit = quirkEls().some((C) => A.right + 6 > C.left && A.left - 6 < C.right && A.bottom > C.top && A.top < C.bottom);
    if (P <= 60 || (!hit && A.bottom <= S.bottom + 1)) break;
  }
  a.classList.add("placed");
}
// "<owner>'s pumpkin" on one line: the largest size from 1.12rem down to 11 px that fits the sign, else two lines
function fitSign(b, maxW) {
  const base = parseFloat(getComputedStyle(document.documentElement).fontSize) * (b.closest(".script") ? .9 : 1.12);
  b.classList.remove("two");
  let fs = base; b.style.setProperty("--sf", fs + "px");
  while (fs > 11 && b.scrollWidth > maxW) { fs -= 0.5; b.style.setProperty("--sf", fs + "px"); }
  if (b.scrollWidth > maxW) b.classList.add("two");
}
function placeShowcaseAt(a, st, desk, P) {
  st.style.minHeight = "";
  a.style.setProperty("--pk", P + "px");
  // the sign takes the room between the strip's margin and the quirk's character (it may reach past the pumpkin)
  const sr0 = st.getBoundingClientRect(), q0 = CFG.quirk.id, m0 = sr0.width * (desk ? 0.12 : 0.05), pc = document.querySelector("#quirk .q-perch");
  const pr = pc && pc.getBoundingClientRect(), room = !pr ? sr0.width * 0.5 : q0 === "hooting-owl" ? pr.left - 8 - (sr0.left + m0) : (sr0.right - m0) - pr.right - 8;
  fitSign($("showcaseName"), Math.max(100, Math.min(220, room) - 56));
  const aw = a.offsetWidth, ah = a.offsetHeight;
  let sr = st.getBoundingClientRect();
  // its base a little below the soil line, and never above the strip's top: when that is lower than the strip
  // reaches (tall phones; a tall pumpkin), the strip grows down as far as Plant a seed can move and stay on screen
  let foot = Math.max(groundLine() + 0.3 * P, sr.top + 6 + ah); // + 6: the tilted sign's corner
  if (foot > sr.bottom - 3) {
    const room = innerHeight - 10 - ($("plantBtn").getBoundingClientRect().bottom + scrollY);
    const grow = Math.max(0, Math.min(foot - (sr.bottom - 3), room));
    if (grow > 0) { st.style.minHeight = Math.round(sr.height + grow) + "px"; sr = st.getBoundingClientRect(); }
  }
  foot = Math.max(sr.top + 6 + ah, Math.min(foot, sr.bottom - 3));
  // beside the quirk's character: across from the cat (left) / owl (right), else right of centre
  const q = CFG.quirk.id, side = q === "black-cat" ? "r" : q === "hooting-owl" ? "l" : "c", m = sr.width * (desk ? 0.12 : 0.05);
  const left = side === "r" ? sr.right - m - aw : side === "l" ? sr.left + m : sr.left + sr.width * 0.6 - aw / 2;
  a.classList.toggle("flip", side === "l");
  const lr = $("landing").getBoundingClientRect();
  a.style.left = Math.round(left - lr.left) + "px"; a.style.top = Math.round(foot - ah - lr.top) + "px";
}
for (const t of ["resize", "orientationchange"]) addEventListener(t, () => placeShowcase());
if (window.visualViewport) visualViewport.addEventListener("resize", () => placeShowcase());
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeShowcase()).catch(() => {});
for (const t of ["resize", "orientationchange"]) addEventListener(t, () => placePlot());
if (window.visualViewport) visualViewport.addEventListener("resize", () => placePlot());
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placePlot()).catch(() => {});
new ResizeObserver(() => placePlot()).observe($("growTitle"));
function swapImg(img, src, cls) {
  img.hidden = false; img.src = src;
  img.classList.remove("pop", "drop-in", "ready");
  if (cls && !reduced.matches) { void img.offsetWidth; img.classList.add(cls); }
}
function setGrowBtn(icon, label) { $("growIcon").src = CFG.icons[icon]; $("growLabel").textContent = label; }
function nudge(on) { growEl.classList.toggle("nudge", !!on); }
function armNudge() { clearTimeout(grow.hint); nudge(false); if (IDLE[grow.phase]) grow.hint = setTimeout(() => nudge(true), IDLE[grow.phase]); }
// droplets: one per watering, filled the moment the tap lands (a tap waiting on an animation counts too)
function syncPips() {
  const n = Math.min(3, grow.waters + (grow.phase === "water" ? grow.queued : 0));
  pips.forEach((p, i) => p.classList.toggle("on", i < n));
  $("pips").hidden = grow.phase !== "water";
  $("growCount").textContent = grow.phase === "water" ? `, ${grow.waters} of 3 done` : "";
}
function startGrow() {
  Sound.unlock();
  grow.pumpkin = newPumpkin();
  loadArt(grow.pumpkin.variety);
  for (const s of STAGE_ORDER) { const i = new Image(); i.src = CFG.stages[s]; }
  showNote(""); show("grow");
  grow.waters = 0; grow.queued = 0; stageImg.hidden = true;
  grow.fast = fastGrow && !reduced.matches; document.body.classList.toggle("fast-grow", grow.fast);
  growEl.classList.remove("planted");
  setPhase("plant");
  scrollTo({ top: 0 });
}
function setPhase(p) {
  grow.phase = p; clearTimeout(grow.timer); grow.busy = false;
  growEl.dataset.phase = p;
  growBtn.hidden = false;
  $("growSkip").hidden = false; $("growSkip").textContent = "Skip ahead";
  if (p === "plant") {
    $("stepLabel").textContent = "Step 1 of 4 · Plant";
    $("growTitle").textContent = "Tap the glowing spot to plant your seed";
    $("growCaption").textContent = "";
    setGrowBtn("seed", "Plant");
  } else if (p === "water") {
    $("stepLabel").textContent = "Step 2 of 4 · Water";
    $("growTitle").textContent = grow.waters ? "Keep going!" : "Water it three times";
    setGrowBtn("watering-can", "Water");
  } else if (p === "night") {
    grow.queued = 0; clearTimeout(grow.hint); nudge(false); syncPips();
    $("stepLabel").textContent = "Step 3 of 4 · Night falls";
    $("growTitle").textContent = `Night falls over ${CFG.name}`;
    $("growCaption").textContent = CFG.event.caption;
    growBtn.hidden = true;
    document.body.classList.add("night");
    Sound.mood("night"); Sound.night();
    runEvent();
    if (grow.fast) {
      // the short night: the weather plays sped up, and Skip › jumps straight to the harvest
      $("growSkip").textContent = "Skip ›";
      const t0 = performance.now(), sped = setInterval(() => { hurry($("event")); if (performance.now() - t0 > FAST.nightMs + 500) clearInterval(sped); }, 120);
      eventStops.push(() => clearInterval(sped));
    }
    grow.timer = setTimeout(() => setPhase("harvest"), reduced.matches ? 1600 : grow.fast ? FAST.nightMs : 6200);
    return;
  } else if (p === "harvest") {
    $("stepLabel").textContent = "Step 4 of 4 · Harvest";
    $("growTitle").textContent = "Something is ready…";
    setGrowBtn("pumpkin", "Harvest");
    Sound.mood("harvest");
    stageImg.classList.remove("pop", "drop-in");
    if (!reduced.matches) stageImg.classList.add("ready");
  }
  armNudge();
  // a tap that landed during the last animation runs now (only plant / water: the harvest reveal always waits for its own tap)
  const run = grow.queued > 0 && (p === "plant" || p === "water");
  if (run) { grow.queued--; syncPips(); act(); } else { grow.queued = 0; syncPips(); }
}
// One tap = one step. A tap during an animation is kept and runs when the animation ends: one at most on the first
// grow, and on repeat runs every Water tap still owed (three quick taps play the three stages back to back).
function act() {
  if (!grow.phase || grow.phase === "night" || grow.phase === "reveal") return;
  clearTimeout(grow.hint); nudge(false);
  if (grow.busy) {
    const cap = grow.fast && grow.phase === "water" ? 3 - grow.waters : 1;
    grow.queued = Math.min(grow.queued + 1, Math.max(1, cap)); syncPips(); return;
  }
  const wait = (ms, fn) => { grow.busy = true; grow.timer = setTimeout(() => { grow.busy = false; fn(); }, reduced.matches ? 0 : pace(ms)); };
  if (grow.phase === "plant") {
    growEl.classList.add("planted");
    setStage("seed", "drop-in"); hurry(growEl);
    Sound.plant(); Sound.stage(0);
    $("growCaption").textContent = "Planted!";
    wait(650, () => setPhase("water"));
  } else if (grow.phase === "water") {
    grow.waters++; syncPips();
    Sound.water();
    if (!reduced.matches) { splash(); hurry(growEl); }
    $("growCaption").textContent = ["", "A sprout!", "A vine curls out…", "A flower opens!"][grow.waters];
    wait(700, () => {
      setStage(STAGE_ORDER[grow.waters], "pop"); hurry(growEl);
      Sound.stage(grow.waters);
      if (grow.waters >= 3) { grow.queued = 0; syncPips(); wait(1100, () => setPhase("night")); }
      else setPhase("water");
    });
  } else if (grow.phase === "harvest") {
    reveal();
  }
}
// Instant feedback on touch: the pressed look shows on pointerdown (before the click), a short buzz on the tap itself.
for (const el of [growBtn, plot]) {
  let downAt = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || !grow.phase || grow.phase === "reveal") return;
    downAt = performance.now(); el.classList.add("pressed"); clearTimeout(grow.hint); nudge(false);
  });
  const up = () => { const left = Math.max(0, 90 - (performance.now() - downAt)); setTimeout(() => el.classList.remove("pressed"), left); };
  for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, up);
}
function splash() {
  const d = $("drops"); d.textContent = "";
  for (let i = 0; i < 7; i++) {
    const s = document.createElement("i"); s.className = "drop";
    s.style.left = 30 + i * 6.5 + "%"; s.style.animationDelay = (i % 3) * 0.09 + "s";
    d.append(s);
  }
}

/* ---------------- night weather ---------------- */
let eventStops = [];
function stopEvent() { for (const f of eventStops) f(); eventStops = []; $("event").textContent = ""; }
function later(ms, fn) { const t = setTimeout(fn, ms); eventStops.push(() => clearTimeout(t)); }
function runEvent() {
  stopEvent();
  const layer = $("event");
  const el = (cls, parent = layer, tag = "div") => { const e = document.createElement(tag); e.className = cls; parent.append(e); return e; };
  const sprite = (src, parent, cls = "") => { const i = el(cls, parent, "img"); i.src = src; i.alt = ""; return i; };
  const id = CFG.event.id, still = reduced.matches;
  if (id === "full-moon") {
    const m = el("ev-moon"); el("halo", m); sprite(CFG.art.moon, m);
    later(still ? 200 : 900, Sound.moon);
  } else if (id === "crow-visit") {
    const c = el("ev-crow"); sprite(CFG.art["crow-fly"], c);
    if (still) { c.style.left = "56vw"; c.style.top = "14vh"; }
    else { const caw = el("caw", c, "span"); caw.textContent = "Caw!"; }
    later(still ? 300 : 2300, Sound.caw);
  } else if (id === "thunderstorm") {
    storm(layer, el, sprite, still);
  } else if (id === "shooting-star") {
    if (still) { later(300, Sound.twinkle); return; }
    [[12, 10, 0], [55, 6, 1.4], [30, 18, 3.1]].forEach(([x, y, delay]) => {
      const s = el("ev-star");
      s.style.left = x + "%"; s.style.top = y + "vh"; s.style.animationDelay = delay + "s";
      s.style.setProperty("--a", "28deg"); s.style.setProperty("--dx", "38vw"); s.style.setProperty("--dy", "20vh");
      later(delay * 1000 + 100, Sound.twinkle);
    });
  } else if (id === "firefly-swarm") {
    const n = (innerWidth < 640 ? 30 : 46) / (QUALITY.lite ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const f = el("ev-ff"); el("", f, "i"); sprite(CFG.art.firefly, f);
      const s = f.style;
      s.left = rand(2, 96) + "%"; s.top = rand(14, 94) + "%";
      s.setProperty("--sz", Math.round(rand(14, 30)) + "px");
      for (const k of ["--x1", "--x2"]) s.setProperty(k, Math.round(rand(-110, 110)) + "px");
      for (const k of ["--y1", "--y2"]) s.setProperty(k, Math.round(rand(-90, 60)) + "px");
      s.setProperty("--dur", rand(6, 12).toFixed(1) + "s"); s.setProperty("--dl", (-rand(0, 10)).toFixed(1) + "s");
      s.setProperty("--tw", rand(1.2, 2.8).toFixed(1) + "s");
    }
    later(300, Sound.shimmer); later(3200, Sound.shimmer);
  } else if (id === "ghost-parade") {
    const n = QUALITY.lite ? 2 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const g = el("ev-ghost"); const img = sprite(CFG.art.ghost, g);
      const s = g.style, k = rand(0.75, 1.15);
      s.setProperty("--sz", `clamp(${Math.round(60 * k)}px,${(17 * k).toFixed(1)}vw,${Math.round(120 * k)}px)`);
      s.top = (8 + i * 9 + rand(0, 6)).toFixed(1) + "vh";
      if (i % 2) img.style.scale = "-1 1";
      if (still) s.left = (12 + i * 22) + "vw";
      else {
        // already mid-parade when night falls: each ghost starts part-way along its path, spread out
        const dur = rand(12, 16); s.setProperty("--dur", dur.toFixed(1) + "s");
        s.setProperty("--dl", (-dur * (0.12 + (i / n) * 0.62)).toFixed(1) + "s");
      }
      later(still ? 300 : 700 + i * 1900, Sound.ghost);
    }
  }
}
// Thunderstorm: a thin two-depth band of drifting clouds along the top edge (kept clear of the step label and
// title), a two-depth canvas rain with splashes on the soil, and now and then a darkening, lightning + thunder.
let boltProbe = null;
function storm(layer, el, sprite, still) {
  const CLOUD_AR = 1024 / 494, SHOW = 0.62, DRIFT = 22;
  const cv = still ? null : el("ev-rain", layer, "canvas");
  const sky = el("ev-sky");
  const dark = still ? null : el("ev-dark"), flash = still ? null : el("ev-flash");
  const bolt = still ? null : sprite(CFG.art.lightning, layer, "ev-bolt");
  let colL = 0, colR = 0;
  // Clouds sit above the step label everywhere; beside the text column (wide screens) they may hang lower, to 18% of the height.
  function placeClouds() {
    sky.textContent = "";
    const W = innerWidth, H = innerHeight;
    const keep = ["stepLabel", "growTitle"].map((id) => $(id).getBoundingClientRect()).filter((r) => r.width && r.height);
    const textTop = keep.length ? Math.min(...keep.map((r) => r.top)) : 58;
    colL = keep.length ? Math.min(...keep.map((r) => r.left)) - 14 : W * 0.3;
    colR = keep.length ? Math.max(...keep.map((r) => r.right)) + 14 : W * 0.7;
    const clearY = Math.max(20, textTop - 8), band = Math.min(H * 0.18, 150);
    const cloud = (left, bottom, w, far, i) => {
      const h = w / CLOUD_AR, c = sprite(CFG.art["storm-cloud"], sky, "ev-cloud" + (far ? " far" : ""));
      c.setAttribute("data-deco", "");
      Object.assign(c.style, { left: left.toFixed(1) + "px", top: (bottom - h).toFixed(1) + "px", width: w.toFixed(1) + "px", height: h.toFixed(1) + "px" });
      c.style.setProperty("--dx", DRIFT * (far ? 0.6 : 1) + "px");
      const d = far ? rand(70, 95) : rand(40, 55);
      c.style.setProperty("--d", d.toFixed(0) + "s"); c.style.setProperty("--dl", (-rand(0, d)).toFixed(1) + "s");
      if (i % 2) c.style.scale = "-1 1";
    };
    // a row of clouds across the whole width, its bottom at y = bottom
    const row = (bottom, far, offset) => {
      const w = (bottom / SHOW) * CLOUD_AR, step = w * 0.62;
      for (let i = 0, x = -w * 0.35 + offset * step; x < W + w * 0.1; i++, x += step) cloud(x, bottom, w, far, i);
    };
    // one bigger cloud hanging off each side, only where it clears the text column (plus its drift)
    const side = (left, far) => {
      const room = left ? colL - DRIFT : W - colR - DRIFT;
      let w = (band * (far ? 0.8 : 1) / SHOW) * CLOUD_AR;
      if (room < w * 0.55) w = room / 0.55;
      const bottom = (w / CLOUD_AR) * SHOW;
      if (bottom < clearY + 10) return;
      cloud(left ? room - w : W - room, bottom, w, far, left ? 0 : 1);
    };
    side(true, true); side(false, true);
    row(clearY * 0.78, true, 0.5);
    side(true, false); side(false, false);
    row(clearY, false, 0);
  }
  placeClouds(); addEventListener("resize", placeClouds);
  eventStops.push(() => removeEventListener("resize", placeClouds));
  if (still) { later(1200, () => Sound.thunder(0.5)); return; }

  const x = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, drops = [], ripples = [], beads = [], raf = 0, last = performance.now(), alive = true;
  const SLANT = 0.18;
  // two depths: near drops are long, thick, fast and bright; far ones shorter, thinner, slower and dimmer
  const DEPTH = [
    { lw: 1.2, alpha: 0.5, len: [14, 22], speed: [560, 720], ground: [0.66, 0.8], splash: 0.35, r: 6 },
    { lw: 2.2, alpha: 0.85, len: [28, 46], speed: [980, 1300], ground: [0.8, 0.97], splash: 1, r: 12 },
  ];
  const spawn = (d, top) => {
    const k = DEPTH[d.z];
    d.len = rand(...k.len); d.speed = rand(...k.speed); d.ground = H * rand(...k.ground);
    d.x = rand(0, W + H * SLANT);
    d.y = top ? rand(-H * 0.25, 0) : rand(-H * 0.2, d.ground);
    return d;
  };
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const n = Math.round(Math.min(760, Math.max(220, Math.round((W * H) / 1150))) / (QUALITY.lite ? 2 : 1));
    drops = [];
    for (let i = 0; i < n; i++) drops.push(spawn({ z: i % 5 < 2 ? 1 : 0 }, false));
  }
  // a streak drawn in three passes per depth: faint tail, mid, bright head (a cheap gradient, 6 strokes a frame)
  const SEG = [[1, 0.55, 0.16, "190,208,245"], [0.55, 0.22, 0.45, "205,220,255"], [0.22, 0, 1, "236,243,255"]];
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    x.lineCap = "round";
    for (const d of drops) {
      d.y += d.speed * dt; d.x -= d.speed * SLANT * dt;
      if (d.y >= d.ground) {
        const k = DEPTH[d.z];
        if (Math.random() < k.splash) {
          ripples.push({ x: d.x, y: d.ground, t: 0, r: k.r, a: k.alpha });
          if (d.z) for (let j = 0; j < 2; j++) beads.push({ x: d.x, y: d.ground, vx: rand(-70, 70), vy: rand(-170, -90), t: 0 });
        }
        spawn(d, true);
      }
    }
    for (let z = 0; z < 2; z++) {
      const k = DEPTH[z];
      x.lineWidth = k.lw;
      for (const [from, to, a, rgb] of SEG) {
        x.strokeStyle = `rgba(${rgb},${(k.alpha * a).toFixed(3)})`;
        x.beginPath();
        for (const d of drops) {
          if (d.z !== z) continue;
          x.moveTo(d.x + d.len * from * SLANT, d.y - d.len * from);
          x.lineTo(d.x + d.len * to * SLANT, d.y - d.len * to);
        }
        x.stroke();
      }
    }
    ripples = ripples.filter((r) => (r.t += dt) < 0.42);
    x.lineWidth = 1.3;
    for (const r of ripples) {
      const p = r.t / 0.42, rr = 2 + r.r * p;
      x.strokeStyle = `rgba(215,228,255,${(0.75 * r.a * (1 - p)).toFixed(3)})`;
      x.beginPath(); x.ellipse(r.x, r.y, rr, rr * 0.3, 0, 0, Math.PI * 2); x.stroke();
    }
    beads = beads.filter((b) => (b.t += dt) < 0.32);
    for (const b of beads) {
      b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      x.fillStyle = `rgba(225,235,255,${(0.8 * (1 - b.t / 0.32)).toFixed(3)})`;
      x.fillRect(b.x - 0.9, b.y - 0.9, 1.8, 1.8);
    }
    raf = requestAnimationFrame(frame);
  }
  // Where a bolt may fall: beside the text column when there is room for it there (wide screens); otherwise (a phone,
  // where the step label and title span the width) in the band between the title and the plot, sized to fit it, so the
  // bolt never covers the step label or the title. It is turned up to 8 degrees, so its box keeps a margin for that.
  const BOLT_AR = (CFG.sprites.lightning && CFG.sprites.lightning.w / CFG.sprites.lightning.h) || 0.5;
  function placeBolt() {
    const vw = innerWidth, vh = innerHeight, text = ["stepLabel", "growTitle"].map((id) => $(id).getBoundingClientRect()).filter((r) => r.width && r.height);
    const textBottom = text.length ? Math.max(...text.map((r) => r.bottom)) : 0;
    let h = Math.min(vh * 0.5, 420), w = h * BOLT_AR, top = vh * 0.02;
    const roomL = colL - 0.03 * vw - 14, roomR = 0.97 * vw - colR - 14;
    let left;
    if (Math.max(roomL, roomR) >= w + 0.15 * h) {
      const side = roomL >= w + 0.15 * h && (roomR < w + 0.15 * h || Math.random() < 0.5) ? "l" : "r";
      left = side === "l" ? rand(0.03 * vw, Math.max(0.03 * vw, colL - 14 - w - 0.07 * h)) : rand(colR + 14 + 0.07 * h, Math.max(colR + 14 + 0.07 * h, 0.97 * vw - w));
    } else {
      const plot = $("plot").getBoundingClientRect(), floor = plot.height ? plot.top + plot.height * 0.25 : vh * 0.6;
      top = textBottom + 12 + 0.08 * w;
      h = Math.max(90, Math.min(h, floor - top)); w = h * BOLT_AR;
      left = rand(0.04 * vw, Math.max(0.04 * vw, 0.96 * vw - w - 0.07 * h));
    }
    Object.assign(bolt.style, { left: left.toFixed(0) + "px", top: top.toFixed(0) + "px", height: h.toFixed(0) + "px", width: w.toFixed(0) + "px" });
  }
  // test hook: where n strikes would land (the bolt stays hidden; only its box moves)
  boltProbe = (n) => Array.from({ length: n }, () => { placeBolt(); bolt.style.transform = "rotate(8deg)"; const a = bolt.getBoundingClientRect(); bolt.style.transform = "rotate(-8deg)"; const b = bolt.getBoundingClientRect();
    return [Math.min(a.left, b.left), Math.min(a.top, b.top), Math.max(a.right, b.right), Math.max(a.bottom, b.bottom)].map(Math.round); });
  eventStops.push(() => { boltProbe = null; });
  // the sky darkens for a moment, then the bolt and flash; thunder follows.
  function strike() {
    dark.classList.add("on");
    later(380, () => {
      placeBolt();
      bolt.style.transform = `rotate(${rand(-8, 8).toFixed(1)}deg)`;
      bolt.classList.add("on"); flash.classList.add("on");
      setTimeout(() => { bolt.classList.remove("on"); flash.classList.remove("on"); }, 120);
      if (Math.random() < 0.5) setTimeout(() => { flash.classList.add("on"); setTimeout(() => flash.classList.remove("on"), 70); }, 220);
      setTimeout(() => dark.classList.remove("on"), 650);
      later(600, () => Sound.thunder(rand(0.7, 1)));
    });
    later(rand(4200, 8000), strike);
  }
  size(); addEventListener("resize", size);
  raf = requestAnimationFrame(frame);
  later(1300, strike);
  eventStops.push(() => { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", size); });
}

/* ---------------- harvest reveal: hidden rarity, then a flourish per tier ---------------- */
const TIER_SPARK = { Common: ["#bff0a6", 8, 60], Uncommon: ["#8fe9f3", 12, 80], Rare: ["#c8b6ff", 14, 100], Legendary: ["#ffe39a", 18, 110], Secret: ["#dcc8ff", 24, 130] };
// Whether this browser has ever grown this patch's secret (the odds sheet then shows it instead of a silhouette).
const GROWN_KEY = SECRET ? `pumpkin-patch:grown:${CFG.seed}:${SECRET.id}` : "";
const grewSecret = () => { try { return !!GROWN_KEY && localStorage.getItem(GROWN_KEY) === "1"; } catch (_) { return false; } };
const markSecretGrown = () => { try { localStorage.setItem(GROWN_KEY, "1"); } catch (_) {} };
function reveal() {
  clearTimeout(grow.timer); clearTimeout(grow.hint); nudge(false); grow.phase = "reveal"; grow.queued = 0; $("grow").dataset.phase = "reveal";
  // from now on this tab's grows are repeat runs; this reveal still plays at the speed it started with
  fastGrow = true; try { sessionStorage.setItem(FAST_KEY, "1"); } catch (_) {}
  const p = grow.pumpkin, v = VAR.get(p.variety);
  stageImg.hidden = true;
  $("growBtn").hidden = true; $("growSkip").hidden = true;
  $("growTitle").textContent = "Harvest time!";
  $("growCaption").textContent = "";
  const card = $("card");
  card.classList.remove("flip"); card.classList.add("mystery"); card.dataset.tier = "";
  $("reveal").classList.remove("secret");
  { const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = CREDIT; $("secretBanner").replaceChildren("Secret! It only grows in ", nm); }
  setTier($("revealTier"), "?"); $("revealTier").textContent = "???";
  $("revealImg").src = v.image; $("revealImg").alt = "A mystery pumpkin";
  $("revealName").textContent = "…";
  $("revealBlurb").textContent = v.blurb;
  $("revealSig").hidden = v.id !== CFG.signature;
  $("revealOdds").textContent = isSecret(v.id) ? `${oddsOf(v.id)} chance, and only here` : `${oddsOf(v.id)} chance in this patch`;
  $("burst").textContent = "";
  $("reveal").hidden = false;
  $("toCarve").focus({ preventScroll: true });
  // Suspense: the music drops away and a build plays (the same for every tier) until the card flips.
  // Tapping the card flips it straight away; leaving for the carve screen cuts the build.
  Sound.mood("reveal");
  const flip = grow.flip = () => {
    clearTimeout(grow.flipTimer);
    if (grow.phase !== "reveal" || !card.classList.contains("mystery")) return;
    card.classList.remove("mystery");
    card.dataset.tier = v.tier;
    setTier($("revealTier"), v.tier);
    $("revealImg").alt = v.name;
    $("revealName").textContent = v.name;
    $("growTitle").textContent = isSecret(v.id) ? `You grew the secret ${v.name}!` : `You grew ${article(v.tier)} ${v.tier} ${v.name}!`;
    if (isSecret(v.id)) { $("reveal").classList.add("secret"); markSecretGrown(); refreshCollection(); }
    Sound.reveal(v.tier);
    if (reduced.matches) return;
    const [c, n, d] = TIER_SPARK[v.tier] || TIER_SPARK.Common;
    const b = $("burst");
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i");
      s.style.setProperty("--a", `${(i * 360) / n}deg`); s.style.setProperty("--d", `${d + (i % 3) * 30}px`); s.style.setProperty("--c", c);
      s.style.animationDelay = `${(i % 4) * 0.05}s`; b.append(s);
    }
    void card.offsetWidth; card.classList.add("flip");
  };
  // the build's length depends only on whether this is a repeat run, never on the tier
  const buildMs = grow.fast ? FAST.buildMs : Sound.BUILD_MS;
  if (reduced.matches) flip(); else { Sound.suspense(buildMs / 1000); grow.flipTimer = setTimeout(flip, buildMs); }
}
$("card").addEventListener("click", (e) => { if (!e.target.closest("button") && grow.phase === "reveal" && grow.flip) grow.flip(); });

/* ---------------- collection sheet ---------------- */
function openCollection() {
  Sound.unlock();
  const g = $("collGrid");
  refreshCollection();
  if (!g.childElementCount) {
    for (const v of CFG.varieties) {
      const li = document.createElement("li");
      if (v.id === CFG.signature) { li.className = "sig"; const s = document.createElement("span"); s.className = "star"; s.title = "Signature variety"; s.append(uiIcon("star")); li.append(s); }
      const b = document.createElement("b"); b.textContent = v.name;
      const t = document.createElement("span"); t.className = "tier"; setTier(t, v.tier);
      const o = document.createElement("small"); o.textContent = `${oddsOf(v.id)} chance`;
      li.append(thumb(v.image), b, t, o); g.append(li);
    }
    if (SECRET) {
      const li = document.createElement("li"); li.className = "secret"; li.id = "collSecret";
      const b = document.createElement("b"), t = document.createElement("span"), o = document.createElement("small");
      t.className = "tier"; setTier(t, SECRET.tier);
      li.append(thumb(SECRET.image), b, t, o); g.append(li);
      refreshCollection();
    }
  }
  $("collSub").replaceChildren("Odds for one harvest here. ", uiIcon("star"), ` ${sigV.name} is this patch's signature${has(CFG.eventMods, CFG.event.id) ? `, and the ${CFG.event.name.toLowerCase()} boosts Legendary luck` : ""}.${SECRET ? " One secret pumpkin grows nowhere else." : ""}`);
  // the odds above are one harvest's; the safety net (luckyRoll) is told here so they stay honest
  let luckOn = false; try { localStorage.getItem(LUCK_KEY); luckOn = true; } catch (_) {}
  $("collLuck").hidden = !luckOn; $("collLuck").textContent = `Lucky streak: a Rare or better at least once every ${LUCK_DRY + 1} grows.`;
  $("collection").hidden = false;
  $("collClose").focus({ preventScroll: true });
}
// A collection thumbnail: the drawing cropped to its visible pixels and fitted into the card's square box (at most
// THUMB.w wide, THUMB.h tall), centred, its lowest pixel on the shared baseline THUMB.base (fractions of the box).
const THUMB = { w: 0.94, h: 0.84, base: 0.95 };
const bboxCache = new Map();
function alphaBox(img) {
  if (bboxCache.has(img.src)) return bboxCache.get(img.src);
  const n = 128, c = document.createElement("canvas"); c.width = c.height = n;
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, n, n);
  let d; try { d = x.getImageData(0, 0, n, n).data; } catch (_) { return null; }
  let x0 = n, y0 = n, x1 = -1, y1 = -1;
  for (let y = 0; y < n; y++) for (let i = 0; i < n; i++) if (d[(y * n + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bb = x1 < 0 ? null : { x0: x0 / n, y0: y0 / n, x1: (x1 + 1) / n, y1: (y1 + 1) / n };
  bboxCache.set(img.src, bb); return bb;
}
function fitThumb(img) {
  const bb = alphaBox(img), ar = img.naturalHeight / img.naturalWidth; if (!bb || !ar) return;
  const cw = bb.x1 - bb.x0, ch = (bb.y1 - bb.y0) * ar, k = Math.min(THUMB.w / cw, THUMB.h / ch);
  img.style.setProperty("--w", (k * 100).toFixed(2) + "%");
  img.style.setProperty("--l", ((0.5 - k * (bb.x0 + bb.x1) / 2) * 100).toFixed(2) + "%");
  img.style.setProperty("--t", ((THUMB.base - k * ar * bb.y1) * 100).toFixed(2) + "%");
  img.dataset.fit = [bb.x0, bb.y0, bb.x1, bb.y1].map((v) => v.toFixed(3)).join(",");
}
function thumb(src) {
  const box = document.createElement("span"); box.className = "thumb";
  const img = document.createElement("img"); img.alt = ""; img.decoding = "async";
  img.onload = () => fitThumb(img); img.src = src;
  if (img.complete && img.naturalWidth) fitThumb(img);
  box.append(img); return box;
}
// The secret shows as a dark silhouette until this browser has grown it.
function refreshCollection() {
  const li = $("collSecret"); if (!li) return;
  const known = grewSecret(), img = li.querySelector("img");
  img.classList.toggle("sil", !known); img.alt = known ? SECRET.name : "An unknown pumpkin";
  li.querySelector("b").textContent = known ? SECRET.name : "???";
  li.querySelector("small").textContent = `Only grows here · ${oddsOf(SECRET.id)}`;
  li.dataset.known = String(known);
}
const closeCollection = () => { $("collection").hidden = true; $("seeAll").focus({ preventScroll: true }); };
$("seeAll").onclick = openCollection;
$("collClose").onclick = closeCollection;
$("collection").addEventListener("click", (e) => { if (e.target === $("collection")) closeCollection(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("collection").hidden) closeCollection(); });

$("plantBtn").onclick = startGrow;
growBtn.addEventListener("click", () => { haptic(); act(); });
plot.addEventListener("click", () => { haptic(); act(); });
plot.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); act(); } });
// iOS only paints :active on elements when a touch listener exists
document.addEventListener("touchstart", () => {}, { passive: true });
$("growSkip").onclick = () => { if (grow.phase && grow.phase !== "reveal") reveal(); };
$("toCarve").onclick = () => startCarve(grow.pumpkin);
$("skipCarve").onclick = () => { Sound.unlock(); showNote(""); startCarve(newPumpkin()); };

/* ================= carving engine ================= */
const canvas = $("c"), ctx = canvas.getContext("2d"), spill = $("spill"), stage = $("stage");
const state = { variety: null, pseed: 0, strokes: [], texts: [], from: "", msg: "" };
let brush = 2, mode = "idle", undoStack = [], active = null, selected = -1;
// G: the pumpkin's placement. Strokes live in "pumpkin space" (0-255 across the art's square box);
// G maps that box onto the 256-unit canvas, scaled by the pumpkin's pseed. Text items use the same
// space, normalised to 0-1.
let G = null, pumpkinToken = 0;

const artCache = new Map();
function loadArt(id) {
  if (!artCache.has(id)) artCache.set(id, new Promise((res) => {
    const img = new Image();
    // the body mask is kept as an ImageBitmap: a cached canvas can come back blank later (seen under memory
    // pressure: an empty mask meant a pumpkin on which no cut ever showed)
    img.onload = () => {
      const a = analyse(img);
      if (a.mask && typeof createImageBitmap === "function") createImageBitmap(a.mask).then((bm) => res({ img, ...a, mask: bm }), () => res({ img, ...a }));
      else res({ img, ...a });
    };
    img.onerror = () => { const c = fallbackArt(); res({ img: c, ...analyse(c) }); };
    img.src = VAR.get(id).image;
  }));
  return artCache.get(id);
}
function fallbackArt() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  x.fillStyle = "#e57a29"; x.beginPath(); x.ellipse(128, 150, 112, 92, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#3f6b2a"; x.fillRect(120, 40, 16, 26);
  return c;
}
// Find the pumpkin's body in the art's alpha: widest solid row = equator; the body ends where rows
// narrow sharply (stem above, nothing below) or at a neck (a crown sitting on the body, like a
// turban squash). Glass-like art is mostly translucent, so the alpha bar drops until a body shows.
function analyse(img) {
  const DEF = { sh: { cx: 128, cy: 146, rx: 110, ry: 90, top: 56, bottom: 236 }, mask: null };
  try {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, 256, 256);
    const d = x.getImageData(0, 0, 256, 256).data;
    let runs, wy = 0, maxLen = 0;
    for (const bar of [235, 160, 90]) {
      runs = [];
      for (let y = 0; y < 256; y++) {
        let best = [0, 0], s = -1;
        for (let xx = 0; xx <= 256; xx++) {
          const on = xx < 256 && d[(y * 256 + xx) * 4 + 3] > bar;
          if (on && s < 0) s = xx;
          if (!on && s >= 0) { if (xx - s > best[1]) best = [s, xx - s]; s = -1; }
        }
        runs.push(best);
      }
      wy = 0; for (let y = 1; y < 256; y++) if (runs[y][1] > runs[wy][1]) wy = y;
      maxLen = runs[wy][1];
      if (maxLen >= 60) break;
    }
    if (maxLen < 40) return DEF;
    let bottom = wy; while (bottom < 255 && runs[bottom + 1][1] >= maxLen * 0.15) bottom++;
    let top = wy, minW = maxLen, minY = wy;
    while (top > 0 && runs[top - 1][1] >= maxLen * 0.33) {
      top--;
      const w = runs[top][1];
      if (w < minW) { minW = w; minY = top; }
      // a neck: the outline narrowed to under 80% and is now widening again -> a crown above the body
      else if (minW < maxLen * 0.8 && w > minW * 1.08 && minY - top >= 2) { top = minY; break; }
    }
    const cx = runs[wy][0] + maxLen / 2;
    // every visible pixel (stem, crown, a ghost's tail, sparkles), not just the body: placement keeps all of it on canvas
    let bl = 256, bt = 256, br = 0, bb = 0;
    for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) if (d[(y * 256 + xx) * 4 + 3] > 8) { if (xx < bl) bl = xx; if (xx + 1 > br) br = xx + 1; if (y < bt) bt = y; if (y + 1 > bb) bb = y + 1; }
    const mask = document.createElement("canvas"); mask.width = mask.height = 256;
    // a software canvas: it is cached for the whole visit, and a GPU canvas can be dropped under memory pressure
    // (its context lost), which left a pumpkin with an empty body mask, so no cut ever showed
    const mx = mask.getContext("2d", { willReadFrequently: true }), md = mx.createImageData(256, 256);
    for (let y = top; y <= bottom; y++) {
      const [s0, len] = runs[y];
      for (let xx = s0; xx < s0 + len; xx++) md.data[(y * 256 + xx) * 4 + 3] = 255;
    }
    mx.putImageData(md, 0, 0);
    return { sh: { cx, cy: (top + bottom) / 2, rx: maxLen / 2, ry: (bottom - top) / 2, top, bottom }, mask, bb: { l: bl, t: bt, r: br, b: bb } };
  } catch (_) { return DEF; }
}
// Where the art sits on the 256-unit canvas. Strokes, words and stencils live in the ART's own 0-255 box ("pumpkin
// space"), so this only moves / scales the picture: every link cuts the same holes in the same pumpkin.
// The pumpkin is drawn at 222 units x its pseed scale, centred, its body's bottom on the line y = 234, unless part of
// the visible art (a ghost's tail, a crown, sparkles, a wide squash at scale 1.08) would then come closer than
// PLACE_PAD to an edge: then it is shrunk / shifted just enough. PLACE_PAD is wider than the card trim (SURFACE_TRIM),
// so the Story card, the clip and the brand images never cut it either.
const PLACE_PAD = 12;
function placement(art, look) {
  const sh = look.flip ? { ...art.sh, cx: 256 - art.sh.cx } : art.sh;
  const b0 = art.bb || { l: 0, t: 0, r: 256, b: 256 }, bb = look.flip ? { l: 256 - b0.r, r: 256 - b0.l, t: b0.t, b: b0.b } : b0;
  const lo = PLACE_PAD, hi = 256 - PLACE_PAD;
  const k = Math.min((222 * look.scale) / 256, (hi - lo) / Math.max(1, bb.r - bb.l), (hi - lo) / Math.max(1, bb.b - bb.t));
  let ox = (256 - 256 * k) / 2, oy = 234 - k * sh.bottom;
  if (ox + k * bb.l < lo) ox = lo - k * bb.l; else if (ox + k * bb.r > hi) ox = hi - k * bb.r;
  if (oy + k * bb.b > hi) oy = hi - k * bb.b;
  if (oy + k * bb.t < lo) oy = lo - k * bb.t;
  return { k, ox, oy, sh };
}
// prep (optional) runs once the pumpkin's body box G.sh is known, before the layers are built (a link's stencil)
async function setPumpkin(variety, pseed, prep) {
  state.variety = variety; state.pseed = pseed;
  const token = ++pumpkinToken;
  const art = await loadArt(variety);
  if (token !== pumpkinToken) return false;
  const look = lookOf(pseed), { k, ox, oy, sh } = placement(art, look);
  G = { k, ox, oy, look, img: art.img, mask: art.mask, sh };
  if (prep) prep(sh);
  rebuildAll();
  return true;
}

let P = 0, U = 1;
let L = {};
let pool = new Map(); // (let: an offscreen surface swaps in its own layers, see onSurface)
const toPumpkin = (x) => x.setTransform(U * G.k, 0, 0, U * G.k, U * G.ox, U * G.oy);
// Canvases are pooled by name so carving (which rebuilds every frame) doesn't churn allocations.
function layer(key) {
  let c = key && pool.get(key);
  if (!c || c.width !== P) { c = document.createElement("canvas"); c.width = P; c.height = P; if (key) pool.set(key, c); }
  const x = c.getContext("2d");
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.shadowBlur = 0; x.shadowColor = "transparent"; x.filter = "none";
  x.shadowOffsetX = 0; x.shadowOffsetY = 0;
  x.clearRect(0, 0, P, P);
  toPumpkin(x); x.lineCap = "round"; x.lineJoin = "round";
  return [c, x];
}
function drawArt(x, hue, src = G.img) {
  x.save();
  if (G.look.flip) { x.translate(256, 0); x.scale(-1, 1); }
  if (hue && "filter" in x) x.filter = `hue-rotate(${G.look.hue.toFixed(2)}deg)`;
  x.drawImage(src, 0, 0, 256, 256);
  x.restore();
}
function strokePass(x, strokes, extra, style) {
  x.strokeStyle = style; x.fillStyle = style;
  for (const s of strokes) {
    const w = BRUSH[s.size] + extra; if (w <= 0.5) continue;
    x.lineWidth = w; x.beginPath();
    const p = s.points;
    x.moveTo(p[0][0], p[0][1]);
    if (p.length === 1) x.lineTo(p[0][0] + 0.01, p[0][1]);
    for (let i = 1; i < p.length; i++) x.lineTo(p[i][0], p[i][1]);
    x.stroke();
  }
}
// Carved words: glyphs are filled (the hole) and, for the rim/edge passes, outlined with the same
// extra width strokes get, so letters get the same pulp rim, inner shading and glow as strokes.
const LATIN = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u;
function textFont(t, px) {
  return LATIN.test(t) ? `${px}px "Luckiest Guy","Arial Black",Impact,sans-serif`
    : `900 ${px}px system-ui,-apple-system,"PingFang TC","Hiragino Sans","Noto Sans CJK TC","Microsoft JhengHei",sans-serif`;
}
function textPass(x, texts, extra, style) {
  for (const tx of texts) {
    x.save();
    x.translate(tx.x * 256, tx.y * 256); x.rotate((tx.r * Math.PI) / 180);
    x.font = textFont(tx.t, tx.s * 256); x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = style; x.fillText(tx.t, 0, 0);
    if (extra > 0) { x.strokeStyle = style; x.lineWidth = extra; x.lineJoin = "round"; x.strokeText(tx.t, 0, 0); }
    x.restore();
  }
}
const measureCtx = document.createElement("canvas").getContext("2d");
function textBox(tx) {
  measureCtx.font = textFont(tx.t, tx.s * 256);
  return { w: measureCtx.measureText(tx.t).width, h: tx.s * 256 * 0.9 };
}
function maskToBody(x) {
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "destination-in";
  x.drawImage(L.mask, 0, 0); x.restore();
}
function candleGrad(x, sh, stops) {
  const g = x.createRadialGradient(sh.cx, sh.cy + sh.ry * 0.35, 0, sh.cx, sh.cy + sh.ry * 0.2, sh.ry * 1.25);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function buildShapeLayers() {
  const sh = G.sh;
  let x;
  [L.body, x] = layer("body"); drawArt(x, true);
  // Carve mask: the body's solid runs, eroded a few units (holes never touch the silhouette),
  // minus everything above the body (the stem, or a turban's crown).
  let m0;
  [m0, x] = layer("mask0"); drawArt(x, false, G.mask || G.img);
  [L.mask, x] = layer("mask");
  x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(m0, 0, 0);
  x.globalCompositeOperation = "destination-in";
  const r = 6 * U * G.k;
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; x.drawImage(m0, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); }
  x.globalCompositeOperation = "source-over"; toPumpkin(x); x.clearRect(-20, -20, 300, sh.top + 26);
  // lit skin: dark, faintly warm from the inside
  [L.bodyLit, x] = layer("bodyLit");
  x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(L.body, 0, 0); toPumpkin(x);
  x.globalCompositeOperation = "source-atop";
  x.fillStyle = "rgba(26,7,3,.74)"; x.fillRect(-50, -50, 360, 360);
  x.fillStyle = candleGrad(x, sh, [[0, "rgba(255,130,35,.36)"], [0.6, "rgba(210,80,12,.14)"], [1, "rgba(0,0,0,0)"]]);
  x.fillRect(-50, -50, 360, 360);
}
// Every cut is rendered from two UNION masks of all strokes, words and stencils, never per shape, so crossings
// and overlaps read as one clean opening: H = the holes, R = H grown by the rim width. From those, once per change:
//   skin shade  - R, blurred: a soft shadow on the skin round the cut
//   pulp rim    - R minus H, softly edged, with a bright bevel along the hole's lip
//   wall        - H in warm flesh, then the dark inside = H shifted away from the light (the pumpkin's highlight is
//                 top-left), blurred and clipped to H, so the visible wall fades smoothly into the dark
// The lit look uses the same recipe in candle colours, and the glow is bloomed from that one union layer.
// Blur uses the shadow-of-an-offscreen-copy trick (works where ctx.filter doesn't), in device pixels.
let half = null;
function halfCanvas() {
  const n = Math.max(32, Math.ceil(P / 2));
  if (!half || half.width !== n) { half = document.createElement("canvas"); half.width = half.height = n; }
  return half;
}
function softInto(target, src, style, { dx = 0, dy = 0, blur = 0, clip = null, cut = null, alpha = 1, op = "source-over" } = {}) {
  const [c, x] = layer("tint");
  const s = U * G.k;
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (blur > 0) {
    // blurred at half resolution (4x fewer pixels) and scaled back up; hard edges come from the full-res clip/cut
    const h = halfCanvas(), hx = h.getContext("2d"), off = h.width * 3;
    hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, h.width, h.height);
    hx.shadowColor = "#000"; hx.shadowBlur = blur * s * 0.5; hx.shadowOffsetX = dx * s * 0.5 + off; hx.shadowOffsetY = dy * s * 0.5;
    hx.drawImage(src, -off, 0, h.width, h.height);
    hx.shadowColor = "transparent"; hx.shadowBlur = 0; hx.shadowOffsetX = 0; hx.shadowOffsetY = 0;
    x.drawImage(h, 0, 0, P, P);
  } else x.drawImage(src, dx * s, dy * s);
  x.globalCompositeOperation = "source-in"; toPumpkin(x);
  x.fillStyle = style; x.fillRect(-50, -50, 360, 360);
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (clip) { x.globalCompositeOperation = "destination-in"; x.drawImage(clip, 0, 0); }
  if (cut) { x.globalCompositeOperation = "destination-out"; x.drawImage(cut, 0, 0); }
  const t = target.getContext("2d");
  t.setTransform(1, 0, 0, 1, 0, 0); t.globalAlpha = alpha; t.globalCompositeOperation = op;
  t.drawImage(c, 0, 0);
  t.globalAlpha = 1; t.globalCompositeOperation = "source-over";
}
let litStale = true;
const PASSES = [["hole", 0], ["rim", 2.8]];
const LIGHT = { dx: 0.6, dy: 2.1 }; // the inside shadow falls down-right: light from the top-left
// While a stroke is being drawn only that stroke is re-rasterised on top of cached masks of
// the finished strokes, so carving stays smooth however busy the pumpkin already is. A draft (every
// frame of a drag) skips the blurred passes; the full look is rebuilt once when the finger lifts.
function buildCarveLayers(incremental, draft = incremental) {
  if (!G || !P) return;
  const sh = G.sh, S = state.strokes;
  let x;
  if (!incremental) {
    const done = S.filter((s) => s !== active);
    for (const [k, extra] of PASSES) { [L["base_" + k], x] = layer("base_" + k); strokePass(x, done, extra, "#000"); textPass(x, state.texts, extra, "#000"); }
  }
  for (const [k, extra] of PASSES) {
    [L[k], x] = layer(k);
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(L["base_" + k], 0, 0); toPumpkin(x);
    if (active) strokePass(x, [active], extra, "#000");
    maskToBody(x);
  }
  const vert = (top, bottom) => { const g = x.createLinearGradient(0, sh.cy - sh.ry, 0, sh.cy + sh.ry); g.addColorStop(0, top); g.addColorStop(1, bottom); return g; };
  [L.carve, x] = layer("carve");
  if (S.length || state.texts.length) {
    const H = L.hole, R = L.rim;
    const q = draft ? 0 : 1;
    if (!draft) softInto(L.carve, R, "rgba(60,20,4,.38)", { blur: 2.4, dx: 0.3, dy: 0.8, cut: H });
    softInto(L.carve, R, vert("#f7c886", "#dd9550"), { blur: 0.5 * q, cut: H });
    if (!draft) softInto(L.carve, H, "rgba(255,238,196,.9)", { blur: 1.3, dx: -0.2, dy: -0.3, clip: R, cut: H });
    softInto(L.carve, H, vert("#b9682f", "#8a4316"));
    softInto(L.carve, H, "#1d0703", { ...LIGHT, blur: 1.1 * q, clip: H });
    if (!draft) softInto(L.carve, H, "#080201", { dx: LIGHT.dx * 2, dy: LIGHT.dy * 2, blur: 2.2, clip: H });
  }
  litStale = true;
  if (light > 0 || anim) buildLitLayers();
  dirty = true;
  placeTbox();
}
// Lit layers are only needed once the candle is on; skipping them keeps carving cheap.
function buildLitLayers() {
  const sh = G.sh, any = state.strokes.length || state.texts.length;
  let x;
  [L.carveLit, x] = layer("carveLit");
  if (any) {
    const H = L.hole, R = L.rim;
    softInto(L.carveLit, R, "#f2862a", { blur: 0.5, cut: H });
    softInto(L.carveLit, H, "rgba(255,226,150,.95)", { blur: 1.5, clip: R, cut: H });
    softInto(L.carveLit, H, "#ffa53e");
    softInto(L.carveLit, H, candleGrad(x, sh, [[0, "#fffbea"], [0.3, "#fff0b8"], [0.65, "#ffd77a"], [1, "#ffb04a"]]), { ...LIGHT, blur: 1.3, clip: H });
  }
  [L.glow, x] = layer("glow");
  if (any) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.shadowColor = "rgba(255,150,40,1)"; x.shadowBlur = 22 * U; x.drawImage(L.carveLit, 0, 0);
    x.shadowColor = "rgba(255,200,110,1)"; x.shadowBlur = 7 * U; x.drawImage(L.carveLit, 0, 0);
  }
  litStale = false;
}
function rebuildAll() { if (!P || !G) return; buildShapeLayers(); buildCarveLayers(); }
/* ---- surfaces ---- The Story / Square cards and the video draw the pumpkin with this same renderer (the same G
   mapping of the variety art, pseed scale / hue / flip, and strokes / words / stencils in pumpkin space) on an
   offscreen surface at THEIR output size, from the original art: never a resampled copy of the page canvas.
   onSurface swaps the renderer's size and layer set in for one synchronous call, then puts the page's back. */
function onSurface(sf, fn) {
  const keep = [P, U, L, pool, half, litStale];
  P = sf.P; U = sf.P / 256; L = sf.L; pool = sf.pool; half = sf.half; litStale = sf.litStale;
  try { return fn(); } finally { sf.half = half; sf.litStale = litStale; [P, U, L, pool, half, litStale] = keep; }
}
// the current pumpkin, carved, at n x n device pixels (the same 256-unit box as the page canvas)
function pumpkinSurface(n) {
  const sf = { P: Math.max(64, Math.round(n)), L: {}, pool: new Map(), half: null, litStale: true };
  onSurface(sf, () => { buildShapeLayers(); buildCarveLayers(false); buildLitLayers(); });
  return sf;
}
// a hole layer (n x n device pixels, drawn through toPumpkin) back in pumpkin space, flipped back to the art's own
// orientation: "0"/"1" per cell of the 256 x 256 box (test hooks: the brand images and the page must cut the same holes)
function holeBits(hole, n) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d", { willReadFrequently: true }), s = n / 256;
  x.setTransform(1 / (s * G.k), 0, 0, 1 / (s * G.k), -G.ox / G.k, -G.oy / G.k);
  if (G.look.flip) { x.setTransform(-1 / (s * G.k), 0, 0, 1 / (s * G.k), 256 + G.ox / G.k, -G.oy / G.k); }
  x.drawImage(hole, 0, 0);
  const d = x.getImageData(0, 0, 256, 256).data; let out = "";
  for (let i = 0; i < 65536; i++) out += d[i * 4 + 3] > 127 ? "1" : "0";
  return out;
}
const SURFACE_TRIM = 0.04; // the canvas keeps a margin round the pumpkin for the page's glow; cards trim it (< PLACE_PAD)
// draws the surface's pumpkin (light lv, room rm, flicker f) into box [l, t, S, S] of x, feathered so the glow has no edge
function drawPumpkin(sf, x, l, t, S, lv, rm, f) {
  const n = sf.P, off = sf.canvas || (sf.canvas = document.createElement("canvas"));
  if (off.width !== n) { off.width = off.height = n; }
  const ox = off.getContext("2d");
  onSurface(sf, () => render(0, ox, lv, rm, f));
  // only the glow round the pumpkin is feathered out; the pumpkin itself stays solid (a feathered body showed the
  // backdrop through its sides and read as blurry)
  const body = sf.bodyCanvas || (sf.bodyCanvas = document.createElement("canvas"));
  if (body.width !== n) { body.width = body.height = n; }
  const bx = body.getContext("2d");
  bx.globalCompositeOperation = "copy"; bx.drawImage(off, 0, 0);
  bx.globalCompositeOperation = "destination-in"; bx.drawImage(sf.L.body, 0, 0); bx.globalCompositeOperation = "source-over";
  const fe = ox.createRadialGradient(n / 2, n * 0.52, n * 0.3, n / 2, n * 0.52, n * 0.5);
  fe.addColorStop(0, "rgba(0,0,0,1)"); fe.addColorStop(1, "rgba(0,0,0,0)");
  ox.setTransform(1, 0, 0, 1, 0, 0); ox.globalCompositeOperation = "destination-in"; ox.fillStyle = fe; ox.fillRect(0, 0, n, n); ox.globalCompositeOperation = "source-over";
  ox.drawImage(body, 0, 0);
  const m = n * SURFACE_TRIM;
  x.imageSmoothingQuality = "high"; x.drawImage(off, m, m, n - 2 * m, n - 2 * m, l, t, S, S);
}
// surface size for a pumpkin box of S output pixels: the trimmed square maps 1:1 onto the box
const surfaceFor = (S) => Math.round(S / (1 - 2 * SURFACE_TRIM));
/* ---- /surfaces ---- */
// The display font arrives after first paint; carved words are re-cut once it is ready.
if (document.fonts && document.fonts.load) document.fonts.load('40px "Luckiest Guy"').then(() => { if (state.texts.length) buildCarveLayers(); }).catch(() => {});

