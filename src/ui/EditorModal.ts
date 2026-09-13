/**
 * EditorModal
 * Modal editor coordinating Projects, Sprints, and Settings tabs for Gantt chart
 */

import type { GanttData } from '../types';
import { GanttDataManager } from '../storage/GanttDataManager';
import { PLUGIN_NAME } from '../utils/constants';
import { DragAndDropManager } from './DragAndDropManager';
import { ProjectsTabView } from './modal/ProjectsTabView';
import { SprintsTabView } from './modal/SprintsTabView';
import { SettingsTabView } from './modal/SettingsTabView';

export class EditorModal {
  private data: GanttData;
  private blockUuid: string;
  private storage: GanttDataManager;
  private modalElement: HTMLElement | null = null;
  private doc: Document;
  private dragDropManager: DragAndDropManager;
  private projectsTab: ProjectsTabView | null = null;
  private sprintsTab: SprintsTabView | null = null;

  constructor(data: GanttData, blockUuid: string) {
    this.data = data;
    this.blockUuid = blockUuid;
    this.storage = new GanttDataManager();
    this.dragDropManager = new DragAndDropManager();
    this.doc = (parent && (parent as any).document) ? (parent as any).document : document;
  }

  /**
   * Показывает модальное окно редактора
   */
  show(): void {
    this.createModal();
    this.initTabs();
    this.switchTab('projects');
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
    this.dragDropManager.cleanup();
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

    this.setupEventListeners();
  }

  /**
   * Инициализирует контроллеры вкладок
   */
  private initTabs(): void {
    if (!this.modalElement) return;

    this.projectsTab = new ProjectsTabView(
      this.modalElement,
      this.data,
      this.dragDropManager,
      this.escapeHtml.bind(this)
    );

    this.sprintsTab = new SprintsTabView(
      this.modalElement,
      this.data,
      this.escapeHtml.bind(this)
    );
  }

  /**
   * Настраивает обработчики событий
   */
  private setupEventListeners(): void {
    if (!this.modalElement) return;

    const closeButtons = this.modalElement.querySelectorAll('[data-action="close"]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    const overlay = this.modalElement.querySelector('.gantt-editor-overlay');
    overlay?.addEventListener('click', () => this.hide());

    const saveButton = this.modalElement.querySelector('[data-action="save"]');
    saveButton?.addEventListener('click', () => this.handleSave());

    const tabs = this.modalElement.querySelectorAll('.gantt-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });
  }

  /**
   * Переключает вкладку
   */
  private switchTab(tabName: string): void {
    if (!this.modalElement) return;

    const tabs = this.modalElement.querySelectorAll('.gantt-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });

    switch (tabName) {
      case 'projects':
        this.projectsTab?.render();
        break;
      case 'sprints':
        this.sprintsTab?.render();
        break;
      case 'settings':
        SettingsTabView.render(this.modalElement, this.data);
        break;
    }
  }

  /**
   * Обработчик сохранения
   */
  private async handleSave(): Promise<void> {
    try {
      const activeTab = this.modalElement?.querySelector('.gantt-tab.active');
      if (activeTab && activeTab.getAttribute('data-tab') === 'settings' && this.modalElement) {
        SettingsTabView.applyChanges(this.modalElement, this.data);
      }

      await this.storage.save(this.blockUuid, this.data);
      logseq.UI.showMsg('✅ Все изменения сохранены', 'success');
      this.hide();
    } catch (error) {
      console.error(`[${PLUGIN_NAME}] Failed to save:`, error);
      logseq.UI.showMsg('❌ Ошибка сохранения', 'error');
    }
  }

  /**
   * Быстрое экранирование HTML
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
