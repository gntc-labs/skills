# Charts, tables and flowcharts

Load when a slide carries a chart, a table or a process.

`dock_slides_compose` takes `chart` and `table` on a layout whose `guide.family` matches. Otherwise:

- `dock_slides_upsert_table` / `dock_slides_upsert_chart` — when a slide needs a table or chart the
  compose shapes do not cover, or to change the data of one that exists.
- `dock_slides_add_flowchart` — a process or flow, in place of boxes and arrows placed one by one.

Draw each source number in its own proportion, and read the layout from the write's answer (`dock-slides/edit`, Answers).
