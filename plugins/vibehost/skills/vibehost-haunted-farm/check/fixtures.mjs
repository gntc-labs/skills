// Haunted Farm checks — fixtures: a fixed clock, the docs of a small village,
// and the scenarios (who I am, what the store holds) each check opens with.
import { GROW_MS, SCARECROW_IDS } from "../template/shared.js";
import { deflateSync } from "node:zlib";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0); // 2026-10-24 20:00 Taipei
const H = 3600e3;
const at = (ms) => new Date(NOW - ms).toISOString();
// Grow times come from the engine (GROW_MS). Going off after
// max(grow, 2 h) ripe, rotten at twice that: Common/Rare 2 h / 4 h, Legendary 6 h / 12 h.
const tile = (kind, agoMs, over = {}) => ({
  kind,
  secret: false,
  plantedAt: at(agoMs),
  growMs: GROW_MS[kind],
  boostMs: 0,
  ghostSince: null,
  ghostMs: 0,
  stolen: 0,
  stolenBy: [],
  helpedBy: [],
  ...over,
});
const player = (name, candy, over = {}) => ({ name, avatar: 0, candy, steals: 0, helps: 0, day: "2026-10-24", stealsToday: 0, helpsToday: 0, events: [], ...over });
let joined = 0; // each doc made below "joined" a minute after the one before
const doc = (owner, data, version = 1) => ({ owner, version, data, createdAt: new Date(NOW - 30 * 24 * H + ++joined * 60e3).toISOString() });
const ALICE = { id: "u_alice", name: "Alice", avatarUrl: null };
const FARMS = {
  u_alice: doc("u_alice", { name: "Alice's Acre", slug: "alice", avatar: 1, scarecrow: "classic", district: 1, lot: 0 }),
  u_bob: doc("u_bob", { name: "Bob's Spooky Acre", slug: "bob", avatar: 4, scarecrow: "plum", district: 1, lot: 1 }),
};
const SLUGS = { alice: doc("u_alice", { userId: "u_alice" }), bob: doc("u_bob", { userId: "u_bob" }) };
// A farm's lot is claimed by lots-d<district>/<lot>; its plot
// lives in plots-d<district>/<userId>.
const VILLAGE_DOCS = {
  farms: FARMS,
  slugs: SLUGS,
  "lots-d1": { 0: doc("u_alice", { userId: "u_alice" }), 1: doc("u_bob", { userId: "u_bob" }) },
  players: {
    u_alice: doc("u_alice", player("Alice", 12, { avatar: 0, steals: 2, helps: 1, stealsToday: 2, helpsToday: 1 }), 3),
    u_bob: doc(
      "u_bob",
      player("Bob", 30, {
        avatar: 3,
        steals: 4,
        // What Bob did to Alice's farm while she was away (the away card).
        events: [
          { t: "steal", victim: "u_alice", kind: "rare", at: at(1 * H) },
          { t: "caught", victim: "u_alice", kind: "rare", at: at(0.5 * H) },
          { t: "steal", victim: "u_x", kind: "common", at: at(0.4 * H) },
        ],
      }),
      5,
    ),
  },
  "plots-d1": {
    u_alice: doc(
      "u_alice",
      {
        tiles: [
          tile("common", 1 * H), // ripe 30 min ago: harvest +4
          tile("rare", 1 * H), // 1 h to go
          tile("legendary", 1 * H, { ghostSince: at(0.5 * H) }), // haunted
          null,
          tile("legendary", 1 * H, { secret: true }), // 5 h to go
          tile("common", 0.5 * H + 2.5 * H), // ripe 2.5 h ago: went off 30 min ago
          tile("common", 0.5 * H + 5 * H), // rotten: clear it
          tile("common", 0.1 * H, { helpedBy: ["u_bob"] }),
          null,
        ],
      },
      4,
    ),
    u_bob: doc(
      "u_bob",
      {
        tiles: [
          tile("common", 1 * H), // ripe, stealable, worth 4
          tile("rare", 3 * H, { stolen: 1, stolenBy: ["u_x"], guardSince: at(1 * H) }), // guarded, worth 7
          null,
          tile("common", 0.2 * H), // growing
          tile("rare", 2.1 * H), // ripe, steal window not open yet
          { ghostOnly: true, ghostSince: at(0.2 * H) },
          tile("legendary", 3 * H),
          tile("rare", 2 * H + 3 * H), // going off: worth 4 (8 halved)
          tile("common", 0.5 * H + 6 * H), // rotten: not stealable
        ],
      },
      6,
    ),
  },
};
const drop = (docs, id) => {
  const f = docs.farms[id].data;
  delete docs.farms[id];
  delete docs.slugs[f.slug];
  delete docs[`lots-d${f.district}`][f.lot];
  delete docs[`plots-d${f.district}`][id];
  return docs;
};
const copy = () => JSON.parse(JSON.stringify(VILLAGE_DOCS));
const withoutFarm = (id) => drop(copy(), id);
const solo = () => drop(copy(), "u_bob");
// Settle farmer `u_f<k>` as farm number `n` (1-based) of the village.
const settle = (docs, k, n, over = {}) => {
  const id = `u_f${k}`;
  const district = Math.ceil(n / 8);
  const lot = (n - 1) % 8;
  docs.farms[id] = doc(id, { name: `Farm Number ${k}`, slug: `f${k}`, avatar: (k % 6) + 1, scarecrow: SCARECROW_IDS[k % SCARECROW_IDS.length], district, lot });
  docs.slugs[`f${k}`] = doc(id, { userId: id });
  (docs[`lots-d${district}`] ??= {})[lot] = doc(id, { userId: id });
  docs.players[id] = doc(id, player(`Farmer ${k}`, 1, over.player));
  (docs[`plots-d${district}`] ??= {})[id] = doc(id, { tiles: over.tiles ?? [tile("common", 0.2 * H), null, null, null, null, null, null, null, null] });
  return docs;
};
// Nine farmers: Alice, Bob and f1–f6 fill district 1; f7 is the 9th and
// opens district 2. f6 stole from Alice 3 minutes ago ([warning] pip on its house);
// f7 has a ripe pumpkin to steal across districts.
const crowd = () => {
  const docs = copy();
  for (let k = 1; k <= 7; k++)
    settle(docs, k, k + 2, {
      player: k === 6 ? { events: [{ t: "steal", victim: "u_alice", kind: "common", at: at(3 * 60e3) }] } : {},
      tiles: k === 7 ? [tile("common", 1 * H), null, null, null, null, null, null, null, null] : undefined,
    });
  return docs;
};
// Alice has no farm yet and `n` farmers already live in the village.
const placed = (n) => {
  const docs = drop(drop(copy(), "u_alice"), "u_bob");
  for (let k = 1; k <= n; k++) settle(docs, k, k);
  return docs;
};
// "Lately in the village": Bob pinched from Cleo three times (2, 6, 9 min
// ago), Dan pinched from Alice's gold pumpkin, Alice walked into Bob's
// guard trap, Eve harvested a Legendary and watered Bob, Nova just moved in —
// and plenty of noise that must NOT show: a Common harvest (tending one's own
// farm), an unknown event type, and an event from two days ago.
const feedDocs = () => {
  const docs = JSON.parse(JSON.stringify(VILLAGE_DOCS));
  const ago = (m) => at(m * 60e3);
  docs.players.u_bob.data.events = [
    ...docs.players.u_bob.data.events, // his steal (1 h) and catch (30 min) on Alice, a steal from u_x (24 min)
    { t: "steal", victim: "u_cleo", kind: "common", at: ago(9) },
    { t: "steal", victim: "u_cleo", kind: "legendary", at: ago(6) },
    { t: "steal", victim: "u_cleo", kind: "common", at: ago(2) },
    { t: "harvest", kind: "common", at: ago(3) },
  ];
  docs.players.u_alice.data.events = [{ t: "caught", victim: "u_bob", kind: "rare", at: ago(15), guarded: true }];
  const add = (id, name, lot, events, joinedAgoMin) => {
    docs.farms[id] = { ...doc(id, { name: `${name}'s Patch`, slug: name.toLowerCase(), avatar: (lot % 6) + 1, scarecrow: "moss", district: 1, lot }), ...(joinedAgoMin ? { createdAt: ago(joinedAgoMin) } : {}) };
    docs.slugs[name.toLowerCase()] = doc(id, { userId: id });
    docs["lots-d1"][lot] = doc(id, { userId: id });
    docs.players[id] = doc(id, player(name, 3, { events }));
    docs["plots-d1"][id] = doc(id, { tiles: Array(9).fill(null) });
  };
  add("u_cleo", "Cleo", 2, [{ t: "plant", kind: "rare", at: ago(4) }]);
  add("u_dan", "Dan", 3, [{ t: "steal", victim: "u_alice", kind: "legendary", at: ago(6) }, { t: "steal", victim: "u_eve", kind: "common", at: ago(48 * 60) }]);
  add("u_eve", "Eve", 4, [{ t: "harvest", kind: "legendary", at: ago(20) }, { t: "help", victim: "u_bob", kind: "rare", at: ago(25) }]);
  add("u_nova", "Nova", 5, [], 5);
  return docs;
};
// The same village with Alice's house on the bottom-left lot (6).
const feedBottomLeft = () => {
  const docs = feedDocs();
  docs.farms.u_alice.data.lot = 6;
  docs["lots-d1"][6] = docs["lots-d1"][0];
  delete docs["lots-d1"][0];
  return docs;
};
// A brand-new farmer: the tutorial on step 1, beginner's luck
// unused, an empty plot and 4 candy — one steal from Bob's ripe pumpkin
// makes the 5 a guard ghost costs.
const newbieDocs = (tut = { round: 0, cleared: [], done: false, skipped: false }, over = {}) => {
  const docs = JSON.parse(JSON.stringify(VILLAGE_DOCS));
  Object.assign(docs.farms.u_alice.data, { tutorial: tut, firstCropBoost: false, ...over });
  docs["plots-d1"].u_alice.data.tiles = Array(9).fill(null);
  docs.players.u_alice.data.candy = 4;
  return docs;
};
// Alice has used every steal and help today.
const spentDocs = () => {
  const docs = JSON.parse(JSON.stringify(VILLAGE_DOCS));
  Object.assign(docs.players.u_alice.data, { stealsToday: 20, helpsToday: 10 }); // today's caps
  return docs;
};
// No season. The same village, every stored time moved to a day
// well past what used to be the season's end (2026-11-01 23:59 Taipei).
const LATER = Date.UTC(2027, 2, 3, 4, 0, 0); // 2027-03-03 12:00 Taipei
const shiftTimes = (docs, ms) =>
  JSON.parse(JSON.stringify(docs), (_k, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(Date.parse(v) + ms).toISOString() : v));
