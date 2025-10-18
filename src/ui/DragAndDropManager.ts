/**
 * DragAndDropManager
 * Manages drag-and-drop reordering for projects and stages
 */

import type { Project, Stage } from '../types';

export class DragAndDropManager {
  private draggedElement: HTMLElement | null = null;
  private draggedIndex: number = -1;
  private dropZone: HTMLElement | null = null;

  /**
   * Настраивает drag-and-drop для списка проектов
   */
  setupProjectsDragAndDrop(
    listContainer: HTMLElement,
    projects: Project[],
    onReorder: (projects: Project[]) => void
  ): void {
    const items = listContainer.querySelectorAll('.gantt-list-item');

    items.forEach((item, index) => {
      this.setupDraggable(item as HTMLElement, index, () => {
        // Reorder projects array
        const newProjects = [...projects];
        const [removed] = newProjects.splice(this.draggedIndex, 1);
        newProjects.splice(index, 0, removed);
        onReorder(newProjects);
      });
    });
  }

  /**
   * Настраивает drag-and-drop для этапов проекта
   */
  setupStagesDragAndDrop(
    listContainer: HTMLElement,
    stages: Stage[],
    onReorder: (stages: Stage[]) => void
  ): void {
    const items = listContainer.querySelectorAll('.gantt-stage-item');

    items.forEach((item, index) => {
      this.setupDraggable(item as HTMLElement, index, () => {
        // Reorder stages array
        const newStages = [...stages];
        const [removed] = newStages.splice(this.draggedIndex, 1);
        newStages.splice(index, 0, removed);
        onReorder(newStages);
      });
    });
  }

  /**
   * Делает элемент перетаскиваемым
   */
  private setupDraggable(
    element: HTMLElement,
    index: number,
    onDrop: () => void
  ): void {
    element.setAttribute('draggable', 'true');

    element.addEventListener('dragstart', (e) => {
      this.draggedElement = element;
      this.draggedIndex = index;
      element.classList.add('gantt-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    element.addEventListener('dragend', () => {
      element.classList.remove('gantt-dragging');
      if (this.dropZone) {
        this.dropZone.classList.remove('gantt-drag-over');
      }
      this.draggedElement = null;
      this.dropZone = null;
    });

    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      if (this.draggedElement && element !== this.draggedElement) {
        element.classList.add('gantt-drag-over');
        this.dropZone = element;
      }
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('gantt-drag-over');
    });

    element.addEventListener('drop', (e) => {
      e.preventDefault();
      element.classList.remove('gantt-drag-over');

      if (this.draggedElement && element !== this.draggedElement) {
        onDrop();
      }
    });
  }

  /**
   * Очистка всех обработчиков
   */
  cleanup(): void {
    this.draggedElement = null;
    this.dropZone = null;
  }
}
