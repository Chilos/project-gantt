/**
 * Position Utilities
 * Helper functions for calculating positions on the Gantt timeline
 */

import type { WorkingDaysConfig } from '../types';
import { getWorkingDaysBetween, addWorkingDays, isWorkingDay, getWeekStart } from './dateUtils';

/**
 * Получает позицию даты на временной шкале (в пикселях)
 * Поддерживает режимы 'day' и 'week'
 */
export function getDatePosition(
  startDate: Date,
  targetDate: Date,
  cellWidth: number,
  config: WorkingDaysConfig,
  timeScale: 'day' | 'week' = 'day'
): number {
  if (timeScale === 'week') {
    // Для недельного режима считаем количество недель между понедельниками
    const startWeek = getWeekStart(startDate);
    const targetWeek = getWeekStart(targetDate);
    const weeksDiff = Math.floor((targetWeek.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(0, weeksDiff) * cellWidth;
  }

  const workingDays = getWorkingDaysBetween(startDate, targetDate, config);
  // Если дата = startDate, workingDays = 1, позиция должна быть 0
  return Math.max(0, workingDays - 1) * cellWidth;
}

/**
 * Получает дату из позиции на временной шкале
 * Поддерживает режимы 'day' и 'week'
 */
export function getDateFromPosition(
  startDate: Date,
  position: number,
  cellWidth: number,
  config: WorkingDaysConfig,
  timeScale: 'day' | 'week' = 'day'
): Date {
  if (timeScale === 'week') {
    // Для недельного режима добавляем недели
    const weekIndex = Math.round(position / cellWidth);
    const startWeek = getWeekStart(startDate);
    const result = new Date(startWeek);
    result.setDate(result.getDate() + weekIndex * 7);
    return result;
  }

  const workingDayIndex = Math.round(position / cellWidth);

  // Позиция 0 = первый рабочий день (может быть startDate или позже, если startDate - выходной)
  if (workingDayIndex <= 0) {
    // Находим первый рабочий день, начиная со startDate
    const current = new Date(startDate);
    while (!isWorkingDay(current, config)) {
      current.setDate(current.getDate() + 1);
    }
    return current;
  }

  // Находим первый рабочий день, начиная со startDate
  const firstWorkingDay = new Date(startDate);
  while (!isWorkingDay(firstWorkingDay, config)) {
    firstWorkingDay.setDate(firstWorkingDay.getDate() + 1);
  }

  // Добавляем оставшиеся рабочие дни
  return addWorkingDays(firstWorkingDay, workingDayIndex, config);
}

/**
 * Получает границы позиций для временной шкалы
 * Поддерживает режимы 'day' и 'week'
 */
export function getPositionLimits(
  startDate: Date,
  endDate: Date,
  cellWidth: number,
  config: WorkingDaysConfig,
  timeScale: 'day' | 'week' = 'day'
): { minPosition: number; maxPosition: number } {
  const minPosition = 0;
  // maxPosition должен включать весь последний день/неделю, добавляем +1 cellWidth
  const maxPosition = getDatePosition(startDate, endDate, cellWidth, config, timeScale) + cellWidth;

  return { minPosition, maxPosition };
}

/**
 * Округляет позицию к ближайшей сетке дней
 */
export function snapToGrid(position: number, cellWidth: number): number {
  return Math.round(position / cellWidth) * cellWidth;
}

/**
 * Ограничивает позицию элемента в пределах временной шкалы
 */
export function constrainPosition(
  position: number,
  elementWidth: number,
  minPosition: number,
  maxPosition: number
): number {
  // Убеждаемся что элемент не выходит за левую границу
  const constrainedLeft = Math.max(minPosition, position);

  // Убеждаемся что элемент не выходит за правую границу
  const constrainedRight = Math.min(maxPosition - elementWidth, constrainedLeft);

  return Math.max(minPosition, constrainedRight);
}

/**
 * Проверяет достигнута ли граница
 */
export function isAtBoundary(
  position: number,
  elementWidth: number,
  minPosition: number,
  maxPosition: number
): boolean {
  return position <= minPosition || (position + elementWidth) >= maxPosition;
}

/**
 * Вычисляет длительность в днях из ширины элемента
 */
export function getDurationFromWidth(width: number, cellWidth: number): number {
  return Math.max(1, Math.round(width / cellWidth));
}

/**
 * Вычисляет ширину элемента из длительности в днях
 */
export function getWidthFromDuration(duration: number, cellWidth: number): number {
  return duration * cellWidth;
}

/**
 * Вычисляет конечную дату этапа
 */
export function calculateEndDate(startDate: Date, duration: number): Date {
  return new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
}

/**
 * Проверяет попадает ли точка в прямоугольник (для определения кликов)
 */
export function isPointInRect(
  pointX: number,
  pointY: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    pointX >= rect.x &&
    pointX <= rect.x + rect.width &&
    pointY >= rect.y &&
    pointY <= rect.y + rect.height
  );
}

/**
 * Получает относительную позицию мыши относительно элемента
 */
export function getRelativeMousePosition(
  mouseX: number,
  mouseY: number,
  element: HTMLElement
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: mouseX - rect.left,
    y: mouseY - rect.top,
  };
}
