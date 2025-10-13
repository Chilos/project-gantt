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

    it('should decode old format with double encoding (backward compatibility)', () => {
      // Create data in old format (with encodeURIComponent + btoa)
      const testData = {
        projects: [{
          id: 'p1',
          name: 'Test',
          stages: [{
            id: 's1',
            name: 'Stage',
            type: 'Stage',
            start: '2024-01-01',
            duration: 5,
            color: '#FF0000',
          }],
          milestones: [],
        }],
        sprints: [],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        excludeWeekdays: [0, 6],
        includeDates: [],
        excludeDates: [],
      };

      // Encode using old method (double encoding)
      const oldEncoded = btoa(encodeURIComponent(JSON.stringify(testData)));

      // Should successfully decode old format
      const decoded = decodeGanttData(oldEncoded);
      expect(decoded).toBeDefined();
      expect(decoded.projects).toHaveLength(1);
      expect(decoded.projects[0].name).toBe('Test');
      expect(decoded.projects[0].stages[0].name).toBe('Stage');
    });

    it('should restore type field from name when missing (optimization)', () => {
      const original = createDefaultGanttData();
      original.projects = [{
        id: 'proj1',
        name: 'Test',
        stages: [{
          id: 's1',
          name: 'MyStage',
          type: 'MyStage',
          start: new Date('2024-01-01'),
          duration: 5,
          color: '#FF0000',
        }],
        milestones: [{
          id: 'm1',
          name: 'MyMilestone',
          type: 'MyMilestone',
          date: new Date('2024-01-15'),
        }],
      }];

      // Encode (removes type field) and decode (restores type from name)
      const encoded = encodeGanttData(original);
      const decoded = decodeGanttData(encoded);

      expect(decoded.projects[0].stages[0].type).toBe('MyStage');
      expect(decoded.projects[0].milestones[0].type).toBe('MyMilestone');
    });

    it('should produce smaller encoded output than old format', () => {
      const testData = createDefaultGanttData();
      testData.projects = [{
        id: 'p1',
        name: 'Project',
        stages: [
          { id: 's1', name: 'Stage1', type: 'Stage1', start: new Date('2024-01-01'), duration: 5, color: '#FF0000' },
          { id: 's2', name: 'Stage2', type: 'Stage2', start: new Date('2024-01-10'), duration: 3, color: '#00FF00' },
        ],
        milestones: [],
      }];

      // New optimized encoding
      const newEncoded = encodeGanttData(testData);

      // Old double-encoded format (for comparison)
      const json = JSON.stringify({
        ...testData,
        startDate: testData.startDate.toISOString().split('T')[0],
        endDate: testData.endDate.toISOString().split('T')[0],
        projects: testData.projects.map(p => ({
          ...p,
          stages: p.stages.map(s => ({
            ...s,
            start: s.start.toISOString().split('T')[0],
          })),
        })),
      });
      const oldEncoded = btoa(encodeURIComponent(json));

      // New format should be significantly smaller
      expect(newEncoded.length).toBeLessThan(oldEncoded.length);
      expect(newEncoded.length / oldEncoded.length).toBeLessThan(0.6); // At least 40% smaller
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
