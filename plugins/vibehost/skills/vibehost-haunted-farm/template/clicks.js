// Haunted Farm — the click registry. One document listener tries the page's
// click routes in order. A route is { match(ev) → an element (or true) when
// it applies, run(el, ev) }; the first route that matches ends the click,
// unless its run returns NEXT ("and still does what it was for": close a
// menu, then let the click carry on down the list).

const NEXT = Symbol("next");
/** A route for clicks inside `selector`. */
const inside = (selector, run) => ({ match: (ev) => ev.target.closest(selector), run });
/** A plain left click (no modifier): the kind that may be taken over. */
const plainClick = (ev) => ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey;

function installClicks(routes) {
  document.addEventListener("click", (ev) => {
    for (const route of routes) {
      const el = route.match(ev);
      if (el && route.run(el, ev) !== NEXT) return;
    }
  });
}

export { inside, installClicks, NEXT, plainClick };
