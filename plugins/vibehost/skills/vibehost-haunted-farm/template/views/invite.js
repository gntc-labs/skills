// Haunted Farm — "Invite a neighbour".
// VibeHost workspace invites are per email and only owners/admins send
// them (dashboard → workspace settings). So the card hands the farmer a
// message to forward, and a link to where the invite is sent.

import * as FX from "../fx.js";
import { NEXT, plainClick } from "../clicks.js";
import { $, CFG, state } from "../core.js";

const villageUrl = () => (CFG.villageUrl || location.origin).replace(/\/+$/, "");
/** The message a farmer forwards to a teammate. */
function inviteMessage() {
  const v = villageUrl();
  return [
    `🎃 Come steal my pumpkins. Our haunted village: ${v}`,
    `What it is: ${CFG.landingUrl}`,
    "1. Accept the VibeHost invite I send to your email (on a company email? just sign in)",
    `2. Tell your coding agent: "Use the vibehost-haunted-farm skill to join my village ${v}"`,
  ].join("\n");
}
/** One district and ≤ 3 farms: a Free workspace may be the limit. */
function freePlanHint() {
  const placed = [...state.farms.values()].filter((v) => v.farm.district);
  return placed.length <= 3 && placed.every((v) => v.farm.district === 1);
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    Object.assign(t.style, { position: "fixed", opacity: "0" });
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}
function openInvite() {
  const card = $("#invite");
  $("#invite-msg").textContent = inviteMessage();
  $("#invite-go").href = CFG.membersUrl;
  $("#invite-free").hidden = !freePlanHint();
  $("#invite-copy").textContent = "Copy invite message";
  card.hidden = false;
  $("#invite-copy").focus({ preventScroll: true });
}
const inviteOpen = () => !$("#invite").hidden;
function closeInvite() {
  if (!inviteOpen()) return false;
  $("#invite").hidden = true;
  return true;
}

// ── clicks ──
// The card: a lot opens it; ✕ or a tap outside closes it.
const inviteClicks = [
  {
    match: () => inviteOpen(),
    run: (_, ev) => {
      if (ev.target.closest("#invite-close")) return closeInvite();
      if (ev.target.closest("#invite-copy")) {
        const b = $("#invite-copy");
        copyText(inviteMessage()).then((ok) => {
          b.textContent = ok ? "Copied" : "Select the text and copy it";
          FX.sfx(ok ? "tick" : "nope");
        });
        return;
      }
      if (ev.target.closest("#invite")) return; // the link inside opens its own new tab
      closeInvite();
      if (ev.target.closest("a.lot[data-invite]")) return NEXT; // another lot: open it again
      // a tap outside only closes it
    },
  },
  {
    match: (ev) => plainClick(ev) && ev.target.closest("a.lot[data-invite]"),
    run: (_, ev) => {
      ev.preventDefault();
      openInvite();
    },
  },
];

export { closeInvite, inviteClicks };
