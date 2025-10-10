/**
 * GanttRenderer - ПЕРЕПИСАН С НУЛЯ
 * Компактный рендеринг без огромных отступов
 */

import type { GanttData, GanttRenderOptions, Project, Stage, Milestone, Sprint } from '../types';
import { DEFAULT_CELL_WIDTH, CSS_CLASSES } from '../utils/constants';
import { generateWorkingDaysScale, getDayNameRu, isSameDay, getToday, getWorkingDaysBetween } from '../utils/dateUtils';
import { ColorSystem } from '../utils/colorSystem';

export class GanttRenderer {
  private colorSystem: ColorSystem;

  constructor() {
    this.colorSystem = new ColorSystem();
  }

  /**
   * Рендерит полную Gantt диаграмму
   */
  render(data: GanttData, options: GanttRenderOptions = {}): string {
    const cellWidth = options.cellWidth || DEFAULT_CELL_WIDTH;
    const readonly = options.readonly ?? true;
    const showEditButton = options.showEditButton ?? true;

    const workingDaysConfig = {
      excludeWeekdays: data.excludeWeekdays,
      includeDates: data.includeDates,
      excludeDates: data.excludeDates,
    };

    const workingDays = generateWorkingDaysScale(data.startDate, data.endDate, workingDaysConfig);
    const timelineWidth = workingDays.length * cellWidth;

    // Получаем сохранённую ширину колонки или используем 200px по умолчанию
    const savedColumnWidth = typeof localStorage !== 'undefined'
      ? parseInt(localStorage.getItem('gantt-column-width') || '200', 10)
      : 200;
    const columnWidth = Math.max(120, Math.min(400, savedColumnWidth));
    const totalWidth = columnWidth + timelineWidth;

    const sprintSeparators = this.renderSprintSeparators(data.sprints, workingDays, cellWidth, columnWidth, workingDaysConfig);
    const todayLine = (data.showTodayLine !== false) ? this.renderTodayLine(workingDays, cellWidth, columnWidth, workingDaysConfig) : '';

    return `<div class="${CSS_CLASSES.CONTAINER}" data-slot-id="${options.slotKey || ''}" data-readonly="${readonly}">${showEditButton ? this.renderEditButton(options.slotKey || '') : ''}<div class="${CSS_CLASSES.TABLE}" style="width: ${totalWidth}px;">${this.renderHeader(workingDays, data.sprints, cellWidth, columnWidth, workingDaysConfig)}${this.renderProjects(data, workingDays, cellWidth, columnWidth, workingDaysConfig)}${sprintSeparators}${todayLine}</div></div>`;
  }

  /**
   * Рендерит заголовок с временной шкалой
   */
  private renderHeader(workingDays: Date[], sprints: Sprint[], cellWidth: number, columnWidth: number, workingDaysConfig: any): string {
    return `<div class="${CSS_CLASSES.HEADER}"><div class="${CSS_CLASSES.PROJECT_HEADER}" style="width: ${columnWidth}px;">Проекты<div class="gantt-column-resizer"></div></div><div class="${CSS_CLASSES.TIME_HEADER}">${this.renderSprintRow(sprints, workingDays, cellWidth, workingDaysConfig)}${this.renderDayRow(workingDays, cellWidth)}</div></div>`;
  }

  /**
   * Рендерит строку спринтов
   */
  private renderSprintRow(sprints: Sprint[], _workingDays: Date[], cellWidth: number, workingDaysConfig: any): string {
    if (!sprints || sprints.length === 0) {
      return '';
    }

    const sprintHtml = sprints.map((sprint, index) => {
      const sprintWorkingDays = getWorkingDaysBetween(sprint.start, sprint.end, workingDaysConfig);
      const width = sprintWorkingDays * cellWidth;
      const isLast = index === sprints.length - 1;

      return `<div class="gantt-sprint-header ${!isLast ? 'gantt-sprint-separator' : ''}" style="width: ${width}px;" data-sprint-id="${sprint.id}"> ${this.escapeHtml(sprint.name)} </div>`;
    }).join('');

    return `<div class="${CSS_CLASSES.SPRINT_ROW}">${sprintHtml}</div>`;
  }

  /**
   * Рендерит вертикальные линии-разделители спринтов
   */
  private renderSprintSeparators(sprints: Sprint[], _workingDays: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any): string {
    if (!sprints || sprints.length === 0) {
      return '';
    }

    let currentPosition = 0;
    const separators: string[] = [];

    sprints.forEach((sprint, index) => {
      const sprintWorkingDays = getWorkingDaysBetween(sprint.start, sprint.end, workingDaysConfig);
      const width = sprintWorkingDays * cellWidth;
      currentPosition += width;

      // Добавляем разделитель после каждого спринта, кроме последнего
      // Учитываем смещение от колонки с названиями проектов
      if (index < sprints.length - 1) {
        separators.push(`<div class="gantt-sprint-separator-line" style="left: ${columnWidth + currentPosition}px;"></div>`);
      }
    });

    return separators.join('');
  }

