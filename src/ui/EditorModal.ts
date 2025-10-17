/**
 * EditorModal
 * Full-featured modal editor for managing Gantt chart elements
 */

import type { GanttData, Project, Stage, Milestone, Sprint } from '../types';
import { GanttDataManager } from '../storage/GanttDataManager';
import { generateId } from '../utils/encoding';
import { formatDateISO, parseDateISO, getWeekStart, getWeekEnd } from '../utils/dateUtils';
import { DEFAULT_STAGE_COLORS, DEFAULT_MILESTONE_COLORS, PLUGIN_NAME } from '../utils/constants';

export class EditorModal {
  private data: GanttData;
  private blockUuid: string;
  private storage: GanttDataManager;
  private modalElement: HTMLElement | null = null;
  private selectedProject: Project | null = null;
  private doc: Document;

  constructor(data: GanttData, blockUuid: string) {
    this.data = data;
    this.blockUuid = blockUuid;
    this.storage = new GanttDataManager();
    // Получаем правильный document (parent для iframe или обычный document)
    this.doc = (parent && (parent as any).document) ? (parent as any).document : document;
  }

  /**
   * Показывает модальное окно редактора
   */
  show(): void {
    this.createModal();
    this.renderModalContent();
    this.doc.body.appendChild(this.modalElement!);
  }

  /**
   * Скрывает модальное окно
   */
  hide(): void {
    if (this.modalElement && this.modalElement.parentNode) {
      this.modalElement.parentNode.removeChild(this.modalElement);
    }
    this.modalElement = null;
  }

  /**
   * Создает структуру модального окна
   */
  private createModal(): void {
    this.modalElement = this.doc.createElement('div');
    this.modalElement.className = 'gantt-editor-modal';
    this.modalElement.innerHTML = `
      <div class="gantt-editor-overlay"></div>
      <div class="gantt-editor-container">
        <div class="gantt-editor-header">
          <h2>Редактор Gantt диаграммы</h2>
          <button class="gantt-editor-close" data-action="close">✕</button>
        </div>
        <div class="gantt-editor-body">
          <div class="gantt-editor-sidebar">
            <div class="gantt-editor-tabs">
              <button class="gantt-tab active" data-tab="projects">Проекты</button>
              <button class="gantt-tab" data-tab="sprints">Спринты</button>
              <button class="gantt-tab" data-tab="settings">Настройки</button>
            </div>
            <div class="gantt-editor-list" id="gantt-items-list"></div>
          </div>
          <div class="gantt-editor-content">
            <div id="gantt-editor-form"></div>
          </div>
        </div>
        <div class="gantt-editor-footer">
          <button class="gantt-btn gantt-btn-secondary" data-action="close">Отмена</button>
          <button class="gantt-btn gantt-btn-primary" data-action="save">Сохранить</button>
        </div>
      </div>
    `;

    // Обработчики событий
    this.setupEventListeners();
  }

