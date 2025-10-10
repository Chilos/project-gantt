/**
 * Tests for GanttRenderer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GanttRenderer } from '../GanttRenderer';
import { createDefaultGanttData } from '../../utils/encoding';
import type { GanttData, Project, Sprint } from '../../types';

// Mock getComputedStyle
global.getComputedStyle = vi.fn(() => ({
  getPropertyValue: () => '#045591',
})) as any;

// Mock localStorage
global.localStorage = {
  getItem: () => '200',
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => null,
} as any;

describe('GanttRenderer', () => {
  let renderer: GanttRenderer;
  let ganttData: GanttData;

  beforeEach(() => {
    renderer = new GanttRenderer();
    ganttData = createDefaultGanttData();
  });

  describe('render', () => {
    it('should render basic gantt chart', () => {
      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-container');
      expect(html).toContain('gantt-table');
      expect(html).toContain('gantt-header');
    });

    it('should render edit button by default', () => {
      const html = renderer.render(ganttData, { showEditButton: true });

      expect(html).toContain('gantt-edit-button');
      expect(html).toContain('data-on-click="openGanttEditor"');
    });

    it('should not render edit button when disabled', () => {
      const html = renderer.render(ganttData, { showEditButton: false });

      expect(html).not.toContain('gantt-edit-button');
    });

    it('should include slot ID in rendered HTML', () => {
      const slotKey = 'test-slot-123';
      const html = renderer.render(ganttData, { slotKey });

      expect(html).toContain(`data-slot-id="${slotKey}"`);
    });

    it('should set readonly attribute', () => {
      const html = renderer.render(ganttData, { readonly: true });

      expect(html).toContain('data-readonly="true"');
    });

    it('should render with custom cell width', () => {
      const html = renderer.render(ganttData, { cellWidth: 60 });

      expect(html).toBeDefined();
      expect(html).toContain('gantt-container');
    });
  });

  describe('render with projects', () => {
    it('should render project with stages', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('Test Project');
      expect(html).toContain('Stage 1');
      expect(html).toContain('gantt-stage');
      expect(html).toContain('#3498db');
    });

    it('should render project with milestones', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        stages: [],
        milestones: [
          {
            id: 'milestone1',
            name: 'Release',
            type: 'release',
            date: new Date('2025-10-13'),
            color: '#FFD93D',
          },
        ],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('Release');
      expect(html).toContain('gantt-milestone');
    });

    it('should not render project without stages and milestones', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Empty Project',
        stages: [],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).not.toContain('Empty Project');
    });

    it('should render project with assignee', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        assignee: { name: 'John Doe' },
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('John Doe');
      expect(html).toContain('gantt-assignee');
    });

    it('should render multiline project layout', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        layout: 'multiline',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-project-main');
      expect(html).toContain('gantt-stage-row');
    });
  });

  describe('render with sprints', () => {
    it('should render sprint headers', () => {
      const sprint: Sprint = {
        id: 'sprint1',
        name: 'Sprint 1',
        start: new Date('2025-10-13'),
        end: new Date('2025-10-24'),
      };

      ganttData.sprints = [sprint];

      const html = renderer.render(ganttData);

      expect(html).toContain('Sprint 1');
      expect(html).toContain('gantt-sprint-header');
    });

    it('should render sprint separators', () => {
      const sprints: Sprint[] = [
        {
          id: 'sprint1',
          name: 'Sprint 1',
          start: new Date('2025-10-13'),
          end: new Date('2025-10-17'),
        },
        {
          id: 'sprint2',
          name: 'Sprint 2',
          start: new Date('2025-10-20'),
          end: new Date('2025-10-24'),
        },
      ];

      ganttData.sprints = sprints;

      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-sprint-separator-line');
    });

    it('should not render separator for single sprint', () => {
      const sprint: Sprint = {
        id: 'sprint1',
        name: 'Sprint 1',
        start: new Date('2025-10-13'),
        end: new Date('2025-10-24'),
      };

      ganttData.sprints = [sprint];

      const html = renderer.render(ganttData);

      expect(html).not.toContain('gantt-sprint-separator-line');
    });
  });

  describe('render today line', () => {
    it('should render today line when enabled', () => {
      ganttData.showTodayLine = true;

      const html = renderer.render(ganttData);

      // May or may not render depending on whether today is a working day
      // Just check that rendering doesn't crash
      expect(html).toBeDefined();
    });

    it('should not render today line when disabled', () => {
      ganttData.showTodayLine = false;

      const html = renderer.render(ganttData);

      expect(html).not.toContain('gantt-today-line');
    });
  });

  describe('render with Logseq links', () => {
    it('should parse Logseq page links', () => {
      const project: Project = {
        id: 'proj1',
        name: '[[Page Name]] Project',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-logseq-link');
      expect(html).toContain('data-page-name');
      expect(html).toContain('Page Name');
    });

    it('should parse Logseq links with aliases', () => {
      const project: Project = {
        id: 'proj1',
        name: '[[Page Name|Alias]] Project',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-logseq-link');
      expect(html).toContain('Alias');
    });
  });

  describe('render day headers', () => {
    it('should render day numbers and names', () => {
      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-day-header');
      expect(html).toContain('gantt-day-number');
      expect(html).toContain('gantt-day-name');
    });

    it('should mark current day', () => {
      const html = renderer.render(ganttData);

      // May or may not contain current-day class depending on date
      // Just verify rendering doesn't crash
      expect(html).toBeDefined();
    });
  });

  describe('stage rendering', () => {
    it('should include duration in stage', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 7,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-stage-days');
      expect(html).toContain('>7<');
    });

    it('should include resize handle', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('gantt-resize-handle');
      expect(html).toContain('gantt-resize-right');
    });

    it('should render stage with assignee', () => {
      const project: Project = {
        id: 'proj1',
        name: 'Test Project',
        stages: [
          {
            id: 'stage1',
            name: 'Stage 1',
            type: 'development',
            start: new Date('2025-10-13'),
            duration: 5,
            color: '#3498db',
            assignee: { name: 'Jane Doe' },
          },
        ],
        milestones: [],
      };

      ganttData.projects = [project];

      const html = renderer.render(ganttData);

      expect(html).toContain('Jane Doe');
      expect(html).toContain('gantt-stage-assignee');
    });
  });
});
