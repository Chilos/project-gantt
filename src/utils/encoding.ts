/**
 * Data Encoding/Decoding
 * Handles serialization of Gantt data to/from base64
 */

import type { GanttData, SerializableGanttData } from '../types';
import { getDefaultStartDate, getDefaultEndDate, DEFAULT_EXCLUDE_WEEKDAYS } from './constants';
import { formatDateISO, parseDateISO } from './dateUtils';

/**
 * Создает пустую Gantt диаграмму по умолчанию
 */
export function createDefaultGanttData(): GanttData {
  return {
    projects: [],
    sprints: [],
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
    excludeWeekdays: DEFAULT_EXCLUDE_WEEKDAYS,
    includeDates: [],
    excludeDates: [],
    showTodayLine: true,
  };
}

/**
 * Преобразует GanttData в сериализуемый формат (Date -> string)
 * Оптимизирован для минимального размера: удаляет избыточные поля
 */
export function toSerializable(data: GanttData): SerializableGanttData {
  return {
    projects: data.projects.map(project => ({
      id: project.id,
      name: project.name,
      ...(project.assignee && { assignee: project.assignee }),
      stages: project.stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        // type убран - он дублирует name, восстановим при декодировании
        start: formatDateISO(stage.start),
        duration: stage.duration,
        ...(stage.assignee && { assignee: stage.assignee }),
        color: stage.color,
      })),
      milestones: project.milestones.map(milestone => ({
        id: milestone.id,
        name: milestone.name,
        // type убран - он дублирует name, восстановим при декодировании
        date: formatDateISO(milestone.date),
        ...(milestone.assignee && { assignee: milestone.assignee }),
        ...(milestone.color && { color: milestone.color }),
      })),
      ...(project.layout && { layout: project.layout }),
    })),
    sprints: data.sprints.map(sprint => ({
      id: sprint.id,
      name: sprint.name,
      start: formatDateISO(sprint.start),
      end: formatDateISO(sprint.end),
    })),
    startDate: formatDateISO(data.startDate),
    endDate: formatDateISO(data.endDate),
    excludeWeekdays: data.excludeWeekdays,
    ...(data.includeDates.length > 0 && { includeDates: data.includeDates }),
    ...(data.excludeDates.length > 0 && { excludeDates: data.excludeDates }),
    ...(data.showTodayLine !== undefined && { showTodayLine: data.showTodayLine }),
  };
}

/**
 * Преобразует сериализуемый формат обратно в GanttData (string -> Date)
 * Восстанавливает поля, удаленные при сериализации для оптимизации
 */
export function fromSerializable(data: SerializableGanttData): GanttData {
  return {
    projects: data.projects.map(project => ({
      ...project,
      stages: project.stages.map(stage => ({
        ...stage,
        type: (stage as any).type || stage.name, // Восстанавливаем type из name, если его нет
        start: parseDateISO(stage.start),
      })),
      milestones: project.milestones.map(milestone => ({
        ...milestone,
        type: (milestone as any).type || milestone.name, // Восстанавливаем type из name, если его нет
        date: parseDateISO(milestone.date),
      })),
      layout: project.layout || 'inline',
    })),
    sprints: data.sprints.map(sprint => ({
      ...sprint,
      start: parseDateISO(sprint.start),
      end: parseDateISO(sprint.end),
    })),
    startDate: parseDateISO(data.startDate),
    endDate: parseDateISO(data.endDate),
    excludeWeekdays: data.excludeWeekdays || [],
    includeDates: data.includeDates || [],
    excludeDates: data.excludeDates || [],
    showTodayLine: data.showTodayLine !== undefined ? data.showTodayLine : true,
  };
}

/**
 * Кодирует данные Gantt в base64
 */
export function encodeGanttData(data: GanttData): string {
  try {
    const serializable = toSerializable(data);
    const json = JSON.stringify(serializable);
    // Используем прямое base64 кодирование без encodeURIComponent для меньшего размера
    return btoa(unescape(encodeURIComponent(json)));
  } catch (error) {
    console.error('[Project Gantt] Encoding error:', error);
    throw new Error('Failed to encode gantt data');
  }
}

/**
 * Декодирует данные Gantt из base64
 */
export function decodeGanttData(encoded: string): GanttData {
  try {
    if (!encoded || encoded.trim() === '') {
      return createDefaultGanttData();
    }

    let json: string;
    const decoded = atob(encoded);

    // Проверяем, начинается ли с % (признак encodeURIComponent)
    if (decoded.startsWith('%')) {
      // Старый формат с encodeURIComponent
      json = decodeURIComponent(decoded);
    } else {
      // Новый формат (UTF-8 через escape/unescape)
      json = decodeURIComponent(escape(decoded));
    }

    const serializable = JSON.parse(json) as SerializableGanttData;
    return fromSerializable(serializable);
  } catch (error) {
    console.error('[Project Gantt] Decoding error:', error);
    return createDefaultGanttData();
  }
}

/**
 * Валидирует данные Gantt
 */
export function validateGanttData(data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  // Проверяем обязательные поля
  if (!data.startDate || !data.endDate) return false;
  if (!Array.isArray(data.projects)) return false;
  if (!Array.isArray(data.sprints)) return false;

  return true;
}

/**
 * Санитизирует данные Gantt (удаляет невалидные элементы)
 */
export function sanitizeGanttData(data: GanttData): GanttData {
  // Фильтруем проекты с валидными этапами и мелстоунами
  const sanitizedProjects = data.projects.map(project => ({
    ...project,
    stages: project.stages.filter(stage => {
      // Проверяем что дата начала в пределах временной шкалы
      return stage.start >= data.startDate && stage.start <= data.endDate;
    }),
    milestones: project.milestones.filter(milestone => {
      // Проверяем что дата в пределах временной шкалы
      return milestone.date >= data.startDate && milestone.date <= data.endDate;
    }),
  }));

  // Фильтруем спринты в пределах временной шкалы
  const sanitizedSprints = data.sprints.filter(sprint => {
    return sprint.start >= data.startDate && sprint.end <= data.endDate;
  });

  return {
    ...data,
    projects: sanitizedProjects,
    sprints: sanitizedSprints,
  };
}

/**
 * Генерирует уникальный ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
