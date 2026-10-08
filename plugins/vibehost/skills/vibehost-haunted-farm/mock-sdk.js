// Haunted Farm — the App Data SDK, faked in the browser. ONE fake, two users:
//
//   check.mjs  sets window.__HF_SCENARIO before the page loads (a fixed time,
//              fixed docs, in memory) and serves this file in place of
//              /__vh/data/sdk.js.
//   build.mjs --mock  ships this file in the try-out site instead of the
//              real SDK. With no scenario it runs "try-out mode": the store
//              lives in localStorage, the clock runs ?speed= times faster
//              (default from the build, 1: real time — a Common ripens in a minute), and
//              four pretend neighbours — Bob, Cleo, Dan and Eve — each on
//              their own link with a house on the village map, tend their
//              farms, post guard ghosts, clear rot and sometimes steal from
//              or help you. ?farmers=20 seeds that many farmers in all
//              (you and the four plus pretend extras) so districts 1–3 of
//              the map can be tried.
//
// THE CONTRACT — the real SDK's shapes (VibeHost's app-data-sdk.ts, which
// unwraps each answer's `data`). This fake must return exactly these; the
// game reads them as written here, and dev/mock-sdk.test.mjs holds the fake
// to them:
//   connect()              → vh: { player, reason?, user?, serverTime, now(),
//                             list, get, put, patch, remove, log, poll }
//                             (from GET me → { player, reason?, user?, serverTime })
//   vh.list(c, {cursor})   → { docs: Doc[], nextCursor }
//   vh.get(c, id)          → { doc: Doc }, or null when there is none (404)
//   vh.put / vh.patch      → { doc: Doc }   (expectedVersion: 0 = create)
//   vh.remove(c, id)       → null           (204 No Content)
//   vh.log({since})        → { entries }
//   Doc = { collection, docId, ownerUserId, data, version, createdAt, updatedAt }
//   errors: an Error with .status, .code (e.g. APP_DATA_VERSION_CONFLICT on 409,
//   APP_DATA_RATE_LIMITED on 429), .details; on a 409 .current — the winning
//   Doc itself, not wrapped; on a 429 .retryAfter — seconds to wait before the
//   next request (the Retry-After header, else details.retryAfterSeconds).
//   Reads are limited per app and per visitor IP, so a page must honour it.
//   check.mjs can make this fake answer 429: scenario.rateLimit =
//   { ops: ["list", …], times, retryAfter }.
// Also as the real one: "$serverTime" substitution and owner-only PUT/DELETE.
// A normal build never contains this file (check.mjs asserts it).
(function (g) {
  "use strict";
  var MIN = 60 * 1000;
  // Try-out custom art: 24×24 face, 32×32 crop-skin stages — palette-only PNGs.
  var MY_FACE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAHlBMVEUAAACmxktbijoNCxTocxz1piPy6th/49SjJDtrPXpk1OV/AAAACnRSTlMA////////////fokUVgAAAGtJREFUeNqNkEEOwCAIBMGtlf7/w41RERSb7sVkJghZohFmCsMphQZIDAT4alncwLkqz/NU2AeagVmwRs3tYkY+BLqsrxeli/LzK5FBRbaJemd8lR5A8RL4dhVjK963ofzpwYEvxnBvjiLKCx7CBgpjdPW3AAAAAElFTkSuQmCC";
  var BOB_SKIN = {"sprout": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAIVBMVEUAAAANCxRbijovSixKLyJ6Sy6mxkuak6YdFzA6KlJrPXpseyDaAAAAC3RSTlMA/////////////312fdUAAADbSURBVHja7VLBroMwDMOJs6X7/w+e4pQONnZ40jvOEhRqxzGk2/bD/wPAYbngzcy3zc3sUgEWRZaMHyYAGKXwuhh8k4CM0K479MIgTnTtFdyhNVQwBV1daAewPYK7gXh1gG7TxGYX2bUHsNMRt9qZBq5QR0RYV7RghVo8LZRMAq/He/Gx0ztSAoWUQqKonymT1UI1cZ/Np0WYEf0ZpJ/cp417d5CFux9zVjrQ19zReV5/2Jkjj/PKBHPUlEvoZoFMJE7Txqjmj8fIkB8ujgQzx2AS+eXQYeEvJ/kJf5kG94wW1eEAAAAASUVORK5CYII=", "growing": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAG1BMVEUAAAAvSixbijp6Sy5KLyIdFzCmxks6KlINCxTW/iPOAAAACXRSTlMA//////////83ApvUAAAAuElEQVR42u2SwQ7DMAhDeQ4k+/8vniBtla5Su+MOo5cEjG1Izf7xs4F4qEtP9TsKCqD7/mKAS2emNoAw0U4Ar3zkCHlwM/+g2L05kPWSWDCBBCQ1U9LMelv7PZIeEQ0YVHI1TxmVe0LzaI4v+ikQoawkoBJj+DJBWSgnIubViGWC/Aa99xx3gvf6sR1wFSJiZ2s63kciCNQPsWm8ZvbaTNBwF/HSHnHa5RxuE0XXd2d9O0sZ/+oXfAPntwKsxElJHAAAAABJRU5ErkJggg==", "ripe": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAHlBMVEUAAAAvSixKLyJbijp6Sy6jJDujJDsdFzDocxwNCxTwgtnhAAAACnRSTlMA////////////fokUVgAAAPZJREFUeNrlU1mugzAMzIwX8P0v/DR2SlGRqv4/C4mQWbwkrPVfA/iOEwvfUADkY9+MMiZpIJ8GtBZ6RMKY7rK40waPiJRDRgQX7rXCBo/gtTjuFiotIk4h3nh44V0LF2t0Z+zI7H4uPcf4/CAcm0BiO7wjWddAGu/aL7QdyCFQ9TwJ8vTLgayMvBNY3uMYQqfLzAEjM5NkuE8OmJU6uRNKoy2+CABeJlvdnSv3GOipUShKawCGmjmZmWkTqKpRlg7YwE1Qita0ax+tVHtS21dfZXr3WLQw1m7T6a1tluDZ2Pg2abi6GQ78cTUJHAdFXmsVf/9L/gDyGQc54lGfVgAAAABJRU5ErkJggg=="};
  var H = 60 * MIN;
  var cfgEl = g.document && g.document.getElementById("village");
  var CFG = cfgEl ? JSON.parse(cfgEl.textContent) : {};
  var MOCK = CFG.mock || {};
  var S = g.__HF_SCENARIO;
  var tryout = !S;
  var KEY = "haunted-farm-tryout:" + (CFG.seed || "village");
  var CHECK_KEY = "haunted-farm-check-store";
  var ME = "u_you";
  // Who lives next door in the try-out, and how each one behaves:
  // `keen` = chance per tick of tending their own farm (harvest, clear rot),
  // `steal` / `help` = chance per tick of doing it to you, `guard` = of
  // posting a guard ghost. Eve is lazy, so her crops go off and rot.
  var NEIGHBOURS = [
    { id: "u_bob", name: "Bob", farm: "Bob's Spooky Acre", slug: "bob", avatar: 4, scarecrow: "plum", candy: 6, keen: 0.6, steal: 0.06, help: 0.03, guard: 0.08 },
    { id: "u_cleo", name: "Cleo", farm: "Cleo's Lantern Patch", slug: "cleo", avatar: 2, scarecrow: "spirit", candy: 12, keen: 0.5, steal: 0.04, help: 0.04, guard: 0.25 },
    { id: "u_dan", name: "Dan", farm: "Dan's Sprout Yard", slug: "dan", avatar: 5, scarecrow: "moss", candy: 3, keen: 0.5, steal: 0.03, help: 0.06, guard: 0.05 },
    { id: "u_eve", name: "Eve", farm: "Eve's Forgotten Field", slug: "eve", avatar: 3, scarecrow: "blood", candy: 9, keen: 0.03, steal: 0.05, help: 0.01, guard: 0.02 },
  ];
  // ?farmers=N extras (after you + the four): quieter, mostly growing.
  var EXTRA_NAMES = ["Finn", "Gus", "Hana", "Ivy", "Jun", "Kai", "Lena", "Milo", "Nia", "Otto", "Pia", "Quinn", "Rae", "Sol", "Tess", "Uma", "Vic", "Wren", "Xia", "Yuki", "Zed"];
  // Scarecrows, preset avatars, grow times and lots per district come from
  // template/shared.js: whoever serves this file (build.mjs, check.mjs) fills
  // the slot below, so no number here can drift from the game's.
  var SHARED = /*@shared*/null;
  var SCARECROWS = SHARED.scarecrows;
  var G = SHARED.growMs;
  var SEC = 1000;
  // Ages (how long ago a crop was planted) for each state, from the rules.
  var AGE = {
    ripeOpen: function (k) { return G[k] + SHARED.stealOpensMs + 10 * SEC; }, // ripe, stealable, fresh
    growing: function (k, f) { return G[k] * f; }, // f of the way to ripe
    off: function (k) { return G[k] + 1.2 * SHARED.goingOffFactor * G[k]; }, // going off (half value)
    rotten: function (k) { return G[k] + 2 * SHARED.goingOffFactor * G[k] + 30 * SEC; },
  };
  var STORE_VERSION = 5; // 2 = plots per district; 3 = seeded feed events; 4 = a fresh farmer in the tutorial; 5 = fast mode (1-minute Commons)
  var LOTS = SHARED.lots;
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var state;
  if (tryout) {
    var q = new URLSearchParams(g.location.search);
    var asked = Number(q.get("speed"));
    var speed = asked > 0 && asked <= 3600 ? asked : MOCK.speed || 1;
    try { state = JSON.parse(g.localStorage.getItem(KEY)); } catch (e) { state = null; }
    var real = Date.now();
    // ?farmers= picks the village size and sticks until asked again; a store
    // from before districts (v1) starts over.
    var wantFarmers = q.has("farmers") ? Math.max(5, Math.min(60, Math.floor(Number(q.get("farmers")) || 5))) : state && state.farmers || 5;
    if (!state || !state.docs || !state.clock || state.v !== STORE_VERSION || state.farmers !== wantFarmers) state = seed(real, speed, wantFarmers);
    // Rebase the virtual clock on every load, so changing ?speed= never
    // makes time jump — it only changes how fast it runs from here.
    var virtual = state.clock.virtual + (real - state.clock.real) * state.clock.speed;
    state.clock = { real: real, virtual: virtual, speed: speed };
    save();
  } else {
    // check.mjs: the scenario is the starting point; what the page writes
    // survives navigations within the tab (sessionStorage), the way the
    // real server keeps it — a steal on /farm/bob is still there on /.
    var kept = null;
    try { kept = JSON.parse(g.sessionStorage.getItem(CHECK_KEY)); } catch (e) { kept = null; }
    state = kept && kept.docs ? kept : { me: S.me, docs: clone(S.docs || {}), log: [], clock: { real: Date.now(), virtual: S.now, speed: 1 } };
  }
  if (tryout) {
    // A kept ?farmers= village: its extras tick too.
    Object.keys(state.docs.farms).forEach(function (id) {
      if (id === ME || NEIGHBOURS.some(function (n) { return n.id === id; })) return;
      NEIGHBOURS.push({ id: id, keen: 0.3, steal: 0.01, help: 0.01, guard: 0.03 });
    });
  }
  g.__HF_STORE = state.docs;
  g.__HF_LOG = state.log;
  // Every list/get the page makes, so check.mjs can see what a page loads.
  g.__HF_CALLS = [];

  function save() {
    try {
      if (tryout) g.localStorage.setItem(KEY, JSON.stringify(state));
      else g.sessionStorage.setItem(CHECK_KEY, JSON.stringify(state));
    } catch (e) { /* private mode: lives for this page only */ }
  }
  function now() { return state.clock.virtual + (Date.now() - state.clock.real) * state.clock.speed; }
  function iso(t) { return new Date(t === undefined ? now() : t).toISOString(); }

  // ── the try-out village: your farm and Bob's, each on its own link ──
  function seed(real, speed, farmers) {
    var t = real;
    var at = function (ago) { return iso(t - ago); };
    var tile = function (kind, ago, extra) {
      var o = { kind: kind, secret: false, plantedAt: at(ago), growMs: G[kind], boostMs: 0, ghostSince: null, ghostMs: 0, stolen: 0, stolenBy: [], helpedBy: [] };
      for (var k in extra || {}) o[k] = extra[k];
      return o;
    };
    // The try-out starts on the village map with your house and four
    // neighbours', each in a different state so the map has something to say.
    var DAY = 24 * H;
    var doc = function (owner, data, joinedDaysAgo) { return { owner: owner, version: 1, data: data, createdAt: at((joinedDaysAgo || 0) * DAY) }; };
    // Ages by intent (ripe and open, growing, going off, rotten), from
    // engine.js's RULES, so the seed village follows whatever pace it sets.
    var PLOTS = {
      // 🎃 ripe & stealable right now (and still fresh)
      u_bob: [tile("common", AGE.ripeOpen("common")), tile("rare", AGE.ripeOpen("rare") + 20 * SEC), tile("common", AGE.growing("common", 0.4)), null, tile("legendary", AGE.growing("legendary", 0.4)), null, tile("common", AGE.growing("common", 0.7)), null, null],
      // 👻 a guard ghost on her ripest (and one unguarded ripe common)
      u_cleo: [tile("legendary", AGE.ripeOpen("legendary"), { guardSince: at(SHARED.guardLastsMs / 2) }), tile("common", AGE.ripeOpen("common")), tile("rare", AGE.growing("rare", 0.5)), tile("rare", AGE.growing("rare", 0.15)), null, tile("common", AGE.growing("common", 0.3)), null, tile("legendary", AGE.growing("legendary", 0.3)), null],
      // nothing ripe yet: a field of sprouts
      u_dan: [tile("common", AGE.growing("common", 0.2)), tile("common", AGE.growing("common", 0.1)), tile("rare", AGE.growing("rare", 0.15)), tile("common", AGE.growing("common", 0.3)), tile("legendary", AGE.growing("legendary", 0.07)), tile("common", AGE.growing("common", 0.05)), tile("rare", AGE.growing("rare", 0.1)), tile("common", AGE.growing("common", 0.4)), null],
      // a rotten pumpkin and one going off (a Rare)
      u_eve: [tile("common", AGE.rotten("common")), tile("rare", AGE.off("rare")), null, tile("common", AGE.growing("common", 0.25)), null, null, tile("rare", AGE.growing("rare", 0.2)), null, null],
    };
    // "Lately in the village" has something to say from the start: what the
    // neighbours got up to in the last hour (on their player docs, like the
    // engine records it).
    var FEED = {
      u_bob: [{ t: "steal", victim: "u_cleo", kind: "common", ago: 9 }, { t: "steal", victim: "u_cleo", kind: "legendary", ago: 6 }, { t: "steal", victim: "u_cleo", kind: "common", ago: 2 }],
      u_dan: [{ t: "help", victim: ME, kind: "common", ago: 20 }, { t: "harvest", kind: "legendary", ago: 45 }],
      u_eve: [{ t: "caught", victim: "u_cleo", kind: "legendary", ago: 12, guarded: true }, { t: "steal", victim: "u_dan", kind: "rare", ago: 30 }],
    };
    // Farm N sits in district ceil(N/8), lot (N-1) % 8, claimed by a
    // lots-d<district>/<lot> doc — the same docs the real page writes.
    var docs = { farms: {}, slugs: {}, players: {} };
    var settle = function (id, n, farm, joined, tiles) {
      var district = Math.floor(n / LOTS) + 1, lot = n % LOTS;
      farm.district = district; farm.lot = lot;
      docs.farms[id] = doc(id, farm, joined);
      docs.slugs[farm.slug] = doc(id, { userId: id }, joined);
      (docs["lots-d" + district] = docs["lots-d" + district] || {})[String(lot)] = doc(id, { userId: id }, joined);
      (docs["plots-d" + district] = docs["plots-d" + district] || {})[id] = doc(id, { tiles: tiles }, joined);
    };
    // You start as a fresh farmer: the tutorial on step 1, beginner's luck unused.
    // Bob has a ripe pumpkin, so the steal step is reachable at once.
    // The village rules in the try-out: I have a custom face (made with make-your-own/pixel-grid.mjs).
    settle(ME, 0, { name: "My Pumpkin Patch", slug: "you", avatar: 1, scarecrow: "classic", avatarPng: MY_FACE, firstCropBoost: false, tutorial: { round: 0, cleared: [], done: false, skipped: false } }, 5, Array(9).fill(null));
    NEIGHBOURS.forEach(function (n, k) {
      var joined = 4 - k; // Bob moved in first after you, Eve last
      // …and Bob grows "blood pumpkins": his Common has a crop skin (pixelate.mjs, recoloured).
      settle(n.id, k + 1, { name: n.farm, slug: n.slug, avatar: n.avatar, scarecrow: n.scarecrow, ...(n.id === "u_bob" ? { skins: { common: BOB_SKIN } } : {}) }, joined, PLOTS[n.id]);
      docs.players[n.id] = doc(n.id, { name: n.name, avatar: n.avatar - 1, candy: n.candy, steals: 0, helps: 0, day: "", stealsToday: 0, helpsToday: 0, events: (FEED[n.id] || []).map(function (e) { return { t: e.t, victim: e.victim, kind: e.kind, at: at(e.ago * MIN), guarded: e.guarded }; }) }, joined);
    });
    for (var k = 5; k < farmers; k++) {
      var nm = EXTRA_NAMES[(k - 5) % EXTRA_NAMES.length] + (k - 5 >= EXTRA_NAMES.length ? " " + (k + 1) : "");
      var id = "u_x" + (k + 1);
      var x = { id: id, name: nm, farm: nm + "'s Patch", slug: nm.toLowerCase().replace(/[^a-z0-9]+/g, "-"), avatar: SHARED.avatars[k % SHARED.avatars.length], scarecrow: SCARECROWS[k % SCARECROWS.length], candy: 4 + (k % 7), keen: 0.3, steal: 0.01, help: 0.01, guard: 0.03 };
      NEIGHBOURS.push(x);
      var joinedX = 1 - (k - 4) / (farmers + 1); // after Eve, in order
      // Every third one has a ripe pumpkin to steal; the rest are growing.
      var tilesX = [tile("common", k % 3 === 0 ? AGE.ripeOpen("common") : AGE.growing("common", 0.2)), null, tile("rare", AGE.growing("rare", 0.1 + 0.2 * (k % 4))), null, null, null, null, null, null];
      settle(id, k, { name: x.farm, slug: x.slug, avatar: x.avatar, scarecrow: x.scarecrow }, joinedX, tilesX);
      docs.players[id] = doc(id, { name: nm, avatar: x.avatar - 1, candy: x.candy, steals: 0, helps: 0, day: "", stealsToday: 0, helpsToday: 0, events: [] }, joinedX);
    }
    return {
      v: STORE_VERSION,
      farmers: farmers,
      me: { player: true, user: { id: ME, name: "You", avatarUrl: null } },
      clock: { real: real, virtual: t, speed: speed },
      log: [],
      docs: docs,
    };
  }

  // ── the store ──────────────────────────────────────────────────────────
  function sub(v) {
    if (v === "$serverTime") return iso();
    if (Array.isArray(v)) return v.map(sub);
    if (v && typeof v === "object") { var o = {}; for (var k in v) o[k] = sub(v[k]); return o; }
    return v;
  }
  function err(status, code, current) {
    var e = new Error(code); e.status = status; e.code = code;
    e.details = current !== undefined ? { current: current } : undefined;
    if (current !== undefined) e.current = current;
    return e;
  }
  function coll(c) { return (state.docs[c] = state.docs[c] || {}); }
  function dto(c, id) {
    var d = coll(c)[id];
    return { collection: c, docId: id, ownerUserId: d.owner, data: clone(d.data), version: d.version, createdAt: d.createdAt || iso(), updatedAt: d.updatedAt || iso() };
  }
  function record(user, c, id, op) {
    state.log.push({ id: String(state.log.length + 1), userId: user, collection: c, docId: id, op: op, at: iso() });
    if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
  }
  function write(user, c, id, data, op, owner) {
    var cur = coll(c)[id];
    coll(c)[id] = { owner: cur ? cur.owner : owner, data: data, version: cur ? cur.version + 1 : 1, createdAt: cur ? cur.createdAt : iso(), updatedAt: iso() };
    record(user, c, id, op);
    save();
    return { doc: dto(c, id) };
  }
  function me() { return state.me.user && state.me.user.id; }
  function guard() { if (!state.me.player) throw err(403, "APP_DATA_NOT_PLAYER"); }
  // A scenario's rate limit: the next `times` calls of `ops` answer 429.
  var limit = S && S.rateLimit ? { ops: S.rateLimit.ops || [], times: S.rateLimit.times || 1, retryAfter: S.rateLimit.retryAfter || 1 } : null;
  // check.mjs, after the page is up: the next `times` calls of `ops` answer 429.
  if (S) g.__HF_THROTTLE = function (ops, times, retryAfter) { limit = { ops: ops, times: times, retryAfter: retryAfter }; };
  function throttle(op) {
    if (!limit || limit.times <= 0 || limit.ops.indexOf(op) < 0) return;
    limit.times--;
    var e = err(429, "APP_DATA_RATE_LIMITED");
    e.details = { retryAfterSeconds: limit.retryAfter };
    e.retryAfter = limit.retryAfter;
    throw e;
  }
  var later = function (fn) { return Promise.resolve().then(fn); };

  var api = {
    list: function (c) {
      g.__HF_CALLS.push("list " + c);
      return later(function () {
        throttle("list");
        var ids = Object.keys(coll(c)).sort();
        return { docs: ids.map(function (id) { return dto(c, id); }), nextCursor: null };
      });
    },
    get: function (c, id) { g.__HF_CALLS.push("get " + c + "/" + id); return later(function () { throttle("get"); return coll(c)[id] ? { doc: dto(c, id) } : null; }); },
    put: function (c, id, data, o) {
      return later(function () {
        throttle("put"); guard(); o = o || {};
        var cur = coll(c)[id];
        if (cur && cur.owner !== me()) throw err(403, "APP_DATA_NOT_PLAYER");
        if (o.expectedVersion !== undefined && (cur ? cur.version : 0) !== o.expectedVersion) throw err(409, "APP_DATA_VERSION_CONFLICT", cur ? dto(c, id) : null);
        return write(me(), c, id, sub(data), "put", me());
      });
    },
    patch: function (c, id, data, o) {
      return later(function () {
        throttle("patch"); guard(); o = o || {};
        var cur = coll(c)[id];
        if (!cur) throw err(404, "NOT_FOUND");
        if (cur.version !== o.expectedVersion) throw err(409, "APP_DATA_VERSION_CONFLICT", dto(c, id));
        var merged = clone(cur.data); var patch = sub(data);
        for (var k in patch) merged[k] = patch[k];
        return write(me(), c, id, merged, "patch");
      });
    },
    remove: function (c, id) {
      return later(function () {
        guard();
        var cur = coll(c)[id];
        if (!cur) throw err(404, "NOT_FOUND");
        if (cur.owner !== me()) throw err(403, "APP_DATA_NOT_PLAYER");
        delete coll(c)[id]; record(me(), c, id, "delete"); save();
        return null;
      });
    },
    log: function (o) {
      return later(function () {
        var since = o && o.since ? Date.parse(o.since) : -Infinity;
        return { entries: state.log.filter(function (e) { return Date.parse(e.at) > since; }) };
      });
    },
    poll: function (c, ms, onChange) {
      var last = null, stopped = false;
      var tick = function () {
        if (stopped) return;
        api.list(c).then(function (r) {
          var s = r.docs.map(function (d) { return d.docId + ":" + d.version; }).join(",");
          if (s !== last) { last = s; onChange(r.docs); }
          if (!stopped) g.setTimeout(tick, ms);
        }, function (e) {
          // As the real one: a 429 waits at least retryAfter (plus 0–1 s jitter).
          var wait = e && e.retryAfter ? Math.max(ms, e.retryAfter * 1000 + Math.random() * 1000) : ms;
          if (!stopped) g.setTimeout(tick, wait);
        });
      };
      tick();
      return function () { stopped = true; };
    },
  };

  // ── the pretend neighbours (try-out mode only) ─────────────────────────
  var TIME_FIELDS = ["plantedAt", "ghostSince", "guardSince"];
  var toMs = function (v) { return v == null ? null : typeof v === "number" ? v : Date.parse(v); };
  function tileIn(t) { if (!t) return null; var o = clone(t); TIME_FIELDS.forEach(function (f) { if (f in o) o[f] = toMs(o[f]); }); if (o.marks) o.marks.forEach(function (m) { m.at = toMs(m.at); }); return o; }
  function tileOut(t) { if (!t) return null; var o = clone(t); TIME_FIELDS.forEach(function (f) { if (o[f] != null) o[f] = iso(o[f]); }); if (o.marks) o.marks.forEach(function (m) { m.at = iso(m.at); }); return o; }
  function plotIn(d) {
    var n = (d.cols || 3) * (d.rows || 3);
    var p = { tiles: Array.from({ length: n }, function (_, i) { return tileIn((d.tiles || [])[i] || null); }) };
    if (d.cols) { p.cols = d.cols; p.rows = d.rows; }
    return p;
  }
  function plotOut(p) { var o = { tiles: p.tiles.map(tileOut) }; if (p.cols) { o.cols = p.cols; o.rows = p.rows; } return o; }
  // The engine records Bob's steals/helps in his events (ms); stored as ISO.
  function playerIn(d) { var p = clone(d); p.events = (p.events || []).map(function (ev) { ev.at = toMs(ev.at); return ev; }); return p; }
  function playerOut(p) { var o = clone(p); o.events = (o.events || []).map(function (ev) { ev.at = iso(ev.at); return ev; }); return o; }
  var attempt = function (fn) { try { return fn(); } catch (e) { if (e && e.name === "EngineError") return null; throw e; } };

  // Plots live per district: plots-d<district>/<userId>.
  function plotsOf(id) { var f = coll("farms")[id]; return f && f.data.district ? "plots-d" + f.data.district : null; }

  function neighbourTick(E, n) {
    var ID = n.id;
    var PC = plotsOf(ID), MC = plotsOf(ME);
    if (!PC) return;
    var bp = coll(PC)[ID], bpl = coll("players")[ID];
    if (!bp || !bpl) return;
    var t = now();
    var plot = plotIn(bp.data), them = playerIn(bpl.data), mine = false, r;
    var keen = Math.random() < n.keen;
    for (var i = 0; i < plot.tiles.length; i++) {
      var tile = plot.tiles[i];
      if (!tile) continue;
      var st = E.tileState(tile, t);
      // They're slow: ripe crops sit for three times the steal window
      // (90 s at today's pace) — a minute past it opening. Steal them!
      if (keen && st.stage === "rotten" && (r = attempt(function () { return E.clearRotten({ plot: plot, i: i, now: t }); }))) { plot = r.plot; mine = true; }
      else if (keen && st.stage === "ripe" && t - st.ripeAt > 3 * E.RULES.stealOpensAfterMs && (r = attempt(function () { return E.harvest({ player: them, plot: plot, i: i, now: t }); }))) { plot = r.plot; them = r.player; mine = true; }
      else if (st.haunted && them.candy >= 2 && Math.random() < 0.3 && (r = attempt(function () { return E.chaseOwnGhost({ player: them, plot: plot, i: i, now: t }); }))) { plot = r.plot; them = r.player; mine = true; }
    }
    for (var j = 0; j < plot.tiles.length; j++) {
      if (plot.tiles[j] || Math.random() > n.keen) continue;
      var kind = them.candy >= 15 && Math.random() < 0.2 ? "legendary" : them.candy >= 5 && Math.random() < 0.4 ? "rare" : "common";
      if ((r = attempt(function () { return E.plant({ player: them, plot: plot, i: j, kind: kind, now: t, rand: Math.random }); }))) { plot = r.plot; them = r.player; mine = true; }
    }
    // Now and then a guard ghost on their ripest pumpkin.
    if (them.candy >= 5 && Math.random() < n.guard) {
      var ripest = -1, best = -Infinity;
      plot.tiles.forEach(function (tl, k) {
        var s2 = tl && E.tileState(tl, t);
        if (s2 && (s2.stage === "ripe" || s2.stage === "growing") && !s2.guarded && s2.progress - (s2.stage === "ripe" ? 0 : 1) > best) { best = s2.progress - (s2.stage === "ripe" ? 0 : 1); ripest = k; }
      });
      if (ripest >= 0 && (r = attempt(function () { return E.placeGuard({ player: them, plot: plot, i: ripest, now: t }); }))) { plot = r.plot; them = r.player; mine = true; }
    }
    if (mine) { write(ID, PC, ID, plotOut(plot), "patch"); write(ID, "players", ID, playerOut(them), "patch"); }

    var yours = MC && coll(MC)[ME];
    if (!yours) return;
    var victim = plotIn(yours.data);
    if (Math.random() < n.steal) {
      var open = victim.tiles.map(function (tl, k) { return tl && E.tileState(tl, t).stealable && (tl.stolenBy || []).indexOf(ID) === -1 ? k : -1; }).filter(function (k) { return k >= 0; });
      if (open.length && (r = attempt(function () { return E.steal({ thief: them, thiefId: ID, thiefPlot: plot, victimId: ME, victimPlot: victim, i: open[0], now: t, rand: Math.random }); }))) {
        // Either way your tile gets their mark (a caught attempt takes nothing).
        write(ID, MC, ME, plotOut(r.victimPlot), "patch");
        if (r.outcome !== "success") write(ID, PC, ID, plotOut(r.thiefPlot), "patch");
        write(ID, "players", ID, playerOut(r.thief), "patch");
        return;
      }
    }
    if (Math.random() < n.help) {
      var growing = victim.tiles.map(function (tl, k) { var s = tl && E.tileState(tl, t); return s && (s.stage === "sprout" || s.stage === "growing") && (tl.helpedBy || []).indexOf(ID) === -1 ? k : -1; }).filter(function (k) { return k >= 0; });
      if (growing.length && (r = attempt(function () { return E.help({ helper: them, helperId: ID, ownerId: ME, plot: victim, i: growing[0], action: "water", now: t }); }))) {
        write(ID, "players", ID, playerOut(r.helper), "patch");
        write(ID, MC, ME, plotOut(r.plot), "patch");
      }
    }
  }

  if (tryout && MOCK.engine) {
    import("/" + MOCK.engine).then(function (E) {
      var run = function () {
        NEIGHBOURS.forEach(function (n) {
          try { neighbourTick(E, n); } catch (e) { /* they trip over a pumpkin; try next tick */ }
        });
      };
      g.setInterval(run, 3000);
      g.setTimeout(run, 1500);
      // check.mjs: one keen tick of one neighbour, on demand.
      g.__HF_NEIGHBOUR_TICK = function (id) {
        NEIGHBOURS.filter(function (n) { return n.id === id; }).forEach(function (n) { neighbourTick(E, Object.assign({}, n, { keen: 1 })); });
      };
    });
  }

  g.VibeHostData = {
    connect: function () {
      return new Promise(function (ok) { g.setTimeout(ok, 30); }).then(function () {
        var vh = {
          player: !!state.me.player,
          reason: state.me.reason,
          user: state.me.user || null,
          serverTime: iso(),
          // How fast the try-out's clock runs (1 = real time; ?speed= changes it).
          speed: state.clock.speed,
          now: function () { return new Date(now()); },
        };
        for (var k in api) vh[k] = api[k];
        return vh;
      });
    },
    // Try-out banner's "Reset": forget this browser's farm and start over.
    resetTryout: function () {
      try {
        g.localStorage.removeItem(KEY);
        // The page's "last seen" marks are in the old (fast) clock's time.
        Object.keys(g.localStorage).filter(function (k) { return k.indexOf("haunted-farm:seen:") === 0; }).forEach(function (k) { g.localStorage.removeItem(k); });
      } catch (e) { /* nothing stored */ }
      g.location.reload();
    },
  };
})(window);
