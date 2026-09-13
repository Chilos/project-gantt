/**
 * ProjectsTabView
 * Handles rendering and user interactions for the Projects tab in EditorModal
 */

import type { GanttData, Project, Stage, Milestone } from '../../types';
import { generateId } from '../../utils/encoding';
import { formatDateISO, parseDateISO } from '../../utils/dateUtils';
import { DEFAULT_STAGE_COLORS, DEFAULT_MILESTONE_COLORS } from '../../utils/constants';
import { DragAndDropManager } from '../DragAndDropManager';

export class ProjectsTabView {
  private container: HTMLElement;
  private data: GanttData;
  private selectedProject: Project | null = null;
  private dragDropManager: DragAndDropManager;
  private escapeHtml: (str: string) => string;

  constructor(
    container: HTMLElement,
    data: GanttData,
    dragDropManager: DragAndDropManager,
    escapeHtml: (str: string) => string
  ) {
    this.container = container;
    this.data = data;
    this.dragDropManager = dragDropManager;
    this.escapeHtml = escapeHtml;
  }

  /**
   * Рендерит вкладку проектов
   */
  render(): void {
    const listContainer = this.container.querySelector('#gantt-items-list');
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
        if ((e.target as HTMLElement).classList.contains('gantt-drag-handle')) {
          return;
        }
        const projectId = (e.currentTarget as HTMLElement).dataset.projectId;
        const project = this.data.projects.find(p => p.id === projectId);
        if (project) {
          this.selectProject(project);
        }
      });
    });

    // Настраиваем drag-and-drop для проектов
    const listItemsContainer = listContainer.querySelector('.gantt-list-items');
    if (listItemsContainer && this.data.projects.length > 0) {
      this.dragDropManager.setupProjectsDragAndDrop(
        listItemsContainer as HTMLElement,
        this.data.projects,
        (reorderedProjects) => {
          this.data.projects = reorderedProjects;
          this.render();
        }
      );
    }

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
        <span class="gantt-drag-handle">☰</span>
        <div class="gantt-list-item-content">
          <div class="gantt-list-item-name">${this.escapeHtml(project.name)}</div>
          <div class="gantt-list-item-meta">
            ${project.stages.length} этапов, ${project.milestones.length} мелстоунов
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Обновляет отображение проекта в списке без полного перерендера
   */
  private updateProjectListDisplay(project: Project): void {
    const listContainer = this.container.querySelector('#gantt-items-list');
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

    const items = this.container.querySelectorAll('.gantt-list-item');
    items.forEach(item => {
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
    const formContainer = this.container.querySelector('#gantt-editor-form');
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
              ${project.stages.map(stage => this.renderStageListItem(stage, project.layout === 'multiline')).join('')}
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

    this.setupProjectFormHandlers(project);
  }

  /**
   * Настраивает обработчики формы проекта
   */
  private setupProjectFormHandlers(project: Project | null): void {
    const form = this.container.querySelector('#gantt-editor-form');
    if (!form) return;

    const createBtn = form.querySelector('[data-action="create-project"]');
    createBtn?.addEventListener('click', () => this.handleCreateProject());

    const deleteBtn = form.querySelector('[data-action="delete-project"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteProject());

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

      const addStageBtn = form.querySelector('[data-action="add-stage"]');
      addStageBtn?.addEventListener('click', () => this.showAddStageForm(project));

      const addMilestoneBtn = form.querySelector('[data-action="add-milestone"]');
      addMilestoneBtn?.addEventListener('click', () => this.showAddMilestoneForm(project));

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

      const stagesList = form.querySelector('.gantt-stages-list');
      if (stagesList && project.layout === 'multiline' && project.stages.length > 0) {
        this.dragDropManager.setupStagesDragAndDrop(
          stagesList as HTMLElement,
          project.stages,
          (reorderedStages) => {
            project.stages = reorderedStages;
            this.updateProjectListDisplay(project);
            this.selectProject(project);
          }
        );
      }

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

  private renderStageListItem(stage: Stage, showDragHandle: boolean = true): string {
    const timeScale = this.data.timeScale || 'day';
    const durationLabel = timeScale === 'week' ? 'недель' : 'дней';

    return `
      <div class="gantt-stage-item" data-stage-id="${stage.id}">
        ${showDragHandle ? '<span class="gantt-drag-handle">☰</span>' : ''}
        <div class="gantt-stage-color" style="background-color: ${stage.color}"></div>
        <div class="gantt-stage-info">
          <div class="gantt-stage-name">${this.escapeHtml(stage.name)}</div>
          <div class="gantt-stage-meta">${formatDateISO(stage.start)} • ${stage.duration} ${durationLabel}</div>
        </div>
        <button class="gantt-edit-btn" title="Редактировать">✎</button>
      </div>
    `;
  }

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

  private showAddStageForm(project: Project): void {
    this.showStageForm(project, null);
  }

  private showEditStageForm(project: Project, stage: Stage): void {
    this.showStageForm(project, stage);
  }

  private showStageForm(project: Project, stage: Stage | null): void {
    const formContainer = this.container.querySelector('#gantt-editor-form');
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

    this.setupStageFormHandlers(project, stage);
  }

  private setupStageFormHandlers(project: Project, stage: Stage | null): void {
    const form = this.container.querySelector('#gantt-editor-form');
    if (!form) return;

    const backBtn = form.querySelector('[data-action="back"]');
    backBtn?.addEventListener('click', () => this.selectProject(project));

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

    const createBtn = form.querySelector('[data-action="create-stage"]');
    createBtn?.addEventListener('click', () => this.handleCreateStage(project));

    const deleteBtn = form.querySelector('[data-action="delete-stage"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteStage(project, stage!));

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

  private showAddMilestoneForm(project: Project): void {
    this.showMilestoneForm(project, null);
  }

  private showEditMilestoneForm(project: Project, milestone: Milestone): void {
    this.showMilestoneForm(project, milestone);
  }

  private showMilestoneForm(project: Project, milestone: Milestone | null): void {
    const formContainer = this.container.querySelector('#gantt-editor-form');
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

    this.setupMilestoneFormHandlers(project, milestone);
  }

  private setupMilestoneFormHandlers(project: Project, milestone: Milestone | null): void {
    const form = this.container.querySelector('#gantt-editor-form');
    if (!form) return;

    const backBtn = form.querySelector('[data-action="back"]');
    backBtn?.addEventListener('click', () => this.selectProject(project));

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

    const createBtn = form.querySelector('[data-action="create-milestone"]');
    createBtn?.addEventListener('click', () => this.handleCreateMilestone(project));

    const deleteBtn = form.querySelector('[data-action="delete-milestone"]');
    deleteBtn?.addEventListener('click', () => this.handleDeleteMilestone(project, milestone!));

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

  private handleCreateProject(): void {
    const name = (this.container.querySelector('#project-name') as HTMLInputElement)?.value.trim();
    const assigneeName = (this.container.querySelector('#project-assignee') as HTMLInputElement)?.value.trim();
    const layout = (this.container.querySelector('#project-layout') as HTMLSelectElement)?.value as 'inline' | 'multiline';

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
    this.render();
    logseq.UI.showMsg('✅ Проект создан', 'success');
  }

  private handleDeleteProject(): void {
    if (!this.selectedProject) return;

    if (!confirm(`Удалить проект "${this.selectedProject.name}"?`)) return;

    this.data.projects = this.data.projects.filter(p => p.id !== this.selectedProject!.id);
    this.selectedProject = null;
    this.render();
    logseq.UI.showMsg('✅ Проект удален', 'success');
  }

  private handleCreateStage(project: Project): void {
    const name = (this.container.querySelector('#stage-name') as HTMLInputElement)?.value.trim();
    const startStr = (this.container.querySelector('#stage-start') as HTMLInputElement)?.value;
    const duration = parseInt((this.container.querySelector('#stage-duration') as HTMLInputElement)?.value);
    const assigneeName = (this.container.querySelector('#stage-assignee') as HTMLInputElement)?.value.trim();
    const selectedColor = this.container.querySelector('.gantt-color-option.selected');
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
    const name = (this.container.querySelector('#milestone-name') as HTMLInputElement)?.value.trim();
    const dateStr = (this.container.querySelector('#milestone-date') as HTMLInputElement)?.value;
    const assigneeName = (this.container.querySelector('#milestone-assignee') as HTMLInputElement)?.value.trim();
    const selectedColor = this.container.querySelector('.gantt-color-option.selected');
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
}