  /**
   * Рендерит вертикальную линию текущего дня
   */
  private renderTodayLine(workingDays: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any): string {
    const today = getToday();

    // Находим индекс текущего дня в массиве рабочих дней
    const todayIndex = workingDays.findIndex(day => isSameDay(day, today));

    // Отладочная информация
    console.log('[Project Gantt] Today line debug:', {
      today: today.toISOString().split('T')[0],
      todayIndex,
      workingDaysCount: workingDays.length,
      workingDaysSample: workingDays.slice(0, 5).map(d => d.toISOString().split('T')[0]),
      includeDates: workingDaysConfig.includeDates,
      excludeWeekdays: workingDaysConfig.excludeWeekdays,
    });

    // Если сегодня не является рабочим днём (не в списке), не рисуем линию
    if (todayIndex === -1) {
      console.log('[Project Gantt] Today is not a working day - not rendering line');
      return '';
    }

    // Позиция линии: смещение колонки + позиция ячейки + половина ширины ячейки (центр)
    const linePosition = columnWidth + (todayIndex * cellWidth) + (cellWidth / 2);

    console.log('[Project Gantt] Today line position:', { todayIndex, linePosition, columnWidth, cellWidth });

    return `<div class="gantt-today-line" style="left: ${linePosition}px;"></div>`;
  }

  /**
   * Рендерит строку дней
   */
  private renderDayRow(workingDays: Date[], cellWidth: number): string {
    const today = getToday();

    const dayHtml = workingDays.map(day => {
      const dayNum = day.getDate();
      const dayName = getDayNameRu(day);
      const isCurrentDay = isSameDay(day, today);

      return `<div class="gantt-day-header ${isCurrentDay ? CSS_CLASSES.CURRENT_DAY : ''}" style="width: ${cellWidth}px;" data-date="${day.toISOString().split('T')[0]}"><div class="gantt-day-number">${dayNum}</div><div class="gantt-day-name">${dayName}</div></div>`;
    }).join('');

    return `<div class="${CSS_CLASSES.DAY_ROW}">${dayHtml}</div>`;
  }

  /**
   * Рендерит все проекты
   */
  private renderProjects(data: GanttData, workingDays: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any): string {
    if (!data.projects || data.projects.length === 0) {
      return `<div class="${CSS_CLASSES.PROJECTS}"></div>`;
    }

    const projectsHtml = data.projects.map(project => {
      if (project.layout === 'multiline') {
        return this.renderProjectMultiline(project, data.startDate, workingDays, cellWidth, columnWidth, workingDaysConfig);
      } else {
        return this.renderProjectInline(project, data.startDate, workingDays, cellWidth, columnWidth, workingDaysConfig);
      }
    }).join('');

    return `<div class="${CSS_CLASSES.PROJECTS}">${projectsHtml}</div>`;
  }

  /**
   * Рендерит проект в inline режиме (все этапы на одной строке)
   */
  private renderProjectInline(project: Project, startDate: Date, _workingDays: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any): string {
    // Если проект без этапов и мелстоунов - НЕ рендерим вообще
    const hasStages = project.stages.length > 0;
    const hasMilestones = project.milestones.length > 0;

    if (!hasStages && !hasMilestones) {
      return '';
    }

    const stagesHtml = project.stages.map(stage =>
      this.renderStage(stage, startDate, cellWidth, workingDaysConfig)
    ).join('');

    const milestonesHtml = project.milestones.map(milestone =>
      this.renderMilestone(milestone, startDate, cellWidth, workingDaysConfig)
    ).join('');

    const projectNameHtml = this.parseLogseqLinks(project.name);

    return `<div class="${CSS_CLASSES.PROJECT_ROW}" data-project-id="${project.id}"><div class="${CSS_CLASSES.PROJECT_NAME}" style="width: ${columnWidth}px;"><div>${projectNameHtml}</div>${project.assignee ? `<span class="gantt-assignee">${this.escapeHtml(project.assignee.name)}</span>` : ''}</div><div class="${CSS_CLASSES.PROJECT_TIMELINE}">${stagesHtml}${milestonesHtml}</div></div>`;
  }

