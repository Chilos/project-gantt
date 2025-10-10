/**
 * Tests for encoding utilities
 */

import { describe, it, expect } from 'vitest';
import {
  encodeGanttData,
  decodeGanttData,
  createDefaultGanttData,
  validateGanttData,
  sanitizeGanttData,
  generateId,
} from '../encoding';

describe('encoding utilities', () => {
  describe('createDefaultGanttData', () => {
    it('should create valid default data', () => {
      const data = createDefaultGanttData();

      expect(data).toBeDefined();
      expect(data.projects).toEqual([]);
      expect(data.sprints).toEqual([]);
      expect(data.startDate).toBeInstanceOf(Date);
      expect(data.endDate).toBeInstanceOf(Date);
      expect(data.endDate.getTime()).toBeGreaterThan(data.startDate.getTime());
    });
  });

  describe('validateGanttData', () => {
    it('should validate correct data', () => {
      const data = createDefaultGanttData();
      expect(validateGanttData(data)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(validateGanttData(null)).toBe(false);
      expect(validateGanttData({})).toBe(false);
      expect(validateGanttData({ startDate: new Date() })).toBe(false);
    });
  });

  describe('encodeGanttData and decodeGanttData', () => {
    it('should encode and decode data correctly', () => {
      const original = createDefaultGanttData();
      original.projects = [{
        id: 'proj1',
        name: 'Test Project',
        stages: [{
          id: 'stage1',
          name: 'Stage 1',
          type: 'development',
          start: new Date('2024-01-01'),
          duration: 5,
          color: '#FF6B6B',
        }],
        milestones: [{
          id: 'mile1',
          name: 'Milestone 1',
          date: new Date('2024-01-05'),
          type: 'release',
        }],
      }];

      const encoded = encodeGanttData(original);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');

      const decoded = decodeGanttData(encoded);
      expect(decoded.projects).toHaveLength(1);
      expect(decoded.projects[0].name).toBe('Test Project');
      expect(decoded.projects[0].stages[0].duration).toBe(5);
    });

    it('should handle empty encoded string', () => {
      const decoded = decodeGanttData('');
      expect(decoded).toBeDefined();
      expect(decoded.projects).toEqual([]);
    });

    it('should handle invalid encoded string', () => {
      const decoded = decodeGanttData('invalid-base64');
      expect(decoded).toBeDefined();
      expect(decoded.projects).toEqual([]);
    });
  });

  describe('sanitizeGanttData', () => {
    it('should remove stages outside date range', () => {
      const data = createDefaultGanttData();
      data.startDate = new Date('2024-01-01');
      data.endDate = new Date('2024-01-31');

      data.projects = [{
        id: 'proj1',
        name: 'Project',
        stages: [
          {
            id: 'stage1',
            name: 'Valid Stage',
            type: 'dev',
            start: new Date('2024-01-15'),
            duration: 5,
            color: '#FF6B6B',
          },
          {
            id: 'stage2',
            name: 'Invalid Stage',
            type: 'dev',
            start: new Date('2024-02-15'), // Outside range
            duration: 5,
            color: '#FF6B6B',
          },
        ],
        milestones: [],
      }];

      const sanitized = sanitizeGanttData(data);
      expect(sanitized.projects[0].stages).toHaveLength(1);
      expect(sanitized.projects[0].stages[0].name).toBe('Valid Stage');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });
  });
});
