/**
 * Project Gantt Type Definitions
 * All TypeScript interfaces and types for the plugin
 */

// ===== CORE DATA TYPES =====

export interface Assignee {
  name: string;
  color?: string;
}

export interface Stage {
  id: string;
  name: string;
  type: string;
  start: Date;
  duration: number; // количество календарных дней
  assignee?: Assignee;
  color: string;
}

export interface Milestone {
  id: string;
  name: string;
  date: Date;
  assignee?: Assignee;
  type: string;
  color?: string;
}

export interface Project {
  id: string;
  name: string;
  assignee?: Assignee;
  stages: Stage[];
  milestones: Milestone[];
  layout?: 'inline' | 'multiline'; // inline - все этапы на одной строке, multiline - каждый этап на отдельной строке
}

export interface Sprint {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

export interface GanttData {
  projects: Project[];
  sprints: Sprint[];
  startDate: Date;
  endDate: Date;
  excludeWeekdays: number[]; // 0=воскресенье, 6=суббота
  includeDates: string[]; // Конкретные даты для включения (формат YYYY-MM-DD)
  excludeDates: string[]; // Конкретные даты для исключения (формат YYYY-MM-DD)
}

// ===== SERIALIZABLE DATA TYPES (для JSON) =====

export interface SerializableStage {
  id: string;
  name: string;
  type: string;
  start: string; // ISO date string
  duration: number;
  assignee?: Assignee;
  color: string;
}

export interface SerializableMilestone {
  id: string;
  name: string;
  date: string; // ISO date string
  assignee?: Assignee;
  type: string;
  color?: string;
}

export interface SerializableProject {
  id: string;
  name: string;
  assignee?: Assignee;
  stages: SerializableStage[];
  milestones: SerializableMilestone[];
  layout?: 'inline' | 'multiline';
}

export interface SerializableSprint {
  id: string;
  name: string;
  start: string; // ISO date string
  end: string; // ISO date string
}

export interface SerializableGanttData {
  projects: SerializableProject[];
  sprints: SerializableSprint[];
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  excludeWeekdays: number[];
  includeDates: string[];
  excludeDates: string[];
}

// ===== UI TYPES =====

export interface EditorState {
  selectedProject: Project | null;
  selectedStage: Stage | null;
  selectedMilestone: Milestone | null;
  draggedElement: DraggedElement | null;
  isDragging: boolean;
  isResizing: boolean;
}

export interface DraggedElement {
  type: 'stage' | 'milestone';
  id: string;
  initialData: Stage | Milestone;
}

export interface CellPosition {
  row: number;
  col: number;
}

// ===== RENDER OPTIONS =====

export interface RenderOptions {
  readonly?: boolean;
  blockUuid?: string;
  slotKey?: string;
}

export interface GanttRenderOptions extends RenderOptions {
  showEditButton?: boolean;
  cellWidth?: number;
  cellHeight?: number;
}

// ===== STORAGE TYPES =====

export interface StoredGanttData {
  uuid: string;
  data: GanttData;
}

// ===== COLOR SYSTEM TYPES =====

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export type ThemeMode = 'light' | 'dark';

// ===== PLUGIN TYPES =====

export interface PluginConfig {
  name: string;
  version: string;
  debug?: boolean;
  defaultCellWidth: number;
  defaultCellHeight: number;
}

export interface IGanttRepository {
  save(uuid: string, data: GanttData): Promise<void>;
  load(uuid: string): Promise<GanttData>;
  delete(uuid: string): Promise<void>;
}

// ===== LOGSEQ SDK EVENT TYPES =====

export interface EditorButtonClickEvent {
  dataset?: {
    slotId?: string;
    [key: string]: any;
  };
  slotId?: string;
  'data-slot-id'?: string;
  [key: string]: any;
}

export interface MacroRendererPayload {
  arguments: string[];
  uuid: string;
  [key: string]: any;
}

export interface MacroRendererSlotEvent {
  slot: string;
  payload: MacroRendererPayload;
}

export interface ThemeModeChangedEvent {
  mode: 'light' | 'dark';
}

// ===== UTILITY TYPES =====

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// ===== GEOMETRY TYPES =====

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ===== WORKING DAYS CONFIGURATION =====

export interface WorkingDaysConfig {
  excludeWeekdays: number[]; // 0-6, where 0=Sunday
  includeDates: string[]; // specific dates to include
  excludeDates: string[]; // specific dates to exclude
}
