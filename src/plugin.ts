/**
 * ProjectGanttPlugin
 * Main plugin class that coordinates all components
 */

/// <reference types="@logseq/libs" />

import { ColorSystem } from './utils/colorSystem';
import { encodeGanttData, decodeGanttData, createDefaultGanttData } from './utils/encoding';
import { PLUGIN_NAME, RENDERER_TYPE } from './utils/constants';
import type { GanttData, EditorButtonClickEvent, MacroRendererSlotEvent } from './types';
import { GanttDataManager } from './storage/GanttDataManager';
import { GanttRenderer } from './ui/GanttRenderer';
import { VisualEditor } from './ui/VisualEditor';
import { EditorModal } from './ui/EditorModal';
import { ColumnResizer } from './ui/ColumnResizer';

// Import styles
import ganttCSS from './styles/gantt.css';
import editorModalCSS from './styles/editor-modal.css';

export class ProjectGanttPlugin {
  private colorSystem: ColorSystem;
  private colors: string[] = [];
  private slotUuidMap: Map<string, string> = new Map();
  private slotDataMap: Map<string, GanttData> = new Map();
  private storage: GanttDataManager;
  private ganttRenderer: GanttRenderer;
  private activeEditors: Map<string, VisualEditor> = new Map();
  private activeResizers: Map<string, ColumnResizer> = new Map();

  constructor() {
    this.colorSystem = new ColorSystem();
    this.storage = new GanttDataManager();
    this.ganttRenderer = new GanttRenderer();
  }

  /**
   * Инициализирует плагин
   */
  async initialize(): Promise<void> {
    console.log(`[${PLUGIN_NAME}] Initializing...`);

    // Инициализируем цветовую систему
    this.colors = this.colorSystem.generateStageColors();
    console.log(`[${PLUGIN_NAME}] Color system initialized:`, {
      mode: this.colorSystem.getThemeMode(),
      accent: this.colorSystem.getAccentColor(),
      colors: this.colors
    });

    // Регистрируем стили
    this.registerStyles();

    // Регистрируем обработчики событий
    this.registerEventHandlers();

    // Регистрируем slash команду
    this.registerSlashCommand();

    // Регистрируем macro renderer
    this.registerMacroRenderer();

    // Слушаем изменения темы
    this.setupThemeListener();

    console.log(`[${PLUGIN_NAME}] Plugin loaded successfully!`);
  }

  /**
   * Регистрирует CSS стили
   */
  private registerStyles(): void {
    logseq.provideStyle(ganttCSS);
    logseq.provideStyle(editorModalCSS);
    console.log(`[${PLUGIN_NAME}] Styles registered`);
  }

  /**
   * Регистрирует обработчики событий UI
   */
  private registerEventHandlers(): void {
    logseq.provideModel({
      openGanttEditor: (e: EditorButtonClickEvent) => {
        console.log(`[${PLUGIN_NAME}] Editor button clicked`, e);

        const slotId = (e as any).slot || e.dataset?.slotId || e.slotId || e['data-slot-id'];

        if (!slotId) {
          console.error(`[${PLUGIN_NAME}] No slotId found in event`);
          return;
        }

        const rawUuid = this.slotUuidMap.get(slotId);
        const blockUuid = typeof rawUuid === 'string' ? rawUuid : String(rawUuid ?? '');

        if (!blockUuid) {
          console.error(`[${PLUGIN_NAME}] Invalid block uuid for slotId:`, slotId);
          return;
        }

        // Берем последние отрендеренные данные
        const currentData = this.slotDataMap.get(slotId) || createDefaultGanttData();
        this.openEditor(blockUuid, currentData, slotId);
      },

      navigateToPage: async (e: any) => {
        console.log(`[${PLUGIN_NAME}] Navigate to page clicked`, e);

        // Предотвращаем стандартное действие ссылки
        if (e.preventDefault) {
          e.preventDefault();
        }

        const pageName = e.dataset?.pageName || e['data-page-name'];

        if (!pageName) {
          console.error(`[${PLUGIN_NAME}] No page name found in event`);
          return;
        }

        console.log(`[${PLUGIN_NAME}] Navigating to page:`, pageName);

        try {
          // Получаем страницу по имени
          const page = await logseq.Editor.getPage(pageName);

          if (page) {
            // Переходим на страницу
            await logseq.Editor.scrollToBlockInPage(pageName);
          } else {
            // Если страницы не существует, создаем её
            console.log(`[${PLUGIN_NAME}] Page not found, creating:`, pageName);
            await logseq.Editor.createPage(pageName);
            await logseq.Editor.scrollToBlockInPage(pageName);
          }
        } catch (error) {
          console.error(`[${PLUGIN_NAME}] Failed to navigate to page:`, error);
        }
      },
    });
  }

