# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project Gantt для Logseq** - интерактивный плагин диаграммы Ганта для управления проектами в Logseq. Плагин сочетает архитектуру от cardbord с функциональностью Gantt-диаграмм из project-gantt-obsidian.

## Build Commands

```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev

# Build production
npm run build

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Test coverage
npm run test:coverage
```

## Architecture

### Project Structure

```
src/
├── core/           # Core business logic
│   └── GanttManager.ts  # Manages Gantt data (projects, stages, sprints, milestones)
├── storage/        # Data persistence layer
│   └── GanttDataManager.ts  # Saves/loads data to/from Logseq blocks
├── ui/             # User interface components
│   ├── GanttRenderer.ts     # HTML rendering of Gantt timeline
│   └── VisualEditor.ts      # Drag-and-drop interactive editor
├── utils/          # Utility functions
│   ├── colorSystem.ts   # Adaptive colors based on Logseq theme
│   ├── constants.ts     # Plugin constants
│   ├── dateUtils.ts     # Date calculations & working days logic
│   ├── encoding.ts      # Base64 serialization/deserialization
│   └── positionUtils.ts # Position calculations for timeline
├── styles/         # CSS styles
│   └── gantt.css       # Main Gantt chart styles
├── types/          # TypeScript type definitions
│   └── index.ts
├── plugin.ts       # Main plugin class
└── index.ts        # Entry point
```

### Key Architectural Patterns

1. **Data Storage**:
   - Uses base64-encoded JSON in Logseq renderer macros: `{{renderer project-gantt, <base64-data>}}`
   - GanttDataManager handles all interactions with Logseq Editor API
   - Data persists in Logseq blocks, survives page reloads

2. **Date Handling**:
   - All dates stored as Date objects internally
   - Serialized to ISO strings (YYYY-MM-DD) for storage
   - Working days logic supports: excludeWeekdays, includeDates, excludeDates

3. **Color System**:
   - ColorSystem adapts to Logseq light/dark themes
   - Generates contrasting text colors automatically
   - Theme changes trigger color regeneration

4. **Plugin Lifecycle**:
   - Entry point: src/index.ts
   - Main class: ProjectGanttPlugin in src/plugin.ts
   - Initialization: logseq.ready() → plugin.initialize()
   - Cleanup: logseq.beforeunload() → plugin.cleanup()

## Data Model

### Core Types

- **GanttData**: Root data structure containing projects, sprints, date range, working days config
- **Project**: Container for stages and milestones, supports inline/multiline layouts
- **Stage**: Time-boxed work period with start date and duration (calendar days)
- **Milestone**: Single-day marker/milestone
- **Sprint**: Time range grouping for multiple projects

### Working Days Logic

Priority order (highest to lowest):
1. excludeDates - specific dates to exclude (holidays)
2. includeDates - specific dates to include (working weekend days)
3. excludeWeekdays - weekdays to exclude (0=Sunday, 6=Saturday)
4. Default: all days are working days

## Development Guidelines

### Adding New Features

1. **New data types**: Add to src/types/index.ts
2. **New utilities**: Add to appropriate file in src/utils/
3. **Business logic**: Extend GanttManager in src/core/
4. **UI components**: Add to src/ui/ (to be created)
5. **Storage logic**: Extend GanttDataManager in src/storage/

### Styling

- Use Logseq CSS variables: `--ls-primary-background-color`, `--ls-link-text-color`, etc.
- Support both light and dark themes
- Inline styles in plugin.ts registerStyles() method

### State Management

- plugin.ts maintains:
  - slotUuidMap: Maps renderer slots to block UUIDs
  - slotDataMap: Maps slots to last rendered data
  - These enable proper editor opening and data refresh

### Serialization

- **Encoding**: GanttData → SerializableGanttData → JSON → base64
- **Decoding**: base64 → JSON → SerializableGanttData → GanttData
- SerializableGanttData uses ISO strings for dates
- Always validate and sanitize decoded data

## Common Tasks

### Adding a New Stage Property

1. Update Stage type in src/types/index.ts
2. Update SerializableStage in src/types/index.ts
3. Update toSerializable/fromSerializable in src/utils/encoding.ts
4. Add UI rendering logic (when UI is implemented)

