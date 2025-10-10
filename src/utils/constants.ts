/**
 * Plugin Constants
 */

export const PLUGIN_NAME = 'Project Gantt';
export const RENDERER_TYPE = 'project-gantt';

// Default grid configuration
export const DEFAULT_CELL_WIDTH = 30; // ширина одного дня в пикселях
export const DEFAULT_CELL_HEIGHT = 40; // высота строки проекта

// Default dates (1 месяц от сегодня)
export const getDefaultStartDate = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const getDefaultEndDate = (): Date => {
  const today = new Date();
  today.setMonth(today.getMonth() + 1);
  today.setHours(23, 59, 59, 999);
  return today;
};

// Default working days configuration
export const DEFAULT_EXCLUDE_WEEKDAYS: number[] = [0, 6]; // Суббота и воскресенье
export const DEFAULT_INCLUDE_DATES: string[] = [];
export const DEFAULT_EXCLUDE_DATES: string[] = [];

// Default colors for stages
export const DEFAULT_STAGE_COLORS = [
  '#FF6B6B', // Красный
  '#4ECDC4', // Бирюзовый
  '#45B7D1', // Голубой
  '#96CEB4', // Зеленый
  '#FFEAA7', // Желтый
  '#DFE6E9', // Серый
  '#A29BFE', // Фиолетовый
  '#FD79A8', // Розовый
  '#FDCB6E', // Оранжевый
  '#6C5CE7', // Индиго
];

// Default colors for milestones
export const DEFAULT_MILESTONE_COLORS = [
  '#FFD93D', // Золотой
  '#6C5CE7', // Индиго
  '#E17055', // Красно-оранжевый
  '#00B894', // Зеленый
  '#0984E3', // Синий
];

// Default stage names
export const DEFAULT_STAGE_NAMES = [
  'Анализ',
  'Разработка',
  'Тестирование',
  'Деплой',
];

// Default milestone names
export const DEFAULT_MILESTONE_NAMES = [
  'ПСИ',
  'РЕЛИЗ',
  'Деплой',
];

// UI Constants
export const MIN_STAGE_DURATION = 1; // минимальная длительность этапа в днях
export const DRAG_THRESHOLD = 5; // минимальное смещение для начала drag
export const RESIZE_HANDLE_WIDTH = 8; // ширина хендла для resize

// Russian day names
export const DAY_NAMES_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// CSS Classes
export const CSS_CLASSES = {
  CONTAINER: 'gantt-container',
  TABLE: 'gantt-table',
  HEADER: 'gantt-header',
  PROJECT_HEADER: 'gantt-project-header',
  TIME_HEADER: 'gantt-time-header',
  SPRINT_ROW: 'gantt-sprint-row',
  DAY_ROW: 'gantt-day-row',
  PROJECTS: 'gantt-projects',
  PROJECT_ROW: 'gantt-project-row',
  PROJECT_NAME: 'gantt-project-name',
  PROJECT_TIMELINE: 'gantt-project-timeline',
  STAGE: 'gantt-stage',
  MILESTONE: 'gantt-milestone',
  CURRENT_DAY: 'gantt-current-day',
  DRAGGING: 'gantt-dragging',
  RESIZING: 'gantt-resizing',
  BOUNDARY_CONSTRAINT: 'gantt-boundary-constraint',
};
