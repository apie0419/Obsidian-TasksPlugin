# Frontmatter Kanban Board

An Obsidian plugin that creates a Kanban board from Markdown task notes.

Each task is stored as a Markdown file with frontmatter, so Obsidian Bases can read the task data. The Kanban board itself is a custom plugin view, not an embedded Bases view.

## Development

Obsidian loads `main.js` from the plugin root. Maintain the source in `src/main.js`, then build the distributable `main.js`:

```bash
npm install
npm run build
```

For iterative work:

```bash
npm run dev
```

## Current scope

- Drag tasks between status columns.
- Default statuses: `backlog`, `nextup`, `ongoing`, `done`.
- Add, rename, and remove statuses in plugin settings.
- Filter with nested groups: combine groups with AND/OR, and combine each group's conditions with AND/OR.
- Sort by built-in and custom fields, including weighted priority values (`high` = 3, `medium` = 2, `easy`/`low` = 1).
- Compact toolbar controls for creating, refreshing, sorting, and filtering; sort/filter popovers close when clicking outside them.
- Click a task card to edit task frontmatter; double-click or use `Open note` in the edit modal to open the note.
- Due date, create date, complete date, work-on date range, priority, and per-task notification lead time.
- Complete date is applied when status becomes `done` and removed when status changes away from `done`.
- Create task modal and Kanban board commands are available from the command palette and Obsidian Hotkeys settings. Default hotkeys are `Ctrl/Cmd+Shift+T` for create task and `Ctrl/Cmd+Shift+K` for the board.
- Custom fields: text, number, date, datetime, date range, select, checkbox.

Recurrence jobs are intentionally not implemented yet.