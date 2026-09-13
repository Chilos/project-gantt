/**
 * SettingsTabView
 * Handles rendering and applying changes for the Settings tab in EditorModal
 */

import type { GanttData } from '../../types';
import { formatDateISO, parseDateISO } from '../../utils/dateUtils';

export class SettingsTabView {
  /**
   * Рендерит вкладку настроек
   */
  static render(container: HTMLElement, data: GanttData): void {
    const listContainer = container.querySelector('#gantt-items-list');
    const formContainer = container.querySelector('#gantt-editor-form');
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

        ${data.timeScale === 'week' ? `
          <div class="gantt-form-group">
            <label>Начало недели *</label>
            <select id="settings-week-starts-on">
              <option value="1" ${!data.weekStartsOn || data.weekStartsOn === 1 ? 'selected' : ''}>Понедельник</option>
              <option value="0" ${data.weekStartsOn === 0 ? 'selected' : ''}>Воскресенье</option>
            </select>
            <small>День, с которого начинается неделя в вашей стране</small>
          </div>
        ` : ''}

        <div class="gantt-form-group">
          <label>Дата начала *</label>
          <input type="date" id="settings-start-date" value="${formatDateISO(data.startDate)}" />
        </div>

        <div class="gantt-form-group">
          <label>Дата окончания *</label>
          <input type="date" id="settings-end-date" value="${formatDateISO(data.endDate)}" />
        </div>

        ${data.timeScale === 'day' ? `
          <div class="gantt-form-group">
            <label>Исключить дни недели</label>
            <div class="gantt-weekdays">
              ${['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day, index) => `
                <label class="gantt-checkbox">
                  <input type="checkbox" value="${index}" ${data.excludeWeekdays.includes(index) ? 'checked' : ''} />
                  ${day}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="gantt-form-group">
            <label>Включить конкретные даты (через запятую)</label>
            <input type="text" id="settings-include-dates" value="${data.includeDates.join(', ')}" placeholder="2024-01-06, 2024-01-13" />
            <small>Даты в формате YYYY-MM-DD</small>
          </div>

          <div class="gantt-form-group">
            <label>Исключить конкретные даты (через запятую)</label>
            <input type="text" id="settings-exclude-dates" value="${data.excludeDates.join(', ')}" placeholder="2024-01-01, 2024-01-07" />
            <small>Праздники и выходные в формате YYYY-MM-DD</small>
          </div>

          <div class="gantt-form-group" id="today-line-settings">
            <label class="gantt-checkbox">
              <input type="checkbox" id="settings-show-today-line" ${data.showTodayLine !== false ? 'checked' : ''} />
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
  }

  /**
   * Применяет изменения настроек из формы к data
   */
  static applyChanges(container: HTMLElement, data: GanttData): void {
    const startStr = (container.querySelector('#settings-start-date') as HTMLInputElement)?.value;
    const endStr = (container.querySelector('#settings-end-date') as HTMLInputElement)?.value;

    if (!startStr || !endStr) {
      return;
    }

    // Обновляем даты
    data.startDate = parseDateISO(startStr);
    data.endDate = parseDateISO(endStr);

    const timeScale = data.timeScale || 'day';

    if (timeScale === 'week') {
      const weekStartsOnSelect = container.querySelector('#settings-week-starts-on') as HTMLSelectElement;
      if (weekStartsOnSelect) {
        data.weekStartsOn = parseInt(weekStartsOnSelect.value) as 0 | 1;
      }
    } else {
      const checkboxes = container.querySelectorAll('.gantt-weekdays input[type="checkbox"]');
      data.excludeWeekdays = Array.from(checkboxes)
        .filter((cb: any) => cb.checked)
        .map((cb: any) => parseInt(cb.value));

      const includeStr = (container.querySelector('#settings-include-dates') as HTMLInputElement)?.value;
      const excludeStr = (container.querySelector('#settings-exclude-dates') as HTMLInputElement)?.value;
      data.includeDates = includeStr ? includeStr.split(',').map(d => d.trim()).filter(d => d) : [];
      data.excludeDates = excludeStr ? excludeStr.split(',').map(d => d.trim()).filter(d => d) : [];

      const showTodayLineCheckbox = container.querySelector('#settings-show-today-line') as HTMLInputElement;
      data.showTodayLine = showTodayLineCheckbox?.checked ?? true;
    }
  }
}