// Bob pinched Alice's ripe Common 5 min ago (and is still in her
// 10-minute revenge window, from a steal 3 min ago); he was caught on her
// going-off pumpkin 20 min ago. Someone (u_x) also marked Bob's guarded Rare.
const robbedDocs = () => {
  const docs = JSON.parse(JSON.stringify(VILLAGE_DOCS));
  const mine = docs["plots-d1"].u_alice.data.tiles;
  Object.assign(mine[0], { stolen: 1, stolenBy: ["u_bob"], marks: [{ by: "u_bob", at: at(5 * 60e3) }] });
  Object.assign(mine[5], { marks: [{ by: "u_bob", at: at(20 * 60e3), caught: true }] });
  docs["plots-d1"].u_bob.data.tiles[1].marks = [{ by: "u_x", at: at(60 * 60e3) }];
  docs.players.u_bob.data.events.push({ t: "steal", victim: "u_alice", kind: "common", at: at(3 * 60e3) });
  return docs;
};
// ── fixtures: custom avatars / crop skins as PNG data URLs ──
const PNG_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const pngChunk = (type, data) => {
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (const b of td) c = PNG_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crc]);
};
/** size×size RGBA PNG; px(x, y) → [r, g, b, a]; `pad` adds a text chunk of that many bytes. */
const makePng = (size, px, pad = 0) => {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) raw.set(px(x, y), y * (size * 4 + 1) + 1 + x * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), ...(pad ? [pngChunk("tEXt", Buffer.from(`c\0${"x".repeat(pad)}`))] : []), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
};
const PAL = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
// A face in palette colours: bone skin, void eyes, a spirit-teal frame (transparent corners).
const faceOk = (size = 24) => makePng(size, (x, y) => ((x < 2 || x > size - 3) && (y < 2 || y > size - 3) ? [0, 0, 0, 0] : x < 2 || y < 2 || x > size - 3 || y > size - 3 ? [...PAL("#7fe3d4"), 255] : (y === 9 && (x === 7 || x === 16)) ? [...PAL("#0d0b14"), 255] : [...PAL("#f2ead8"), 255]));
const BAD_FACES = {
  wrongSize: faceOk(32),
  offPalette: makePng(24, () => [255, 0, 255, 255]),
  halfAlpha: makePng(24, () => [...PAL("#f2ead8"), 128]),
  notPng: "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  tooLong: makePng(24, () => [...PAL("#f2ead8"), 255], 2200),
};
// Bob's "blood pumpkin" skin for his Common: a red ball on a moss stem.
const skinStage = (r) => makePng(32, (x, y) => ((x - 16) ** 2 + (y - 20) ** 2 < r * r ? [...PAL("#a3243b"), 255] : x === 16 && y > 4 && y < 20 ? [...PAL("#2f4a2c"), 255] : [0, 0, 0, 0]));
const BOB_SKIN = { common: { sprout: skinStage(4), growing: skinStage(7), ripe: skinStage(11) } };
// Pictures live in art/<userId>; the farm doc carries only artVersion.
const withArt = (docs, id, art, v = "v1") => {
  docs.art = docs.art || {};
  docs.art[id] = { owner: id, version: 1, data: art };
  docs.farms[id].data.artVersion = v;
  return docs;
};
const ruled = (docs) => {
  withArt(docs, "u_alice", { avatarPng: faceOk() });
  withArt(docs, "u_bob", { skins: BOB_SKIN });
  return docs;
};
// Alice with 70 candy, a crop at row 1 col 2 (tile 5) and a 4×4 field to test "off".
const richDocs = () => {
  const docs = ruled(JSON.parse(JSON.stringify(VILLAGE_DOCS)));
  docs.players.u_alice.data.candy = 70;
  return docs;
};
const bigDocs = () => {
  const docs = ruled(JSON.parse(JSON.stringify(VILLAGE_DOCS)));
  const old = docs["plots-d1"].u_alice.data.tiles;
  const tiles = Array.from({ length: 16 }, (_, i) => (i % 4 < 3 && i < 12 ? old[Math.floor(i / 4) * 3 + (i % 4)] : null));
  tiles[15] = tile("common", 0.2 * H); // only on the 4×4 field
  docs["plots-d1"].u_alice.data = { tiles, cols: 4, rows: 4 };
  return docs;
};
const badFaceCrowd = () => {
  const docs = ruled(crowd());
  Object.values(BAD_FACES).forEach((url, k) => (docs.farms[`u_f${k + 1}`].data.avatarPng = url));
  docs.farms.u_f6.data.skins = { common: { sprout: BAD_FACES.offPalette, growing: BAD_FACES.offPalette, ripe: BAD_FACES.offPalette } };
  return docs;
};

