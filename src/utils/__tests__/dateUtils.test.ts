/**
 * Tests for date utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isWorkingDay,
  getWorkingDaysBetween,
  generateWorkingDaysScale,
  getStageEndDate,
  formatDateISO,
  parseDateISO,
  isSameDay,
  getDayNameRu,
  clampDate,
  addWorkingDays,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('isWorkingDay', () => {
    it('should treat all days as working by default', () => {
      const config = {
        excludeWeekdays: [],
        includeDates: [],
        excludeDates: [],
      };

      const monday = new Date('2024-01-01'); // Monday
      const saturday = new Date('2024-01-06'); // Saturday

      expect(isWorkingDay(monday, config)).toBe(true);
      expect(isWorkingDay(saturday, config)).toBe(true);
    });

    it('should exclude weekends', () => {
      const config = {
        excludeWeekdays: [0, 6], // Sunday, Saturday
        includeDates: [],
        excludeDates: [],
      };

      const monday = new Date('2024-01-01'); // Monday
      const saturday = new Date('2024-01-06'); // Saturday
      const sunday = new Date('2024-01-07'); // Sunday

      expect(isWorkingDay(monday, config)).toBe(true);
      expect(isWorkingDay(saturday, config)).toBe(false);
      expect(isWorkingDay(sunday, config)).toBe(false);
    });

    it('should respect includeDates over excludeWeekdays', () => {
      const config = {
        excludeWeekdays: [6], // Saturday excluded
        includeDates: ['2024-01-06'], // But this Saturday is included
        excludeDates: [],
      };

      const saturday = new Date('2024-01-06');
      expect(isWorkingDay(saturday, config)).toBe(true);
    });

    it('should respect excludeDates over everything', () => {
      const config = {
        excludeWeekdays: [],
        includeDates: ['2024-01-01'], // Explicitly included
        excludeDates: ['2024-01-01'], // But also excluded - exclude wins
      };

      const date = new Date('2024-01-01');
      expect(isWorkingDay(date, config)).toBe(false);
    });
  });

  describe('getWorkingDaysBetween', () => {
    it('should count all days when no exclusions', () => {
      const config = {
        excludeWeekdays: [],
        includeDates: [],
        excludeDates: [],
      };

      const start = new Date('2024-01-01');
      const end = new Date('2024-01-05');

      expect(getWorkingDaysBetween(start, end, config)).toBe(5);
    });

    it('should exclude weekends', () => {
      const config = {
        excludeWeekdays: [0, 6],
        includeDates: [],
        excludeDates: [],
      };

      // Jan 1-7, 2024: Mon-Sun (5 weekdays)
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-07');

      expect(getWorkingDaysBetween(start, end, config)).toBe(5);
    });
  });

  describe('generateWorkingDaysScale', () => {
    it('should generate correct scale', () => {
      const config = {
        excludeWeekdays: [],
        includeDates: [],
        excludeDates: [],
      };

      const start = new Date('2024-01-01');
      const end = new Date('2024-01-03');

      const scale = generateWorkingDaysScale(start, end, config);
      expect(scale).toHaveLength(3);
      expect(scale[0]).toEqual(start);
    });
  });

  describe('getStageEndDate', () => {
    it('should calculate end date correctly', () => {
      const start = new Date('2024-01-01');
      const duration = 5;

      const end = getStageEndDate(start, duration);
      expect(end.getDate()).toBe(6);
    });
  });

  describe('formatDateISO and parseDateISO', () => {
    it('should format and parse dates', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const formatted = formatDateISO(date);

      expect(formatted).toBe('2024-01-15');

      const parsed = parseDateISO(formatted);
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(0);
      expect(parsed.getDate()).toBe(15);
    });
  });

  describe('isSameDay', () => {
    it('should compare dates correctly', () => {
      const date1 = new Date('2024-01-15T10:00:00');
      const date2 = new Date('2024-01-15T20:00:00');
      const date3 = new Date('2024-01-16T10:00:00');

      expect(isSameDay(date1, date2)).toBe(true);
      expect(isSameDay(date1, date3)).toBe(false);
    });
  });

  describe('getDayNameRu', () => {
    it('should return correct Russian day names', () => {
      const monday = new Date('2024-01-01');
      const sunday = new Date('2024-01-07');

      expect(getDayNameRu(monday)).toBe('пн');
      expect(getDayNameRu(sunday)).toBe('вс');
    });
  });

  describe('clampDate', () => {
    it('should clamp date to range', () => {
      const min = new Date('2024-01-01');
      const max = new Date('2024-01-31');

      const before = new Date('2023-12-31');
      const after = new Date('2024-02-01');
      const within = new Date('2024-01-15');

      expect(clampDate(before, min, max)).toEqual(min);
      expect(clampDate(after, min, max)).toEqual(max);
      expect(clampDate(within, min, max)).toEqual(within);
    });
  });

  describe('addWorkingDays', () => {
    it('should add working days correctly', () => {
      const config = {
        excludeWeekdays: [0, 6], // Exclude weekends
        includeDates: [],
        excludeDates: [],
      };

      const monday = new Date('2024-01-01'); // Monday

      // Adding 5 working days should skip weekend
      const result = addWorkingDays(monday, 5, config);
      expect(result.getDate()).toBe(8); // Next Monday
    });
  });
});
