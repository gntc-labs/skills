# Web research

Load when a deck that is not 快速 / Quick needs facts from the web. 快速 / Quick keeps the rule on the core page.

**Web research.** With `subagent__spawn`, do not search yourself: a page you read stays here and
every later step pays for it. Split the questions in two and call `subagent__spawn`
twice in ONE response (`model: "lite"`, or no `model` if refused; `effort: "low"`; `max_steps: 20`; no `background`). Each prompt carries the topic, the
audience, its half of the questions and this format: one row per number,
`{claim, number+unit, quote, url, title, publisher, date}`, `quote` one sentence word for word; only
pages it opened; a final "not found" list, whose questions have no number.
Refused or missing: search yourself.
