// Haunted Farm — the setup form (a farmer with no farm yet).

import { $, A, esc, RULES, state } from "../core.js";
import { refresh } from "../data.js";
import { avatarFor, cleanFarm, saveFarm } from "../farms.js";
import { AVATARS, SCARECROWS, slugify } from "../shared.js";

function setupHtml(prefill) {
  const f = prefill || { name: `${state.vh?.user?.name || "My"}'s Pumpkin Patch`.slice(0, 30), avatar: avatarFor(state.meId) + 1, scarecrow: "classic" };
  const slug = f.slug || slugify(f.name);
  return `<section class="setup" id="setup">
    <h2>Set up your farm</h2>
    <p>Your farm gets its own link in this village. Neighbours visit it to steal — and to help.</p>
    <form id="setup-form" novalidate>
      <label>Farm name <input name="name" maxlength="30" required value="${esc(f.name)}"></label>
      <label>Link name <span class="slugrow">/farm/<input name="slug" maxlength="31" required value="${esc(slug)}"></span></label>
      <fieldset><legend>Your farmer</legend>${AVATARS
        .map((n) => `<label class="pick"><input type="radio" name="avatar" value="${n}"${Number(f.avatar) === n ? " checked" : ""}><img alt="Farmer ${n}" src="${A(`avatars/farmer-${n}.png`)}"></label>`)
        .join("")}</fieldset>
      <fieldset><legend>Scarecrow colour</legend>${Object.entries(SCARECROWS)
        .map(([k, label]) => `<label class="pick"><input type="radio" name="scarecrow" value="${k}"${f.scarecrow === k ? " checked" : ""}><img class="sc-${k}" alt="" src="${A("props/scarecrow.png")}"><span>${label}</span></label>`)
        .join("")}</fieldset>
      ${RULES.customAvatar && f.avatarPng ? `<label class="own"><input type="checkbox" name="useOwn" checked> <img alt="Your own face" src="${esc(f.avatarPng)}" width="48" height="48"> Use my own face</label>` : ""}
      <p class="err" id="setup-err" role="alert"></p>
      <button class="btn" type="submit">Make my farm</button>
    </form>
  </section>`;
}

document.addEventListener("input", (ev) => {
  // The link name follows the farm name until the farmer edits it.
  const form = ev.target.closest && ev.target.closest("#setup-form");
  if (!form) return;
  if (ev.target.name === "slug") form.dataset.slugTouched = "1";
  if (ev.target.name === "name" && !form.dataset.slugTouched) form.elements.slug.value = slugify(form.elements.name.value);
});
document.addEventListener("submit", async (ev) => {
  const form = ev.target.closest && ev.target.closest("#setup-form");
  if (!form) return;
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  // A setup link's custom art: kept when "Use my own face" stays ticked.
  const art = state.setupArt || {};
  if (art.avatarPng) data.avatarPng = data.useOwn ? art.avatarPng : null;
  if (art.skins) data.skins = art.skins;
  try {
    const farm = cleanFarm(data);
    await saveFarm(farm);
    // Setup ends on the map, where your new house pops in. The form already
    // sits on the map, so redraw in place — a hash change wouldn't reload.
    state.newHouse = true;
    await refresh();
    document.querySelector(".house.mine")?.scrollIntoView({ block: "center", inline: "center" });
  } catch (e) {
    $("#setup-err").textContent = e.message || "Couldn't save your farm — try again.";
  }
});

export { setupHtml };