  /**
   * Настраивает обработчики событий
   */
  private setupEventListeners(): void {
    if (!this.modalElement) return;

    // Закрытие модального окна
    const closeButtons = this.modalElement.querySelectorAll('[data-action="close"]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    // Клик по overlay
    const overlay = this.modalElement.querySelector('.gantt-editor-overlay');
    overlay?.addEventListener('click', () => this.hide());

    // Сохранение
    const saveButton = this.modalElement.querySelector('[data-action="save"]');
    saveButton?.addEventListener('click', () => this.handleSave());

    // Переключение табов
    const tabs = this.modalElement.querySelectorAll('.gantt-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        this.switchTab(tabName!);
      });
    });
  }

  /**
   * Переключает вкладку
   */
  private switchTab(tabName: string): void {
    // Обновляем активную вкладку
    const tabs = this.modalElement?.querySelectorAll('.gantt-tab');
    tabs?.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });

    // Рендерим содержимое вкладки
    switch (tabName) {
      case 'projects':
        this.renderProjectsTab();
        break;
      case 'sprints':
        this.renderSprintsTab();
        break;
      case 'settings':
        this.renderSettingsTab();
        break;
    }
  }

  /**
   * Рендерит содержимое модального окна
   */
  private renderModalContent(): void {
    this.renderProjectsTab();
  }

  /**
   * Рендерит вкладку проектов
   */
  private renderProjectsTab(): void {
    const listContainer = this.modalElement?.querySelector('#gantt-items-list');
    if (!listContainer) return;

    listContainer.innerHTML = `
      <div class="gantt-list-header">
        <h3>Проекты</h3>
        <button class="gantt-btn-icon" data-action="add-project" title="Добавить проект">+</button>
      </div>
      <div class="gantt-list-items">
        ${this.data.projects.map(project => this.renderProjectListItem(project)).join('')}
      </div>
    `;

    // Обработчики
    const addBtn = listContainer.querySelector('[data-action="add-project"]');
    addBtn?.addEventListener('click', () => this.showAddProjectForm());

    const projectItems = listContainer.querySelectorAll('.gantt-list-item');
    projectItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const projectId = (e.currentTarget as HTMLElement).dataset.projectId;
        const project = this.data.projects.find(p => p.id === projectId);
        if (project) {
          this.selectProject(project);
        }
      });
    });

    // Показываем форму первого проекта или форму добавления
    if (this.data.projects.length > 0) {
      this.selectProject(this.data.projects[0]);
    } else {
      this.showAddProjectForm();
    }
  }

  /**
   * Рендерит элемент проекта в списке
   */
  private renderProjectListItem(project: Project): string {
    const isSelected = this.selectedProject?.id === project.id;
    return `
      <div class="gantt-list-item ${isSelected ? 'selected' : ''}" data-project-id="${project.id}">
        <div class="gantt-list-item-name">${this.escapeHtml(project.name)}</div>
        <div class="gantt-list-item-meta">
          ${project.stages.length} этапов, ${project.milestones.length} мелстоунов
        </div>
      </div>
    `;
  }

  /**
   * Обновляет отображение проекта в списке без полного перерендера
   */
  private updateProjectListDisplay(project: Project): void {
    const listContainer = this.modalElement?.querySelector('#gantt-items-list');
    if (!listContainer) return;

    const projectItem = listContainer.querySelector(`[data-project-id="${project.id}"]`);
    if (projectItem) {
      const nameElement = projectItem.querySelector('.gantt-list-item-name');
      const metaElement = projectItem.querySelector('.gantt-list-item-meta');

      if (nameElement) {
        nameElement.textContent = project.name;
      }

      if (metaElement) {
        metaElement.textContent = `${project.stages.length} этапов, ${project.milestones.length} мелстоунов`;
      }
    }
  }

  /**
   * Выбирает проект для редактирования
   */
  private selectProject(project: Project): void {
    this.selectedProject = project;
    this.renderProjectForm(project);

    // Обновляем выделение в списке
    const items = this.modalElement?.querySelectorAll('.gantt-list-item');
    items?.forEach(item => {
      item.classList.toggle('selected', item.getAttribute('data-project-id') === project.id);
    });
  }

  /**
   * Показывает форму добавления проекта
   */
  private showAddProjectForm(): void {
    this.selectedProject = null;
    this.renderProjectForm(null);
  }

  /**
   * Рендерит форму проекта
   */
  private renderProjectForm(project: Project | null): void {
    const formContainer = this.modalElement?.querySelector('#gantt-editor-form');
    if (!formContainer) return;

    const isEdit = project !== null;

    formContainer.innerHTML = `
      <div class="gantt-form">
        <h3>${isEdit ? 'Редактирование проекта' : 'Новый проект'}</h3>

        <div class="gantt-form-group">
          <label>Название проекта *</label>
          <input type="text" id="project-name" value="${isEdit ? this.escapeHtml(project.name) : ''}" placeholder="Название проекта" />
        </div>

        <div class="gantt-form-group">
          <label>Ответственный</label>
          <input type="text" id="project-assignee" value="${isEdit && project.assignee ? this.escapeHtml(project.assignee.name) : ''}" placeholder="Имя ответственного" />
        </div>

        <div class="gantt-form-group">
          <label>Режим отображения</label>
          <select id="project-layout">
            <option value="inline" ${!isEdit || project.layout === 'inline' ? 'selected' : ''}>Inline (компактный)</option>
            <option value="multiline" ${isEdit && project.layout === 'multiline' ? 'selected' : ''}>Multiline (развернутый)</option>
          </select>
        </div>

        ${isEdit ? `
          <div class="gantt-form-section">
            <h4>Этапы проекта</h4>
            <div class="gantt-stages-list">
              ${project.stages.map(stage => this.renderStageListItem(stage)).join('')}
            </div>
            <button class="gantt-btn gantt-btn-secondary" data-action="add-stage">+ Добавить этап</button>
          </div>

          <div class="gantt-form-section">
            <h4>Мелстоуны проекта</h4>
            <div class="gantt-milestones-list">
              ${project.milestones.map(milestone => this.renderMilestoneListItem(milestone)).join('')}
            </div>
            <button class="gantt-btn gantt-btn-secondary" data-action="add-milestone">+ Добавить мелстоун</button>
          </div>
        ` : ''}

        <div class="gantt-form-actions">
          ${isEdit ? `
            <button class="gantt-btn gantt-btn-danger" data-action="delete-project">Удалить проект</button>
          ` : `
            <button class="gantt-btn gantt-btn-primary" data-action="create-project">Создать проект</button>
          `}
        </div>
        ${isEdit ? `
          <div class="gantt-form-hint">
            <small>Изменения будут сохранены при нажатии кнопки "Сохранить" внизу</small>
          </div>
        ` : ''}
      </div>
    `;

    // Обработчики
    this.setupProjectFormHandlers(project);
  }

  /**
   * Настраивает обработчики формы проекта
   */
  private setupProjectFormHandlers(project: Project | null): void {
    const form = this.modalElement?.querySelector('#gantt-editor-form');
    if (!form) return;

    // Создание проекта
    const createBtn = form.querySelector('[data-action="create-project"]');
    createBtn?.addEventListener('click', () => this.handleCreateProject());

    // Удаление проекта
    const deleteBtn = form.querySelector('[data-action="delete-project"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteProject());

    // Автоматическое обновление полей проекта при редактировании
    if (project) {
      const nameInput = form.querySelector('#project-name') as HTMLInputElement;
      const assigneeInput = form.querySelector('#project-assignee') as HTMLInputElement;
      const layoutSelect = form.querySelector('#project-layout') as HTMLSelectElement;

      nameInput?.addEventListener('input', () => {
        if (project) {
          project.name = nameInput.value.trim();
          this.updateProjectListDisplay(project);
        }
      });

      assigneeInput?.addEventListener('input', () => {
        if (project) {
          const assigneeName = assigneeInput.value.trim();
          project.assignee = assigneeName ? { name: assigneeName } : undefined;
        }
      });

      layoutSelect?.addEventListener('change', () => {
        if (project) {
          project.layout = layoutSelect.value as 'inline' | 'multiline';
        }
      });
    }

    if (project) {
      // Добавление этапа
      const addStageBtn = form.querySelector('[data-action="add-stage"]');
      addStageBtn?.addEventListener('click', () => this.showAddStageForm(project));

      // Добавление мелстоуна
      const addMilestoneBtn = form.querySelector('[data-action="add-milestone"]');
      addMilestoneBtn?.addEventListener('click', () => this.showAddMilestoneForm(project));

      // Клики по этапам
      const stageItems = form.querySelectorAll('.gantt-stage-item');
      stageItems.forEach(item => {
        const editBtn = item.querySelector('.gantt-edit-btn');
        editBtn?.addEventListener('click', () => {
          const stageId = (item as HTMLElement).dataset.stageId;
          const stage = project.stages.find(s => s.id === stageId);
          if (stage) {
            this.showEditStageForm(project, stage);
          }
        });
      });

      // Клики по мелстоунам
      const milestoneItems = form.querySelectorAll('.gantt-milestone-item');
      milestoneItems.forEach(item => {
        const editBtn = item.querySelector('.gantt-edit-btn');
        editBtn?.addEventListener('click', () => {
          const milestoneId = (item as HTMLElement).dataset.milestoneId;
          const milestone = project.milestones.find(m => m.id === milestoneId);
          if (milestone) {
            this.showEditMilestoneForm(project, milestone);
          }
        });
      });
    }
  }

  /**
   * Рендерит элемент этапа в списке
   */
  private renderStageListItem(stage: Stage): string {
    const timeScale = this.data.timeScale || 'day';
    const durationLabel = timeScale === 'week' ? 'недель' : 'дней';

    return `
      <div class="gantt-stage-item" data-stage-id="${stage.id}">
        <div class="gantt-stage-color" style="background-color: ${stage.color}"></div>
        <div class="gantt-stage-info">
          <div class="gantt-stage-name">${this.escapeHtml(stage.name)}</div>
          <div class="gantt-stage-meta">${formatDateISO(stage.start)} • ${stage.duration} ${durationLabel}</div>
        </div>
        <button class="gantt-edit-btn" title="Редактировать">✎</button>
      </div>
    `;
  }

  /**
   * Рендерит элемент мелстоуна в списке
   */
  private renderMilestoneListItem(milestone: Milestone): string {
    return `
      <div class="gantt-milestone-item" data-milestone-id="${milestone.id}">
        <div class="gantt-milestone-marker" style="background-color: ${milestone.color || '#FFD93D'}">◆</div>
        <div class="gantt-milestone-info">
          <div class="gantt-milestone-name">${this.escapeHtml(milestone.name)}</div>
          <div class="gantt-milestone-meta">${formatDateISO(milestone.date)}</div>
        </div>
        <button class="gantt-edit-btn" title="Редактировать">✎</button>
      </div>
    `;
  }

  /**
   * Показывает форму добавления этапа
   */
  private showAddStageForm(project: Project): void {
    this.showStageForm(project, null);
  }

  /**
   * Показывает форму редактирования этапа
   */
  private showEditStageForm(project: Project, stage: Stage): void {
    this.showStageForm(project, stage);
  }

  /**
   * Показывает форму этапа (создание/редактирование)
   */
  private showStageForm(project: Project, stage: Stage | null): void {
    const formContainer = this.modalElement?.querySelector('#gantt-editor-form');
    if (!formContainer) return;

    const isEdit = stage !== null;
    const timeScale = this.data.timeScale || 'day';
    const durationLabel = timeScale === 'week' ? 'недель' : 'дней';

    formContainer.innerHTML = `
      <div class="gantt-form">
        <h3>${isEdit ? 'Редактирование этапа' : 'Новый этап'}</h3>

        <div class="gantt-form-group">
          <label>Название этапа *</label>
          <input type="text" id="stage-name" value="${isEdit ? this.escapeHtml(stage.name) : ''}" placeholder="Название этапа" />
        </div>

        <div class="gantt-form-group">
          <label>Дата начала *</label>
          <input type="date" id="stage-start" value="${isEdit ? formatDateISO(stage.start) : formatDateISO(this.data.startDate)}" />
        </div>

        <div class="gantt-form-group">
          <label>Длительность (${durationLabel}) *</label>
          <input type="number" id="stage-duration" min="1" value="${isEdit ? stage.duration : 5}" />
          <small>${timeScale === 'week' ? 'Количество недель' : 'Количество календарных дней'}</small>
        </div>

        <div class="gantt-form-group">
          <label>Ответственный</label>
          <input type="text" id="stage-assignee" value="${isEdit && stage.assignee ? this.escapeHtml(stage.assignee.name) : ''}" placeholder="Имя ответственного" />
        </div>

        <div class="gantt-form-group">
          <label>Цвет</label>
          <div class="gantt-color-picker">
            ${DEFAULT_STAGE_COLORS.map(color => `
              <div class="gantt-color-option ${isEdit && stage.color === color ? 'selected' : ''}"
                   style="background-color: ${color}"
                   data-color="${color}"></div>
            `).join('')}
          </div>
        </div>

        <div class="gantt-form-actions">
          <button class="gantt-btn gantt-btn-secondary" data-action="back">← Назад</button>
          ${isEdit ? `
            <button class="gantt-btn gantt-btn-danger" data-action="delete-stage">Удалить</button>
          ` : `
            <button class="gantt-btn gantt-btn-primary" data-action="create-stage">Создать</button>
          `}
        </div>
        ${isEdit ? `
          <div class="gantt-form-hint">
            <small>Изменения будут сохранены при нажатии кнопки "Сохранить" внизу</small>
          </div>
        ` : ''}
      </div>
    `;

    // Обработчики
    this.setupStageFormHandlers(project, stage);
  }

  /**
   * Настраивает обработчики формы этапа
   */
  private setupStageFormHandlers(project: Project, stage: Stage | null): void {
    const form = this.modalElement?.querySelector('#gantt-editor-form');
    if (!form) return;

    // Назад к проекту
    const backBtn = form.querySelector('[data-action="back"]');
    backBtn?.addEventListener('click', () => this.selectProject(project));

    // Выбор цвета
    const colorOptions = form.querySelectorAll('.gantt-color-option');
    colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        if (stage) {
          stage.color = option.getAttribute('data-color') || stage.color;
        }
      });
    });

    // Создание
    const createBtn = form.querySelector('[data-action="create-stage"]');
    createBtn?.addEventListener('click', () => this.handleCreateStage(project));

    // Удаление
    const deleteBtn = form.querySelector('[data-action="delete-stage"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteStage(project, stage!));

    // Автоматическое обновление полей этапа при редактировании
    if (stage) {
      const nameInput = form.querySelector('#stage-name') as HTMLInputElement;
      const startInput = form.querySelector('#stage-start') as HTMLInputElement;
      const durationInput = form.querySelector('#stage-duration') as HTMLInputElement;
      const assigneeInput = form.querySelector('#stage-assignee') as HTMLInputElement;

      nameInput?.addEventListener('input', () => {
        if (stage) {
          stage.name = nameInput.value.trim();
          stage.type = stage.name;
        }
      });

      startInput?.addEventListener('change', () => {
        if (stage) {
          stage.start = parseDateISO(startInput.value);
        }
      });

      durationInput?.addEventListener('input', () => {
        if (stage) {
          const duration = parseInt(durationInput.value);
          if (duration > 0) {
            stage.duration = duration;
          }
        }
      });

      assigneeInput?.addEventListener('input', () => {
        if (stage) {
          const assigneeName = assigneeInput.value.trim();
          stage.assignee = assigneeName ? { name: assigneeName } : undefined;
        }
      });
    }
  }

  /**
   * Показывает форму добавления мелстоуна
   */
  private showAddMilestoneForm(project: Project): void {
    this.showMilestoneForm(project, null);
  }

  /**
   * Показывает форму редактирования мелстоуна
   */
  private showEditMilestoneForm(project: Project, milestone: Milestone): void {
    this.showMilestoneForm(project, milestone);
  }

  /**
   * Показывает форму мелстоуна
   */
  private showMilestoneForm(project: Project, milestone: Milestone | null): void {
    const formContainer = this.modalElement?.querySelector('#gantt-editor-form');
    if (!formContainer) return;

    const isEdit = milestone !== null;

    formContainer.innerHTML = `
      <div class="gantt-form">
        <h3>${isEdit ? 'Редактирование мелстоуна' : 'Новый мелстоун'}</h3>

        <div class="gantt-form-group">
          <label>Название *</label>
          <input type="text" id="milestone-name" value="${isEdit ? this.escapeHtml(milestone.name) : ''}" placeholder="Название мелстоуна" />
        </div>

        <div class="gantt-form-group">
          <label>Дата *</label>
          <input type="date" id="milestone-date" value="${isEdit ? formatDateISO(milestone.date) : formatDateISO(this.data.startDate)}" />
        </div>

        <div class="gantt-form-group">
          <label>Ответственный</label>
          <input type="text" id="milestone-assignee" value="${isEdit && milestone.assignee ? this.escapeHtml(milestone.assignee.name) : ''}" placeholder="Имя ответственного" />
        </div>

        <div class="gantt-form-group">
          <label>Цвет</label>
          <div class="gantt-color-picker">
            ${DEFAULT_MILESTONE_COLORS.map(color => `
              <div class="gantt-color-option ${isEdit && milestone.color === color ? 'selected' : ''}"
                   style="background-color: ${color}"
                   data-color="${color}"></div>
            `).join('')}
          </div>
        </div>

        <div class="gantt-form-actions">
          <button class="gantt-btn gantt-btn-secondary" data-action="back">← Назад</button>
          ${isEdit ? `
            <button class="gantt-btn gantt-btn-danger" data-action="delete-milestone">Удалить</button>
          ` : `
            <button class="gantt-btn gantt-btn-primary" data-action="create-milestone">Создать</button>
          `}
        </div>
        ${isEdit ? `
          <div class="gantt-form-hint">
            <small>Изменения будут сохранены при нажатии кнопки "Сохранить" внизу</small>
          </div>
        ` : ''}
      </div>
    `;

    // Обработчики
    this.setupMilestoneFormHandlers(project, milestone);
  }

  /**
   * Настраивает обработчики формы мелстоуна
   */
  private setupMilestoneFormHandlers(project: Project, milestone: Milestone | null): void {
    const form = this.modalElement?.querySelector('#gantt-editor-form');
    if (!form) return;

    // Назад
    const backBtn = form.querySelector('[data-action="back"]');
    backBtn?.addEventListener('click', () => this.selectProject(project));

    // Выбор цвета
    const colorOptions = form.querySelectorAll('.gantt-color-option');
    colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        if (milestone) {
          milestone.color = option.getAttribute('data-color') || undefined;
        }
      });
    });

    // Создание
    const createBtn = form.querySelector('[data-action="create-milestone"]');
    createBtn?.addEventListener('click', () => this.handleCreateMilestone(project));

    // Удаление
    const deleteBtn = form.querySelector('[data-action="delete-milestone"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteMilestone(project, milestone!));

    // Автоматическое обновление полей мелстоуна при редактировании
    if (milestone) {
      const nameInput = form.querySelector('#milestone-name') as HTMLInputElement;
      const dateInput = form.querySelector('#milestone-date') as HTMLInputElement;
      const assigneeInput = form.querySelector('#milestone-assignee') as HTMLInputElement;

      nameInput?.addEventListener('input', () => {
        if (milestone) {
          milestone.name = nameInput.value.trim();
          milestone.type = milestone.name;
        }
      });

      dateInput?.addEventListener('change', () => {
        if (milestone) {
          milestone.date = parseDateISO(dateInput.value);
        }
      });

      assigneeInput?.addEventListener('input', () => {
        if (milestone) {
          const assigneeName = assigneeInput.value.trim();
          milestone.assignee = assigneeName ? { name: assigneeName } : undefined;
        }
      });
    }
  }

  /**
   * Рендерит вкладку спринтов
   */
  private renderSprintsTab(): void {
    const listContainer = this.modalElement?.querySelector('#gantt-items-list');
    const formContainer = this.modalElement?.querySelector('#gantt-editor-form');
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
    // Показываем реальные даты начала и окончания спринта
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
    const listContainer = this.modalElement?.querySelector('#gantt-items-list');
    if (!listContainer) return;

    const sprintItem = listContainer.querySelector(`[data-sprint-id="${sprint.id}"]`);
    if (sprintItem) {
      const nameElement = sprintItem.querySelector('.gantt-list-item-name');
      const metaElement = sprintItem.querySelector('.gantt-list-item-meta');

      if (nameElement) {
        nameElement.textContent = sprint.name;
      }

      if (metaElement) {
        // Показываем реальные даты начала и окончания спринта
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
    const formContainer = this.modalElement?.querySelector('#gantt-editor-form');
    if (!formContainer) return;

    const isEdit = sprint !== null;
    const timeScale = this.data.timeScale || 'day';

    // Для нового спринта определяем дату начала
    let defaultStartDate: Date;
    if (isEdit) {
      defaultStartDate = sprint.start;
    } else if (this.data.sprints.length > 0) {
      // Если есть спринты, берем следующий день после окончания последнего спринта
      const lastSprint = this.data.sprints[this.data.sprints.length - 1];
      defaultStartDate = new Date(lastSprint.end.getTime() + 24 * 60 * 60 * 1000);
    } else {
      // Если это первый спринт, берем дату начала проекта
      defaultStartDate = this.data.startDate;
    }

    const weekStartsOn = this.data.weekStartsOn || 1;

    // В недельном режиме привязываем к началу недели
    if (timeScale === 'week') {
      defaultStartDate = getWeekStart(defaultStartDate, weekStartsOn);
    }

    // Для нового спринта вычисляем дату окончания
    // ВАЖНО: В недельном режиме dropdown'ы хранят ПОНЕДЕЛЬНИКИ недель, а не воскресенья!
    let defaultEndDate: Date;
    if (isEdit) {
      defaultEndDate = sprint.end;
    } else {
      if (timeScale === 'week') {
        // 2 недели (13 дней, чтобы закончить в воскресенье)
        defaultEndDate = new Date(defaultStartDate.getTime() + 13 * 24 * 60 * 60 * 1000);
      } else {
        // 2 недели для режима дней
        defaultEndDate = new Date(defaultStartDate.getTime() + 13 * 24 * 60 * 60 * 1000);
      }
    }

    // Вычисляем понедельники для dropdown'ов (dropdown хранит именно понедельники)
    let defaultStartMonday: Date;
    let defaultEndMonday: Date;

    if (timeScale === 'week') {
      // Для режима недель dropdown содержит понедельники
      defaultStartMonday = getWeekStart(defaultStartDate, weekStartsOn);

      if (isEdit) {
        // При редактировании: sprint.end это воскресенье, находим понедельник ЭТОЙ недели
        defaultEndMonday = getWeekStart(defaultEndDate, weekStartsOn);
      } else {
        // При создании: defaultEndDate это промежуточная дата, привязываем к концу недели,
        // затем находим понедельник последней недели
        const endWeekSunday = getWeekEnd(defaultEndDate, weekStartsOn);
        defaultEndMonday = getWeekStart(endWeekSunday, weekStartsOn);
      }
    } else {
      // В режиме дней используем даты как есть (input type="date")
      defaultStartMonday = defaultStartDate;
      defaultEndMonday = defaultEndDate;
    }

    // Генерируем список недель для выбора (если режим недель)
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

    // Устанавливаем выбранные значения для select'ов в недельном режиме
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

    // Обработчики
    this.setupSprintFormHandlers(sprint);
  }

  /**
   * Настраивает обработчики формы спринта
   */
  private setupSprintFormHandlers(sprint: Sprint | null): void {
    const form = this.modalElement?.querySelector('#gantt-editor-form');
    if (!form) return;

    const startElement = form.querySelector('#sprint-start') as HTMLInputElement | HTMLSelectElement;
    const endElement = form.querySelector('#sprint-end') as HTMLInputElement | HTMLSelectElement;
    const timeScale = this.data.timeScale || 'day';

    // В недельном режиме используется select, автоматически пересчитываем конец для новых спринтов
    if (timeScale === 'week') {
      startElement?.addEventListener('change', () => {
        // Автоматически обновляем конец спринта если создаем новый
        if (!sprint && endElement) {
          const startDate = parseDateISO(startElement.value);
          const newEndDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
          const weekStart = getWeekStart(newEndDate, this.data.weekStartsOn || 1);
          endElement.value = formatDateISO(weekStart);
        }
      });
    } else {
      // Для создания нового спринта в режиме дней: автоматически пересчитываем дату окончания
      if (!sprint) {
        startElement?.addEventListener('change', () => {
          const startDate = parseDateISO(startElement.value);
          // Автоматически устанавливаем дату окончания через 2 недели
          const newEndDate = new Date(startDate.getTime() + 13 * 24 * 60 * 60 * 1000);
          if (endElement) {
            endElement.value = formatDateISO(newEndDate);
          }
        });
      }
    }

    // Создание
    const createBtn = form.querySelector('[data-action="create-sprint"]');
    createBtn?.addEventListener('click', () => this.handleCreateSprint());

    // Удаление
    const deleteBtn = form.querySelector('[data-action="delete-sprint"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteSprint(sprint!));

    // Автоматическое обновление полей спринта при редактировании
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
            // Обновляем значение в dropdown, чтобы оно показывало понедельник
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
            // Dropdown хранит понедельники, поэтому находим понедельник последней недели
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

  /**
   * Рендерит вкладку настроек
   */
  private renderSettingsTab(): void {
    const listContainer = this.modalElement?.querySelector('#gantt-items-list');
    const formContainer = this.modalElement?.querySelector('#gantt-editor-form');
    if (!listContainer || !formContainer) return;

    listContainer.innerHTML = `
      <div class="gantt-list-header">
        <h3>Настройки</h3>
      </div>
      <div class="gantt-list-items">
        <div class="gantt-settings-info">
          Настройки временной шкалы и рабочих дней
        </div>
      </div>
    `;

    formContainer.innerHTML = `
      <div class="gantt-form">
        <h3>Настройки диаграммы</h3>

        ${this.data.timeScale === 'week' ? `
          <div class="gantt-form-group">
            <label>Начало недели *</label>
            <select id="settings-week-starts-on">
              <option value="1" ${!this.data.weekStartsOn || this.data.weekStartsOn === 1 ? 'selected' : ''}>Понедельник</option>
              <option value="0" ${this.data.weekStartsOn === 0 ? 'selected' : ''}>Воскресенье</option>
            </select>
            <small>День, с которого начинается неделя в вашей стране</small>
          </div>
        ` : ''}

        <div class="gantt-form-group">
          <label>Дата начала *</label>
          <input type="date" id="settings-start-date" value="${formatDateISO(this.data.startDate)}" />
        </div>

        <div class="gantt-form-group">
          <label>Дата окончания *</label>
          <input type="date" id="settings-end-date" value="${formatDateISO(this.data.endDate)}" />
        </div>

        ${this.data.timeScale === 'day' ? `
          <div class="gantt-form-group">
            <label>Исключить дни недели</label>
            <div class="gantt-weekdays">
              ${['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day, index) => `
                <label class="gantt-checkbox">
                  <input type="checkbox" value="${index}" ${this.data.excludeWeekdays.includes(index) ? 'checked' : ''} />
                  ${day}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="gantt-form-group">
            <label>Включить конкретные даты (через запятую)</label>
            <input type="text" id="settings-include-dates" value="${this.data.includeDates.join(', ')}" placeholder="2024-01-06, 2024-01-13" />
            <small>Даты в формате YYYY-MM-DD</small>
          </div>

          <div class="gantt-form-group">
            <label>Исключить конкретные даты (через запятую)</label>
            <input type="text" id="settings-exclude-dates" value="${this.data.excludeDates.join(', ')}" placeholder="2024-01-01, 2024-01-07" />
            <small>Праздники и выходные в формате YYYY-MM-DD</small>
          </div>

          <div class="gantt-form-group" id="today-line-settings">
            <label class="gantt-checkbox">
              <input type="checkbox" id="settings-show-today-line" ${this.data.showTodayLine !== false ? 'checked' : ''} />
              Показывать линию текущего дня
            </label>
            <small>Вертикальная линия, показывающая сегодняшнюю дату</small>
          </div>
        ` : ''}

        <div class="gantt-settings-info">
          <small>Изменения будут применены при нажатии кнопки "Сохранить" внизу</small>
        </div>
      </div>
    `;

    // Обработчики больше не нужны - timeScale теперь задается при создании диаграммы
  }

  // === ОБРАБОТЧИКИ ДЕЙСТВИЙ ===

  private handleCreateProject(): void {
    const name = (this.modalElement?.querySelector('#project-name') as HTMLInputElement)?.value.trim();
    const assigneeName = (this.modalElement?.querySelector('#project-assignee') as HTMLInputElement)?.value.trim();
    const layout = (this.modalElement?.querySelector('#project-layout') as HTMLSelectElement)?.value as 'inline' | 'multiline';

    if (!name) {
      logseq.UI.showMsg('Введите название проекта', 'warning');
      return;
    }

    const newProject: Project = {
      id: generateId(),
      name,
      assignee: assigneeName ? { name: assigneeName } : undefined,
      stages: [],
      milestones: [],
      layout,
    };

    this.data.projects.push(newProject);
    this.renderProjectsTab();
    logseq.UI.showMsg('✅ Проект создан', 'success');
  }

  private handleDeleteProject(): void {
    if (!this.selectedProject) return;

    if (!confirm(`Удалить проект "${this.selectedProject.name}"?`)) return;

    this.data.projects = this.data.projects.filter(p => p.id !== this.selectedProject!.id);
    this.selectedProject = null;
    this.renderProjectsTab();
    logseq.UI.showMsg('✅ Проект удален', 'success');
  }

  private handleCreateStage(project: Project): void {
    const name = (this.modalElement?.querySelector('#stage-name') as HTMLInputElement)?.value.trim();
    const startStr = (this.modalElement?.querySelector('#stage-start') as HTMLInputElement)?.value;
    const duration = parseInt((this.modalElement?.querySelector('#stage-duration') as HTMLInputElement)?.value);
    const assigneeName = (this.modalElement?.querySelector('#stage-assignee') as HTMLInputElement)?.value.trim();
    const selectedColor = this.modalElement?.querySelector('.gantt-color-option.selected');
    const color = selectedColor?.getAttribute('data-color') || DEFAULT_STAGE_COLORS[0];

    if (!name || !startStr || !duration) {
      logseq.UI.showMsg('Заполните обязательные поля', 'warning');
      return;
    }

    const newStage: Stage = {
      id: generateId(),
      name,
      type: name,
      start: parseDateISO(startStr),
      duration,
      assignee: assigneeName ? { name: assigneeName } : undefined,
      color,
    };

    project.stages.push(newStage);
    this.updateProjectListDisplay(project);
    this.selectProject(project);
    logseq.UI.showMsg('✅ Этап создан', 'success');
  }

  private handleDeleteStage(project: Project, stage: Stage): void {
    if (!confirm(`Удалить этап "${stage.name}"?`)) return;

    project.stages = project.stages.filter(s => s.id !== stage.id);
    this.updateProjectListDisplay(project);
    this.selectProject(project);
    logseq.UI.showMsg('✅ Этап удален', 'success');
  }

  private handleCreateMilestone(project: Project): void {
    const name = (this.modalElement?.querySelector('#milestone-name') as HTMLInputElement)?.value.trim();
    const dateStr = (this.modalElement?.querySelector('#milestone-date') as HTMLInputElement)?.value;
    const assigneeName = (this.modalElement?.querySelector('#milestone-assignee') as HTMLInputElement)?.value.trim();
    const selectedColor = this.modalElement?.querySelector('.gantt-color-option.selected');
    const color = selectedColor?.getAttribute('data-color');

    if (!name || !dateStr) {
      logseq.UI.showMsg('Заполните обязательные поля', 'warning');
      return;
    }

    const newMilestone: Milestone = {
      id: generateId(),
      name,
      type: name,
      date: parseDateISO(dateStr),
      assignee: assigneeName ? { name: assigneeName } : undefined,
      color: color || undefined,
    };

    project.milestones.push(newMilestone);
    this.updateProjectListDisplay(project);
    this.selectProject(project);
    logseq.UI.showMsg('✅ Мелстоун создан', 'success');
  }

  private handleDeleteMilestone(project: Project, milestone: Milestone): void {
    if (!confirm(`Удалить мелстоун "${milestone.name}"?`)) return;

    project.milestones = project.milestones.filter(m => m.id !== milestone.id);
    this.updateProjectListDisplay(project);
    this.selectProject(project);
    logseq.UI.showMsg('✅ Мелстоун удален', 'success');
  }

  private handleCreateSprint(): void {
    const name = (this.modalElement?.querySelector('#sprint-name') as HTMLInputElement)?.value.trim();
    const startStr = (this.modalElement?.querySelector('#sprint-start') as HTMLInputElement)?.value;
    const endStr = (this.modalElement?.querySelector('#sprint-end') as HTMLInputElement)?.value;

    if (!name || !startStr || !endStr) {
      logseq.UI.showMsg('Заполните все поля', 'warning');
      return;
    }

    const timeScale = this.data.timeScale || 'day';
    let startDate = parseDateISO(startStr);
    let endDate = parseDateISO(endStr);

    // В недельном режиме привязываем к границам недель
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
    this.renderSprintsTab();
    logseq.UI.showMsg('✅ Спринт создан', 'success');
  }

  private handleDeleteSprint(sprint: Sprint): void {
    if (!confirm(`Удалить спринт "${sprint.name}"?`)) return;

    this.data.sprints = this.data.sprints.filter(s => s.id !== sprint.id);
    this.renderSprintsTab();
    logseq.UI.showMsg('✅ Спринт удален', 'success');
  }

  private async handleSave(): Promise<void> {
    try {
      // Если открыта вкладка настроек, применяем изменения перед сохранением
      const activeTab = this.modalElement?.querySelector('.gantt-tab.active');
      if (activeTab && activeTab.getAttribute('data-tab') === 'settings') {
        this.applySettingsChanges();
      }

      await this.storage.save(this.blockUuid, this.data);
      logseq.UI.showMsg('✅ Все изменения сохранены', 'success');
      this.hide();

      // Logseq автоматически перерисует блок после обновления
      // Не нужно перезагружать страницу - это убивает слушатели событий
    } catch (error) {
      console.error(`[${PLUGIN_NAME}] Failed to save:`, error);
      logseq.UI.showMsg('❌ Ошибка сохранения', 'error');
    }
  }

  /**
   * Применяет изменения настроек из формы к this.data
   */
  private applySettingsChanges(): void {
    const startStr = (this.modalElement?.querySelector('#settings-start-date') as HTMLInputElement)?.value;
    const endStr = (this.modalElement?.querySelector('#settings-end-date') as HTMLInputElement)?.value;

    if (!startStr || !endStr) {
      return; // Валидация будет в handleSave
    }

    // Обновляем даты
    this.data.startDate = parseDateISO(startStr);
    this.data.endDate = parseDateISO(endStr);

    // ВАЖНО: timeScale теперь задается при создании диаграммы и не может быть изменен
    // Настройки зависят от текущего timeScale
    const timeScale = this.data.timeScale || 'day';

    if (timeScale === 'week') {
      // В режиме недель обновляем только weekStartsOn
      const weekStartsOnSelect = this.modalElement?.querySelector('#settings-week-starts-on') as HTMLSelectElement;
      if (weekStartsOnSelect) {
        this.data.weekStartsOn = parseInt(weekStartsOnSelect.value) as 0 | 1;
      }
    } else {
      // В режиме дней обновляем настройки рабочих дней
      const checkboxes = this.modalElement?.querySelectorAll('.gantt-weekdays input[type="checkbox"]') || [];
      this.data.excludeWeekdays = Array.from(checkboxes)
        .filter((cb: any) => cb.checked)
        .map((cb: any) => parseInt(cb.value));

      // Обновляем списки дат
      const includeStr = (this.modalElement?.querySelector('#settings-include-dates') as HTMLInputElement)?.value;
      const excludeStr = (this.modalElement?.querySelector('#settings-exclude-dates') as HTMLInputElement)?.value;
      this.data.includeDates = includeStr ? includeStr.split(',').map(d => d.trim()).filter(d => d) : [];
      this.data.excludeDates = excludeStr ? excludeStr.split(',').map(d => d.trim()).filter(d => d) : [];

      // Обновляем настройку линии текущего дня
      const showTodayLineCheckbox = this.modalElement?.querySelector('#settings-show-today-line') as HTMLInputElement;
      this.data.showTodayLine = showTodayLineCheckbox?.checked ?? true;
    }
  }

  /**
   * Экранирует HTML
   */
  private escapeHtml(text: string): string {
    const div = this.doc.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
