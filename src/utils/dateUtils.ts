/**
 * Date Utilities
 * Helper functions for date calculations and working days
 */

import type { WorkingDaysConfig } from '../types';

/**
 * Проверяет является ли день рабочим
 */
export function isWorkingDay(date: Date, config: WorkingDaysConfig): boolean {
  const dateStr = formatDateISO(date);
  const dayOfWeek = date.getDay();

  // Проверяем конкретные даты исключения (приоритет над всем)
  if (config.excludeDates.includes(dateStr)) {
    return false;
  }

  // Проверяем конкретные даты включения (приоритет над днями недели)
  if (config.includeDates.includes(dateStr)) {
    return true;
  }

  // Проверяем исключенные дни недели
  if (config.excludeWeekdays.includes(dayOfWeek)) {
    return false;
  }

  // По умолчанию все дни рабочие (если не исключены выше)
  return true;
}

/**
 * Считает количество рабочих дней между двумя датами (включительно)
 */
export function getWorkingDaysBetween(start: Date, end: Date, config: WorkingDaysConfig): number {
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (isWorkingDay(current, config)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Генерирует массив всех рабочих дней в диапазоне
 */
export function generateWorkingDaysScale(startDate: Date, endDate: Date, config: WorkingDaysConfig): Date[] {
  const scale: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    if (isWorkingDay(current, config)) {
      scale.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return scale;
}

/**
 * Получает дату окончания этапа (start + duration календарных дней)
 */
export function getStageEndDate(start: Date, duration: number): Date {
  return new Date(start.getTime() + duration * 24 * 60 * 60 * 1000);
}

/**
 * Форматирует дату в ISO строку (YYYY-MM-DD) в локальном часовом поясе
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Парсит ISO строку в дату (в локальном часовом поясе, без UTC)
 */
export function parseDateISO(dateStr: string): Date {
  // Разбираем дату вручную, чтобы избежать проблем с часовыми поясами
  const [year, month, day] = dateStr.split('-').map(Number);
  // month - 1 потому что месяцы в JS начинаются с 0
  return new Date(year, month - 1, day);
}

/**
 * Проверяет что две даты это один и тот же день
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.toDateString() === date2.toDateString();
}

/**
 * Получает название дня недели на русском
 */
export function getDayNameRu(date: Date): string {
  const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return dayNames[date.getDay()];
}

/**
 * Ограничивает дату в пределах диапазона
 */
export function clampDate(date: Date, minDate: Date, maxDate: Date): Date {
  if (date < minDate) return new Date(minDate);
  if (date > maxDate) return new Date(maxDate);
  return new Date(date);
}

/**
 * Добавляет рабочие дни к дате
 */
export function addWorkingDays(start: Date, workingDays: number, config: WorkingDaysConfig): Date {
  const current = new Date(start);
  let addedDays = 0;

  while (addedDays < workingDays) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current, config)) {
      addedDays++;
    }
  }

  return current;
}

/**
 * Получает сегодняшнюю дату без времени
 */
export function getToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Создает копию даты
 */
export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

/**
 * Получает начало недели (понедельник или воскресенье в зависимости от настройки)
 * @param date - Дата для которой нужно найти начало недели
 * @param weekStartsOn - День начала недели: 0 = воскресенье, 1 = понедельник (по умолчанию 1)
 */
export function getWeekStart(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const result = new Date(date);
  const day = result.getDay();

  let diff: number;
  if (weekStartsOn === 1) {
    // Неделя начинается с понедельника
    diff = day === 0 ? -6 : 1 - day;
  } else {
    // Неделя начинается с воскресенья
    diff = -day;
  }

  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);

  return result;
}

/**
 * Получает конец недели (суббота или воскресенье в зависимости от настройки)
 * @param date - Дата для которой нужно найти конец недели
 * @param weekStartsOn - День начала недели: 0 = воскресенье, 1 = понедельник (по умолчанию 1)
 */
export function getWeekEnd(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const weekStart = getWeekStart(date, weekStartsOn);
  const result = new Date(weekStart);
  result.setDate(result.getDate() + 6);
  return result;
}

/**
 * Генерирует массив всех недель в диапазоне
 * @param startDate - Дата начала диапазона
 * @param endDate - Дата окончания диапазона
 * @param weekStartsOn - День начала недели: 0 = воскресенье, 1 = понедельник (по умолчанию 1)
 */
export function generateWeeksScale(startDate: Date, endDate: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const scale: Date[] = [];
  const current = getWeekStart(startDate, weekStartsOn);
  const end = getWeekEnd(endDate, weekStartsOn);

  while (current <= end) {
    scale.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  return scale;
}

/**
 * Получает номер недели в году (ISO 8601)
 * @param date - Дата для которой нужно получить номер недели
 * @returns Номер недели (1-53)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Форматирует неделю как номер недели в году (например, "40")
 * @param weekStart - Начало недели
 * @param weekStartsOn - День начала недели: 0 = воскресенье, 1 = понедельник (по умолчанию 1)
 */
export function formatWeekRange(weekStart: Date, weekStartsOn: 0 | 1 = 1): string {
  const weekNumber = getWeekNumber(weekStart);
  return `${weekNumber}`;
}

/**
 * Привязывает дату к началу недели, в которой больше дней от заданного диапазона
 * Если дата попадает в середину недели, выбираем неделю в которой больше дней от start до end
 * @param date - Дата для привязки
 * @param start - Начало диапазона
 * @param end - Конец диапазона
 * @param weekStartsOn - День начала недели: 0 = воскресенье, 1 = понедельник (по умолчанию 1)
 */
export function snapToWeekBoundary(date: Date, start: Date, end: Date, weekStartsOn: 0 | 1 = 1): Date {
  const weekStart = getWeekStart(date, weekStartsOn);
  const weekEnd = getWeekEnd(date, weekStartsOn);

  // Считаем сколько дней спринта попадает в текущую неделю
  const overlapStart = date > weekStart ? date : weekStart;
  const overlapEnd = end < weekEnd ? end : weekEnd;
  const daysInCurrentWeek = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);

  // Считаем сколько дней спринта попадает в следующую неделю
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = getWeekEnd(nextWeekStart, weekStartsOn);
  const nextOverlapStart = start > nextWeekStart ? start : nextWeekStart;
  const nextOverlapEnd = end < nextWeekEnd ? end : nextWeekEnd;
  const daysInNextWeek = Math.max(0, Math.ceil((nextOverlapEnd.getTime() - nextOverlapStart.getTime()) / (24 * 60 * 60 * 1000)) + 1);

  // Если в следующей неделе больше дней спринта, возвращаем начало следующей недели
  if (daysInNextWeek > daysInCurrentWeek) {
    return nextWeekStart;
  }

  // Иначе возвращаем начало текущей недели
  return weekStart;
}
