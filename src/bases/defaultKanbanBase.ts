import { BASES_KANBAN_VIEW_TYPE, BASES_TIMELINE_VIEW_TYPE, PRIORITY_WEIGHTS, TASK_FOLDER, TASK_TAG } from "../constants";

function escapeBaseString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function formatPriorityWeightFormula() {
  const entries = Object.entries(PRIORITY_WEIGHTS);
  return entries.reduceRight((expression, [priority, weight]) => (
    `if(note.priority == "${priority}", ${weight}, ${expression})`
  ), "0");
}

export function generateDefaultKanbanBase(taskFolder = TASK_FOLDER) {
  const folder = escapeBaseString(taskFolder || TASK_FOLDER);
  return `filters:
  and:
    - note.tags.contains("${TASK_TAG}")
    - file.path.startsWith("${folder}/")
formulas:
  priorityWeight: ${formatPriorityWeightFormula()}
  isOverdue: note.due && date(note.due) < today() && note.status != "done"
  daysUntilDue: if(note.due, ((number(date(note.due)) - number(today())) / 86400000).floor(), null)
views:
  - type: ${BASES_KANBAN_VIEW_TYPE}
    name: Kanban Board
    groupBy:
      property: note.status
      direction: ASC
    order:
      - note.status
      - note.project
      - note.feature
      - note.priority
      - formula.priorityWeight
      - note.due
      - note.work_start
      - note.work_end
      - note.completed
      - file.name
    sort:
      - property: formula.priorityWeight
        direction: DESC
      - property: note.due
        direction: ASC
    options:
      columnWidth: 380
${generateTimelineBaseViewBlock()}
`;
}

export function generateTimelineBaseViewBlock() {
  return `  - type: ${BASES_TIMELINE_VIEW_TYPE}
    name: Timeline
    order:
      - note.status
      - note.project
      - note.feature
      - note.priority
      - formula.priorityWeight
      - note.due
      - note.work_start
      - note.work_end
      - note.completed
      - file.name
    sort:
      - property: note.work_start
        direction: ASC
      - property: formula.priorityWeight
        direction: DESC
      - property: note.due
        direction: ASC
    options:
      dayWidth: 170
      laneHeight: 178
`;
}
