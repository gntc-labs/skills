// Haunted Farm — farms: names and links, the setup form's rules, saving a farm
// (slug, lot, art), moving out, and /setup# links.

import * as E from "./engine.js";
import { artIn } from "./art-check.js";
import { $, now, RULES, state } from "./core.js";
import { listAll, lotsColl, plotsColl, updateMyFarm } from "./data.js";
import { farmIn, isObj } from "./read.js";
import { AVATARS, IMAGE_LIMITS, SCARECROWS, SKIN_KINDS, SKIN_STAGES, SLUG_RE } from "./shared.js";
import { freshTutorial, mergeFarm, plotOut } from "./sync.js";
import { MAP_LOTS } from "./views/map.js";
import { setupHtml } from "./views/setup.js";

function avatarFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 6;
}

// ── farms: names, slugs, setup ────────────────────────────────────────

const nameOf = (id) => state.players.get(id)?.player.name || "A neighbour";
const farmOf = (id) => state.farms.get(id)?.farm || null;
const farmBySlug = (slug) => [...state.farms.entries()].find(([, v]) => v.farm.slug === slug)?.[0] || null;
const farmUrl = (id) => (farmOf(id) ? `/farm/${farmOf(id).slug}` : null);
const farmName = (id) => farmOf(id)?.name || `${nameOf(id)}'s farm`;

/** Validate a farm setup (from the form or a /setup link). Returns the clean farm or throws. */
function cleanFarm(raw) {
  const name = String(raw?.name ?? "").replace(/\s+/g, " ").trim();
  const slug = String(raw?.slug ?? "").trim().toLowerCase();
  const avatar = Number(raw?.avatar);
  const scarecrow = String(raw?.scarecrow ?? "classic");
  if (!name || [...name].length > 30) throw new Error("Give your farm a name (up to 30 characters).");
  if (!SLUG_RE.test(slug)) throw new Error("The link name needs 2–31 lowercase letters, digits or dashes.");
  if (!AVATARS.includes(avatar)) throw new Error("Pick a farmer (1–6).");
  if (!(scarecrow in SCARECROWS)) throw new Error("Pick a scarecrow colour.");
  const farm = { name, slug, avatar, scarecrow };
  // Only what the village allows is kept (the pixels are checked
  // again before anything is shown). null = remove it; absent = keep what's there.
  if (raw?.avatarPng === null) farm.avatarPng = null;
  else if (RULES.customAvatar && typeof raw?.avatarPng === "string") {
    if (raw.avatarPng.length > IMAGE_LIMITS.avatar.maxChars || !raw.avatarPng.startsWith("data:image/png;base64,")) throw new Error("That custom face isn't a small PNG — make it again with the skill.");
    farm.avatarPng = raw.avatarPng;
  }
  if (RULES.cropSkins && raw?.skins && typeof raw.skins === "object") {
    const skins = {};
    for (const k of SKIN_KINDS) {
      const sk = raw.skins[k];
      if (!sk) continue;
      if (!SKIN_STAGES.every((st) => typeof sk[st] === "string" && sk[st].startsWith("data:image/png;base64,") && sk[st].length <= IMAGE_LIMITS.skin.maxChars)) throw new Error(`The ${k} skin needs three small PNGs (sprout, growing, ripe).`);
      skins[k] = Object.fromEntries(SKIN_STAGES.map((st) => [st, sk[st]]));
    }
    if (Object.values(skins).flatMap((k) => Object.values(k)).join("").length > IMAGE_LIMITS.skinsTotalChars) throw new Error("Those crop skins are too big in all — simplify them.");
    if (Object.keys(skins).length) farm.skins = skins;
  }
  return farm;
}

/** Claim the slug (slugs/<slug> is owner-only, so the first PUT wins) and write farms/<you>. */
async function saveFarm(farm) {
  const me = state.meId;
  const claimed = await state.vh.get("slugs", farm.slug);
  if (claimed && claimed.ownerUserId !== me) throw new Error(`"${farm.slug}" is taken in this village — pick another link name.`);
  if (!claimed) {
    try {
      await state.vh.put("slugs", farm.slug, { userId: me }, { expectedVersion: 0 });
    } catch (e) {
      if (e.code === "APP_DATA_VERSION_CONFLICT") throw new Error(`"${farm.slug}" was just taken — pick another link name.`);
      throw e;
    }
  }
  const old = farmOf(me);
  // A farm keeps its district + lot forever; a new one claims the next lot.
  const place = old ? { district: old.district, lot: old.lot } : await claimLot();
  // A new farm starts the tutorial with beginner's luck unused; a renamed one
  // keeps its progress.
  // The doc is re-read for every attempt (a version race re-reads and
  // re-merges), so a rename never writes back an older tutorial.
  for (let attempt = 0; ; attempt++) {
    const fresh = await state.vh.get("farms", me);
    const base = fresh ? mergeFarm(old, fresh.data) : null;
    const carry = base ? { tutorial: base.tutorial, firstCropBoost: base.firstCropBoost } : { tutorial: freshTutorial(), firstCropBoost: false };
    // The pictures go to art/<me> (inline ones from older saves move there too).
    const artVersion = await saveArt(farm, base);
    try {
      const doc = { ...farm, district: place.district, lot: place.lot, ...carry, artVersion };
      delete doc.avatarPng;
      delete doc.skins;
      await state.vh.put("farms", me, JSON.parse(JSON.stringify(doc)), { expectedVersion: fresh ? fresh.version : 0 });
      break;
    } catch (e) {
      if (e.code !== "APP_DATA_VERSION_CONFLICT" || attempt >= 3) throw e;
    }
  }
  await ensurePlot(place.district);
  if (old && old.slug !== farm.slug) state.vh.remove("slugs", old.slug).catch(() => {});
}

