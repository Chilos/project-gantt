/**
 * VisualEditor
 * Interactive Gantt chart editor with drag-and-drop functionality
 */

import type { GanttData, Stage, Milestone, WorkingDaysConfig } from '../types';
import { GanttDataManager } from '../storage/GanttDataManager';
import { DEFAULT_CELL_WIDTH } from '../utils/constants';
import {
  getDatePosition,
  getDateFromPosition,
  getPositionLimits,
  snapToGrid,
  constrainPosition,
  getDurationFromWidth,
  getWidthFromDuration,
} from '../utils/positionUtils';
import { clampDate, getStageEndDate } from '../utils/dateUtils';
import { PLUGIN_NAME } from '../utils/constants';

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  dragTarget: HTMLElement | null;
  dragType: 'stage' | 'milestone' | null;
  resizeType: 'left' | 'right' | null;
  dragOffset: { x: number; y: number };
  initialStageStart: Date | null;
  initialStageDuration: number | null;
}

export class VisualEditor {
  private data: GanttData;
  private blockUuid: string;
  private storage: GanttDataManager;
  private container: HTMLElement | null = null;
  private cellWidth: number = DEFAULT_CELL_WIDTH;
  private dragState: DragState;
  private preservedPositions: Map<string, string> = new Map();
  private preservedSizes: Map<string, { width: string; left: string }> = new Map();
  private doc: Document;

  constructor(data: GanttData, blockUuid: string) {
    this.data = data;
    this.blockUuid = blockUuid;
    this.storage = new GanttDataManager();
    // Получаем правильный document для iframe Logseq
    this.doc = (parent && (parent as any).document) ? (parent as any).document : document;

    // Для недельного режима ширина ячейки в 2 раза больше
    const timeScale = data.timeScale || 'day';
    this.cellWidth = timeScale === 'week' ? DEFAULT_CELL_WIDTH * 2 : DEFAULT_CELL_WIDTH;

    this.dragState = {
      isDragging: false,
      isResizing: false,
      dragTarget: null,
      dragType: null,
      resizeType: null,
      dragOffset: { x: 0, y: 0 },
      initialStageStart: null,
      initialStageDuration: null,
    };
  }

  /**
   * Показывает визуальный редактор в модальном окне
   */
  show(): void {
    // TODO: Implement modal UI
    logseq.UI.showMsg('Визуальный редактор в разработке. Пока доступно только чтение.', 'info');
  }

