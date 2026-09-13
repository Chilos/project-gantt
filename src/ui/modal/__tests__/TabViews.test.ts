import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsTabView } from '../SettingsTabView';
import { SprintsTabView } from '../SprintsTabView';
import { ProjectsTabView } from '../ProjectsTabView';
import { DragAndDropManager } from '../../DragAndDropManager';
import { formatDateISO } from '../../../utils/dateUtils';
import type { GanttData } from '../../../types';

describe('Modal TabViews', () => {
  let container: HTMLElement;
  let mockData: GanttData;
  const escapeHtml = (s: string) => s;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <div id="gantt-items-list"></div>
      <div id="gantt-editor-form"></div>
    `;
    mockData = {
      startDate: new Date(2024, 0, 1),
      endDate: new Date(2024, 0, 31),
      excludeWeekdays: [0, 6],
      includeDates: ['2024-01-06'],
      excludeDates: ['2024-01-02'],
      timeScale: 'day',
      showTodayLine: true,
      projects: [
        {
          id: 'p1',
          name: 'Project Alpha',
          stages: [],
          milestones: []
        }
      ],
      sprints: [
        {
          id: 's1',
          name: 'Sprint 1',
          start: new Date(2024, 0, 1),
          end: new Date(2024, 0, 14)
        }
      ]
    };
  });

  describe('SettingsTabView', () => {
    it('should render settings form with initial values', () => {
      SettingsTabView.render(container, mockData);

      const startInput = container.querySelector('#settings-start-date') as HTMLInputElement;
      const endInput = container.querySelector('#settings-end-date') as HTMLInputElement;
      expect(startInput.value).toBe('2024-01-01');
      expect(endInput.value).toBe('2024-01-31');
    });

    it('should apply changes back to data', () => {
      SettingsTabView.render(container, mockData);

      const startInput = container.querySelector('#settings-start-date') as HTMLInputElement;
      const endInput = container.querySelector('#settings-end-date') as HTMLInputElement;
      startInput.value = '2024-02-01';
      endInput.value = '2024-02-28';

      SettingsTabView.applyChanges(container, mockData);

      expect(formatDateISO(mockData.startDate)).toBe('2024-02-01');
      expect(formatDateISO(mockData.endDate)).toBe('2024-02-28');
    });
  });

  describe('SprintsTabView', () => {
    it('should render sprints list', () => {
      const view = new SprintsTabView(container, mockData, escapeHtml);
      view.render();

      const items = container.querySelectorAll('.gantt-list-item');
      expect(items.length).toBe(1);
      expect(container.textContent).toContain('Sprint 1');
    });
  });

  describe('ProjectsTabView', () => {
    it('should render projects list', () => {
      const dnd = new DragAndDropManager();
      const view = new ProjectsTabView(container, mockData, dnd, escapeHtml);
      view.render();

      const items = container.querySelectorAll('.gantt-list-item');
      expect(items.length).toBe(1);
      expect(container.textContent).toContain('Project Alpha');
    });
  });
});
