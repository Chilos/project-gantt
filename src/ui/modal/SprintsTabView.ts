/**
 * SprintsTabView
 * Handles rendering and user interactions for the Sprints tab in EditorModal
 */

import type { GanttData, Sprint } from '../../types';
import { generateId } from '../../utils/encoding';
import { formatDateISO, parseDateISO, getWeekStart, getWeekEnd } from '../../utils/dateUtils';

export class SprintsTabView {
  private container: HTMLElement;
  private data: GanttData;
  private escapeHtml: (str: string) => string;

  constructor(container: HTMLElement, data: GanttData, escapeHtml: (str: string) => string) {
    this.container = container;
    this.data = data;
    this.escapeHtml = escapeHtml;
  }

  /**
   * Рендерит вкладку спринтов
   */
  render(): void {
    const listContainer = this.container.querySelector('#gantt-items-list');
    const formContainer = this.container.querySelector('#gantt-editor-form');
    if (!listContainer || !formContainer) return;

    listContainer.innerHTML = `
      <div class="gantt-list-header">
        <h3>Спринты</h3>
        <button class="gantt-btn-icon" data-action="add-sprint" title="Добавить спринт">+</button>
      </div>
      <div class="gantt-list-items">
        ${this.data.sprints.map(sprint => this.renderSprintListItem(sprint)).join('')}
      </div>
    `;

    formContainer.innerHTML = '<div class="gantt-form-placeholder">Выберите спринт или создайте новый</div>';

    // Обработчики
    const addBtn = listContainer.querySelector('[data-action="add-sprint"]');
    addBtn?.addEventListener('click', () => this.showAddSprintForm());

    const sprintItems = listContainer.querySelectorAll('.gantt-list-item');
    sprintItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const sprintId = (e.currentTarget as HTMLElement).dataset.sprintId;
        const sprint = this.data.sprints.find(s => s.id === sprintId);
        if (sprint) {
          this.showEditSprintForm(sprint);
        }
      });
    });
  }

  /**
   * Рендерит элемент спринта в списке
   */
  private renderSprintListItem(sprint: Sprint): string {
    return `
      <div class="gantt-list-item" data-sprint-id="${sprint.id}">
        <div class="gantt-list-item-name">${this.escapeHtml(sprint.name)}</div>
        <div class="gantt-list-item-meta">${formatDateISO(sprint.start)} - ${formatDateISO(sprint.end)}</div>
      </div>
    `;
  }

  /**
   * Обновляет отображение спринта в списке без полного перерендера
   */
  private updateSprintListDisplay(sprint: Sprint): void {
    const listContainer = this.container.querySelector('#gantt-items-list');
    if (!listContainer) return;

    const sprintItem = listContainer.querySelector(`[data-sprint-id="${sprint.id}"]`);
    if (sprintItem) {
      const nameElement = sprintItem.querySelector('.gantt-list-item-name');
      const metaElement = sprintItem.querySelector('.gantt-list-item-meta');

      if (nameElement) {
        nameElement.textContent = sprint.name;
      }

      if (metaElement) {
        metaElement.textContent = `${formatDateISO(sprint.start)} - ${formatDateISO(sprint.end)}`;
      }
    }
  }

  /**
   * Показывает форму добавления спринта
   */
  private showAddSprintForm(): void {
    this.showSprintForm(null);
  }

  /**
   * Показывает форму редактирования спринта
   */
  private showEditSprintForm(sprint: Sprint): void {
    this.showSprintForm(sprint);
  }

  /**
   * Показывает форму спринта
   */
  private showSprintForm(sprint: Sprint | null): void {
    const formContainer = this.container.querySelector('#gantt-editor-form');
    if (!formContainer) return;

    const isEdit = sprint !== null;
    const timeScale = this.data.timeScale || 'day';

    let defaultStartDate: Date;
    if (isEdit) {
      defaultStartDate = sprint.start;
    } else if (this.data.sprints.length > 0) {
      const lastSprint = this.data.sprints[this.data.sprints.length - 1];
      defaultStartDate = new Date(lastSprint.end.getTime() + 24 * 60 * 60 * 1000);
    } else {
      defaultStartDate = this.data.startDate;
    }

    const weekStartsOn = this.data.weekStartsOn || 1;

    if (timeScale === 'week') {
      defaultStartDate = getWeekStart(defaultStartDate, weekStartsOn);
    }

    let defaultEndDate: Date;
    if (isEdit) {
      defaultEndDate = sprint.end;
    } else {
      defaultEndDate = new Date(defaultStartDate.getTime() + 13 * 24 * 60 * 60 * 1000);
    }

    let defaultStartMonday: Date;
    let defaultEndMonday: Date;

    if (timeScale === 'week') {
      defaultStartMonday = getWeekStart(defaultStartDate, weekStartsOn);

      if (isEdit) {
        defaultEndMonday = getWeekStart(defaultEndDate, weekStartsOn);
      } else {
        const endWeekSunday = getWeekEnd(defaultEndDate, weekStartsOn);
        defaultEndMonday = getWeekStart(endWeekSunday, weekStartsOn);
      }
    } else {
      defaultStartMonday = defaultStartDate;
      defaultEndMonday = defaultEndDate;
    }

    let weekOptions = '';
    if (timeScale === 'week') {
      const weeks: Date[] = [];
      const current = getWeekStart(this.data.startDate, weekStartsOn);
      const end = getWeekEnd(this.data.endDate, weekStartsOn);

      while (current <= end) {
        weeks.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }

      weekOptions = weeks.map(week => {
        const weekEnd = getWeekEnd(week, weekStartsOn);
        const weekLabel = `${formatDateISO(week)} — ${formatDateISO(weekEnd)} (неделя)`;
        return `<option value="${formatDateISO(week)}">${weekLabel}</option>`;
      }).join('');
    }

    formContainer.innerHTML = `
      <div class="gantt-form">
        <h3>${isEdit ? 'Редактирование спринта' : 'Новый спринт'}</h3>

        <div class="gantt-form-group">
          <label>Название спринта *</label>
          <input type="text" id="sprint-name" value="${isEdit ? this.escapeHtml(sprint.name) : ''}" placeholder="Спринт 1" />
        </div>

        ${timeScale === 'week' ? `
          <div class="gantt-form-group">
            <label>Неделя начала *</label>
            <select id="sprint-start">
              ${weekOptions}
            </select>
            <small>Выберите понедельник недели начала спринта</small>
          </div>

          <div class="gantt-form-group">
            <label>Неделя окончания *</label>
            <select id="sprint-end">
              ${weekOptions}
            </select>
            <small>Выберите понедельник недели окончания спринта</small>
          </div>
        ` : `
          <div class="gantt-form-group">
            <label>Дата начала *</label>
            <input type="date" id="sprint-start" value="${formatDateISO(defaultStartMonday)}" />
          </div>

          <div class="gantt-form-group">
            <label>Дата окончания *</label>
            <input type="date" id="sprint-end" value="${formatDateISO(defaultEndMonday)}" />
          </div>
        `}

        <div class="gantt-form-actions">
          ${isEdit ? `
            <button class="gantt-btn gantt-btn-danger" data-action="delete-sprint">Удалить</button>
          ` : `
            <button class="gantt-btn gantt-btn-primary" data-action="create-sprint">Создать</button>
          `}
        </div>
        ${isEdit ? `
          <div class="gantt-form-hint">
            <small>Изменения будут сохранены при нажатии кнопки "Сохранить" внизу</small>
          </div>
        ` : ''}
      </div>
    `;

    if (timeScale === 'week') {
      const startSelect = formContainer.querySelector('#sprint-start') as HTMLSelectElement;
      const endSelect = formContainer.querySelector('#sprint-end') as HTMLSelectElement;

      if (startSelect) {
        startSelect.value = formatDateISO(defaultStartMonday);
      }
      if (endSelect) {
        endSelect.value = formatDateISO(defaultEndMonday);
      }
    }

    this.setupSprintFormHandlers(sprint);
  }

  /**
   * Настраивает обработчики формы спринта
   */
  private setupSprintFormHandlers(sprint: Sprint | null): void {
    const form = this.container.querySelector('#gantt-editor-form');
    if (!form) return;

    const startElement = form.querySelector('#sprint-start') as HTMLInputElement | HTMLSelectElement;
    const endElement = form.querySelector('#sprint-end') as HTMLInputElement | HTMLSelectElement;
    const timeScale = this.data.timeScale || 'day';

    if (timeScale === 'week') {
      startElement?.addEventListener('change', () => {
        if (!sprint && endElement) {
          const startDate = parseDateISO(startElement.value);
          const newEndDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
          const weekStart = getWeekStart(newEndDate, this.data.weekStartsOn || 1);
          endElement.value = formatDateISO(weekStart);
        }
      });
    } else {
      if (!sprint) {
        startElement?.addEventListener('change', () => {
          const startDate = parseDateISO(startElement.value);
          const newEndDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
          if (endElement) {
            endElement.value = formatDateISO(newEndDate);
          }
        });
      }
    }

    const createBtn = form.querySelector('[data-action="create-sprint"]');
    createBtn?.addEventListener('click', () => this.handleCreateSprint());

    const deleteBtn = form.querySelector('[data-action="delete-sprint"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteSprint(sprint!));

    if (sprint) {
      const nameInput = form.querySelector('#sprint-name') as HTMLInputElement;

      nameInput?.addEventListener('input', () => {
        if (sprint) {
          sprint.name = nameInput.value.trim();
          this.updateSprintListDisplay(sprint);
        }
      });

      startElement?.addEventListener('change', () => {
        if (sprint) {
          const selectedDate = parseDateISO(startElement.value);

          if (timeScale === 'week') {
            const normalized = getWeekStart(selectedDate, this.data.weekStartsOn || 1);
            sprint.start = normalized;
            startElement.value = formatDateISO(normalized);
          } else {
            sprint.start = selectedDate;
          }

          this.updateSprintListDisplay(sprint);
        }
      });

      endElement?.addEventListener('change', () => {
        if (sprint) {
          const selectedDate = parseDateISO(endElement.value);

          if (timeScale === 'week') {
            const normalized = getWeekEnd(selectedDate, this.data.weekStartsOn || 1);
            sprint.end = normalized;
            const endMonday = getWeekStart(normalized, this.data.weekStartsOn || 1);
            endElement.value = formatDateISO(endMonday);
          } else {
            sprint.end = selectedDate;
          }

          this.updateSprintListDisplay(sprint);
        }
      });
    }
  }

  private handleCreateSprint(): void {
    const name = (this.container.querySelector('#sprint-name') as HTMLInputElement)?.value.trim();
    const startStr = (this.container.querySelector('#sprint-start') as HTMLInputElement)?.value;
    const endStr = (this.container.querySelector('#sprint-end') as HTMLInputElement)?.value;

    if (!name || !startStr || !endStr) {
      logseq.UI.showMsg('Заполните все поля', 'warning');
      return;
    }

    const timeScale = this.data.timeScale || 'day';
    let startDate = parseDateISO(startStr);
    let endDate = parseDateISO(endStr);

    if (timeScale === 'week') {
      const weekStartsOn = this.data.weekStartsOn || 1;
      startDate = getWeekStart(startDate, weekStartsOn);
      endDate = getWeekEnd(endDate, weekStartsOn);
    }

    const sprintId = generateId();
    const newSprint: Sprint = {
      id: sprintId,
      name,
      start: startDate,
      end: endDate,
    };

    this.data.sprints.push(newSprint);
    this.render();
    logseq.UI.showMsg('✅ Спринт создан', 'success');
  }

  private handleDeleteSprint(sprint: Sprint): void {
    if (!confirm(`Удалить спринт "${sprint.name}"?`)) return;

    this.data.sprints = this.data.sprints.filter(s => s.id !== sprint.id);
    this.render();
    logseq.UI.showMsg('✅ Спринт удален', 'success');
  }
}
