// Haunted Farm — "Lately in the village".
// Only what happens BETWEEN people, plus a few notable moments — never
// someone tending their own farm. Built from the players' event lists and
// the farms' createdAt (moved in); it never says where a guard stands.

import * as E from "../engine.js";
import * as FX from "../fx.js";
import { avatarSrc, pngOk, skinsOf } from "../art-check.js";
import { inside, NEXT } from "../clicks.js";
import { $, CFG, esc, ico, now, state } from "../core.js";
import { farmOf, nameOf } from "../farms.js";
import { render } from "../render.js";
import { IMAGE_LIMITS } from "../shared.js";

const FEED_WINDOW = 24 * E.HOUR;
const FEED_KINDS = new Set(["steal", "caught", "help", "chase", "harvest"]);
const COLOUR = { common: "orange", rare: "ghost-white", legendary: "gold", secret: "secret" };

/** Feed entries, newest first, repeats (same who/what/whom) collapsed into one. */
function feedItems(t) {
  const raw = [];
  for (const [id, v] of state.players) {
    for (const ev of v.player.events || []) {
      if (!FEED_KINDS.has(ev.t) || !(ev.at <= t) || t - ev.at > FEED_WINDOW) continue;
      if (ev.t === "harvest" && ev.kind !== "legendary" && ev.kind !== "secret") continue;
      raw.push({ ...ev, actor: id });
    }
  }
  for (const [id, v] of state.farms) {
    const at = Date.parse(v.createdAt);
    if (at <= t && t - at <= FEED_WINDOW) raw.push({ t: "movedIn", actor: id, at });
  }
  raw.sort((a, b) => b.at - a.at);
  const groups = new Map();
  const items = [];
  for (const e of raw) {
    const key = [e.t, e.actor, e.victim || "", e.t === "harvest" ? e.kind : "", e.guarded ? "g" : ""].join("|");
    const g = groups.get(key);
    if (g) {
      g.n++;
      g.oldest = e.at;
    } else {
      const ng = { ...e, key, n: 1, newest: e.at, oldest: e.at };
      groups.set(key, ng);
      items.push(ng);
    }
  }
  return items;
}

const fmtAgo = (ms) => {
  const m = Math.max(0, Math.round(ms / E.MIN));
  return m < 60 ? [m, "m"] : m < 24 * 60 ? [Math.round(m / 60), "h"] : [Math.round(m / 1440), "d"];
};
function feedWhen(item, t) {
  const [a, ua] = fmtAgo(t - item.newest);
  if (item.n === 1) return `${a}${ua}`;
  const [b, ub] = fmtAgo(t - item.oldest);
  return ua === ub ? (a === b ? `${a}${ua}` : `${a}–${b}${ua}`) : `${a}${ua}–${b}${ub}`;
}
const aboutMe = (item) => item.actor === state.meId || item.victim === state.meId;

/** One line: bold names ("you" for me), verb, crop colour; ×n for repeats. */
function feedText(item) {
  // Someone with no player doc (never played, or a bad id) is "a neighbour".
  const named = (id) => (state.players.has(id) ? `<b>${esc(nameOf(id))}</b>` : "a neighbour");
  const who = (id) => (id === state.meId ? "<b>you</b>" : named(id));
  const whose = (id) => (id === state.meId ? "<b>your</b>" : `${named(id)}'s`);
  const many = item.n > 1 ? ` ×${item.n}` : "";
  const colour = COLOUR[item.kind] || "";
  // Their own look for that variety (crop skin), small, after the words.
  const skinUrl = skinsOf(item.victim)?.[item.kind]?.ripe;
  const skin = skinUrl && pngOk(skinUrl, IMAGE_LIMITS.skin) ? ` <img class="skin-thumb" alt="" src="${skinUrl}">` : "";
  let line;
  switch (item.t) {
    case "steal":
      line = many ? `${who(item.actor)} pinched from ${who(item.victim)}${many}` : `${who(item.actor)} pinched 1 ${ico("candy")} from ${whose(item.victim)} ${colour} pumpkin${skin}`;
      break;
    case "caught":
      line = item.guarded
        ? `${who(item.actor)} walked into ${whose(item.victim)} guard ghost trap ${ico("ghost")}${many}`
        : `${whose(item.victim)} ghost caught ${who(item.actor)} red-handed${many}`;
      break;
    case "help":
      line = many ? `${who(item.actor)} watered ${whose(item.victim)} pumpkins${many}` : `${who(item.actor)} watered ${whose(item.victim)} ${colour} pumpkin${skin} ${ico("water")}`;
      break;
    case "chase":
      line = `${who(item.actor)} chased a ghost off ${whose(item.victim)} farm${many}`;
      break;
    case "harvest":
      line = item.kind === "secret" ? `${who(item.actor)} found the secret pumpkin! ${ico("pumpkin")}${many}` : `${who(item.actor)} harvested a gold pumpkin ${ico("pumpkin")}${many}`;
      break;
    case "movedIn":
      line = `${who(item.actor)} moved into the village`;
      break;
    default:
      line = "";
  }
  // A line that starts with me reads "You …".
  return line.replace(/^<b>you<\/b>/, "<b>You</b>").replace(/^<b>your<\/b>/, "<b>Your</b>");
}