  /**
   * Рендерит проект в multiline режиме (каждый этап на отдельной строке)
   */
  private renderProjectMultiline(project: Project, startDate: Date, _workingDays: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any): string {
    const milestonesHtml = project.milestones.map(milestone =>
      this.renderMilestone(milestone, startDate, cellWidth, workingDaysConfig)
    ).join('');

    const projectNameHtml = this.parseLogseqLinks(project.name);

    const mainRow = `<div class="${CSS_CLASSES.PROJECT_ROW} gantt-project-main" data-project-id="${project.id}"><div class="${CSS_CLASSES.PROJECT_NAME}" style="width: ${columnWidth}px;"><div>${projectNameHtml}</div>${project.assignee ? `<span class="gantt-assignee">${this.escapeHtml(project.assignee.name)}</span>` : ''}</div><div class="${CSS_CLASSES.PROJECT_TIMELINE}">${milestonesHtml}</div></div>`;

    const stageRows = project.stages.map(stage => {
      const stageHtml = this.renderStage(stage, startDate, cellWidth, workingDaysConfig);
      const stageNameHtml = this.parseLogseqLinks(stage.name);

      return `<div class="${CSS_CLASSES.PROJECT_ROW} gantt-stage-row" data-project-id="${project.id}" data-stage-id="${stage.id}"><div class="${CSS_CLASSES.PROJECT_NAME}" style="width: ${columnWidth}px;"><div> - ${stageNameHtml}</div>${stage.assignee ? `<span class="gantt-assignee">${this.escapeHtml(stage.assignee.name)}</span>` : ''}</div><div class="${CSS_CLASSES.PROJECT_TIMELINE}">${stageHtml}</div></div>`;
    }).join('');

    return mainRow + stageRows;
  }

  /**
   * Рендерит этап
   */
  private renderStage(stage: Stage, startDate: Date, cellWidth: number, workingDaysConfig: any): string {
    const position = this.getDatePosition(startDate, stage.start, cellWidth, workingDaysConfig);
    const width = stage.duration * cellWidth;
    const textColor = this.colorSystem.getContrastTextColor(stage.color);

    return `<div class="${CSS_CLASSES.STAGE}" data-stage-id="${stage.id}" data-type="stage" style="left: ${position}px; width: ${width}px; background-color: ${stage.color}; color: ${textColor};"><div class="gantt-stage-days">${stage.duration}</div><div class="gantt-stage-content"><div class="gantt-stage-name">${this.escapeHtml(stage.name)}</div>${stage.assignee ? `<div class="gantt-stage-assignee">${this.escapeHtml(stage.assignee.name)}</div>` : ''}</div><div class="gantt-resize-handle gantt-resize-right"></div></div>`;
  }

  /**
   * Рендерит мелстоун
   */
  private renderMilestone(milestone: Milestone, startDate: Date, cellWidth: number, workingDaysConfig: any): string {
    const position = this.getDatePosition(startDate, milestone.date, cellWidth, workingDaysConfig);
    // Добавляем половину ширины ячейки, чтобы вершина ромба указывала на середину
    const centerPosition = position +  + 10;
    const color = milestone.color || '#FFD93D';
    const title = milestone.assignee
      ? `${milestone.name} (${milestone.assignee.name})`
      : milestone.name;

    return `<div class="${CSS_CLASSES.MILESTONE}" data-milestone-id="${milestone.id}" data-type="milestone" style="left: ${centerPosition}px; background-color: ${color}; border-color: ${color};" title="${this.escapeHtml(title)}"><span class="gantt-milestone-label">${this.escapeHtml(milestone.name)}</span></div>`;
  }

  /**
   * Рендерит кнопку редактирования
   */
  private renderEditButton(slotId: string): string {
    return `<button class="gantt-edit-button" data-on-click="openGanttEditor" data-slot-id="${slotId}">✏</button>`;
  }

  /**
   * Вычисляет позицию даты на временной шкале
   */
  private getDatePosition(startDate: Date, targetDate: Date, cellWidth: number, workingDaysConfig: any): number {
    const workingDays = getWorkingDaysBetween(startDate, targetDate, workingDaysConfig);
    return Math.max(0, workingDays - 1) * cellWidth;
  }

  /**
   * Экранирует HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Парсит текст и преобразует Logseq ссылки в кликабельные элементы
   * Поддерживает форматы: [[Page Name]], [[Page Name|Alias]]
   */
  private parseLogseqLinks(text: string): string {
    // Регулярное выражение для поиска [[Page Name]] или [[Page Name|Alias]]
    const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    return text.replace(linkRegex, (_match, pageName, alias) => {
      const displayText = alias || pageName;
      const escapedPageName = this.escapeHtml(pageName);
      const escapedDisplayText = this.escapeHtml(displayText);

      return `<a class="gantt-logseq-link" data-on-click="navigateToPage" data-page-name="${escapedPageName}" href="#" title="Перейти к ${escapedPageName}">${escapedDisplayText}</a>`;
    });
  }
}
