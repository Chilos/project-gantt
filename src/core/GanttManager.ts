/**
 * GanttManager
 * Manages Gantt data operations (projects, stages, sprints, milestones)
 */

import type { GanttData, Project, Stage, Milestone, Sprint } from '../types';
import { generateId, sanitizeGanttData } from '../utils/encoding';

export class GanttManager {
  private data: GanttData;

  constructor(initialData?: GanttData) {
    this.data = initialData || this.createEmptyGantt();
  }

  /**
   * Создает пустую Gantt диаграмму
   */
  private createEmptyGantt(): GanttData {
    return {
      projects: [],
      sprints: [],
      startDate: new Date(),
      endDate: new Date(),
      excludeWeekdays: [],
      includeDates: [],
      excludeDates: [],
    };
  }

  /**
   * Получает текущие данные
   */
  getData(): GanttData {
    return { ...this.data };
  }

  /**
   * Устанавливает данные
   */
  setData(data: GanttData): void {
    this.data = sanitizeGanttData(data);
  }

  /**
   * Добавляет проект
   */
  addProject(project: Project): void {
    this.data.projects.push(project);
  }

  /**
   * Обновляет проект
   */
  updateProject(projectId: string, updates: Partial<Project>): void {
    const project = this.data.projects.find(p => p.id === projectId);
    if (project) {
      Object.assign(project, updates);
    }
  }

  /**
   * Удаляет проект
   */
  deleteProject(projectId: string): void {
    this.data.projects = this.data.projects.filter(p => p.id !== projectId);
  }

  /**
   * Получает проект по ID
   */
  getProjectById(projectId: string): Project | null {
    return this.data.projects.find(p => p.id === projectId) || null;
  }

  /**
   * Добавляет этап к проекту
   */
  addStage(projectId: string, stage: Stage): void {
    const project = this.getProjectById(projectId);
    if (project) {
      project.stages.push(stage);
    }
  }

  /**
   * Обновляет этап
   */
  updateStage(projectId: string, stageId: string, updates: Partial<Stage>): void {
    const project = this.getProjectById(projectId);
    if (project) {
      const stage = project.stages.find(s => s.id === stageId);
      if (stage) {
        Object.assign(stage, updates);
      }
    }
  }

  /**
   * Удаляет этап
   */
  deleteStage(projectId: string, stageId: string): void {
    const project = this.getProjectById(projectId);
    if (project) {
      project.stages = project.stages.filter(s => s.id !== stageId);
    }
  }

  /**
   * Получает этап по ID
   */
  getStageById(stageId: string): { project: Project; stage: Stage } | null {
    for (const project of this.data.projects) {
      const stage = project.stages.find(s => s.id === stageId);
      if (stage) {
        return { project, stage };
      }
    }
    return null;
  }

  /**
   * Добавляет мелстоун к проекту
   */
  addMilestone(projectId: string, milestone: Milestone): void {
    const project = this.getProjectById(projectId);
    if (project) {
      project.milestones.push(milestone);
    }
  }

  /**
   * Обновляет мелстоун
   */
  updateMilestone(projectId: string, milestoneId: string, updates: Partial<Milestone>): void {
    const project = this.getProjectById(projectId);
    if (project) {
      const milestone = project.milestones.find(m => m.id === milestoneId);
      if (milestone) {
        Object.assign(milestone, updates);
      }
    }
  }

  /**
   * Удаляет мелстоун
   */
  deleteMilestone(projectId: string, milestoneId: string): void {
    const project = this.getProjectById(projectId);
    if (project) {
      project.milestones = project.milestones.filter(m => m.id !== milestoneId);
    }
  }

  /**
   * Получает мелстоун по ID
   */
  getMilestoneById(milestoneId: string): { project: Project; milestone: Milestone } | null {
    for (const project of this.data.projects) {
      const milestone = project.milestones.find(m => m.id === milestoneId);
      if (milestone) {
        return { project, milestone };
      }
    }
    return null;
  }

  /**
   * Добавляет спринт
   */
  addSprint(sprint: Sprint): void {
    this.data.sprints.push(sprint);
  }

  /**
   * Обновляет спринт
   */
  updateSprint(sprintId: string, updates: Partial<Sprint>): void {
    const sprint = this.data.sprints.find(s => s.id === sprintId);
    if (sprint) {
      Object.assign(sprint, updates);
    }
  }

  /**
   * Удаляет спринт
   */
  deleteSprint(sprintId: string): void {
    this.data.sprints = this.data.sprints.filter(s => s.id !== sprintId);
  }

  /**
   * Обновляет временные рамки
   */
  updateTimeRange(startDate: Date, endDate: Date): void {
    this.data.startDate = startDate;
    this.data.endDate = endDate;
    this.data = sanitizeGanttData(this.data);
  }

  /**
   * Обновляет настройки рабочих дней
   */
  updateWorkingDays(config: {
    excludeWeekdays?: number[];
    includeDates?: string[];
    excludeDates?: string[];
  }): void {
    if (config.excludeWeekdays !== undefined) {
      this.data.excludeWeekdays = config.excludeWeekdays;
    }
    if (config.includeDates !== undefined) {
      this.data.includeDates = config.includeDates;
    }
    if (config.excludeDates !== undefined) {
      this.data.excludeDates = config.excludeDates;
    }
  }

  /**
   * Очищает все данные
   */
  clear(): void {
    this.data.projects = [];
    this.data.sprints = [];
  }
}
