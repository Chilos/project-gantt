/**
 * Tests for GanttManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GanttManager } from '../GanttManager';
import { createDefaultGanttData } from '../../utils/encoding';
import type { GanttData, Project, Stage, Milestone, Sprint } from '../../types';

describe('GanttManager', () => {
  let manager: GanttManager;
  let mockData: GanttData;

  beforeEach(() => {
    mockData = createDefaultGanttData();
    manager = new GanttManager(mockData);
  });

  describe('constructor', () => {
    it('should initialize with provided data', () => {
      const data = manager.getData();
      expect(data).toBeDefined();
      expect(data.projects).toEqual([]);
      expect(data.sprints).toEqual([]);
    });

    it('should initialize with empty data if none provided', () => {
      const emptyManager = new GanttManager();
      const data = emptyManager.getData();
      expect(data).toBeDefined();
      expect(data.projects).toEqual([]);
    });
  });

  describe('getData and setData', () => {
    it('should get data', () => {
      const data = manager.getData();
      expect(data).toEqual(mockData);
    });

    it('should set data', () => {
      const newData = createDefaultGanttData();
      newData.projects = [{
        id: 'proj1',
        name: 'New Project',
        stages: [],
        milestones: [],
      }];

      manager.setData(newData);
      const data = manager.getData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].name).toBe('New Project');
    });
  });

  describe('Project operations', () => {
    const mockProject: Project = {
      id: 'proj1',
      name: 'Test Project',
      stages: [],
      milestones: [],
    };

    it('should add project', () => {
      manager.addProject(mockProject);
      const data = manager.getData();

      expect(data.projects).toHaveLength(1);
      expect(data.projects[0]).toEqual(mockProject);
    });

    it('should update project', () => {
      manager.addProject(mockProject);
      manager.updateProject('proj1', { name: 'Updated Project' });

      const project = manager.getProjectById('proj1');
      expect(project?.name).toBe('Updated Project');
    });

    it('should delete project', () => {
      manager.addProject(mockProject);
      manager.deleteProject('proj1');

      const data = manager.getData();
      expect(data.projects).toHaveLength(0);
    });

    it('should get project by ID', () => {
      manager.addProject(mockProject);
      const project = manager.getProjectById('proj1');

      expect(project).toEqual(mockProject);
    });

    it('should return null for non-existent project', () => {
      const project = manager.getProjectById('nonexistent');
      expect(project).toBeNull();
    });
  });

  describe('Stage operations', () => {
    const mockProject: Project = {
      id: 'proj1',
      name: 'Test Project',
      stages: [],
      milestones: [],
    };

    const mockStage: Stage = {
      id: 'stage1',
      name: 'Test Stage',
      type: 'development',
      start: new Date('2025-10-13'),
      duration: 5,
      color: '#3498db',
    };

    beforeEach(() => {
      manager.addProject(mockProject);
    });

    it('should add stage to project', () => {
      manager.addStage('proj1', mockStage);
      const project = manager.getProjectById('proj1');

      expect(project?.stages).toHaveLength(1);
      expect(project?.stages[0]).toEqual(mockStage);
    });

    it('should update stage', () => {
      manager.addStage('proj1', mockStage);
      manager.updateStage('proj1', 'stage1', { name: 'Updated Stage' });

      const project = manager.getProjectById('proj1');
      expect(project?.stages[0].name).toBe('Updated Stage');
    });

    it('should delete stage', () => {
      manager.addStage('proj1', mockStage);
      manager.deleteStage('proj1', 'stage1');

      const project = manager.getProjectById('proj1');
      expect(project?.stages).toHaveLength(0);
    });

    it('should get stage by ID', () => {
      manager.addStage('proj1', mockStage);
      const result = manager.getStageById('stage1');

      expect(result).not.toBeNull();
      expect(result?.stage).toEqual(mockStage);
      expect(result?.project.id).toBe('proj1');
    });

    it('should return null for non-existent stage', () => {
      const result = manager.getStageById('nonexistent');
      expect(result).toBeNull();
    });

    it('should not add stage to non-existent project', () => {
      const dataBefore = manager.getData();
      const totalStagesBefore = dataBefore.projects.reduce((sum, p) => sum + p.stages.length, 0);

      manager.addStage('nonexistent', mockStage);

      const dataAfter = manager.getData();
      const totalStagesAfter = dataAfter.projects.reduce((sum, p) => sum + p.stages.length, 0);

      // Total stages should not change
      expect(totalStagesAfter).toBe(totalStagesBefore);
    });
  });

  describe('Milestone operations', () => {
    const mockProject: Project = {
      id: 'proj1',
      name: 'Test Project',
      stages: [],
      milestones: [],
    };

    const mockMilestone: Milestone = {
      id: 'milestone1',
      name: 'Release',
      type: 'release',
      date: new Date('2025-10-20'),
      color: '#FFD93D',
    };

    beforeEach(() => {
      manager.addProject(mockProject);
    });

    it('should add milestone to project', () => {
      manager.addMilestone('proj1', mockMilestone);
      const project = manager.getProjectById('proj1');

      expect(project?.milestones).toHaveLength(1);
      expect(project?.milestones[0]).toEqual(mockMilestone);
    });

    it('should update milestone', () => {
      manager.addMilestone('proj1', mockMilestone);
      manager.updateMilestone('proj1', 'milestone1', { name: 'Updated Release' });

      const project = manager.getProjectById('proj1');
      expect(project?.milestones[0].name).toBe('Updated Release');
    });

    it('should delete milestone', () => {
      manager.addMilestone('proj1', mockMilestone);
      manager.deleteMilestone('proj1', 'milestone1');

      const project = manager.getProjectById('proj1');
      expect(project?.milestones).toHaveLength(0);
    });

    it('should get milestone by ID', () => {
      manager.addMilestone('proj1', mockMilestone);
      const result = manager.getMilestoneById('milestone1');

      expect(result).not.toBeNull();
      expect(result?.milestone).toEqual(mockMilestone);
      expect(result?.project.id).toBe('proj1');
    });

    it('should return null for non-existent milestone', () => {
      const result = manager.getMilestoneById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Sprint operations', () => {
    const mockSprint: Sprint = {
      id: 'sprint1',
      name: 'Sprint 1',
      start: new Date('2025-10-13'),
      end: new Date('2025-10-24'),
    };

    it('should add sprint', () => {
      manager.addSprint(mockSprint);
      const data = manager.getData();

      expect(data.sprints).toHaveLength(1);
      expect(data.sprints[0]).toEqual(mockSprint);
    });

    it('should update sprint', () => {
      manager.addSprint(mockSprint);
      manager.updateSprint('sprint1', { name: 'Updated Sprint' });

      const data = manager.getData();
      expect(data.sprints[0].name).toBe('Updated Sprint');
    });

    it('should delete sprint', () => {
      manager.addSprint(mockSprint);
      manager.deleteSprint('sprint1');

      const data = manager.getData();
      expect(data.sprints).toHaveLength(0);
    });

    it('should not update non-existent sprint', () => {
      const sprint1: Sprint = {
        id: 'sprint1',
        name: 'Sprint 1',
        start: new Date('2025-10-13'),
        end: new Date('2025-10-17'),
      };
      const sprint2: Sprint = {
        id: 'sprint2',
        name: 'Sprint 2',
        start: new Date('2025-10-20'),
        end: new Date('2025-10-24'),
      };

      manager.addSprint(sprint1);
      manager.addSprint(sprint2);
      manager.updateSprint('nonexistent', { name: 'Updated' });

      const data = manager.getData();
      expect(data.sprints[0].name).toBe('Sprint 1');
      expect(data.sprints[1].name).toBe('Sprint 2');
    });
  });

  describe('Time range operations', () => {
    it('should update time range', () => {
      const newStart = new Date('2025-01-01');
      const newEnd = new Date('2025-12-31');

      manager.updateTimeRange(newStart, newEnd);
      const data = manager.getData();

      expect(data.startDate).toEqual(newStart);
      expect(data.endDate).toEqual(newEnd);
    });
  });

  describe('Working days operations', () => {
    it('should update exclude weekdays', () => {
      manager.updateWorkingDays({ excludeWeekdays: [0, 6] });
      const data = manager.getData();

      expect(data.excludeWeekdays).toEqual([0, 6]);
    });

    it('should update include dates', () => {
      manager.updateWorkingDays({ includeDates: ['2025-01-01', '2025-01-06'] });
      const data = manager.getData();

      expect(data.includeDates).toEqual(['2025-01-01', '2025-01-06']);
    });

    it('should update exclude dates', () => {
      manager.updateWorkingDays({ excludeDates: ['2025-12-25', '2025-12-31'] });
      const data = manager.getData();

      expect(data.excludeDates).toEqual(['2025-12-25', '2025-12-31']);
    });

    it('should update multiple working day settings', () => {
      manager.updateWorkingDays({
        excludeWeekdays: [0, 6],
        includeDates: ['2025-01-01'],
        excludeDates: ['2025-12-25'],
      });

      const data = manager.getData();

      expect(data.excludeWeekdays).toEqual([0, 6]);
      expect(data.includeDates).toEqual(['2025-01-01']);
      expect(data.excludeDates).toEqual(['2025-12-25']);
    });
  });

  describe('clear', () => {
    it('should clear all projects and sprints', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test',
        stages: [],
        milestones: [],
      };

      const sprint: Sprint = {
        id: 'sprint1',
        name: 'Sprint 1',
        start: new Date(),
        end: new Date(),
      };

      manager.addProject(project);
      manager.addSprint(sprint);

      manager.clear();
      const data = manager.getData();

      expect(data.projects).toHaveLength(0);
      expect(data.sprints).toHaveLength(0);
    });
  });
});