function feedLi(item, t, fresh) {
  return `<li class="ev${aboutMe(item) ? " me" : ""}${fresh ? " slide" : ""}" data-key="${esc(item.key)}" data-t="${item.t}"><img class="face" alt="" src="${avatarSrc(item.actor)}"><span class="txt">${feedText(item)}<span class="when"> · ${feedWhen(item, t)}</span></span></li>`;
}

const FEED_EMPTY = '<li class="ev empty">Quiet night… go pinch something.</li>';
const feedSeenKey = () => `haunted-farm:feed-seen:${CFG.seed}:${state.meId}`;
function feedSeen() {
  try {
    return Number(localStorage.getItem(feedSeenKey())) || 0;
  } catch {
    return 0;
  }
}
/** Unread = events about me, by someone else, newer than my last look at the list. */
const unread = (items) => items.filter((x) => x.victim === state.meId && x.actor !== state.meId && x.newest > state.feedSeenAt).length;

/**
 * The feed is ONE bar above the map (above the 3×3 on a farm page), never
 * over it: newest line + "▾ All activity (N unread about me)".
 * The whole bar is a button. Desktop: a dropdown under it (over the top of
 * the map); phone: the bottom sheet.
 */
function feedBarHtml(t) {
  const items = feedItems(t);
  const top = items[0];
  const fresh = !!top && state.feedTop !== undefined && state.feedTop !== `${top.key}:${top.n}`;
  const badge = unread(items);
  const line = top
    ? `<img class="face" alt="" src="${avatarSrc(top.actor)}"><span class="txt${fresh ? " slide" : ""}">${feedText(top)}<span class="when"> · ${feedWhen(top, t)}</span></span>`
    : '<span class="txt">Quiet night… go pinch something.</span>';
  const drop = state.feedOpen
    ? `<div class="feed-drop" id="feed-drop" role="region" aria-label="All activity"><ul>${items.length ? items.map((x, k) => feedLi(x, t, fresh && k === 0)).join("") : FEED_EMPTY}</ul></div>`
    : "";
  return `<div class="feed-bar-wrap${state.feedOpen ? " open" : ""}" id="feed">
    <button type="button" class="feed-bar" id="feed-bar" role="button" aria-expanded="${state.feedOpen}" aria-controls="feed-drop" aria-label="Lately in the village — all activity${badge ? `, ${badge} new about you` : ""}">${line}<span class="all">${state.feedOpen ? "▴" : "▾"} All activity${badge ? ` <span class="badge">${badge}</span>` : ""}</span></button>
    ${drop}
  </div>`;
}
const phoneSized = () => typeof matchMedia === "function" && matchMedia("(max-width: 899px)").matches;
function markFeedRead() {
  state.feedSeenAt = now();
  try {
    localStorage.setItem(feedSeenKey(), String(state.feedSeenAt));
  } catch {
    /* the badge comes back next visit */
  }
}

/** The feed shows to a farmer with a farm (it's about the people they play with). */
const feedOn = () => state.mode === "play" && !!farmOf(state.meId);

/** After a render: note the newest entry (a new one slides in, ticks once). */
function feedRendered(t) {
  const top = feedItems(t)[0];
  const key = top ? `${top.key}:${top.n}` : "";
  if (state.feedTop !== undefined && key && key !== state.feedTop) FX.sfx("tick");
  state.feedTop = key;
}

function openFeedSheet() {
  const t = now();
  const items = feedItems(t);
  $("#feed-sheet-list").innerHTML = items.length ? items.map((x) => feedLi(x, t, false)).join("") : FEED_EMPTY;
  markFeedRead();
  $("#feed-sheet").showModal();
  render();
}
// The bottom sheet also closes with a swipe down on it.
{
  const sheet = $("#feed-sheet");
  let y0 = null;
  sheet.addEventListener("pointerdown", (ev) => (y0 = ev.clientY));
  sheet.addEventListener("pointerup", (ev) => {
    if (y0 !== null && ev.clientY - y0 > 60) sheet.close();
    y0 = null;
  });
  sheet.addEventListener("pointercancel", () => (y0 = null));
}

// ── clicks ──
const feedClicks = [
  inside("#feed-bar", () => {
    // Phone: the bottom sheet. Desktop: the dropdown under the bar.
    if (phoneSized()) return openFeedSheet();
    state.feedOpen = !state.feedOpen;
    if (state.feedOpen) markFeedRead();
    render();
  }),
  {
    match: (ev) => state.feedOpen && !ev.target.closest("#feed"),
    run: () => {
      state.feedOpen = false; // a click anywhere else closes the dropdown…
      render(); // …and still does what it was for
      return NEXT;
    },
  },
  // ✕, or a tap outside the sheet (on its backdrop).
  { match: (ev) => ev.target.closest("#feed-sheet-close") || ev.target === $("#feed-sheet"), run: () => $("#feed-sheet").close() },
];

export { feedBarHtml, feedClicks, feedOn, feedRendered, feedSeen };