  /**
   * Регистрирует slash команду
   */
  private registerSlashCommand(): void {
    logseq.Editor.registerSlashCommand('Project Gantt', async () => {
      console.log(`[${PLUGIN_NAME}] Slash command triggered`);
      const defaultData = createDefaultGanttData();
      const encoded = encodeGanttData(defaultData);
      await logseq.Editor.insertAtEditingCursor(`{{renderer ${RENDERER_TYPE}, ${encoded}}}`);
    });
    console.log(`[${PLUGIN_NAME}] Slash command registered as "Project Gantt"`);
  }

  /**
   * Регистрирует macro renderer
   */
  private registerMacroRenderer(): void {
    logseq.App.onMacroRendererSlotted(({ slot, payload }: MacroRendererSlotEvent) => {
      const [type, encodedData] = payload.arguments;
      if (type !== RENDERER_TYPE) return;

      console.log(`[${PLUGIN_NAME}] Rendering Gantt for slot:`, slot);
      const data = decodeGanttData(encodedData || '');

      // Сохраняем соответствие slot -> uuid и текущие данные
      this.slotUuidMap.set(slot, String(payload.uuid));
      this.slotDataMap.set(slot, data);

      // Используем GanttRenderer для рендеринга
      const html = this.ganttRenderer.render(data, {
        readonly: true,
        blockUuid: payload.uuid,
        slotKey: slot,
        showEditButton: true,
      });

      logseq.provideUI({
        key: `${RENDERER_TYPE}-${slot}`,
        slot,
        template: html,
        reset: true
      });

      // Инициализируем drag-and-drop после рендеринга DOM
      setTimeout(() => {
        this.setupDragAndDrop(slot, data, payload.uuid);
      }, 100);
    });
  }

  /**
   * Настраивает drag-and-drop для рендеренной диаграммы
   */
  private setupDragAndDrop(slotId: string, data: GanttData, blockUuid: string): void {
    try {
      const root = (parent && (parent as any).document) ? (parent as any).document : document;
      const container = root.querySelector(`.gantt-container[data-slot-id="${slotId}"]`) as HTMLElement | null;

      if (!container) {
        console.warn(`[${PLUGIN_NAME}] Container not found for slot:`, slotId);
        return;
      }

      // Создаем или переиспользуем редактор для этого слота
      let editor = this.activeEditors.get(slotId);
      if (!editor) {
        editor = new VisualEditor(data, blockUuid);
        this.activeEditors.set(slotId, editor);
      }

      // Настраиваем обработчики событий
      editor.setupEventListeners(container);

      // Создаем или переиспользуем resizer для этого слота
      let resizer = this.activeResizers.get(slotId);
      if (!resizer) {
        resizer = new ColumnResizer(container);
        this.activeResizers.set(slotId, resizer);
        // Восстанавливаем сохраненную ширину
        resizer.restoreWidth();
      }

      console.log(`[${PLUGIN_NAME}] Drag-and-drop and column resizing enabled for slot:`, slotId);
    } catch (err) {
      console.error(`[${PLUGIN_NAME}] Failed to setup drag-and-drop:`, err);
    }
  }

  /**
   * Открывает редактор для указанного блока
   */
  private openEditor(blockUuid: string, initialData: GanttData, slotId: string): void {
    console.log(`[${PLUGIN_NAME}] Opening editor for block:`, blockUuid);

    // Создаем и показываем модальный редактор
    const modal = new EditorModal(initialData, blockUuid);
    modal.show();
  }

  /**
   * Устанавливает слушатели для изменения темы
   */
  private setupThemeListener(): void {
    logseq.App.onThemeModeChanged(({ mode }: { mode: 'light' | 'dark' }) => {
      console.log(`[${PLUGIN_NAME}] Theme changed to:`, mode);
      this.colorSystem.refresh();
      this.colors = this.colorSystem.generateStageColors();
      console.log(`[${PLUGIN_NAME}] Colors updated:`, this.colors);
    });
  }

  /**
   * Очистка ресурсов при выгрузке
   */
  async cleanup(): Promise<void> {
    console.log(`[${PLUGIN_NAME}] Cleaning up...`);

    // Очищаем редакторы
    for (const editor of this.activeEditors.values()) {
      editor.cleanup();
    }
    this.activeEditors.clear();

    // Очищаем resizers
    for (const resizer of this.activeResizers.values()) {
      resizer.cleanup();
    }
    this.activeResizers.clear();

    this.slotUuidMap.clear();
    this.slotDataMap.clear();
  }
}
