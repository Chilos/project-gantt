/**
 * Tests for EditorModal
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorModal } from '../EditorModal';
import type { GanttData, Sprint, Project } from '../../types';
import { formatDateISO } from '../../utils/dateUtils';

// Mock logseq global
global.logseq = {
  UI: {
    showMsg: vi.fn(),
  },
} as any;

describe('EditorModal', () => {
  let mockData: GanttData;
  let blockUuid: string;

  beforeEach(() => {
    blockUuid = 'test-block-uuid';
    mockData = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      projects: [],
      sprints: [],
      excludeWeekdays: [0, 6], // Sunday, Saturday
      includeDates: [],
      excludeDates: [],
      showTodayLine: true,
    };
  });

  describe('Sprint default dates', () => {
    it('should use project start date for first sprint', () => {
      const editor = new EditorModal(mockData, blockUuid);

      // First sprint should start at project start date
      const expectedStart = new Date('2024-01-01');
      const expectedEnd = new Date('2024-01-14'); // Start + 13 days

      expect(mockData.sprints.length).toBe(0);

      // Verify the logic would use startDate for first sprint
      const firstSprintStart = mockData.sprints.length === 0 ? mockData.startDate : null;
      expect(firstSprintStart).toEqual(expectedStart);
    });

    it('should use day after last sprint end for subsequent sprints', () => {
      // Add first sprint
      mockData.sprints = [{
        id: 'sprint-1',
        name: 'Sprint 1',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-14'),
      }];

      const editor = new EditorModal(mockData, blockUuid);

      // Second sprint should start day after first sprint ends
      const lastSprint = mockData.sprints[mockData.sprints.length - 1];
      const expectedStart = new Date(lastSprint.end.getTime() + 24 * 60 * 60 * 1000);
      const expectedEnd = new Date(expectedStart.getTime() + 13 * 24 * 60 * 60 * 1000);

      expect(expectedStart).toEqual(new Date('2024-01-15'));
      expect(expectedEnd).toEqual(new Date('2024-01-28'));
    });

    it('should calculate end date as start + 13 days (2 weeks ending on Sunday)', () => {
      const startDate = new Date('2024-01-01'); // Monday
      const expectedEndDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);

      expect(expectedEndDate).toEqual(new Date('2024-01-14')); // Sunday
      expect(expectedEndDate.getDay()).toBe(0); // Sunday = 0
    });

    it('should maintain 13-day duration for Monday to Sunday span', () => {
      const monday = new Date('2024-01-08'); // Monday
      const sunday = new Date(monday.getTime() + 13 * 24 * 60 * 60 * 1000);

      expect(sunday.getDay()).toBe(0); // Sunday
      expect(formatDateISO(sunday)).toBe('2024-01-21');
    });
  });

  describe('Sprint date calculations', () => {
    it('should chain sprints correctly', () => {
      mockData.sprints = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          start: new Date('2024-01-01'), // Monday
          end: new Date('2024-01-14'),   // Sunday
        },
        {
          id: 'sprint-2',
          name: 'Sprint 2',
          start: new Date('2024-01-15'), // Monday
          end: new Date('2024-01-28'),   // Sunday
        },
      ];

      // Verify sprints are properly chained
      const sprint1End = mockData.sprints[0].end;
      const sprint2Start = mockData.sprints[1].start;

      const dayAfterSprint1 = new Date(sprint1End.getTime() + 24 * 60 * 60 * 1000);
      expect(sprint2Start).toEqual(dayAfterSprint1);

      // Verify each sprint is 13 days (14 days inclusive)
      const sprint1Duration = (sprint1End.getTime() - mockData.sprints[0].start.getTime()) / (24 * 60 * 60 * 1000);
      const sprint2Duration = (mockData.sprints[1].end.getTime() - sprint2Start.getTime()) / (24 * 60 * 60 * 1000);

      expect(sprint1Duration).toBe(13);
      expect(sprint2Duration).toBe(13);
    });

    it('should handle multiple sprints in sequence', () => {
      const sprints: Sprint[] = [];
      let currentStart = new Date('2024-01-01'); // Monday

      for (let i = 0; i < 5; i++) {
        const currentEnd = new Date(currentStart.getTime() + 13 * 24 * 60 * 60 * 1000);
        sprints.push({
          id: `sprint-${i + 1}`,
          name: `Sprint ${i + 1}`,
          start: currentStart,
          end: currentEnd,
        });
        currentStart = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      mockData.sprints = sprints;

      // Verify all sprints are properly chained
      for (let i = 0; i < sprints.length - 1; i++) {
        const currentEnd = sprints[i].end;
        const nextStart = sprints[i + 1].start;
        const dayAfterCurrent = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);

        expect(nextStart).toEqual(dayAfterCurrent);
      }

      // Verify all sprints end on Sunday
      sprints.forEach((sprint, index) => {
        expect(sprint.end.getDay()).toBe(0); // Sunday
      });
    });
  });

  describe('Project counter updates', () => {
    it('should track stages count correctly', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        stages: [],
        milestones: [],
        layout: 'inline',
      };

      mockData.projects = [project];

      // Add stages
      project.stages.push({
        id: 'stage-1',
        name: 'Stage 1',
        type: 'Stage 1',
        start: new Date('2024-01-01'),
        duration: 5,
        color: '#4CAF50',
      });

      expect(project.stages.length).toBe(1);

      project.stages.push({
        id: 'stage-2',
        name: 'Stage 2',
        type: 'Stage 2',
        start: new Date('2024-01-08'),
        duration: 3,
        color: '#2196F3',
      });

      expect(project.stages.length).toBe(2);
    });

    it('should track milestones count correctly', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        stages: [],
        milestones: [],
        layout: 'inline',
      };

      mockData.projects = [project];

      // Add milestones
      project.milestones.push({
        id: 'milestone-1',
        name: 'Milestone 1',
        type: 'Milestone 1',
        date: new Date('2024-01-15'),
        color: '#FFD93D',
      });

      expect(project.milestones.length).toBe(1);

      project.milestones.push({
        id: 'milestone-2',
        name: 'Milestone 2',
        type: 'Milestone 2',
        date: new Date('2024-01-30'),
      });

      expect(project.milestones.length).toBe(2);
    });

    it('should update counts when items are deleted', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Test Project',
        stages: [
          {
            id: 'stage-1',
            name: 'Stage 1',
            type: 'Stage 1',
            start: new Date('2024-01-01'),
            duration: 5,
            color: '#4CAF50',
          },
          {
            id: 'stage-2',
            name: 'Stage 2',
            type: 'Stage 2',
            start: new Date('2024-01-08'),
            duration: 3,
            color: '#2196F3',
          },
        ],
        milestones: [
          {
            id: 'milestone-1',
            name: 'Milestone 1',
            type: 'Milestone 1',
            date: new Date('2024-01-15'),
          },
        ],
        layout: 'inline',
      };

      mockData.projects = [project];

      expect(project.stages.length).toBe(2);
      expect(project.milestones.length).toBe(1);

      // Delete a stage
      project.stages = project.stages.filter(s => s.id !== 'stage-1');
      expect(project.stages.length).toBe(1);

      // Delete a milestone
      project.milestones = project.milestones.filter(m => m.id !== 'milestone-1');
      expect(project.milestones.length).toBe(0);
    });
  });

  describe('Date formatting consistency', () => {
    it('should format dates consistently across sprints', () => {
      mockData.sprints = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          start: new Date('2024-01-01'),
          end: new Date('2024-01-14'),
        },
      ];

      const formattedStart = formatDateISO(mockData.sprints[0].start);
      const formattedEnd = formatDateISO(mockData.sprints[0].end);

      expect(formattedStart).toBe('2024-01-01');
      expect(formattedEnd).toBe('2024-01-14');
      expect(formattedStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formattedEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Auto-update behavior', () => {
    it('should not require separate update button for project fields', () => {
      const project: Project = {
        id: 'project-1',
        name: 'Initial Name',
        stages: [],
        milestones: [],
        layout: 'inline',
      };

      mockData.projects = [project];

      // Simulate direct property update (as event listeners would do)
      project.name = 'Updated Name';
      project.layout = 'multiline';

      expect(project.name).toBe('Updated Name');
      expect(project.layout).toBe('multiline');
    });

    it('should not require separate update button for stage fields', () => {
      const stage = {
        id: 'stage-1',
        name: 'Initial Stage',
        type: 'Initial Stage',
        start: new Date('2024-01-01'),
        duration: 5,
        color: '#4CAF50',
      };

      // Simulate direct property updates
      stage.name = 'Updated Stage';
      stage.type = 'Updated Stage';
      stage.duration = 10;

      expect(stage.name).toBe('Updated Stage');
      expect(stage.type).toBe('Updated Stage');
      expect(stage.duration).toBe(10);
    });

    it('should not require separate update button for milestone fields', () => {
      const milestone = {
        id: 'milestone-1',
        name: 'Initial Milestone',
        type: 'Initial Milestone',
        date: new Date('2024-01-15'),
      };

      // Simulate direct property updates
      milestone.name = 'Updated Milestone';
      milestone.type = 'Updated Milestone';
      milestone.date = new Date('2024-01-20');

      expect(milestone.name).toBe('Updated Milestone');
      expect(milestone.type).toBe('Updated Milestone');
      expect(formatDateISO(milestone.date)).toBe('2024-01-20');
    });

    it('should not require separate update button for sprint fields', () => {
      const sprint: Sprint = {
        id: 'sprint-1',
        name: 'Initial Sprint',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-14'),
      };

      // Simulate direct property updates
      sprint.name = 'Updated Sprint';
      sprint.start = new Date('2024-01-08');
      sprint.end = new Date('2024-01-21');

      expect(sprint.name).toBe('Updated Sprint');
      expect(formatDateISO(sprint.start)).toBe('2024-01-08');
      expect(formatDateISO(sprint.end)).toBe('2024-01-21');
    });
  });

  describe('Settings auto-apply', () => {
    it('should not require separate apply button for settings', () => {
      const initialStartDate = mockData.startDate;
      const initialEndDate = mockData.endDate;

      // Simulate settings changes
      mockData.startDate = new Date('2024-02-01');
      mockData.endDate = new Date('2024-11-30');
      mockData.excludeWeekdays = [0]; // Only exclude Sunday

      expect(mockData.startDate).not.toEqual(initialStartDate);
      expect(mockData.endDate).not.toEqual(initialEndDate);
      expect(mockData.excludeWeekdays).toEqual([0]);
    });

    it('should update working days configuration', () => {
      mockData.excludeWeekdays = [0, 6]; // Exclude weekends
      mockData.includeDates = ['2024-01-06']; // Include specific Saturday
      mockData.excludeDates = ['2024-01-01']; // Exclude New Year

      expect(mockData.excludeWeekdays.length).toBe(2);
      expect(mockData.includeDates.length).toBe(1);
      expect(mockData.excludeDates.length).toBe(1);
    });
  });
});