  /**
   * Инициализирует обработчики событий для drag-and-drop
   */
  setupEventListeners(container: HTMLElement): void {
    this.container = container;

    // Обработка перетаскивания
    container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    // Используем правильный document для iframe
    this.doc.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.doc.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  /**
   * Обрабатывает начало перетаскивания
   */
  private handleMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Проверяем resize хендлы
    if (target.classList.contains('gantt-resize-handle')) {
      const stageElement = target.parentElement;
      if (stageElement && stageElement.classList.contains('gantt-stage')) {
        this.dragState.isResizing = true;
        this.dragState.dragTarget = stageElement;
        this.dragState.dragType = 'stage';
        this.dragState.resizeType = 'right'; // Только правый resize

        // Сохраняем исходные данные этапа
        const stageId = stageElement.dataset.stageId;
        const stage = this.findStageById(stageId!);
        if (stage) {
          this.dragState.initialStageStart = new Date(stage.start);
          this.dragState.initialStageDuration = stage.duration;
        }

        target.classList.add('gantt-resizing');
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // Обычное перетаскивание
    const stageElement = target.closest('.gantt-stage') as HTMLElement;
    const milestoneElement = target.closest('.gantt-milestone') as HTMLElement;
    const dragElement = stageElement || milestoneElement;

    if (dragElement) {
      this.dragState.isDragging = true;
      this.dragState.dragTarget = dragElement;
      this.dragState.dragType = dragElement.dataset.type as 'stage' | 'milestone';

      // Сохраняем исходные данные для перетаскивания
      if (this.dragState.dragType === 'stage') {
        const stageId = dragElement.dataset.stageId;
        const stage = this.findStageById(stageId!);
        if (stage) {
          this.dragState.initialStageStart = new Date(stage.start);
          this.dragState.initialStageDuration = stage.duration;
        }
      }

      // Вычисляем offset мыши относительно элемента
      const rect = dragElement.getBoundingClientRect();
      this.dragState.dragOffset.x = e.clientX - rect.left;
      this.dragState.dragOffset.y = e.clientY - rect.top;

      dragElement.classList.add('gantt-dragging');
      e.preventDefault();
    }
  }

  /**
   * Обрабатывает движение мыши во время перетаскивания
   */
  private handleMouseMove(e: MouseEvent): void {
    if ((!this.dragState.isDragging && !this.dragState.isResizing) || !this.dragState.dragTarget) {
      return;
    }

    const timeline = this.dragState.dragTarget.parentElement;
    if (!timeline) return;

    const timelineRect = timeline.getBoundingClientRect();

    if (this.dragState.isResizing) {
      // Плавный resize
      const mouseX = e.clientX - timelineRect.left;

      const stageId = this.dragState.dragTarget.dataset.stageId;
      const stage = this.findStageById(stageId!);
      if (!stage || !this.dragState.initialStageStart) return;

      const config = this.getWorkingDaysConfig();
      const timeScale = this.data.timeScale || 'day';
      const startPosition = getDatePosition(this.data.startDate, stage.start, this.cellWidth, config, timeScale);

      // Ограничиваем минимальную ширину
      const minMouseX = startPosition + this.cellWidth * 0.5;
      const clampedMouseX = Math.max(minMouseX, mouseX);

      // Плавное изменение визуального размера
      const newWidth = clampedMouseX - startPosition;
      this.dragState.dragTarget.style.width = `${newWidth}px`;
    } else {
      // Обычное перетаскивание
      const x = e.clientX - timelineRect.left - this.dragState.dragOffset.x;
      let gridPosition = snapToGrid(x, this.cellWidth);

      // Для milestone добавляем фиксированное смещение
      if (this.dragState.dragType === 'milestone') {
        const timeScale = this.data.timeScale || 'day';
        // В режиме дней: 20px, в режиме недель: 40px
        const offset = timeScale === 'week' ? 27 : 10;
        gridPosition = gridPosition + offset;
      }

      // Ограничиваем перетаскивание в пределах временной шкалы
      const config = this.getWorkingDaysConfig();
      const timeScale = this.data.timeScale || 'day';
      const { minPosition, maxPosition } = getPositionLimits(
        this.data.startDate,
        this.data.endDate,
        this.cellWidth,
        config,
        timeScale
      );

      let constrainedPosition = gridPosition;
      if (this.dragState.dragType === 'stage') {
        const stageWidth = parseInt(this.dragState.dragTarget.style.width) || 0;
        constrainedPosition = constrainPosition(gridPosition, stageWidth, minPosition, maxPosition);
      } else if (this.dragState.dragType === 'milestone') {
        // Для milestone учитываем фиксированное смещение
        const offset = timeScale === 'week' ? 27 : 10;
        constrainedPosition = Math.max(minPosition + offset, Math.min(maxPosition + offset, gridPosition));
      } else {
        constrainedPosition = constrainPosition(gridPosition, 0, minPosition, maxPosition);
      }

      // Визуальная индикация при достижении границ
      if (constrainedPosition !== gridPosition) {
        this.dragState.dragTarget.classList.add('gantt-boundary-constraint');
      } else {
        this.dragState.dragTarget.classList.remove('gantt-boundary-constraint');
      }

      this.dragState.dragTarget.style.left = `${constrainedPosition}px`;
    }
  }

  /**
   * Обрабатывает окончание перетаскивания
   */
  private handleMouseUp(e: MouseEvent): void {
    if ((!this.dragState.isDragging && !this.dragState.isResizing) || !this.dragState.dragTarget) {
      return;
    }

    // Убираем классы
    this.dragState.dragTarget.classList.remove('gantt-dragging', 'gantt-boundary-constraint');

    const resizeHandle = e.target as HTMLElement;
    if (resizeHandle && resizeHandle.classList.contains('gantt-resize-handle')) {
      resizeHandle.classList.remove('gantt-resizing');
    }

    if (this.dragState.isResizing) {
      // Обновление данных после resize
      const stageId = this.dragState.dragTarget.dataset.stageId;
      const stage = this.findStageById(stageId!);

      if (stage && this.dragState.initialStageStart && this.dragState.initialStageDuration) {
        const currentWidth = parseFloat(this.dragState.dragTarget.style.width.replace('px', ''));
        const newDuration = getDurationFromWidth(currentWidth, this.cellWidth);

        if (newDuration > 0) {
          stage.duration = newDuration;
        }

        // Финальная привязка к сетке
        const config = this.getWorkingDaysConfig();
        const timeScale = this.data.timeScale || 'day';
        const finalPosition = getDatePosition(this.data.startDate, stage.start, this.cellWidth, config, timeScale);
        const finalWidth = getWidthFromDuration(stage.duration, this.cellWidth);

        this.dragState.dragTarget.style.left = `${finalPosition}px`;
        this.dragState.dragTarget.style.width = `${finalWidth}px`;

        // Сохраняем финальные размеры
        if (stageId) {
          this.preservedSizes.set(stageId, {
            width: `${finalWidth}px`,
            left: `${finalPosition}px`,
          });
        }
      }
    } else {
      // Обновление данных после drag
      this.updateItemPosition(this.dragState.dragTarget);

      const elementId = this.dragState.dragTarget.dataset.stageId || this.dragState.dragTarget.dataset.milestoneId;
      if (elementId) {
        this.preservedPositions.set(elementId, this.dragState.dragTarget.style.left);
      }
    }

    // Сохраняем изменения
    this.saveData().then(() => {
      setTimeout(() => {
        this.preservedPositions.clear();
        this.preservedSizes.clear();
      }, 100);
    });

    // Сбрасываем состояние
    this.dragState = {
      isDragging: false,
      isResizing: false,
      dragTarget: null,
      dragType: null,
      resizeType: null,
      dragOffset: { x: 0, y: 0 },
      initialStageStart: null,
      initialStageDuration: null,
    };
  }

  /**
   * Обновляет позицию элемента в данных
   */
  private updateItemPosition(element: HTMLElement): void {
    let leftValue = parseFloat(element.style.left.replace('px', ''));

    // Для milestone нужно вычесть фиксированное смещение
    if (this.dragState.dragType === 'milestone') {
      const timeScale = this.data.timeScale || 'day';
      const offset = timeScale === 'week' ? 27 : 10;
      leftValue = leftValue - offset;
    }

    const config = this.getWorkingDaysConfig();
    const timeScale = this.data.timeScale || 'day';
    const newDate = getDateFromPosition(this.data.startDate, leftValue, this.cellWidth, config, timeScale);

    if (this.dragState.dragType === 'stage') {
      const stageId = element.dataset.stageId;
      const stage = this.findStageById(stageId!);

      if (stage && this.dragState.initialStageStart && this.dragState.initialStageDuration) {
        const originalDuration = this.dragState.initialStageDuration;

        let newStartDate = new Date(newDate);
        let newEndDate = getStageEndDate(newStartDate, originalDuration);

        // Проверяем границы
        if (newStartDate < this.data.startDate) {
          newStartDate = new Date(this.data.startDate);
          newEndDate = getStageEndDate(newStartDate, originalDuration);
        }

        if (newEndDate > this.data.endDate) {
          // Если конечная дата выходит за границу, используем текущую визуальную позицию
          // без пересчета, так как constrainPosition уже правильно ограничил позицию
          newStartDate = new Date(newDate);
        }

        stage.start = newStartDate;
        stage.duration = originalDuration;
      }
    } else if (this.dragState.dragType === 'milestone') {
      const milestoneId = element.dataset.milestoneId;
      const milestone = this.findMilestoneById(milestoneId!);

      if (milestone) {
        milestone.date = clampDate(newDate, this.data.startDate, this.data.endDate);
      }
    }
  }

  /**
   * Находит этап по ID
   */
  private findStageById(id: string): Stage | null {
    for (const project of this.data.projects) {
      const stage = project.stages.find(s => s.id === id);
      if (stage) return stage;
    }
    return null;
  }

  /**
   * Находит мелстоун по ID
   */
  private findMilestoneById(id: string): Milestone | null {
    for (const project of this.data.projects) {
      const milestone = project.milestones.find(m => m.id === id);
      if (milestone) return milestone;
    }
    return null;
  }

  /**
   * Получает конфигурацию рабочих дней
   */
  private getWorkingDaysConfig(): WorkingDaysConfig {
    return {
      excludeWeekdays: this.data.excludeWeekdays,
      includeDates: this.data.includeDates,
      excludeDates: this.data.excludeDates,
    };
  }

  /**
   * Сохраняет данные
   */
  private async saveData(): Promise<void> {
    try {
      await this.storage.save(this.blockUuid, this.data);
      logseq.UI.showMsg('✅ Изменения сохранены', 'success');
    } catch (error) {
      console.error(`[${PLUGIN_NAME}] Failed to save:`, error);
      logseq.UI.showMsg('❌ Ошибка сохранения', 'error');
    }
  }

  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    if (this.container) {
      this.container.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    }
    // Используем правильный document для iframe
    this.doc.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.doc.removeEventListener('mouseup', this.handleMouseUp.bind(this));

    this.preservedPositions.clear();
    this.preservedSizes.clear();
  }
}
