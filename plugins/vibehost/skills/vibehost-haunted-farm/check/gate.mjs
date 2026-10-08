// Haunted Farm checks — the gate: what an agent runs after every build (the
// default of check.mjs). The village map (phone + desktop), my farm, a
// neighbour's farm and a steal, the phone layout with this village's own
// name and tagline, setting up a farm, a spectator, a resting village, what
// the build ships — and, for a try-out build, the try-out itself. It writes
// the three screenshots SKILL.md opens: phone-map, desktop-map, phone-bob-farm.
import { RULES } from "../template/engine.js";
import { SCENARIOS, VILLAGE_DOCS } from "./fixtures.mjs";
import { BASE, browser, CFG, check, DESKTOP, FONTS, FORCE_TRICK, guarded, ICON_TEXT, IS_MOCK, layout, layoutOk, open, PHONE, pngsSettled, pullSteal, ready, scan, serveFont, shot, shots, sideways, site, SKILL_DIR, STEAL, tap, viewShot } from "./harness.mjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export default async function gate() {
  await guarded("/ is the village map: one house per farm, mine highlighted, pips, empty lots for rent; no drawer", async (ref) => {
    const { page, ctx, errors } = await open(DESKTOP, SCENARIOS.play);
    ref.ctx = ctx;
    await ready(page);
    const m = await page.evaluate(() => {
      const houses = [...document.querySelectorAll(".map .house")];
      const h = (id) => houses.find((x) => x.dataset.owner === id);
      const fs = (el) => parseFloat(getComputedStyle(el).fontSize);
      return {
        view: document.body.dataset.view,
        houses: houses.map((x) => x.dataset.owner),
        farms: document.querySelectorAll(".farm").length,
        mine: document.querySelectorAll(".house.mine").length,
        mineIsAlice: h("u_alice")?.classList.contains("mine"),
        mineYou: h("u_alice")?.querySelector(".you")?.textContent,
        youFits: (() => {
          const y = h("u_alice")?.querySelector(".you");
          return !!y && y.scrollWidth <= y.clientWidth + 1 && y.getBoundingClientRect().width > 15;
        })(),
        aliceHref: h("u_alice")?.getAttribute("href"),
        bobHref: h("u_bob")?.getAttribute("href"),
        bobPips: __iconText(h("u_bob")?.querySelector(".pips")) ?? "",
        bobFace: /avatars\/farmer-4\.png/.test(h("u_bob")?.querySelector(".face")?.getAttribute("src") ?? ""),
        signs: [...document.querySelectorAll(".map a.lot")].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") })),
        drawer: !!document.getElementById("drawer") || !!document.getElementById("open-neighbours"),
        minLabelPx: Math.min(...[...document.querySelectorAll(".house .label, .lot .sign")].map(fs)),
        // Every house image is exactly as wide as its lot slot (12% of the map).
        housesSized: houses.every((x) => Math.abs(x.querySelector(".house-img").getBoundingClientRect().width - x.getBoundingClientRect().width) <= 1),
      };
    });
    const one = await page.evaluate(() => ({
      switcher: !!document.querySelector(".districts"),
      district: document.querySelector(".map-seg")?.dataset.district,
      notes: [...document.querySelectorAll(".map a.lot .sign small")].map((x) => x.textContent),
    }));
    check(
      "one district: no district switcher; one 'For rent' sign says Free fits 3 farmers",
      !one.switcher && one.district === "1" && one.notes.join() === "(Free fits 3 farmers — upgrade for more)" && errors.length === 0,
      { one, errors },
    );
    check(
      "/ is the village map: one house per farm, mine highlighted, pips, empty lots for rent; no drawer",
      m.view === "map" && m.farms === 0 && m.houses.length === 2 && m.mine === 1 && m.mineIsAlice && m.mineYou === "You" && m.youFits &&
        m.aliceHref === "/farm/alice" && m.bobHref === "/farm/bob" && m.bobPips.includes("[pumpkin]") && m.bobPips.includes("[ghost]") && !m.bobPips.includes("[warning]") && m.bobFace &&
        m.signs.length === 6 && m.signs.every((x) => x.text.startsWith("For rent — invite a teammate") && x.href === CFG.membersUrl) &&
        !m.drawer && m.minLabelPx >= 11 && m.housesSized && errors.length === 0,
      { m, members: CFG.membersUrl, errors },
    );
    // Tap Bob's house → his farm, with the Village button back.
    await Promise.all([page.waitForURL(`${BASE}farm/bob`), page.click('.house[data-owner="u_bob"]')]);
    await ready(page);
    const bob = await page.evaluate(() => ({ farm: document.querySelector(".farm")?.dataset.owner, village: document.querySelector("#farms .to-village")?.getAttribute("href") }));
    await Promise.all([page.waitForURL(BASE), page.click("#farms .to-village")]);
    await ready(page);
    // Tap my house → my farm, with the Village button in the HUD.
    await Promise.all([page.waitForURL(`${BASE}farm/alice`), page.click(".house.mine")]);
    await ready(page);
    const mineFarm = await page.evaluate(() => ({ farm: document.querySelector(".farm.me")?.dataset.owner, village: document.querySelector("#hud .to-village")?.getAttribute("href") }));
    check(
      "tapping a house opens that farm; every farm page has the Village button back to the map",
      bob.farm === "u_bob" && bob.village === "/" && mineFarm.farm === "u_alice" && mineFarm.village === "/" && errors.length === 0,
      { bob, mineFarm, errors },
    );
  });

  await guarded("desktop map: the whole village at once, my house highlighted", async (ref) => {
    const { page, ctx, errors } = await open(DESKTOP, SCENARIOS.play);
    ref.ctx = ctx;
    await ready(page);
    await page.screenshot({ path: join(shots, "desktop-map.png") });
    const d = await page.evaluate(() => {
      const wrap = document.querySelector(".map-wrap");
      return { scrolls: wrap.scrollWidth > wrap.clientWidth + 2, houses: document.querySelectorAll(".house").length };
    });
    check("desktop map: the whole village at once, my house highlighted", !d.scrolls && d.houses === 2 && errors.length === 0, { d, errors });
  });

  await guarded("my farm: harvest, rot and going-off on my own link; laid out", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.play, "/farm/alice");
    ref.ctx = ctx;
    await ready(page);
    const info = await page.evaluate(() => ({
      view: document.body.dataset.view,
      farms: [...document.querySelectorAll(".farm")].map((f) => f.dataset.owner),
      me: document.querySelector(".farm.me header b")?.textContent,
      harvest: document.querySelectorAll('.farm.me button.tile[data-act="harvest"]').length,
      clearRot: document.querySelectorAll('.farm.me button.tile[data-act="clearRot"]').length,
      goingOff: document.querySelectorAll(".farm.me .tile.going-off .flies").length,
    }));
    await shot(page, "phone-my-farm.png");
    const l = await layout(page);
    check("phone layout: tile gutters, scarecrow off the tiles, framed header, scene layer", layoutOk(l), l);
    check(
      "my farm: harvest, rot and going-off on my own link; laid out",
      info.view === "mine" && info.farms.join() === "u_alice" && info.me === "Alice's Acre" && info.harvest >= 1 && info.clearRot === 1 && info.goingOff >= 1 && errors.length === 0,
      { info, errors },
    );
  });

  await guarded("Bob's link shows Bob's farm only, the Village button, values, base risks; no planting or harvesting there", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.play, "/farm/bob");
    ref.ctx = ctx;
    await ready(page);
    const info = await page.evaluate(() => {
      const t = (i) => document.querySelector(`.farm[data-owner="u_bob"] .grid > .tile[data-i="${i}"]`);
      return {
        view: document.body.dataset.view,
        farms: [...document.querySelectorAll(".farm")].map((f) => f.dataset.owner),
        back: __iconText(document.querySelector("#farms .to-village")),
        backHref: document.querySelector("#farms .to-village")?.getAttribute("href"),
        mineActs: document.querySelectorAll('button.tile[data-act="plant"], button.tile[data-act="harvest"], button.tile[data-act="clearRot"], button.tile[data-act="guard"]').length,
        guardBtn: !!document.getElementById("guard-mode"),
        v0: __iconText(t(0)?.querySelector(".value")),
        r0: __iconText(t(0)?.querySelector(".risk")),
        v1: __iconText(t(1)?.querySelector(".value")),
        r1: __iconText(t(1)?.querySelector(".risk")),
        why1: t(1)?.dataset.why,
        // Bob's guard is HIDDEN from me: no sprite, no "guard" anywhere on
        // a tile (badge, title, label, hint data), just the farm's count.
        guardSprites: document.querySelectorAll('.farm[data-owner="u_bob"] img.guard').length,
        guardWords: [...document.querySelectorAll('.farm[data-owner="u_bob"] .grid > *')].filter((x) => /guard/i.test(x.outerHTML)).length,
        lurking: __iconText(document.querySelector('.farm[data-owner="u_bob"] .lurking')),
        v7: __iconText(t(7)?.querySelector(".value")),
        off7: !!t(7)?.querySelector(".crop.off"),
        rotten8: t(8)?.dataset.stage,
        rottenAct: t(8)?.dataset.act ?? null,
        // Readable on a phone: the value and risk badges never cover each
        // other, and the guard ghost stands in the lower half of its tile.
        badgesOverlap: (() => {
          const a = t(0)?.querySelector(".value")?.getBoundingClientRect();
          const b = t(0)?.querySelector(".risk")?.getBoundingClientRect();
          return !a || !b || (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
        })(),
      };
    });
    await shot(page, "phone-bob-farm.png");
    check(
      "a neighbour's guard ghost is hidden: no sprite, base 30% on its tile, no 'guard' in any hint; the farm says 1 is lurking",
      info.guardSprites === 0 && info.guardWords === 0 && info.r1 === "[ghost]30%" && !info.why1 && info.lurking === "[ghost] 1 guard ghost is lurking somewhere on this farm" && errors.length === 0,
      { info, errors },
    );
    check(
      "Bob's link shows Bob's farm only, the Village button, values, base risks; no planting or harvesting there",
      info.view === "neighbour" &&
        info.farms.join() === "u_bob" &&
        /^\[map\] Village$/.test(info.back) &&
        info.backHref === "/" &&
        info.mineActs === 0 &&
        !info.guardBtn &&
        info.v0 === "[candy]4" &&
        info.r0 === "[ghost]30%" &&
        info.v1 === "[candy]7" &&
        info.r1 === "[ghost]30%" &&
        info.v7 === "[candy]4" &&
        info.off7 &&
        info.rotten8 === "rotten" &&
        info.rottenAct === null &&
        !info.badgesOverlap &&
        errors.length === 0,
      { info, errors },
    );
  });

  await guarded("a steal is Trick or Treat and counts toward today's cap", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.play, "/farm/bob");
    ref.ctx = ctx;
    await ready(page);
    const before = await page.evaluate(() => window.__HF_STORE.players.u_alice.version);
    await pullSteal(page, STEAL("u_bob", 0));
    await page.waitForFunction((v) => window.__HF_STORE.players.u_alice.version > v, before, { timeout: 5000 });
    const after = await page.evaluate(() => ({
      alice: window.__HF_STORE.players.u_alice.data,
      bobStolen: window.__HF_STORE["plots-d1"].u_bob.data.tiles.reduce((a, t) => a + ((t && t.stolen) || 0), 0),
      aliceGhosts: window.__HF_STORE["plots-d1"].u_alice.data.tiles.filter((t) => t && t.ghostSince).length,
    }));
    const treat = after.bobStolen === 2 && after.alice.candy === 13;
    const trick = after.bobStolen === 1 && after.aliceGhosts >= 2;
    check("a steal is Trick or Treat and counts toward today's cap", (treat || trick) && after.alice.stealsToday === 3 && errors.length === 0, { after, treat, trick, errors });
  });

  await guarded("watering my own growing crop: 25% sooner, no candy, counts toward today's helps — once per crop, then nothing left to tap", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.play, "/farm/alice");
    ref.ctx = ctx;
    await ready(page);
    const read = () =>
      page.evaluate(() => ({
        version: window.__HF_STORE.players.u_alice.version,
        candy: window.__HF_STORE.players.u_alice.data.candy,
        helps: window.__HF_STORE.players.u_alice.data.helpsToday,
        tile: window.__HF_STORE["plots-d1"].u_alice.data.tiles[7],
      }));
    const before = await read();
    const label = await page.getAttribute('.farm.me button.tile[data-act="water"][data-i="7"]', "title");
    await tap(page, '.farm.me button.tile[data-act="water"][data-i="7"]');
    await page.waitForFunction((v) => window.__HF_STORE.players.u_alice.version > v, before.version, { timeout: 5000 });
    const after = await read();
    // Once per crop: the tile is plain soil now, and another tap says no.
    const again = await page.evaluate(() => ({
      button: !!document.querySelector('.farm.me button.tile[data-i="7"]'),
      div: !!document.querySelector('.farm.me .grid > div.tile[data-i="7"]'),
    }));
    await tap(page, '.farm.me .grid > div.tile[data-i="7"]');
    await page.waitForTimeout(300);
    const later = await read();
    const boost = Math.round(RULES.helpBoost * after.tile.growMs);
    check(
      "watering my own growing crop: 25% sooner, no candy, counts toward today's helps — once per crop, then nothing left to tap",
      label === `Water it (${Math.round(RULES.helpBoost * 100)}% sooner)` &&
        after.tile.helpedBy.includes("u_alice") &&
        Math.round(after.tile.boostMs - before.tile.boostMs) === boost &&
        after.candy === before.candy &&
        after.helps === before.helps + 1 &&
        !again.button &&
        again.div &&
        later.version === after.version &&
        errors.length === 0,
      { label, before, after, again, later: later.version, errors },
    );
  });

  await guarded("caught: \"Keep sneaking\" closes the card and keeps me on Bob's farm; the ghost still followed me home", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.play, "/farm/bob", { init: [[FORCE_TRICK]] });
    ref.ctx = ctx;
    await ready(page);
    const ghosts = () => page.evaluate(() => window.__HF_STORE["plots-d1"].u_alice.data.tiles.filter((t) => t && t.ghostSince).length);
    const had = await ghosts();
    await tap(page, STEAL("u_bob", 0));
    await page.waitForSelector("dialog#trick[open]", { timeout: 5000 });
    await page.waitForTimeout(250);
    const buttons = await page.$$eval("#trick .trick-btns .btn", (bs) => bs.map((b) => b.textContent).join("|"));
    const focused = await page.evaluate(() => document.activeElement?.id);
    await viewShot(page, "caught-modal.png");
    // A mark on this page: a navigation home (after the ghost's flight) would wipe it.
    await page.evaluate(() => (window.__stayed = true));
    await page.click("#trick-stay");
    await page.waitForSelector("dialog#trick:not([open])", { state: "attached", timeout: 3000 });
    await page.waitForTimeout(3000);
    await ready(page);
    const stay = await page.evaluate(() => ({ same: window.__stayed === true, url: location.pathname, farm: document.querySelector(".farm")?.dataset.owner, view: document.body.dataset.view }));
    const now = await ghosts();
    check(
      "caught: \"Keep sneaking\" closes the card and keeps me on Bob's farm; the ghost still followed me home",
      buttons === "Keep sneaking|Back to my farm" && focused === "trick-stay" && stay.same && stay.url === "/farm/bob" && stay.farm === "u_bob" && stay.view === "neighbour" && now === had + 1 && errors.length === 0,
      { buttons, focused, stay, had, now, errors },
    );
  });

  await guarded("tab title: \"🎃 Ready! · <village>\" while one of my crops is ripe (on any page); just the village name when none is", async (ref) => {
    const ready_ = `\u{1F383} Ready! · ${CFG.name}`;
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.play, "/farm/alice");
    ref.ctx = ctx;
    await ready(page);
    const titles = { mine: await page.title() };
    await viewShot(page, "tab-title-ready.png");
    await Promise.all([page.waitForURL(`${BASE}farm/bob`), page.goto(`${BASE}farm/bob`)]);
    await ready(page);
    titles.bob = await page.title();
    await ctx.close();
    // Nothing of mine ripe (the ripe and going-off pumpkins gone).
    const docs = JSON.parse(JSON.stringify(VILLAGE_DOCS));
    const mine = docs["plots-d1"].u_alice.data.tiles;
    mine[0] = mine[5] = null;
    const n = await open(PHONE, { ...SCENARIOS.play, docs }, "/farm/alice");
    ref.ctx = n.ctx;
    await ready(n.page);
    titles.none = await n.page.title();
    // Harvesting the last ripe one turns it back.
    const one = JSON.parse(JSON.stringify(VILLAGE_DOCS));
    one["plots-d1"].u_alice.data.tiles[5] = null;
    await n.ctx.close();
    const h = await open(PHONE, { ...SCENARIOS.play, docs: one }, "/farm/alice");
    ref.ctx = h.ctx;
    await ready(h.page);
    titles.beforeHarvest = await h.page.title();
    await tap(h.page, '.farm.me button.tile[data-act="harvest"][data-i="0"]');
    await h.page.waitForFunction((name) => document.title === name, CFG.name, { timeout: 5000 }).catch(() => {});
    titles.afterHarvest = await h.page.title();
    writeFileSync(join(shots, "tab-title.txt"), Object.entries(titles).map(([k, v]) => `${k}: ${v}`).join("\n") + "\n");
    check(
      "tab title: \"🎃 Ready! · <village>\" while one of my crops is ripe (on any page); just the village name when none is",
      titles.mine === ready_ && titles.bob === ready_ && titles.none === CFG.name && titles.beforeHarvest === ready_ && titles.afterHarvest === CFG.name && errors.length === 0 && n.errors.length === 0 && h.errors.length === 0,
      { titles, want: ready_ },
    );
  });

  await guarded("phone map fits the width: as wide as the content, 16:9, no horizontal overflow or panning anywhere", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.crowd);
    ref.ctx = ctx;
    await ready(page);
    const r = await page.evaluate(() => {
      const wrap = document.querySelector(".map-wrap");
      const map = document.querySelector(".map").getBoundingClientRect();
      const content = document.getElementById("farms").getBoundingClientRect();
      return { map: map.width, ratio: map.width / map.height, content: content.width, wrapScroll: wrap.scrollWidth - wrap.clientWidth, overflowX: getComputedStyle(wrap).overflowX, inner: wrap.clientWidth };
    });
    const over = await sideways(page);
    check(
      "phone map fits the width: as wide as the content, 16:9, no horizontal overflow or panning anywhere",
      Math.abs(r.map - r.inner) <= 1 && r.inner >= r.content - 8 && Math.abs(r.ratio - 480 / 270) < 0.02 && r.wrapScroll <= 0 && r.overflowX === "hidden" && over.page <= 0 && over.boxes.length === 0 && errors.length === 0,
      { r, over, errors },
    );
  });

  await guarded("phone: under the map, my district's farms as a list — mine first and highlighted, each row a link to that farm; the switcher sits above it", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.crowd);
    ref.ctx = ctx;
    await ready(page);
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".neighbours .nrow")];
      return {
        rows: rows.map((a) => ({ id: a.dataset.owner, href: a.getAttribute("href"), mine: a.classList.contains("mine"), status: a.querySelector(".status").textContent })),
        map: document.querySelector(".map-wrap").getBoundingClientRect().bottom,
        sw: document.querySelector(".districts")?.getBoundingClientRect().toJSON(),
        list: document.querySelector(".neighbours").getBoundingClientRect().top,
      };
    });
    await page.screenshot({ path: join(shots, "phone-map.png"), fullPage: true });
    await Promise.all([page.waitForURL(`${BASE}farm/bob`), page.click('.neighbours .nrow[data-owner="u_bob"]')]);
    await ready(page);
    const landed = await page.evaluate(() => document.querySelector(".farm")?.dataset.owner);
    check(
      "phone: under the map, my district's farms as a list — mine first and highlighted, each row a link to that farm; the switcher sits above it",
      r.rows.length === 8 && r.rows[0].id === "u_alice" && r.rows[0].mine && r.rows.slice(1).every((x) => !x.mine) && r.rows.every((x) => /^\/farm\//.test(x.href)) &&
        r.rows.every((x) => ["ripe & stealable", "ripe to harvest", "nothing yet"].includes(x.status)) &&
        r.sw && r.sw.top >= r.map && r.sw.bottom <= r.list && landed === "u_bob" && errors.length === 0,
      { r, landed, errors },
    );
  });

  await guarded("phone header is compact: one-line title, one row of HUD chips, the Village button in the title row; the farm grid starts within 300 px", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.feed, "/farm/alice");
    ref.ctx = ctx;
    await ready(page);
    const r = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const kids = [...document.getElementById("hud").children].filter((el) => box(el).width > 0);
      const title = document.getElementById("title");
      return {
        gridTop: box(document.querySelector(".farm.me .grid")).top,
        titleOneLine: box(title).height < 40 && getComputedStyle(title).whiteSpace === "nowrap",
        hudRows: new Set(kids.map((el) => Math.round(box(el).top / 6))).size,
        hudFits: document.getElementById("hud").scrollWidth <= document.getElementById("hud").clientWidth + 1,
        village: (() => {
          const v = document.querySelector("#top-village .to-village");
          return !!v && box(v).height > 0 && Math.abs(box(v).top - box(title).top) < 20;
        })(),
        otherVillage: [...document.querySelectorAll("#hud .to-village, #farms > .to-village")].filter((el) => box(el).height > 0).length,
        tagline: getComputedStyle(document.getElementById("tagline")).display,
      };
    });
    const over = await sideways(page);
    await viewShot(page, "phone-compact-header.png");
    check(
      "phone header is compact: one-line title, one row of HUD chips, the Village button in the title row; the farm grid starts within 300 px",
      r.gridTop <= 300 && r.titleOneLine && r.hudRows === 1 && r.hudFits && r.village && r.otherVillage === 0 && r.tagline === "none" && over.page <= 0 && over.boxes.length === 0 && errors.length === 0,
      { r, over, errors },
    );
  });

  await guarded("no farm yet: the setup form shows over the map; filling it writes farms/<me> and the slug, then my house pops in on the map", async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.noFarm);
    ref.ctx = ctx;
    await ready(page);
    const form = await page.evaluate(() => ({
      setup: !!document.getElementById("setup-form"),
      farms: document.querySelectorAll(".farm").length,
      map: !!document.querySelector(".map"),
      avatars: document.querySelectorAll('#setup-form input[name="avatar"]').length,
      scarecrows: document.querySelectorAll('#setup-form input[name="scarecrow"]').length,
    }));
    await page.fill('#setup-form input[name="name"]', "Pumpkin Palace");
    const autoSlug = await page.inputValue('#setup-form input[name="slug"]');
    await page.check('#setup-form input[name="avatar"][value="3"]', { force: true });
    await page.check('#setup-form input[name="scarecrow"][value="spirit"]', { force: true });
    await shot(page, "phone-setup.png");
    // A taken link name is refused, in words.
    await page.fill('#setup-form input[name="slug"]', "bob");
    await page.click('#setup-form button[type="submit"]');
    const taken = await page.locator("#setup-err").textContent();
    await page.fill('#setup-form input[name="slug"]', "pumpkin-palace");
    await Promise.all([page.waitForURL(BASE, { timeout: 5000 }), page.click('#setup-form button[type="submit"]')]);
    await ready(page);
    const saved = await page.evaluate(() => ({
      farm: window.__HF_STORE.farms.u_alice?.data,
      slug: window.__HF_STORE.slugs["pumpkin-palace"]?.owner,
      shown: document.querySelector(".house.mine .label b")?.textContent,
      popIn: !!document.querySelector(".house.mine.pop-in"),
      href: document.querySelector(".house.mine")?.getAttribute("href"),
      setupGone: !document.getElementById("setup-form"),
    }));
    check(
      "no farm yet: the setup form shows over the map; filling it writes farms/<me> and the slug, then my house pops in on the map",
      form.setup && form.farms === 0 && form.map && form.avatars === 6 && form.scarecrows === 6 && autoSlug === "pumpkin-palace" && /taken/.test(taken) &&
        JSON.stringify(saved.farm) === JSON.stringify({ name: "Pumpkin Palace", slug: "pumpkin-palace", avatar: 3, scarecrow: "spirit", district: 1, lot: 0, tutorial: { round: 0, cleared: [], done: false, skipped: false }, firstCropBoost: false }) &&
        saved.slug === "u_alice" && saved.shown === "Pumpkin Palace" && saved.popIn && saved.href === "/farm/pumpkin-palace" && saved.setupGone && errors.length === 0,
      { form, autoSlug, taken, saved, errors },
    );
  });

  // The first live village failed exactly here: a brand-new player in an
  // empty village sets up, opens their farm and plants. Nothing is seeded —
  // no players/<me> either — so every doc the page needs, it makes itself.
  const FIRST_PLANT = "a brand-new player in an empty village: setup, then their own farm, tap an empty tile, Common — a sprout appears, no 'bump' toast";
  await guarded(FIRST_PLANT, async (ref) => {
    const NEWBIE = { id: "u_first", name: "Wren", avatarUrl: null };
    const { page, ctx, errors } = await open(PHONE, { now: SCENARIOS.noFarm.now, me: { player: true, user: NEWBIE }, docs: {} });
    ref.ctx = ctx;
    const logged = [];
    page.on("console", (m) => m.type() === "error" && /haunted-farm/.test(m.text()) && logged.push(m.text()));
    await ready(page);
    await page.fill('#setup-form input[name="name"]', "First Furrow");
    await Promise.all([page.waitForURL(BASE, { timeout: 5000 }), page.click('#setup-form button[type="submit"]')]);
    await ready(page);
    await page.goto(`${BASE}farm/first-furrow`);
    await ready(page);
    const before = await page.evaluate(() => ({ view: document.body.dataset.view, empty: document.querySelectorAll('.farm.me button.tile[data-act="plant"]').length }));
    // Every toast while it plants (they leave after a few seconds).
    await page.evaluate(() => {
      window.__toasts = [];
      const t = document.getElementById("toast");
      new MutationObserver(() => t.hidden || window.__toasts.push(t.textContent)).observe(t, { attributes: true, childList: true, subtree: true, characterData: true });
    });
    await page.click('.farm.me button.tile[data-act="plant"][data-i="0"]');
    await page.click('#seeds button[data-kind="common"]');
    await page.waitForFunction(() => !!window.__HF_STORE["plots-d1"]?.u_first?.data.tiles[0], null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      stored: window.__HF_STORE["plots-d1"]?.u_first?.data.tiles[0]?.kind ?? null,
      shown: document.querySelector('.farm.me .tile[data-i="0"] img.crop')?.getAttribute("src") ?? null,
      toasts: [...new Set(window.__toasts)],
    }));
    check(
      FIRST_PLANT,
      before.view === "mine" && before.empty === 9 && after.stored === "common" && /crops\/common-sprout\.png/.test(after.shown) && !after.toasts.some((x) => /bump/i.test(x)) && logged.length === 0 && errors.length === 0,
      { before, after, logged, errors },
    );
  });

  const SPECTATOR = "spectator, not a member: the map read-only (no invites), a farm link read-only; the banner says only the workspace's members can farm, and 'How to join' opens how-to-play's join card";
  await guarded(SPECTATOR, async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.notMember);
    ref.ctx = ctx;
    await ready(page);
    const ro = await page.evaluate(() => ({ mode: document.body.dataset.mode, links: document.querySelectorAll(".map a.house").length, invites: document.querySelectorAll(".map a.lot").length, buttons: document.querySelectorAll("button.tile").length, banner: document.getElementById("banner").textContent.trim(), join: document.querySelector("#how-to-join")?.getAttribute("href") }));
    await shot(page, "phone-village-spectator.png");
    await page.locator("#banner").screenshot({ path: join(shots, "banner-not-member.png") });
    const stayed = page.url() === BASE;
    await page.goto(`${BASE}farm/bob`);
    await ready(page);
    const farm = await page.evaluate(() => ({ farms: document.querySelectorAll(".farm").length, buttons: document.querySelectorAll("button.tile").length }));
    await page.click("#how-to-join");
    await page.waitForURL(/how-to-play\.html\?reason=NOT_MEMBER#join/, { timeout: 5000 });
    await page.waitForFunction(() => document.body.dataset.reason === "NOT_MEMBER", null, { timeout: 5000 });
    const card = await page.evaluate(() => {
      const c = document.getElementById("join");
      return { shown: !!c && getComputedStyle(c).display !== "none", lead: c?.querySelector("h2")?.textContent, second: c?.querySelector(".own-village h3")?.textContent };
    });
    await page.locator("#join").screenshot({ path: join(shots, "how-to-play-join.png") });
    check(
      SPECTATOR,
      ro.mode === "watch" && ro.links === 2 && ro.invites === 0 && ro.buttons === 0 &&
        ro.banner.startsWith("You can look around, but only members of this village's VibeHost workspace can farm here.") && /How to join$/.test(ro.banner) &&
        stayed && farm.farms === 1 && farm.buttons === 0 && card.shown && card.lead === "Join this village" && card.second === "Or start your own village" && errors.length === 0,
      { ro, stayed, farm, card, errors },
    );
  });

  const SIGNED_OUT = "spectator, signed out: the banner asks to sign in, and 'Sign in' goes to the platform login, coming back to this page";
  await guarded(SIGNED_OUT, async (ref) => {
    const { page, ctx, errors } = await open(PHONE, SCENARIOS.signedOut, "farm/bob");
    ref.ctx = ctx;
    await ready(page);
    const b = await page.evaluate(() => ({ banner: document.getElementById("banner").textContent.trim(), href: document.querySelector("#sign-in")?.getAttribute("href"), here: location.href }));
    await page.locator("#banner").screenshot({ path: join(shots, "banner-signed-out.png") });
    check(
      SIGNED_OUT,
      b.banner === "Sign in to farm in this village. Sign in" && b.href === `${CFG.loginUrl}?next=${encodeURIComponent(b.here)}` && errors.length === 0,
      { b, errors },
    );
  });

  if (!IS_MOCK) {
    await guarded("no App Data → 'the village is resting', never a broken game", async (ref) => {
      const { page, ctx, errors } = await open(PHONE, null, "", { rest: true });
      ref.ctx = ctx;
      await ready(page);
      const r = await page.evaluate(() => ({ mode: document.body.dataset.mode, banner: document.getElementById("banner").textContent, farms: document.querySelectorAll(".farm").length }));
      await shot(page, "phone-village-resting.png");
      check("no App Data → 'the village is resting', never a broken game", r.mode === "rest" && /resting/.test(r.banner) && r.farms === 0 && errors.length === 0, { r, errors });
    });
  }

  {
    // The rewrites that give every farm its own link. (That no NPC farm ships
    // is dev/removed.test.mjs's job now: a static check.)
    const rw = existsSync(join(site, "vibehost.json")) ? JSON.parse(readFileSync(join(site, "vibehost.json"), "utf8")).rewrites : [];
    const rewritesOk = rw.some((r) => r.source === "/farm/:slug*" && r.destination === "/index.html") && rw.some((r) => r.source === "/setup" && r.destination === "/index.html");
    check("the build ships the /farm/* + /setup rewrites", rewritesOk, { rw });
  }

  {
    // Link previews and icons: what Slack, LINE, iMessage and a browser tab
    // see. Read from the built files, no browser needed.
    const NAME = "link preview + icons: full Open Graph / Twitter meta on every page (absolute URLs), og.png 1200×630 ≤ 300 KB and this village's own, the favicon set at its sizes, a valid manifest";
    const file = (f) => (existsSync(join(site, f)) ? readFileSync(join(site, f)) : null);
    const pngSize = (b) => (b && b.length > 24 && b.toString("latin1", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null);
    const metaOf = (html) => {
      const m = {};
      for (const [, k, v] of html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)">/g)) m[k] = v;
      for (const [, rel, href] of html.matchAll(/<link rel="([^"]+)"[^>]*href="([^"]+)"/g)) (m[`link:${rel}`] ??= []).push(href);
      m.title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
      return m;
    };
    const live = CFG.villageUrl;
    const NEED = ["description", "og:type", "og:site_name", "og:title", "og:description", "og:image", "og:image:width", "og:image:height", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "theme-color"];
    const pages = {};
    for (const page of ["index.html", "how-to-play.html"]) {
      const m = metaOf(String(file(page)));
      const missing = [...NEED, ...(live ? ["og:url"] : [])].filter((k) => !m[k]);
      const abs = live ? ["og:url", "og:image", "twitter:image"].filter((k) => !String(m[k]).startsWith(`${live}/`)) : [];
      const links = ["link:icon", "link:apple-touch-icon", "link:manifest"].filter((k) => !m[k]);
      pages[page] = {
        missing,
        notAbsolute: abs,
        links,
        ok: missing.length === 0 && abs.length === 0 && links.length === 0 && m["og:type"] === "website" && m["og:image:width"] === "1200" && m["og:image:height"] === "630" && m["twitter:card"] === "summary_large_image" && m["og:title"] === m.title.replace(/&amp;/g, "&") && m["twitter:title"] === m["og:title"],
        title: m.title,
      };
    }
    const og = file("og.png");
    const generic = og && og.equals(readFileSync(join(SKILL_DIR, "art/ui/og.png")));
    const icons = Object.fromEntries(
      [["favicon-16.png", 16], ["favicon-32.png", 32], ["favicon-48.png", 48], ["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]].map(([f, n]) => [f, String(pngSize(file(f))) === String([n, n])]),
    );
    const ico = file("favicon.ico");
    const icoSizes = ico && ico.readUInt16LE(2) === 1 ? Array.from({ length: ico.readUInt16LE(4) }, (_, k) => ico[6 + 16 * k] || 256) : [];
    let manifest = null;
    try {
      manifest = JSON.parse(String(file("site.webmanifest")));
    } catch {
      /* invalid: reported below */
    }
    const manifestOk = !!manifest && !!manifest.name && /^#[0-9a-f]{6}$/i.test(manifest.theme_color) && /^#[0-9a-f]{6}$/i.test(manifest.background_color) && ["192x192", "512x512"].every((s) => manifest.icons?.some((i) => i.sizes === s && file(i.src.replace(/^\//, ""))));
    check(
      NAME,
      Object.values(pages).every((p) => p.ok) && /^How to play/.test(pages["how-to-play.html"].title) && String(pngSize(og)) === "1200,630" && og.length <= 300 * 1024 && !generic && Object.values(icons).every(Boolean) && icoSizes.join() === "16,32,48" && manifestOk,
      { pages, og: og && { size: pngSize(og), bytes: og.length, generic, ...(generic ? { hint: "the generic card: build.mjs found no Playwright — run it again from the project folder" } : {}) }, icons, icoSizes, manifest },
    );
  }

  if (!IS_MOCK) {
    await guarded("normal build carries no mock code or try-out banner", async (ref) => {
      // A normal build must not carry the try-out: no fake SDK, no banner, no
      // try-out store, no speed knob — in any file it ships. (localStorage
      // itself is fine: the page remembers mute and "last seen".)
      const leaks = scan(/mock-sdk|Try-out mode|id="tryout|tryout-reset|resetTryout|__HF_|haunted-farm-tryout:|[?&]speed=|"mock":/i);
      const { page, ctx, errors } = await open(PHONE, SCENARIOS.play);
      ref.ctx = ctx;
      await ready(page);
      const banner = await page.locator("#tryout").count();
      check("normal build carries no mock code or try-out banner", leaks.length === 0 && banner === 0 && errors.length === 0, { leaks, banner, errors });
    });
  } else {
    // ---- try-out mode: no scenario, a fresh browser profile ----
    await guarded("try-out: the walkthrough finished", async (ref) => {
      const tryCtx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
      ref.ctx = tryCtx;
      const page = await tryCtx.newPage();
      await page.addInitScript(ICON_TEXT);
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 400 && !FONTS.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`);
      });
      await page.route(FONTS, serveFont);
      let asksRealSdk = false;
      await page.route("**/__vh/data/**", (r) => ((asksRealSdk = true), r.fulfill({ status: 404, body: "" })));
      await page.goto(BASE);
      await ready(page);
      const t = await page.evaluate(async () => {
        const vh = window.__hauntedFarm.vh;
        const a = vh.now().getTime();
        await new Promise((r) => setTimeout(r, 1000));
        return {
          mode: document.body.dataset.mode,
          houses: [...document.querySelectorAll(".map .house")].map((h) => `${h.dataset.owner}:${__iconText(h.querySelector(".pips")) ?? ""}`),
          me: document.querySelector(".house.mine .label b")?.textContent,
          faces: new Set([...document.querySelectorAll(".map .house .face")].map((f) => f.getAttribute("src"))).size,
          banner: document.getElementById("tryout")?.textContent ?? "",
          bannerFixed: getComputedStyle(document.getElementById("tryout") || document.body).position,
          // The banner fits the room the page leaves for it (body padding-bottom: 56px).
          bannerH: document.getElementById("tryout")?.offsetHeight ?? 0,
          perRealSecond: (vh.now().getTime() - a) / 1000,
        };
      });
      // Bob leaves a ripe pumpkin for three steal windows before he harvests it.
      const waitMs = 3 * RULES.stealOpensAfterMs;
      const bobWaits = await page.evaluate(async ({ growMs, before, after }) => {
        await new Promise((r) => { const w = () => (window.__HF_NEIGHBOUR_TICK ? r() : setTimeout(w, 50)); w(); });
        const store = window.__HF_STORE;
        const plotsKey = Object.keys(store).find((k) => k.startsWith("plots-d") && store[k].u_bob);
        const at = (agoMs) => {
          const t = window.__hauntedFarm.vh.now().getTime();
          const plantedAt = new Date(t - growMs - agoMs).toISOString();
          store[plotsKey].u_bob.data.tiles[0] = { kind: "common", secret: false, plantedAt, growMs, boostMs: 0, ghostSince: null, ghostMs: 0, stolen: 0, stolenBy: [], helpedBy: [] };
          window.__HF_NEIGHBOUR_TICK("u_bob");
          // Still that pumpkin? (Once harvested, he may sow a new seed in the same spot.)
          return store[plotsKey].u_bob.data.tiles[0]?.plantedAt === plantedAt;
        };
        return { before: at(before), after: at(after) };
      }, { growMs: RULES.kinds.common.growMs, before: waitMs - 10_000, after: waitMs + 10_000 });
      check(`try-out: Bob harvests a ripe pumpkin only after three steal windows (still there ${(waitMs - 10_000) / 1000} s after ripening, gone after ${(waitMs + 10_000) / 1000} s)`, bobWaits.before && !bobWaits.after, { bobWaits });
      await page.screenshot({ path: join(shots, "phone-tryout.png") });
      const tryTut = await page.evaluate(() => ({ step: document.getElementById("coach").dataset.step, shown: !document.getElementById("coach").hidden, farm: window.__HF_STORE.farms.u_you.data }));
      check(
        "try-out: a fresh farmer starts in the tutorial (step 1 on the map: my house) with beginner's luck unused; Bob's pumpkin is ripe for step 3",
        tryTut.shown && tryTut.step === "plant" && tryTut.farm.firstCropBoost === false && JSON.stringify(tryTut.farm.tutorial.cleared) === "[]" && t.houses.some((h) => h.startsWith("u_bob:") && h.includes("[pumpkin]")),
        { tryTut },
      );
      const want = CFG.mock.speed;
      check(
        "try-out: starts on the map with my house and Bob, Cleo, Dan and Eve (5 faces; Bob [pumpkin], Cleo [ghost]); banner; clock runs at ?speed",
        t.mode === "play" && t.houses.length === 5 && t.me === "My Pumpkin Patch" && t.faces === 5 &&
          t.houses.some((h) => h.startsWith("u_bob:") && h.includes("[pumpkin]")) && t.houses.some((h) => h.startsWith("u_cleo:") && h.includes("[ghost]")) &&
          ["u_you", "u_bob", "u_cleo", "u_dan", "u_eve"].every((id) => t.houses.some((h) => h.startsWith(`${id}:`))) &&
          /Try-out mode — your farm lives in this browser only\. Neighbours are pretend\./.test(t.banner) && t.bannerFixed === "fixed" && t.bannerH > 0 && t.bannerH <= 56 &&
          t.perRealSecond > want * 0.6 && t.perRealSecond < want * 1.6 && !asksRealSdk && errors.length === 0,
        { t, want, asksRealSdk, errors },
      );

      // The village rules in the try-out: my own face, Bob's "blood pumpkin" skin, expansion on offer.
      await pngsSettled(page);
      const myFace = await page.$eval(".house.mine .face", (i) => i.getAttribute("src"));
      await page.goto(`${BASE}farm/bob`);
      await ready(page);
      await pngsSettled(page);
      const bobCommons = await page.$$eval('.farm[data-owner="u_bob"] img.crop', (is) => is.map((i) => i.getAttribute("src")));
      await page.goto(`${BASE}farm/you`);
      await ready(page);
      const expandBtn = await page.evaluate(() => {
        const b = document.getElementById("expand");
        return b && { text: window.__iconText(b).replace(/\s+/g, " ").trim(), next: b.dataset.next };
      });
      check(
        `try-out: my farmer has a custom face, Bob's Common pumpkins wear a crop skin, and my farm offers 'Expand field — ${CFG.rules.expansion.costs[0]} candy'`,
        /^data:image\/png;base64,/.test(myFace) && bobCommons.some((x) => /^data:image\/png;base64,/.test(x)) && bobCommons.some((x) => /crops\/(rare|legendary)-/.test(x)) &&
          expandBtn?.text === `Expand field — ${CFG.rules.expansion.costs[0]} [candy]` && expandBtn.next === "3x4" && errors.length === 0,
        { myFace: myFace.slice(0, 30), bobCommons: bobCommons.map((x) => x.slice(0, 30)), expandBtn, errors },
      );

      // Over to Bob's link: steal, then home to plant; a reload keeps both.
      await page.goto(`${BASE}farm/bob`);
      await ready(page);
      await pullSteal(page, STEAL("u_bob"));
      await page.waitForFunction(() => window.__HF_STORE.players.u_you.data.stealsToday === 1, null, { timeout: 5000 });
      await page.goto(`${BASE}farm/you`);
      await ready(page);
      await page.click('.farm.me button.tile[data-act="plant"]');
      await page.click('#seeds button[data-kind="common"]');
      await page.waitForFunction(() => window.__HF_STORE["plots-d1"].u_you?.data.tiles.some((x) => x && x.kind === "common"), null, { timeout: 5000 });
      await page.reload();
      await ready(page);
      const kept = await page.evaluate(() => ({
        planted: window.__HF_STORE["plots-d1"].u_you.data.tiles.filter((x) => x && x.kind === "common").length,
        steals: window.__HF_STORE.players.u_you.data.stealsToday,
      }));
      check("try-out: stealing on Bob's link and planting on mine survive a reload (localStorage)", kept.planted >= 1 && kept.steals === 1 && errors.length === 0, { kept, errors });

      // Bob plays on his own; at ?speed=3600 an hour passes every second.
      await page.goto(`${BASE}?speed=3600`);
      await ready(page);
      const bob = await page
        .waitForFunction(() => window.__HF_LOG.some((e) => e.userId !== "u_you"), null, { timeout: 12000 })
        .then(() => page.evaluate(() => window.__HF_LOG.filter((e) => e.userId !== "u_you").map((e) => `${e.userId} ${e.collection}/${e.docId}`)))
        .catch(() => []);
      check("try-out: the pretend neighbours tend their farms by themselves (and ?speed= is honoured)", bob.length > 0 && errors.length === 0, { bob: bob.slice(0, 6), errors });

      await page.goto(BASE);
      await ready(page);
      await Promise.all([page.waitForEvent("load"), page.click("#tryout-reset")]);
      await ready(page);
      const fresh = await page.evaluate(() => ({
        planted: (window.__HF_STORE["plots-d1"].u_you?.data.tiles ?? []).filter(Boolean).length,
        steals: window.__HF_STORE.players.u_you?.data.stealsToday ?? 0,
      }));
      check("try-out: Reset starts the farm over", fresh.planted === 0 && fresh.steals === 0 && errors.length === 0, { fresh, errors });

      const d = await browser.newContext({ viewport: DESKTOP });
      const dp = await d.newPage();
      await dp.route(FONTS, serveFont);
      await dp.goto(BASE);
      await ready(dp);
      await shot(dp, "desktop-tryout.png");
      // Real time by default: the tips say midnight, nothing about game time;
      // sped up with ?speed=, they say the reset comes in game time.
      const tryTip = await dp.$eval('#hud [data-chip="steals"]', (c) => c.dataset.tip);
      await dp.goto(`${BASE}?speed=60`);
      await ready(dp);
      const fastTip = await dp.$eval('#hud [data-chip="steals"]', (c) => c.dataset.tip);
      await dp.goto(BASE);
      await ready(dp);
      check(
        "try-out: at its default 1× the counters' tips say they reset at midnight; sped up with ?speed=, in game time (which runs fast)",
        /Resets at midnight Taipei time\.$/.test(tryTip) && /Resets at midnight Taipei time — in game time, which runs fast in this try-out\./.test(fastTip),
        { tryTip, fastTip },
      );
      await dp.click("#feed-bar");
      const seeded = await dp.$$eval("#feed-drop li", (lis) => lis.map((li) => li.textContent.replace(/\s+/g, " ").trim()));
      check(
        "try-out: 'Lately in the village' starts with the neighbours' doings on the map (Bob ×3, Eve in Cleo's trap, Dan watering you)",
        seeded.length >= 5 && /^Bob pinched from Cleo ×3/.test(seeded[0]) && seeded.some((x) => /Eve walked into Cleo's guard ghost trap/.test(x)) && seeded.some((x) => /Dan watered your orange pumpkin/.test(x)),
        { seeded },
      );
      await d.close();

      // ?farmers=20: twenty farmers fill districts 1–3 in join order.
      await page.goto(`${BASE}?farmers=20`);
      await ready(page);
      await page.waitForTimeout(300);
      const big = await page.evaluate(() => {
        const farms = window.__HF_STORE.farms;
        const order = Object.entries(farms).sort((a, b) => Date.parse(a[1].createdAt) - Date.parse(b[1].createdAt));
        return {
          count: order.length,
          inOrder: order.every(([, f], k) => f.data.district === Math.floor(k / 8) + 1 && f.data.lot === k % 8),
          plotsOk: order.every(([id, f]) => !!window.__HF_STORE[`plots-d${f.data.district}`]?.[id]),
          buttons: [...document.querySelectorAll(".districts button.district")].map((b) => b.textContent),
          houses: document.querySelectorAll(".map .house").length,
          lists: window.__HF_CALLS.filter((c) => c.startsWith("list plots")),
        };
      });
      await page.screenshot({ path: join(shots, "phone-tryout-districts.png") });
      await page.click('.districts button[data-district="3"]');
      await page.waitForFunction(() => document.querySelector(".map-seg")?.dataset.district === "3");
      const d3 = await page.evaluate(() => ({ houses: document.querySelectorAll(".map .house").length, signs: document.querySelectorAll(".map a.lot").length }));
      check(
        "try-out ?farmers=20: districts 1–3 filled in join order; switcher District 1 · 2 · 3; district 3 has 4 houses and 4 lots for rent",
        big.count === 20 && big.inOrder && big.plotsOk && big.buttons.join("|") === "District 1 ★|2|3" && big.houses === 8 &&
          big.lists.every((c) => c === "list plots-d1") && d3.houses === 4 && d3.signs === 4 && errors.length === 0,
        { big, d3, errors },
      );
      // Back to the usual five (the size sticks until asked again).
      await page.goto(`${BASE}?farmers=5`);
      await ready(page);
    });
  }
}