### Implementing Drag-and-Drop

Reference project-gantt-obsidian/main.ts:
- handleMouseDown: Start drag/resize
- handleMouseMove: Update position during drag
- handleMouseUp: Finalize position, update data, trigger re-render
- Key: Preserve positions during render with Map<id, position>

### Adding Working Days Configuration

Working days logic is in src/utils/dateUtils.ts:
- isWorkingDay(): Checks if a date is a working day
- getWorkingDaysBetween(): Counts working days in range
- generateWorkingDaysScale(): Creates array of all working days

## UI Components

### GanttRenderer (src/ui/GanttRenderer.ts)

Renders the complete Gantt chart HTML:
- **Timeline**: Working days scale with day names (пн, вт, ср...)
- **Sprints**: Visual sprint rows with boundaries
- **Projects**: Project rows with stages and milestones
- **Stages**: Color-coded bars with duration, name, and assignee
- **Milestones**: Diamond-shaped markers with tooltips
- **Current day**: Highlighted in timeline

Key methods:
- `render(data, options)`: Main rendering method
- `renderHeader()`: Timeline header with days/sprints
- `renderProjects()`: All project rows
- `renderStage()`: Individual stage with positioning
- `renderMilestone()`: Individual milestone marker

### VisualEditor (src/ui/VisualEditor.ts)

Interactive drag-and-drop editor:
- **Drag stages**: Move stages along timeline
- **Resize stages**: Adjust duration via right handle
- **Drag milestones**: Reposition milestone markers
- **Boundary constraints**: Elements stay within timeline limits
- **Auto-save**: Changes persist to Logseq blocks

Key methods:
- `setupEventListeners()`: Initialize drag handlers
- `handleMouseDown()`: Start drag/resize
- `handleMouseMove()`: Update position during drag
- `handleMouseUp()`: Finalize and save changes
- `updateItemPosition()`: Update data model from UI

### Position Calculations (src/utils/positionUtils.ts)

Handles all timeline positioning:
- `getDatePosition()`: Date → pixel position
- `getDateFromPosition()`: Pixel position → date
- `snapToGrid()`: Round to nearest day
- `constrainPosition()`: Keep within boundaries
- `getDurationFromWidth()`: Width → duration in days

## Current Features (Implemented)

1. ✅ **Interactive Timeline** - Full drag-and-drop interface
2. ✅ **Resize Handles** - Right-side handle for duration adjustment
3. ✅ **Working Days Support** - excludeWeekdays, includeDates, excludeDates
4. ✅ **Sprint Visualization** - Visual sprint boundaries
5. ✅ **Auto-save** - Changes automatically persist
6. ✅ **Boundary Constraints** - Visual feedback when hitting limits
7. ✅ **Inline/Multiline Layouts** - Flexible project display
8. ✅ **Theme Support** - Adapts to Logseq light/dark themes

## Future Development

### Planned Features

1. **Modal Editor UI** - Full-screen editor with sidebar controls
2. **Add/Remove Elements** - UI for creating new stages/milestones
3. **Context Menus** - Right-click for edit/delete options
4. **Keyboard Shortcuts** - Arrow keys for nudging, Delete for removing
5. **Undo/Redo** - Action history management

### Code to Reference

From **cardbord**:
- src/ui/VisualEditor.ts - Modal editor pattern
- src/ui/GridRenderer.ts - HTML rendering approach
- src/ui/ArrowRenderer.ts - SVG rendering example

From **project-gantt-obsidian**:
- main.ts lines 1028-1307 - Complete drag-and-drop implementation
- main.ts lines 820-970 - Stage and milestone rendering
- main.ts lines 1449-1556 - Date positioning logic

## Testing

- Use Vitest for unit tests
- Test files: src/**/__tests__/*.test.ts
- Key areas to test:
  - encoding/decoding (utils/encoding.ts)
  - date calculations (utils/dateUtils.ts)
  - data sanitization
  - GanttManager operations

## Important Notes

- Never modify Logseq blocks directly - always use logseq.Editor API
- Always sanitize data after decoding from base64
- Dates must be timezone-aware (use midnight UTC for date-only values)
- Render slots are reused - clean up old event listeners properly
- CSS uses Logseq CSS variables for theme compatibility
