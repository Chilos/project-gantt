/**
 * GanttRenderer - ПЕРЕПИСАН С НУЛЯ
 * Компактный рендеринг без огромных отступов
 */

import type { GanttData, GanttRenderOptions, Project, Stage, Milestone, Sprint } from '../types';
import { DEFAULT_CELL_WIDTH, CSS_CLASSES } from '../utils/constants';
import { generateWorkingDaysScale, generateWeeksScale, getDayNameRu, formatWeekRange, isSameDay, getToday, getWorkingDaysBetween, getWeekStart, snapToWeekBoundary } from '../utils/dateUtils';
import { ColorSystem } from '../utils/colorSystem';
import { extractPlainText } from '../utils/textUtils';

export class GanttRenderer {
  private colorSystem: ColorSystem;

  constructor() {
    this.colorSystem = new ColorSystem();
  }

  /**
   * Рендерит полную Gantt диаграмму
   */
  render(data: GanttData, options: GanttRenderOptions = {}): string {
    const timeScale = data.timeScale || 'day';
    const baseCellWidth = options.cellWidth || DEFAULT_CELL_WIDTH;
    // Для недель делаем ширину в 2 раза больше
    const cellWidth = timeScale === 'week' ? baseCellWidth * 2 : baseCellWidth;
    const readonly = options.readonly ?? true;
    const showEditButton = options.showEditButton ?? true;

    const workingDaysConfig = {
      excludeWeekdays: data.excludeWeekdays,
      includeDates: data.includeDates,
      excludeDates: data.excludeDates,
    };

    // Генерируем шкалу в зависимости от режима
    const weekStartsOn = data.weekStartsOn || 1;
    const timeScale_units = timeScale === 'week'
      ? generateWeeksScale(data.startDate, data.endDate, weekStartsOn)
      : generateWorkingDaysScale(data.startDate, data.endDate, workingDaysConfig);

    const timelineWidth = timeScale_units.length * cellWidth;

    // Получаем сохранённую ширину колонки или используем 200px по умолчанию
    const savedColumnWidth = typeof localStorage !== 'undefined'
      ? parseInt(localStorage.getItem('gantt-column-width') || '200', 10)
      : 200;
    const columnWidth = Math.max(120, Math.min(400, savedColumnWidth));
    const totalWidth = columnWidth + timelineWidth;

    const sprintSeparators = this.renderSprintSeparators(data.sprints, timeScale_units, cellWidth, columnWidth, workingDaysConfig, timeScale, weekStartsOn);
    const todayLine = (data.showTodayLine !== false && timeScale === 'day')
      ? this.renderTodayLine(timeScale_units as Date[], cellWidth, columnWidth, workingDaysConfig)
      : '';

    return `<div class="${CSS_CLASSES.CONTAINER}" data-slot-id="${options.slotKey || ''}" data-readonly="${readonly}" data-time-scale="${timeScale}">${showEditButton ? this.renderEditButton(options.slotKey || '') : ''}<div class="${CSS_CLASSES.TABLE}" style="width: ${totalWidth}px;">${this.renderHeader(timeScale_units, data.sprints, cellWidth, columnWidth, workingDaysConfig, timeScale, weekStartsOn)}${this.renderProjects(data, timeScale_units, cellWidth, columnWidth, workingDaysConfig, timeScale, weekStartsOn)}${sprintSeparators}${todayLine}</div></div>`;
  }

  /**
   * Рендерит заголовок с временной шкалой
   */
  private renderHeader(timeUnits: Date[], sprints: Sprint[], cellWidth: number, columnWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    const timeRow = timeScale === 'week'
      ? this.renderWeekRow(timeUnits, cellWidth, weekStartsOn)
      : this.renderDayRow(timeUnits, cellWidth);

    return `<div class="${CSS_CLASSES.HEADER}"><div class="${CSS_CLASSES.PROJECT_HEADER}" style="width: ${columnWidth}px;"><div class="gantt-column-resizer"></div></div><div class="${CSS_CLASSES.TIME_HEADER}">${this.renderSprintRow(sprints, timeUnits, cellWidth, workingDaysConfig, timeScale, weekStartsOn)}${timeRow}</div></div>`;
  }

