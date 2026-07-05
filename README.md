# Frontmatter Kanban Board

An Obsidian plugin that creates a Kanban board from Markdown task notes.

Each task is stored as a Markdown file with frontmatter, so Obsidian Bases can read the task data.

## Current scope

- Drag tasks between status columns.
- Default statuses: `backlog`, `nextup`, `ongoing`, `done`.
- Add custom statuses in plugin settings.
- Filter and sort by built-in and custom fields.
- Due date, create date, complete date, work-on date range, priority, and per-task notification lead time.
- Complete date is applied when status becomes `done` and removed when status changes away from `done`.
- Create task modal available from the command palette.
- Custom fields: text, number, date, datetime, date range, select, checkbox.

Recurrence jobs are intentionally not implemented yet.