// One player can't break the village: six farm docs that make no sense, a
// plot with a tile that can't be a pumpkin, a player doc with nonsense candy.
const brokenDocs = () => {
  const d = crowd();
  Object.assign(d.farms.u_f1.data, { district: 99 });
  Object.assign(d.farms.u_f2.data, { slug: "BAD SLUG" });
  Object.assign(d.farms.u_f3.data, { avatar: 9 });
  Object.assign(d.farms.u_f4.data, { scarecrow: "neon" });
  Object.assign(d.farms.u_f5.data, { name: "x".repeat(40) });
  Object.assign(d.farms.u_f6.data, { name: 42 });
  d["plots-d1"].u_bob.data.tiles[0] = { kind: "mega", plantedAt: "yesterday", growMs: -1 };
  d.players.u_f7.data.candy = "lots";
  return d;
};
const SCENARIOS = {
  play: { now: NOW, me: { player: true, user: ALICE }, docs: VILLAGE_DOCS },
  robbed: { now: NOW, me: { player: true, user: ALICE }, docs: robbedDocs() },
  broken: { now: NOW, me: { player: true, user: ALICE }, docs: brokenDocs() },
  // Four farms in district 1 (Alice, Bob, f1, f2): past what a Free workspace fits.
  four: { now: NOW, me: { player: true, user: ALICE }, docs: (() => { const d = copy(); settle(d, 1, 3); settle(d, 2, 4); return d; })() },
  ruled: { now: NOW, me: { player: true, user: ALICE }, docs: ruled(JSON.parse(JSON.stringify(VILLAGE_DOCS))) },
  rich: { now: NOW, me: { player: true, user: ALICE }, docs: richDocs() },
  big: { now: NOW, me: { player: true, user: ALICE }, docs: bigDocs() },
  badFaces: { now: NOW, me: { player: true, user: ALICE }, docs: badFaceCrowd() },
  later: { now: LATER, me: { player: true, user: ALICE }, docs: shiftTimes(VILLAGE_DOCS, LATER - NOW) },
  noFarm: { now: NOW, me: { player: true, user: ALICE }, docs: withoutFarm("u_alice") },
  solo: { now: NOW, me: { player: true, user: ALICE }, docs: solo() },
  crowd: { now: NOW, me: { player: true, user: ALICE }, docs: crowd() },
  feed: { now: NOW, me: { player: true, user: ALICE }, docs: feedDocs() },
  spent: { now: NOW, me: { player: true, user: ALICE }, docs: spentDocs() },
  newbie: (tut, over) => ({ now: NOW, me: { player: true, user: ALICE }, docs: newbieDocs(tut, over) }),
  feedBottomLeft: { now: NOW, me: { player: true, user: ALICE }, docs: feedBottomLeft() },
  placed: (n, extra = {}) => ({ now: NOW, me: { player: true, user: ALICE }, docs: { ...placed(n), ...extra } }),
  notMember: { now: NOW, me: { player: false, reason: "NOT_MEMBER", user: { id: "u_mallory", name: "Mallory", avatarUrl: null } }, docs: VILLAGE_DOCS },
  signedOut: { now: NOW, me: { player: false, reason: "SIGNED_OUT" }, docs: VILLAGE_DOCS },
};

export { at, BOB_SKIN, crowd, doc, faceOk, H, NOW, ruled, SCENARIOS, tile, VILLAGE_DOCS, withArt };
