/**
 * Position Utilities
 * Helper functions for calculating positions on the Gantt timeline
 */

import type { WorkingDaysConfig } from '../types';
import { getWorkingDaysBetween, addWorkingDays, clampDate } from './dateUtils';

/**
 * Получает позицию даты на временной шкале (в пикселях)
 */
export function getDatePosition(
  startDate: Date,
  targetDate: Date,
  cellWidth: number,
  config: WorkingDaysConfig
): number {
  const workingDays = getWorkingDaysBetween(startDate, targetDate, config);
  // Если дата = startDate, workingDays = 1, позиция должна быть 0
  return Math.max(0, workingDays - 1) * cellWidth;
}

/**
 * Получает дату из позиции на временной шкале
 */
export function getDateFromPosition(
  startDate: Date,
  position: number,
  cellWidth: number,
  config: WorkingDaysConfig
): Date {
  const workingDays = Math.round(position / cellWidth);

  // Позиция 0 = startDate
  if (workingDays <= 0) {
    return new Date(startDate);
  }

  // Добавляем рабочие дни к startDate
  return addWorkingDays(startDate, workingDays, config);
}

/**
 * Получает границы позиций для временной шкалы
 */
export function getPositionLimits(
  startDate: Date,
  endDate: Date,
  cellWidth: number,
  config: WorkingDaysConfig
): { minPosition: number; maxPosition: number } {
  const minPosition = 0;
  const maxPosition = getDatePosition(startDate, endDate, cellWidth, config);

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
