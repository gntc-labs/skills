// Fonts for the creator's own words (patch name, owner, welcome note) in scripts the Latin faces don't draw.
// Creepster (titles) and Gochi Hand (the handwritten note) only cover Latin, so "899 的南瓜田" came
// out as Creepster digits next to a random system serif. For text in another script we pick a Google Font that
// matches the mood, as a subset of exactly the characters used (css2 ?text=), so it stays a few KB:
//   display: the patch name (page title, carve-screen tag, Story card, deed, link preview)
//   hand:    the welcome note and the owner's name where it is handwritten (note signature, deed)
// The whole string goes in the script face, digits and Latin included (the subset carries them), so a mixed title
// like "899 的南瓜田" reads as one piece. Pure Latin text keeps Creepster / Gochi Hand. Shared by build.mjs and brand.mjs.
// Each face was checked to draw every character of a sample in its script (Chrome's own font report, CDP
// CSS.getPlatformFontsForNode); `also` are same-mood faces that fill the gaps of the first one (Simplified Chinese
// in a Traditional face), listed after it so the browser only fetches them when needed.
export const SCRIPT_FONTS = [
  // Chinese, Japanese, Korean: Chiron GoRound TC 700 (昭源圓體 Bold) for the title AND the note: a heavy, friendly round
  // face, the creator's pick. It draws Traditional and Simplified hanzi, kana and Hangul itself (checked glyph by glyph).
  { id: "cjk", test: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u,
    display: { family: "Chiron GoRound TC", weight: 700 }, hand: { family: "Chiron GoRound TC", weight: 700 } },
  { id: "th", test: /\p{Script=Thai}/u, display: { family: "Chonburi", weight: 400 }, hand: { family: "Itim", weight: 400 } },
  { id: "ar", test: /\p{Script=Arabic}/u, display: { family: "Lalezar", weight: 400 }, hand: { family: "Reem Kufi Fun", weight: 600 } },
  { id: "he", test: /\p{Script=Hebrew}/u, display: { family: "Rubik Wet Paint", weight: 400 }, hand: null },
  { id: "cyrillic", test: /\p{Script=Cyrillic}/u, display: { family: "Rubik Wet Paint", weight: 400 }, hand: { family: "Caveat", weight: 600 } }, // Gochi Hand has no Cyrillic
  { id: "el", test: /\p{Script=Greek}/u, display: { family: "Noto Serif Display", weight: 900 }, hand: null },
];

// the script face for one string and one role, or null (Latin / no face: keep the page's own font)
export function faceFor(text, role) {
  const s = String(text || "");
  for (const f of SCRIPT_FONTS) if (f.test.test(s)) return f[role] ? { script: f.id, ...f[role] } : null;
  return null;
}

// "899 的南瓜田" already says whose patch it is: the "899's pumpkin patch" kicker above it, and "899's" in front of
// it in the credit line, would say it twice
export const nameHasOwner = (name, owner) => {
  const o = String(owner ?? "").trim().toLocaleLowerCase();
  return !!o && String(name ?? "").trim().toLocaleLowerCase().includes(o);
};

// Everything the page / brand images need for the creator's text: one css2 request for every script face in use,
// subset to the union of their characters, and a font stack per role.
//   fields: { name: "...", welcome: "...", owner: "..." } -> { href, stacks: { name, welcome, owner }, faces }
// stacks[k] is a CSS font-family list ('"Noto Serif TC","Noto Serif SC"') with its weight, or absent for Latin.
const OWNER_WORDS = "~ 's patch pumpkin";
export function scriptFonts(fields, roles = { name: "display", welcome: "hand", owner: "hand" }) {
  const faces = new Map(), stacks = {}, chars = new Set();
  for (const [k, role] of Object.entries(roles)) {
    const text = fields[k]; if (!text) continue;
    const f = faceFor(text, role); if (!f) continue;
    const list = [f, ...(f.also || [])];
    for (const x of list) faces.set(`${x.family}:${x.weight}`, x);
    for (const c of String(text)) chars.add(c);
    // the owner's name also signs the note as "~ <owner>", and reads "<owner>'s patch" on the farm badge and
    // "<owner>'s pumpkin" on the showcase's stake sign: those words come from the same face
    if (k === "owner") for (const c of OWNER_WORDS) chars.add(c);
    stacks[k] = { family: list.map((x) => `"${x.family}"`).join(","), weight: f.weight, script: f.script };
  }
  // a Latin signature under a note in a script face is written in that same hand ("~ 899" under a Chinese note)
  if (roles.owner && !stacks.owner && stacks.welcome && fields.owner) {
    stacks.owner = stacks.welcome;
    for (const c of `${OWNER_WORDS}${fields.owner}`) chars.add(c);
  }
  if (!faces.size) return { href: null, stacks, faces: [] };
  // the space too: left out, it falls back to the next face in the stack (one Creepster glyph inside a CJK title)
  const text = [...chars].map((c) => (/\s/.test(c) ? " " : c)).filter((c, i, a) => a.indexOf(c) === i).sort().join("");
  // one family= per family, its weights joined (css2 refuses the same family twice)
  const weights = new Map();
  for (const x of faces.values()) weights.set(x.family, [...new Set([...(weights.get(x.family) || []), x.weight])].sort((a, b) => a - b));
  const fam = [...weights].map(([f, w]) => `family=${f.replace(/ /g, "+")}:wght@${w.join(";")}`).join("&");
  return { href: `https://fonts.googleapis.com/css2?${fam}&text=${encodeURIComponent(text)}&display=swap`, stacks, faces: [...faces.values()] };
}
