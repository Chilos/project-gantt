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
 * Форматирует дату в ISO строку (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Парсит ISO строку в дату
 */
export function parseDateISO(dateStr: string): Date {
  return new Date(dateStr);
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
