/**
 * ColumnResizer
 * Handles resizing of the project name column
 */

export class ColumnResizer {
  private container: HTMLElement;
  private resizer: HTMLElement | null = null;
  private isResizing: boolean = false;
  private startX: number = 0;
  private startWidth: number = 0;
  private minWidth: number = 120;
  private maxWidth: number = 400;
  private doc: Document;

  constructor(container: HTMLElement) {
    this.container = container;
    // Получаем правильный document для iframe Logseq
    this.doc = (parent && (parent as any).document) ? (parent as any).document : document;

    // Восстанавливаем сохранённую ширину ДО инициализации событий
    // чтобы предотвратить "мерцание" при перерисовке
    this.restoreWidth();

    this.init();
  }

  /**
   * Инициализирует обработчики событий
   */
  private init(): void {
    this.resizer = this.container.querySelector('.gantt-column-resizer');

    if (!this.resizer) {
      return;
    }

    this.resizer.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.doc.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.doc.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  /**
   * Обрабатывает начало изменения размера
   */
  private handleMouseDown(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    this.isResizing = true;
    this.startX = e.clientX;

    const projectHeader = this.container.querySelector('.gantt-project-header') as HTMLElement;
    if (projectHeader) {
      this.startWidth = projectHeader.offsetWidth;
    }

    if (this.resizer) {
      this.resizer.classList.add('gantt-resizing');
    }

    // Предотвращаем выделение текста
    this.doc.body.style.userSelect = 'none';
    this.doc.body.style.cursor = 'col-resize';
  }

  /**
   * Обрабатывает движение мыши
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isResizing) {
      return;
    }

    const deltaX = e.clientX - this.startX;
    let newWidth = this.startWidth + deltaX;

    // Ограничиваем ширину
    newWidth = Math.max(this.minWidth, Math.min(this.maxWidth, newWidth));

    // Применяем новую ширину ко всем элементам
    this.applyWidth(newWidth);
  }

  /**
   * Обрабатывает окончание изменения размера
   */
  private handleMouseUp(): void {
    if (!this.isResizing) {
      return;
    }

    this.isResizing = false;

    if (this.resizer) {
      this.resizer.classList.remove('gantt-resizing');
    }

    // Восстанавливаем стили
    this.doc.body.style.userSelect = '';
    this.doc.body.style.cursor = '';

    // Сохраняем ширину в localStorage
    const projectHeader = this.container.querySelector('.gantt-project-header') as HTMLElement;
    if (projectHeader) {
      const width = projectHeader.offsetWidth;
      localStorage.setItem('gantt-column-width', width.toString());
    }
  }

  /**
   * Применяет новую ширину ко всем колонкам
   */
  private applyWidth(width: number): void {
    const elements = [
      ...Array.from(this.container.querySelectorAll('.gantt-project-header')),
      ...Array.from(this.container.querySelectorAll('.gantt-project-name'))
    ];

    elements.forEach((el: Element) => {
      (el as HTMLElement).style.width = `${width}px`;
    });

    // Обновляем ширину таблицы
    this.updateTableWidth(width);

    // Обновляем позицию вертикальных линий спринтов
    this.updateSprintSeparators(width);
  }

  /**
   * Обновляет общую ширину таблицы
   */
  private updateTableWidth(columnWidth: number): void {
    const table = this.container.querySelector('.gantt-table') as HTMLElement;
    if (!table) return;

    // Получаем ширину временной шкалы через сумму ширин всех ячеек дней
    const dayHeaders = this.container.querySelectorAll('.gantt-day-header');
    if (dayHeaders.length === 0) return;

    // Вычисляем точную ширину временной шкалы
    let timelineWidth = 0;
    dayHeaders.forEach((cell: Element) => {
      const cellElement = cell as HTMLElement;
      // Используем offsetWidth для получения реальной ширины включая border
      timelineWidth += cellElement.offsetWidth;
    });

    // Вычисляем общую ширину: колонка названий + временная шкала
    const totalWidth = columnWidth + timelineWidth;

    table.style.width = `${totalWidth}px`;
  }

  /**
   * Обновляет позицию вертикальных линий-разделителей спринтов
   */
  private updateSprintSeparators(columnWidth: number): void {
    const separators = this.container.querySelectorAll('.gantt-sprint-separator-line');
    if (separators.length === 0) return;

    // Получаем заголовки спринтов для вычисления их ширины
    const sprintHeaders = this.container.querySelectorAll('.gantt-sprint-header');
    if (sprintHeaders.length === 0) return;

    let currentPosition = 0;

    sprintHeaders.forEach((header, index) => {
      const headerElement = header as HTMLElement;
      const width = headerElement.offsetWidth;
      currentPosition += width;

      // Обновляем позицию соответствующего разделителя
      if (index < separators.length) {
        const separator = separators[index] as HTMLElement;
        separator.style.left = `${columnWidth + currentPosition}px`;
      }
    });
  }

  /**
   * Восстанавливает сохранённую ширину
   */
  restoreWidth(): void {
    const savedWidth = localStorage.getItem('gantt-column-width');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width) && width >= this.minWidth && width <= this.maxWidth) {
        this.applyWidth(width);
      }
    }
  }

  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    if (this.resizer) {
      this.resizer.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    }
    this.doc.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    this.doc.removeEventListener('mouseup', this.handleMouseUp.bind(this));
  }
}