  /**
   * Рендерит строку спринтов
   */
  private renderSprintRow(sprints: Sprint[], timeUnits: Date[], cellWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    if (!sprints || sprints.length === 0) {
      return '';
    }

    const sprintHtml = sprints.map((sprint, index) => {
      let width: number;
      if (timeScale === 'week') {
        // Для недель привязываем спринт к границам недель
        // Используем неделю, в которой больше дней спринта
        const sprintStartWeek = snapToWeekBoundary(sprint.start, sprint.start, sprint.end, weekStartsOn);
        const sprintEndWeek = snapToWeekBoundary(sprint.end, sprint.start, sprint.end, weekStartsOn);

        const startIndex = timeUnits.findIndex(week =>
          getWeekStart(week, weekStartsOn).getTime() === sprintStartWeek.getTime()
        );
        const endIndex = timeUnits.findIndex(week =>
          getWeekStart(week, weekStartsOn).getTime() === sprintEndWeek.getTime()
        );

        // Ширина = количество недель включительно
        const weeksCount = endIndex >= startIndex ? endIndex - startIndex + 1 : 1;
        width = weeksCount * cellWidth;
      } else {
        const sprintWorkingDays = getWorkingDaysBetween(sprint.start, sprint.end, workingDaysConfig);
        width = sprintWorkingDays * cellWidth;
      }
      const isLast = index === sprints.length - 1;

      return `<div class="gantt-sprint-header ${!isLast ? 'gantt-sprint-separator' : ''}" style="width: ${width}px;" data-sprint-id="${sprint.id}"> ${this.escapeHtml(sprint.name)} </div>`;
    }).join('');

    return `<div class="${CSS_CLASSES.SPRINT_ROW}">${sprintHtml}</div>`;
  }

