/**
 * Tests for position utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getDatePosition,
  getDateFromPosition,
  getPositionLimits,
  snapToGrid,
  constrainPosition,
  isAtBoundary,
  getDurationFromWidth,
  getWidthFromDuration,
  calculateEndDate,
  isPointInRect,
} from '../positionUtils';

describe('positionUtils', () => {
  const config = {
    excludeWeekdays: [0, 6], // Sunday, Saturday
    includeDates: [],
    excludeDates: [],
  };

  const cellWidth = 40;

  describe('getDatePosition', () => {
    it('should return 0 for start date', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const position = getDatePosition(startDate, startDate, cellWidth, config);
      expect(position).toBe(0);
    });

    it('should calculate correct position for weekdays', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const targetDate = new Date('2024-01-03'); // Wednesday
      const position = getDatePosition(startDate, targetDate, cellWidth, config);
      // Mon to Wed = 2 working days difference = 2 * 40 = 80
      expect(position).toBe(80);
    });

    it('should skip weekends', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const targetDate = new Date('2024-01-08'); // Next Monday
      const position = getDatePosition(startDate, targetDate, cellWidth, config);
      // Mon to next Mon = 5 working days (Tue-Sat skipped) = 5 * 40 = 200
      expect(position).toBe(200);
    });
  });

  describe('getDateFromPosition', () => {
    it('should return start date for position 0', () => {
      const startDate = new Date('2024-01-01');
      const result = getDateFromPosition(startDate, 0, cellWidth, config);
      expect(result.toDateString()).toBe(startDate.toDateString());
    });

    it('should calculate correct date from position', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const position = 80; // 2 cells
      const result = getDateFromPosition(startDate, position, cellWidth, config);
      // Should be Wednesday
      expect(result.getDate()).toBe(3);
    });
  });

  describe('getPositionLimits', () => {
    it('should calculate correct limits', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-05');
      const limits = getPositionLimits(startDate, endDate, cellWidth, config);

      expect(limits.minPosition).toBe(0);
      expect(limits.maxPosition).toBeGreaterThan(0);
    });
  });

  describe('snapToGrid', () => {
    it('should snap to nearest grid position', () => {
      expect(snapToGrid(35, cellWidth)).toBe(40);
      expect(snapToGrid(45, cellWidth)).toBe(40);
      expect(snapToGrid(60, cellWidth)).toBe(80);
      expect(snapToGrid(0, cellWidth)).toBe(0);
    });
  });

  describe('constrainPosition', () => {
    it('should not constrain position within bounds', () => {
      const position = 100;
      const elementWidth = 40;
      const min = 0;
      const max = 400;

      const result = constrainPosition(position, elementWidth, min, max);
      expect(result).toBe(100);
    });

    it('should constrain position at left boundary', () => {
      const position = -50;
      const elementWidth = 40;
      const min = 0;
      const max = 400;

      const result = constrainPosition(position, elementWidth, min, max);
      expect(result).toBe(0);
    });

    it('should constrain position at right boundary', () => {
      const position = 400;
      const elementWidth = 80;
      const min = 0;
      const max = 400;

      const result = constrainPosition(position, elementWidth, min, max);
      expect(result).toBe(320); // 400 - 80
    });
  });

  describe('isAtBoundary', () => {
    it('should detect left boundary', () => {
      expect(isAtBoundary(0, 40, 0, 400)).toBe(true);
      expect(isAtBoundary(-10, 40, 0, 400)).toBe(true);
    });

    it('should detect right boundary', () => {
      expect(isAtBoundary(360, 40, 0, 400)).toBe(true);
      expect(isAtBoundary(400, 40, 0, 400)).toBe(true);
    });

    it('should not detect boundary for middle positions', () => {
      expect(isAtBoundary(100, 40, 0, 400)).toBe(false);
      expect(isAtBoundary(200, 40, 0, 400)).toBe(false);
    });
  });

  describe('getDurationFromWidth', () => {
    it('should calculate duration from width', () => {
      expect(getDurationFromWidth(40, cellWidth)).toBe(1);
      expect(getDurationFromWidth(80, cellWidth)).toBe(2);
      expect(getDurationFromWidth(120, cellWidth)).toBe(3);
    });

    it('should round to nearest day', () => {
      expect(getDurationFromWidth(50, cellWidth)).toBe(1);
      expect(getDurationFromWidth(70, cellWidth)).toBe(2);
    });

    it('should return minimum of 1 day', () => {
      expect(getDurationFromWidth(0, cellWidth)).toBe(1);
      expect(getDurationFromWidth(10, cellWidth)).toBe(1);
    });
  });

  describe('getWidthFromDuration', () => {
    it('should calculate width from duration', () => {
      expect(getWidthFromDuration(1, cellWidth)).toBe(40);
      expect(getWidthFromDuration(2, cellWidth)).toBe(80);
      expect(getWidthFromDuration(5, cellWidth)).toBe(200);
    });
  });

  describe('calculateEndDate', () => {
    it('should calculate end date correctly', () => {
      const startDate = new Date('2024-01-01');
      const duration = 5;

      const endDate = calculateEndDate(startDate, duration);
      expect(endDate.getDate()).toBe(6); // Jan 1 + 5 days = Jan 6
    });

    it('should handle month boundaries', () => {
      const startDate = new Date('2024-01-30');
      const duration = 5;

      const endDate = calculateEndDate(startDate, duration);
      expect(endDate.getMonth()).toBe(1); // February
      expect(endDate.getDate()).toBe(4); // Feb 4
    });
  });

  describe('isPointInRect', () => {
    const rect = { x: 100, y: 100, width: 200, height: 100 };

    it('should detect point inside rectangle', () => {
      expect(isPointInRect(150, 150, rect)).toBe(true);
      expect(isPointInRect(200, 150, rect)).toBe(true);
      expect(isPointInRect(250, 180, rect)).toBe(true);
    });

    it('should detect point outside rectangle', () => {
      expect(isPointInRect(50, 150, rect)).toBe(false);
      expect(isPointInRect(350, 150, rect)).toBe(false);
      expect(isPointInRect(150, 50, rect)).toBe(false);
      expect(isPointInRect(150, 250, rect)).toBe(false);
    });

    it('should handle boundary points', () => {
      expect(isPointInRect(100, 100, rect)).toBe(true); // top-left corner
      expect(isPointInRect(300, 200, rect)).toBe(true); // bottom-right corner
    });
  });
});