/**
 * Write my pictures to art/<me>: `farm`'s avatarPng / skins (null = remove,
 * absent = keep what the farm had — inline on an old doc, or in art/<me>).
 * Returns the farm doc's new artVersion, or undefined when there's no art.
 */
async function saveArt(farm, base) {
  const me = state.meId;
  const cur = await state.vh.get("art", me);
  const had = base?.artVersion ? (cur && isObj(cur.data) ? artIn(cur.data) : {}) : { avatarPng: base?.avatarPng, skins: base?.skins };
  const art = {};
  for (const f of ["avatarPng", "skins"]) {
    const v = farm[f] === undefined ? had[f] : farm[f];
    if (v != null) art[f] = v;
  }
  if (!Object.keys(art).length) {
    if (cur) await state.vh.remove("art", me).catch(() => {});
    return undefined;
  }
  const sameAsStored = cur && base?.artVersion && JSON.stringify(artIn(cur.data)) === JSON.stringify(artIn(art));
  if (sameAsStored) return base.artVersion;
  await state.vh.put("art", me, art, { expectedVersion: cur ? cur.version : 0 });
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** My farm still carries its pictures inline (saved before art/<id>): move them, once. */
async function migrateMyArt() {
  const farm = farmOf(state.meId);
  if (!farm || farm.artVersion || !(farm.avatarPng || farm.skins)) return;
  const artVersion = await saveArt({}, farm);
  await updateMyFarm((f) => (f.artVersion ? null : { artVersion, avatarPng: null, skins: null }));
}

/**
 * A newcomer takes the FIRST FREE lot, scanning district 1 lot 0 upward:
 * lots left by farmers who moved out get refilled, while everyone already
 * settled keeps their lot. A lot is HELD by a lots-d<district> claim whose
 * owner's farm points at that lot. A claim nobody's farm points at is an
 * orphan (a move-out cut short) and the lot counts as free — unless the
 * claim is under two minutes old and its owner has no farm yet: that's a
 * newcomer mid-setup.
 *
 * Claims are owner-only docs, so an orphan can't be overwritten: the lot is
 * then claimed as "<lot>~<me>" beside it. Two farmers can pick the same gap
 * at once: on "<lot>" the first PUT wins (a loser gets 409 / 403); on
 * "<lot>~<me>" both land, so each re-reads and the earlier claim keeps it.
 */
const PENDING_CLAIM_MS = 2 * 60_000;
const claimLotOf = (docId) => Number(String(docId).split("~")[0]);
async function claimLot() {
  const me = state.meId;
  const farms = new Map((await listAll("farms")).filter((d) => d.ownerUserId === d.docId).map((d) => [d.docId, farmIn(d.docId, d.data)]));
  for (let district = 1; district <= 50; district++) {
    const claimsOf = async () => (await listAll(lotsColl(district))).filter((c) => Number.isInteger(claimLotOf(c.docId)));
    // Does this claim stop someone else from taking its lot?
    const live = (c) => {
      const f = farms.get(c.ownerUserId);
      if (f) return f.district === district && f.lot === claimLotOf(c.docId);
      return now() - Date.parse(c.createdAt) < PENDING_CLAIM_MS;
    };
    const claims = await claimsOf();
    for (let lot = 0; lot < MAP_LOTS.length; lot++) {
      const here = claims.filter((c) => claimLotOf(c.docId) === lot && c.ownerUserId !== me);
      const pointed = [...farms.entries()].some(([id, f]) => id !== me && f && f.district === district && f.lot === lot);
      if (pointed || here.some(live)) continue;
      const primary = claims.find((c) => c.docId === String(lot));
      const id = !primary || primary.ownerUserId === me ? String(lot) : `${lot}~${me}`;
      try {
        const mine = claims.find((c) => c.docId === id);
        await state.vh.put(lotsColl(district), id, { userId: me }, { expectedVersion: mine ? mine.version : 0 });
      } catch (e) {
        if (e.code !== "APP_DATA_VERSION_CONFLICT" && e.code !== "APP_DATA_NOT_PLAYER") throw e;
        continue;
      }
      if (id === String(lot)) return { district, lot };
      // A side claim: someone else may have made one too. The earliest live one keeps the lot.
      const rivals = (await claimsOf()).filter((c) => claimLotOf(c.docId) === lot && c.docId !== id && c.ownerUserId !== me && live(c));
      const mineNow = (await claimsOf()).find((c) => c.docId === id);
      const beaten = rivals.some((c) => Date.parse(c.createdAt) < Date.parse(mineNow?.createdAt) || (c.createdAt === mineNow?.createdAt && c.docId < id));
      if (!beaten) return { district, lot };
      await state.vh.remove(lotsColl(district), id).catch(() => {});
    }
  }
  throw new Error("Couldn't find a free lot in the village — try again.");
}

/**
 * Move out: my farm, link and plot go, and my lot claim is released LAST,
 * so the lot is only free once nothing of mine still points at it. My
 * player doc (candy, steals) stays, should I move back in.
 */
async function moveOut() {
  const me = state.meId;
  const farm = farmOf(me);
  if (!farm) return;
  await state.vh.remove("farms", me);
  const gone = (p) => p.catch((e) => (e && e.status === 404 ? null : Promise.reject(e)));
  if (farm.district) await gone(state.vh.remove(plotsColl(farm.district), me));
  await gone(state.vh.remove("slugs", farm.slug));
  // My claim on the lot: "<lot>", or "<lot>~<me>" when I took over an orphan.
  if (farm.district)
    for (const c of await listAll(lotsColl(farm.district)))
      if (c.ownerUserId === me && claimLotOf(c.docId) === farm.lot) await gone(state.vh.remove(lotsColl(farm.district), c.docId));
  if (farm.artVersion) await gone(state.vh.remove("art", me));
}

/** My plot lives in my district's collection; make it once. */
async function ensurePlot(district) {
  const me = state.meId;
  if (await state.vh.get(plotsColl(district), me)) return;
  try {
    await state.vh.put(plotsColl(district), me, plotOut(E.newPlot(), now()), { expectedVersion: 0 });
  } catch (e) {
    if (e.code !== "APP_DATA_VERSION_CONFLICT") throw e;
  }
}

function decodeSetup(hash) {
  const b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

/** Whose farm this page shows: the slug's owner on /farm/<slug>; none on the map. */
function viewedFarmId() {
  if (state.route.view === "farm") return farmBySlug(state.route.slug);
  return null;
}

/** /setup#<base64url JSON>: write farms/<you>, then go to your farm. */
/** "Replace X with Y?" — resolves true only on "Replace" (No has the focus; Esc = No). */
function confirmReplace(oldName, newName) {
  const dlg = $("#replace-dlg");
  $("#replace-old").textContent = oldName;
  $("#replace-new").textContent = newName;
  $("#replace-keep").textContent = `Keep ${oldName}`;
  return new Promise((done) => {
    const finish = (yes) => {
      dlg.removeEventListener("close", onClose);
      if (dlg.open) dlg.close();
      done(yes);
    };
    const onClose = () => finish(false);
    dlg.addEventListener("close", onClose);
    $("#replace-yes").onclick = () => finish(true);
    $("#replace-keep").onclick = () => finish(false);
    dlg.showModal();
    $("#replace-keep").focus();
  });
}

async function runSetupLink() {
  let raw = null;
  try {
    raw = decodeSetup(state.route.hash);
    const farm = cleanFarm(raw);
    // Opening a setup link when I already have a farm would overwrite it:
    // ask first, and keep it unless the farmer says otherwise.
    const mineNow = farmOf(state.meId);
    if (mineNow && !(await confirmReplace(mineNow.name, farm.name))) {
      location.replace(farmUrl(state.meId) || "/");
      return;
    }
    await saveFarm(farm);
    location.replace("/#new-house");
  } catch (e) {
    // Fall back to the form, filled with whatever the link carried —
    // custom art included (the form offers "Use my own face").
    state.route = { view: "home" };
    state.setupArt = raw && typeof raw === "object" ? { avatarPng: raw.avatarPng, skins: raw.skins } : null;
    const prefill = raw && typeof raw === "object" && raw.name ? { ...raw, avatar: Number(raw.avatar) || 1 } : null;
    $("#farms").innerHTML = setupHtml(prefill);
    $("#setup-err").textContent = `That setup link didn't work: ${e.message || e}`;
  }
}

export { avatarFor, cleanFarm, farmBySlug, farmName, farmOf, farmUrl, migrateMyArt, moveOut, nameOf, runSetupLink, saveFarm, viewedFarmId };