  /**
   * Рендерит вертикальные линии-разделители спринтов
   */
  private renderSprintSeparators(sprints: Sprint[], timeUnits: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    if (!sprints || sprints.length === 0) {
      return '';
    }

    let currentPosition = 0;
    const separators: string[] = [];

    sprints.forEach((sprint, index) => {
      let width: number;
      if (timeScale === 'week') {
        // Используем ту же логику что и в renderSprintRow
        const sprintStartWeek = snapToWeekBoundary(sprint.start, sprint.start, sprint.end, weekStartsOn);
        const sprintEndWeek = snapToWeekBoundary(sprint.end, sprint.start, sprint.end, weekStartsOn);

        const startIndex = timeUnits.findIndex(week =>
          getWeekStart(week, weekStartsOn).getTime() === sprintStartWeek.getTime()
        );
        const endIndex = timeUnits.findIndex(week =>
          getWeekStart(week, weekStartsOn).getTime() === sprintEndWeek.getTime()
        );

        const weeksCount = endIndex >= startIndex ? endIndex - startIndex + 1 : 1;
        width = weeksCount * cellWidth;
      } else {
        const sprintWorkingDays = getWorkingDaysBetween(sprint.start, sprint.end, workingDaysConfig);
        width = sprintWorkingDays * cellWidth;
      }
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
  private renderTodayLine(workingDays: Date[], cellWidth: number, columnWidth: number, _workingDaysConfig: any): string {
    const today = getToday();

    // Находим индекс текущего дня в массиве рабочих дней
    const todayIndex = workingDays.findIndex(day => isSameDay(day, today));

    // Если сегодня не является рабочим днём (не в списке), не рисуем линию
    if (todayIndex === -1) {
      return '';
    }

    // Позиция линии: смещение колонки + позиция ячейки + половина ширины ячейки (центр)
    const linePosition = columnWidth + (todayIndex * cellWidth) + (cellWidth / 2);

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
   * Рендерит строку недель
   */
  private renderWeekRow(weeks: Date[], cellWidth: number, weekStartsOn: 0 | 1 = 1): string {
    const weekHtml = weeks.map(weekStart => {
      const weekRange = formatWeekRange(weekStart, weekStartsOn);

      return `<div class="gantt-day-header gantt-week-header" style="width: ${cellWidth}px;" data-date="${weekStart.toISOString().split('T')[0]}"><div class="gantt-day-number">${weekRange}</div><div class="gantt-day-name">неделя</div></div>`;
    }).join('');

    return `<div class="${CSS_CLASSES.DAY_ROW}">${weekHtml}</div>`;
  }

  /**
   * Рендерит все проекты
   */
  private renderProjects(data: GanttData, timeUnits: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    if (!data.projects || data.projects.length === 0) {
      return `<div class="${CSS_CLASSES.PROJECTS}"></div>`;
    }

    const projectsHtml = data.projects.map(project => {
      if (project.layout === 'multiline') {
        return this.renderProjectMultiline(project, data.startDate, timeUnits, cellWidth, columnWidth, workingDaysConfig, timeScale, weekStartsOn);
      } else {
        return this.renderProjectInline(project, data.startDate, timeUnits, cellWidth, columnWidth, workingDaysConfig, timeScale, weekStartsOn);
      }
    }).join('');

    return `<div class="${CSS_CLASSES.PROJECTS}">${projectsHtml}</div>`;
  }

  /**
   * Рендерит проект в inline режиме (все этапы на одной строке)
   */
  private renderProjectInline(project: Project, startDate: Date, _timeUnits: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    // Если проект без этапов и мелстоунов - НЕ рендерим вообще
    const hasStages = project.stages.length > 0;
    const hasMilestones = project.milestones.length > 0;

    if (!hasStages && !hasMilestones) {
      return '';
    }

    const stagesHtml = project.stages.map(stage =>
      this.renderStage(stage, startDate, cellWidth, workingDaysConfig, timeScale, weekStartsOn)
    ).join('');

    const milestonesHtml = project.milestones.map(milestone =>
      this.renderMilestone(milestone, startDate, cellWidth, workingDaysConfig, timeScale, weekStartsOn)
    ).join('');

    const projectNameHtml = this.parseLogseqLinks(project.name);

    return `<div class="${CSS_CLASSES.PROJECT_ROW}" data-project-id="${project.id}"><div class="${CSS_CLASSES.PROJECT_NAME}" style="width: ${columnWidth}px;"><div>${projectNameHtml}</div>${project.assignee ? `<span class="gantt-assignee">${this.escapeHtml(project.assignee.name)}</span>` : ''}</div><div class="${CSS_CLASSES.PROJECT_TIMELINE}">${stagesHtml}${milestonesHtml}</div></div>`;
  }

  /**
   * Рендерит проект в multiline режиме (каждый этап на отдельной строке)
   */
  private renderProjectMultiline(project: Project, startDate: Date, _timeUnits: Date[], cellWidth: number, columnWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    const milestonesHtml = project.milestones.map(milestone =>
      this.renderMilestone(milestone, startDate, cellWidth, workingDaysConfig, timeScale, weekStartsOn)
    ).join('');

    const projectNameHtml = this.parseLogseqLinks(project.name);

    const mainRow = `<div class="${CSS_CLASSES.PROJECT_ROW} gantt-project-main" data-project-id="${project.id}"><div class="${CSS_CLASSES.PROJECT_NAME}" style="width: ${columnWidth}px;"><div>${projectNameHtml}</div>${project.assignee ? `<span class="gantt-assignee">${this.escapeHtml(project.assignee.name)}</span>` : ''}</div><div class="${CSS_CLASSES.PROJECT_TIMELINE}">${milestonesHtml}</div></div>`;

    const stageRows = project.stages.map(stage => {
      const stageHtml = this.renderStage(stage, startDate, cellWidth, workingDaysConfig, timeScale, weekStartsOn);
      const stageNameHtml = this.parseLogseqLinks(stage.name);

      return `<div class="${CSS_CLASSES.PROJECT_ROW} gantt-stage-row" data-project-id="${project.id}" data-stage-id="${stage.id}"><div class="${CSS_CLASSES.PROJECT_NAME}" style="width: ${columnWidth}px;"><div> - ${stageNameHtml}</div>${stage.assignee ? `<span class="gantt-assignee">${this.escapeHtml(stage.assignee.name)}</span>` : ''}</div><div class="${CSS_CLASSES.PROJECT_TIMELINE}">${stageHtml}</div></div>`;
    }).join('');

    return mainRow + stageRows;
  }

  /**
   * Рендерит этап
   */
  private renderStage(stage: Stage, startDate: Date, cellWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    const position = this.getDatePosition(startDate, stage.start, cellWidth, workingDaysConfig, timeScale, weekStartsOn);
    const width = stage.duration * cellWidth;

    // В режиме недель stage.duration уже содержит количество недель,
    // в режиме дней - количество дней
    const durationLabel = stage.duration;

    // На таймлайне показываем только текст без ссылок
    const plainStageName = extractPlainText(stage.name);
    const plainAssigneeName = stage.assignee ? extractPlainText(stage.assignee.name) : '';

    return `<div class="${CSS_CLASSES.STAGE}" data-stage-id="${stage.id}" data-type="stage" style="left: ${position}px; width: ${width}px; background-color: ${stage.color};"><div class="gantt-stage-days" style="color: #202020">${durationLabel}</div><div class="gantt-stage-content"><div>${this.escapeHtml(plainStageName)}</div>${stage.assignee ? `<div class="gantt-stage-assignee">${this.escapeHtml(plainAssigneeName)}</div>` : ''}</div><div class="gantt-resize-handle gantt-resize-right"></div></div>`;
  }

  /**
   * Рендерит мелстоун
   */
  private renderMilestone(milestone: Milestone, startDate: Date, cellWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): string {
    const position = this.getDatePosition(startDate, milestone.date, cellWidth, workingDaysConfig, timeScale, weekStartsOn);
    // Фиксированное смещение: в режиме дней 20px, в режиме недель 40px
    const offset = timeScale === 'week' ? 27 : 10;
    const centerPosition = position + offset;
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
    return `<button class="gantt-edit-button" data-on-click="openGanttEditor" data-slot-id="${slotId}">✏</button><button class="gantt-export-button" data-on-click="exportGanttToPNG" data-slot-id="${slotId}">📷</button>`;
  }

  /**
   * Вычисляет позицию даты на временной шкале
   */
  private getDatePosition(startDate: Date, targetDate: Date, cellWidth: number, workingDaysConfig: any, timeScale: 'day' | 'week' = 'day', weekStartsOn: 0 | 1 = 1): number {
    if (timeScale === 'week') {
      const startWeek = getWeekStart(startDate, weekStartsOn);
      const targetWeek = getWeekStart(targetDate, weekStartsOn);
      const weeksDiff = Math.floor((targetWeek.getTime() - startWeek.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return Math.max(0, weeksDiff) * cellWidth;
    }

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
   * Парсит текст и преобразует Logseq ссылки и markdown-ссылки в кликабельные элементы
   * Поддерживает форматы:
   * - [[Page Name]], [[Page Name|Alias]] - Logseq ссылки
   * - [text](url) - Markdown ссылки
   */
  private parseLogseqLinks(text: string): string {
    // Парсим markdown-ссылки и Logseq-ссылки
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const logseqLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    // Заменяем на специальные плейсхолдеры, чтобы не конфликтовали
    const placeholders: string[] = [];
    let result = text;

    // Сначала заменяем Logseq ссылки на плейсхолдеры
    result = result.replace(logseqLinkRegex, (_match, pageName, alias) => {
      const displayText = alias || pageName;
      const escapedPageName = this.escapeHtml(pageName);
      const escapedDisplayText = this.escapeHtml(displayText);
      const link = `<a class="gantt-logseq-link" data-on-click="navigateToPage" data-page-name="${escapedPageName}" href="#" title="Перейти к ${escapedPageName}">${escapedDisplayText}</a>`;
      const placeholder = `__LOGSEQ_LINK_${placeholders.length}__`;
      placeholders.push(link);
      return placeholder;
    });

    // Затем заменяем markdown-ссылки на плейсхолдеры
    result = result.replace(markdownLinkRegex, (_match, linkText, url) => {
      const escapedUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const escapedText = this.escapeHtml(linkText);
      const link = `<a href="${escapedUrl}" class="gantt-logseq-link" target="_blank" rel="noopener noreferrer">${escapedText}</a>`;
      const placeholder = `__LOGSEQ_LINK_${placeholders.length}__`;
      placeholders.push(link);
      return placeholder;
    });

    // Экранируем оставшийся текст
    result = this.escapeHtml(result);

    // Восстанавливаем ссылки из плейсхолдеров
    placeholders.forEach((link, index) => {
      result = result.replace(`__LOGSEQ_LINK_${index}__`, link);
    });

    return result;
  }
}
