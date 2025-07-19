import { App, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext, TFile, MarkdownView, Editor } from 'obsidian';

// Интерфейсы для данных
interface GanttSettings {
	defaultStages: string[];
	defaultMilestones: string[];
	workingDays: number[];
	excludeWeekdays: number[];
	includeDates: string[];
	excludeDates: string[];
	cellWidth: number;
	cellHeight: number;
}

interface TimeSpan {
	start: Date;
	end: Date;
	label: string;
}

interface Assignee {
	name: string;
	color?: string;
}

interface Stage {
	id: string;
	name: string;
	type: string;
	start: Date;
	duration: number; // количество дней
	assignee?: Assignee;
	color: string;
}

// Вспомогательная функция для получения даты окончания этапа
function getStageEndDate(stage: Stage): Date {
	return new Date(stage.start.getTime() + stage.duration * 24 * 60 * 60 * 1000);
}

interface Milestone {
	id: string;
	name: string;
	date: Date;
	assignee?: Assignee;
	type: string;
	color?: string;
}

interface Project {
	id: string;
	name: string;
	assignee?: Assignee;
	stages: Stage[];
	milestones: Milestone[];
	layout?: 'inline' | 'multiline'; // inline - все этапы на одной строке, multiline - каждый этап на отдельной строке
}

interface Sprint {
	id: string;
	name: string;
	start: Date;
	end: Date;
}

interface GanttData {
	projects: Project[];
	sprints: Sprint[];
	timeSpans: TimeSpan[];
	startDate: Date;
	endDate: Date;
	excludeWeekdays: number[];
	includeDates: string[];
	excludeDates: string[];
}

const DEFAULT_SETTINGS: GanttSettings = {
	defaultStages: ['Анализ', 'Разработка', 'Тестирование', 'Деплой'],
	defaultMilestones: ['ПСИ', 'РЕЛИЗ', 'Деплой'],
	workingDays: [0, 1, 2, 3, 4, 5, 6], // Все дни недели по умолчанию
	excludeWeekdays: [], // Исключения дней недели (пустой по умолчанию)
	includeDates: [], // Конкретные даты для включения
	excludeDates: [], // Конкретные даты для исключения
	cellWidth: 30,
	cellHeight: 40
};

export default class ProjectGanttPlugin extends Plugin {
	settings: GanttSettings;

	async onload() {
		await this.loadSettings();

		// Регистрируем постпроцессор для блоков кода gantt
		this.registerMarkdownCodeBlockProcessor('gantt', (source, el, ctx) => {
			this.renderGantt(source, el, ctx);
		});

		// Добавляем настройки
		this.addSettingTab(new GanttSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private renderGantt(source: string, element: HTMLElement, ctx: MarkdownPostProcessorContext) {
		try {
			const data = this.parseGanttData(source);
			const ganttView = new GanttView(element, data, this.settings, (newData) => {
				this.updateSourceContent(ctx, newData, source);
			});
			ganttView.render();
		} catch (error) {
			element.createEl('div', { 
				text: `Ошибка парсинга диаграммы Ганта: ${error.message}`,
				cls: 'gantt-error'
			});
		}
	}

	private parseGanttData(source: string): GanttData {
		const lines = source.trim().split('\n').filter(line => line.trim());
		const data: GanttData = {
			projects: [],
			sprints: [],
			timeSpans: [],
			startDate: new Date(),
			endDate: new Date(),
			excludeWeekdays: [],
			includeDates: [],
			excludeDates: []
		};

		let currentProject: Project | null = null;

		for (const line of lines) {
			const trimmed = line.trim();
			
			if (trimmed.startsWith('project:')) {
				const projectData = trimmed.substring(8).trim();
				const parts = projectData.split('|').map(p => p.trim());
				
				const projectName = parts[0];
				const layout = parts.length > 1 && parts[1] === 'multiline' ? 'multiline' : 'inline';
				
				currentProject = {
					id: this.generateId(),
					name: projectName,
					stages: [],
					milestones: [],
					layout: layout
				};
				data.projects.push(currentProject);
			} else if (trimmed.startsWith('sprint:')) {
				const sprintData = this.parseSprint(trimmed);
				if (sprintData) data.sprints.push(sprintData);
			} else if (trimmed.startsWith('stage:') && currentProject) {
				const stage = this.parseStage(trimmed);
				if (stage) currentProject.stages.push(stage);
			} else if (trimmed.startsWith('milestone:') && currentProject) {
				const milestone = this.parseMilestone(trimmed);
				if (milestone) currentProject.milestones.push(milestone);
			} else if (trimmed.startsWith('dates:')) {
				const dates = this.parseDateRange(trimmed);
				if (dates) {
					data.startDate = dates.start;
					data.endDate = dates.end;
				}
			} else if (trimmed.startsWith('excludeWeekdays:')) {
				const weekdays = this.parseWeekdays(trimmed);
				if (weekdays) data.excludeWeekdays = weekdays;
			} else if (trimmed.startsWith('includeDates:')) {
				const dates = this.parseDatesList(trimmed);
				if (dates) data.includeDates = dates;
			} else if (trimmed.startsWith('excludeDates:')) {
				const dates = this.parseDatesList(trimmed);
				if (dates) data.excludeDates = dates;
			}
		}

		return data;
	}

	private parseSprint(line: string): Sprint | null {
		// sprint: Спринт 1 | 2024-01-01 | 2024-01-14
		const match = line.match(/sprint:\s*(.+?)\s*\|\s*(\S+)\s*\|\s*(\S+)/);
		if (match) {
			return {
				id: this.generateId(),
				name: match[1],
				start: new Date(match[2]),
				end: new Date(match[3])
			};
		}
		return null;
	}

	private parseStage(line: string): Stage | null {
		// НОВЫЙ ФОРМАТ: stage: Название | 2024-01-01 | 5 | Assignee | #color
		const parts = line.substring(6).trim().split('|').map(p => p.trim());
		
		if (parts.length >= 3) {
			const startDate = new Date(parts[1]);
			
			// Парсим длительность как простое число (например, "5", "10", "15")
			const duration = parseInt(parts[2]);
			if (isNaN(duration) || duration <= 0) {
				console.error(`❌ НЕВЕРНЫЙ ФОРМАТ: "${parts[2]}" - ожидается число дней (например, "5")`);
				return null;
			}
			
			console.log(`✨ НОВЫЙ СИНТАКСИС: stage="${parts[0]}" start=${parts[1]} duration=${duration}`);
			
			const stage: Stage = {
				id: this.generateId(),
				name: parts[0],
				type: parts[0],
				start: startDate,
				duration: duration,
				color: '#4A90E2'
			};
			
			// Проверяем есть ли ответственный
			if (parts.length >= 4 && parts[3] && !parts[3].startsWith('#')) {
				stage.assignee = { name: parts[3] };
			}
			
			// Проверяем есть ли цвет
			for (let i = 3; i < parts.length; i++) {
				if (parts[i] && parts[i].startsWith('#') && parts[i].length === 7) {
					stage.color = parts[i];
					break;
				}
			}
			
			return stage;
		}
		return null;
	}

	private parseMilestone(line: string): Milestone | null {
		// milestone: РЕЛИЗ | 2024-01-15 | Петров П.П. | #ff6b6b
		console.log('🔍 Parsing milestone line:', line);
		
		// Простой парсинг через split
		if (!line.startsWith('milestone:')) return null;
		
		const parts = line.substring(10).split('|').map(p => p.trim()); // убираем "milestone:" и разбиваем
		
		console.log('📊 Split result:', parts);
		
		if (parts.length < 2) return null;
		
		const name = parts[0];
		const date = parts[1];
		const thirdPart = parts.length > 2 ? parts[2] : undefined;
		const fourthPart = parts.length > 3 ? parts[3] : undefined;
		
		console.log('🔧 Parts analysis:', {
			name,
			date,
			thirdPart,
			fourthPart
		});
		
		// Определяем что есть что
		let assigneeName: string | undefined = undefined;
		let milestoneColor: string | undefined = undefined;
		
		// Определяем assignee и color
		if (thirdPart && thirdPart.startsWith('#')) {
			console.log('🎨 Third part is color:', thirdPart);
			milestoneColor = thirdPart;
		} else if (thirdPart && thirdPart !== '') {
			console.log('👤 Third part is assignee:', thirdPart);
			assigneeName = thirdPart;
			// Четвертая часть может быть цветом
			if (fourthPart && fourthPart.startsWith('#')) {
				console.log('🎨 Fourth part is color:', fourthPart);
				milestoneColor = fourthPart;
			}
		} else if (thirdPart === '' && fourthPart && fourthPart.startsWith('#')) {
			// Обратная совместимость: пустая thirdPart, цвет в fourthPart
			console.log('🔄 Legacy format: empty third part, color in fourth:', fourthPart);
			milestoneColor = fourthPart;
		}
		
		console.log('🎯 Final values before validation:', {
			assigneeName,
			milestoneColor
		});
		
		// Валидируем цвет - если некорректный, то не используем
		if (milestoneColor && !this.isValidHexColor(milestoneColor)) {
			console.log('🚫 Invalid color detected and removed:', milestoneColor);
			milestoneColor = undefined;
		} else if (milestoneColor) {
			console.log('✅ Valid color detected:', milestoneColor);
		}
		
		const result = {
			id: this.generateId(),
			name: name,
			type: name,
			date: new Date(date),
			assignee: assigneeName ? { name: assigneeName } : undefined,
			color: milestoneColor
		};
		
		// Отладочная информация парсинга
		console.log('📝 Parsed milestone:', {
			name: result.name,
			date: result.date.toISOString().split('T')[0],
			color: result.color,
			assignee: result.assignee?.name,
			rawLine: line
		});
		
		return result;
	}

	private parseDateRange(line: string): { start: Date; end: Date } | null {
		// dates: 2024-01-01 | 2024-03-31
		const match = line.match(/dates:\s*(\S+)\s*\|\s*(\S+)/);
		if (match) {
			return {
				start: new Date(match[1]),
				end: new Date(match[2])
			};
		}
		return null;
	}

	private parseWeekdays(line: string): number[] | null {
		// excludeWeekdays: 0,6  (воскресенье, суббота)
		const match = line.match(/excludeWeekdays:\s*(.+)/);
		if (match) {
			const weekdaysStr = match[1].trim();
			if (weekdaysStr) {
				return weekdaysStr.split(',').map(w => parseInt(w.trim())).filter(w => w >= 0 && w <= 6);
			}
		}
		return null;
	}

	private parseDatesList(line: string): string[] | null {
		// includeDates: 2025-07-19,2025-08-15
		// excludeDates: 2025-08-22,2025-09-01
		const match = line.match(/(includeDates|excludeDates):\s*(.+)/);
		if (match) {
			const datesStr = match[2].trim();
			if (datesStr) {
				return datesStr.split(',').map(d => d.trim()).filter(d => d.length > 0);
			}
		}
		return null;
	}

	private generateId(): string {
		return Math.random().toString(36).substr(2, 9);
	}

	// Валидация HEX цвета для основного класса
	private isValidHexColor(color: string): boolean {
		if (!color || color.trim() === '#' || color.trim() === '') return false;
		// Проверяем формат HEX цвета
		const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		return hexRegex.test(color.trim());
	}

	private updateSourceContent(ctx: MarkdownPostProcessorContext, data: GanttData, originalSource: string) {
		const newSource = this.serializeGanttData(data);
		if (newSource !== originalSource) {
			// Получаем активный редактор
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView && activeView.editor) {
				const editor: Editor = activeView.editor;
				const content = editor.getValue();
				
				// Заменяем только конкретный блок gantt с данным originalSource
				const originalBlock = `\`\`\`gantt\n${originalSource}\n\`\`\``;
				const newBlock = `\`\`\`gantt\n${newSource}\n\`\`\``;
				
				// Ищем точное соответствие оригинального блока
				const blockIndex = content.indexOf(originalBlock);
				if (blockIndex !== -1) {
					// Вычисляем позиции начала и конца блока для замены
					const blockStart = this.posFromIndex(editor, blockIndex);
					const blockEnd = this.posFromIndex(editor, blockIndex + originalBlock.length);
					
					// Заменяем только конкретный блок без сброса позиции курсора
					editor.replaceRange(newBlock, blockStart, blockEnd);
				} else {
					// Если точный блок не найден, попробуем найти по содержимому
					// с учетом возможных различий в форматировании
					this.updateByContentMatch(editor, originalSource, newSource);
				}
			}
		}
	}

	private updateByContentMatch(editor: Editor, originalSource: string, newSource: string) {
		const content = editor.getValue();
		const lines = content.split('\n');
		
		let inGanttBlock = false;
		let blockStartIndex = -1;
		let blockEndIndex = -1;
		let blockContent = '';
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			
			if (line === '```gantt') {
				if (!inGanttBlock) {
					inGanttBlock = true;
					blockStartIndex = i;
					blockContent = '';
				}
			} else if (line === '```' && inGanttBlock) {
				blockEndIndex = i;
				
				// Проверяем соответствие содержимого блока
				if (this.normalizeGanttContent(blockContent) === this.normalizeGanttContent(originalSource)) {
					// Заменяем найденный блок с сохранением позиции курсора
					const blockStart = { line: blockStartIndex + 1, ch: 0 };
					const blockEnd = { line: blockEndIndex, ch: 0 };
					
					editor.replaceRange(newSource, blockStart, blockEnd);
					return;
				}
				
				inGanttBlock = false;
			} else if (inGanttBlock) {
				blockContent += (blockContent ? '\n' : '') + lines[i];
			}
		}
	}

	// Вспомогательный метод для преобразования линейного индекса в позицию {line, ch}
	private posFromIndex(editor: Editor, index: number): { line: number; ch: number } {
		const content = editor.getValue();
		let line = 0;
		let ch = 0;
		
		for (let i = 0; i < index; i++) {
			if (content[i] === '\n') {
				line++;
				ch = 0;
			} else {
				ch++;
			}
		}
		
		return { line, ch };
	}

	private normalizeGanttContent(content: string): string {
		return content
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.join('\n');
	}

	private serializeGanttData(data: GanttData): string {
		let result = '';
		
		if (data.startDate && data.endDate) {
			result += `dates: ${data.startDate.toISOString().split('T')[0]} | ${data.endDate.toISOString().split('T')[0]}\n`;
		}

		// Сериализация настроек рабочих дней
		if (data.excludeWeekdays && data.excludeWeekdays.length > 0) {
			result += `excludeWeekdays: ${data.excludeWeekdays.join(',')}\n`;
		}

		if (data.includeDates && data.includeDates.length > 0) {
			result += `includeDates: ${data.includeDates.join(',')}\n`;
		}

		if (data.excludeDates && data.excludeDates.length > 0) {
			result += `excludeDates: ${data.excludeDates.join(',')}\n`;
		}

		for (const sprint of data.sprints) {
			result += `sprint: ${sprint.name} | ${sprint.start.toISOString().split('T')[0]} | ${sprint.end.toISOString().split('T')[0]}\n`;
		}

		for (const project of data.projects) {
			result += `project: ${project.name}`;
			if (project.layout === 'multiline') {
				result += ' | multiline';
			}
			result += '\n';
			
			for (const stage of project.stages) {
				result += `stage: ${stage.name} | ${stage.start.toISOString().split('T')[0]} | ${stage.duration}`;
				if (stage.assignee) result += ` | ${stage.assignee.name}`;
				if (stage.color !== '#4A90E2') result += ` | ${stage.color}`;
				result += '\n';
				console.log(`💾 SERIALIZING stage: "${stage.name}" start=${stage.start.toISOString().split('T')[0]} duration=${stage.duration}`);
			}
			
			for (const milestone of project.milestones) {
				result += `milestone: ${milestone.name} | ${milestone.date.toISOString().split('T')[0]}`;
				
				// Простая логика без пустых полей
				if (milestone.assignee && milestone.color) {
					// И assignee, и цвет: milestone: Name | Date | Assignee | #Color
					result += ` | ${milestone.assignee.name} | ${milestone.color}`;
				} else if (milestone.assignee) {
					// Только assignee: milestone: Name | Date | Assignee
					result += ` | ${milestone.assignee.name}`;
				} else if (milestone.color) {
					// Только цвет: milestone: Name | Date | #Color
					result += ` | ${milestone.color}`;
				}
				
				result += '\n';
			}
		}

		return result;
	}
}

// Функция для вычисления яркости цвета
function getColorBrightness(color: string): number {
	// Удаляем # если есть
	const hex = color.replace('#', '');
	
	// Извлекаем RGB компоненты
	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);
	
	// Вычисляем яркость по формуле относительной яркости
	// https://www.w3.org/WAI/GL/wiki/Relative_luminance
	return (r * 299 + g * 587 + b * 114) / 1000;
}

// Функция для выбора контрастного цвета текста
function getContrastTextColor(backgroundColor: string): string {
	const brightness = getColorBrightness(backgroundColor);
	// Если яркость больше 128 (светлый фон), используем темный текст
	// Если яркость меньше 128 (темный фон), используем светлый текст
	return brightness > 128 ? '#2c2c2c' : '#ffffff';
}

class GanttView {
	private element: HTMLElement;
	private data: GanttData;
	private settings: GanttSettings;
	private updateCallback: (data: GanttData) => void;
	private isDragging = false;
	private dragTarget: HTMLElement | null = null;
	private dragType: 'stage' | 'milestone' | null = null;
	private dragOffset = { x: 0, y: 0 };
	private timelineContainer: HTMLElement | null = null;
	private actualCellWidth: number | null = null;
	private isUpdating = false;
	private preservedPositions = new Map<string, string>();
	private preservedSizes = new Map<string, { width: string; left: string }>();
	private isResizing = false;
	private resizeType: 'left' | 'right' | null = null;
	private initialStageStart: Date | null = null;
	private initialStageDuration: number | null = null;

	constructor(element: HTMLElement, data: GanttData, settings: GanttSettings, updateCallback: (data: GanttData) => void) {
		this.element = element;
		this.data = data;
		this.settings = settings;
		this.updateCallback = updateCallback;
	}

	render() {
		// Предотвращаем перерисовку во время обновления после перетаскивания
		if (this.isUpdating) {
			return;
		}
		
		this.element.empty();
		this.element.addClass('gantt-container');

		const ganttTable = this.element.createEl('div', { cls: 'gantt-table' });
		
		this.renderHeader(ganttTable);
		this.renderProjects(ganttTable);
		
		this.setupEventListeners();
		
		// Кешируем реальную ширину ячейки после рендеринга
		setTimeout(() => {
			this.cacheActualCellWidth();
		}, 100);
	}

	private cacheActualCellWidth() {
		const dayHeader = this.element.querySelector('.gantt-day-header') as HTMLElement;
		this.actualCellWidth = dayHeader ? dayHeader.offsetWidth : this.settings.cellWidth;
	}

	private getActualCellWidth(): number {
		return this.actualCellWidth || this.settings.cellWidth;
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createEl('div', { cls: 'gantt-header' });
		
		// Заголовок с проектами
		const projectHeader = header.createEl('div', { cls: 'gantt-project-header' });
		projectHeader.textContent = 'Проекты';

		// Заголовки спринтов и дней
		const timeHeader = header.createEl('div', { cls: 'gantt-time-header' });
		
		// Создаем временную шкалу
		const timeScale = this.generateWorkingDaysScale();
		
		// Спринты
		const sprintRow = timeHeader.createEl('div', { cls: 'gantt-sprint-row' });
		for (let i = 0; i < this.data.sprints.length; i++) {
			const sprint = this.data.sprints[i];
			const sprintDays = this.getWorkingDaysBetween(sprint.start, sprint.end);
			const sprintEl = sprintRow.createEl('div', { 
				cls: 'gantt-sprint-header',
				text: sprint.name
			});
			sprintEl.style.width = `${sprintDays * this.settings.cellWidth}px`;
			
			// Добавляем класс для разделения спринтов (кроме последнего)
			if (i < this.data.sprints.length - 1) {
				sprintEl.addClass('gantt-sprint-separator');
			}
		}

		// Дни
		const dayRow = timeHeader.createEl('div', { cls: 'gantt-day-row' });
		for (const day of timeScale) {
			const dayName = this.getDayNameRu(day);
			const dayNumber = day.getDate().toString();
			const headerText = `${dayNumber}\n${dayName}`;
			
			const dayEl = dayRow.createEl('div', { 
				cls: 'gantt-day-header'
			});
			dayEl.style.width = `${this.settings.cellWidth}px`;
			dayEl.style.whiteSpace = 'pre-line'; // Разрешаем перенос строк
			dayEl.textContent = headerText;
			
			// Подсветка текущего дня
			if (this.isSameDay(day, new Date())) {
				dayEl.addClass('gantt-current-day');
			}
		}
	}

	private renderProjects(container: HTMLElement) {
		const projectsContainer = container.createEl('div', { cls: 'gantt-projects' });

		for (const project of this.data.projects) {
			if (project.layout === 'multiline') {
				this.renderProjectMultiline(projectsContainer, project);
			} else {
				this.renderProjectInline(projectsContainer, project);
			}
		}
	}

	private renderProjectInline(container: HTMLElement, project: Project) {
		const projectRow = container.createEl('div', { cls: 'gantt-project-row' });
		
		// Название проекта
		const projectName = projectRow.createEl('div', { 
			cls: 'gantt-project-name',
			text: project.name
		});
		if (project.assignee) {
			projectName.createEl('span', { 
				cls: 'gantt-assignee',
				text: ` (${project.assignee.name})`
			});
		}

		// Временная шкала проекта
		const projectTimeline = projectRow.createEl('div', { cls: 'gantt-project-timeline' });
		
		// Отрисовка этапов
		for (const stage of project.stages) {
			this.renderStage(projectTimeline, stage);
		}

		// Отрисовка мелстоунов
		for (const milestone of project.milestones) {
			this.renderMilestone(projectTimeline, milestone);
		}
	}

	private renderProjectMultiline(container: HTMLElement, project: Project) {
		// Основная строка проекта с названием и мелстоунами
		const projectRow = container.createEl('div', { cls: 'gantt-project-row gantt-project-main' });
		
		// Название проекта
		const projectName = projectRow.createEl('div', { 
			cls: 'gantt-project-name',
			text: project.name
		});
		if (project.assignee) {
			projectName.createEl('span', { 
				cls: 'gantt-assignee',
				text: ` (${project.assignee.name})`
			});
		}

		// Временная шкала для мелстоунов
		const projectTimeline = projectRow.createEl('div', { cls: 'gantt-project-timeline' });
		
		// Отрисовка мелстоунов на основной строке
		for (const milestone of project.milestones) {
			this.renderMilestone(projectTimeline, milestone);
		}

		// Создаем отдельную строку для каждого этапа
		for (const stage of project.stages) {
			const stageRow = container.createEl('div', { cls: 'gantt-project-row gantt-stage-row' });
			
			// Название этапа в левой колонке
			const stageName = stageRow.createEl('div', { 
				cls: 'gantt-project-name gantt-stage-name',
				text: `├─ ${stage.name}`
			});
			if (stage.assignee) {
				stageName.createEl('span', { 
					cls: 'gantt-assignee',
					text: ` (${stage.assignee.name})`
				});
			}

			// Временная шкала для этапа
			const stageTimeline = stageRow.createEl('div', { cls: 'gantt-project-timeline' });
			this.renderStage(stageTimeline, stage);
		}
	}

	private renderStage(container: HTMLElement, stage: Stage) {
		const position = this.getDatePosition(stage.start);
		// 🔧 НОВАЯ ЛОГИКА: Ширина напрямую из duration!
		const calendarDays = stage.duration;
		const width = calendarDays * this.getActualCellWidth();
		// Рабочие дни только для отображения
		const stageEnd = getStageEndDate(stage);
		const workingDays = this.getWorkingDaysBetween(stage.start, stageEnd);

		// Специальное логирование для перетаскиваемого этапа
		const isDraggedStage = this.dragTarget && this.dragTarget.dataset.stageId === stage.id;
		const logPrefix = isDraggedStage ? '🎯 DRAGGED STAGE' : '🎨 renderStage DEBUG';
		
		console.log(`${logPrefix}:`, {
			stageId: stage.id,
			stageName: stage.name,
			stageStart: stage.start.toISOString().split('T')[0],
			stageEnd: stageEnd.toISOString().split('T')[0],
			calendarDays,
			workingDays,
			calculatedWidth: width,
			position,
			cellWidth: this.getActualCellWidth(),
			isUpdating: this.isUpdating,
			isDraggedStage
		});

		// Создаем основной контейнер этапа
		const stageEl = container.createEl('div', {
			cls: 'gantt-stage'
		});
		
		// Левая часть: количество дней
		const daysEl = stageEl.createEl('div', {
			cls: 'gantt-stage-days',
			text: calendarDays.toString()
		});
		
		// Правая часть: название и исполнитель
		const contentEl = stageEl.createEl('div', {
			cls: 'gantt-stage-content'
		});
		
		// Название этапа
		contentEl.createEl('div', {
			cls: 'gantt-stage-name',
			text: stage.name
		});
		
		// Исполнитель (если есть)
		if (stage.assignee) {
			contentEl.createEl('div', { 
				cls: 'gantt-stage-assignee',
				text: stage.assignee.name
			});
		}
		
		// Проверяем есть ли сохраненные размеры и позиция для этого элемента
		const preservedSize = this.preservedSizes.get(stage.id);
		const preservedPosition = this.preservedPositions.get(stage.id);
		
		let finalLeft: string;
		let finalWidth: string;
		
		if (preservedSize && this.isUpdating) {
			// Используем сохранённые размеры и позицию (после ресайза)
			finalLeft = preservedSize.left;
			finalWidth = preservedSize.width;
			console.log('📦 USING preserved size:', { 
				stageId: stage.id,
				finalLeft, 
				finalWidth,
				calculatedWidth: `${width}px`,
				calendarDays,
				widthMismatch: finalWidth !== `${width}px`,
				isDraggedStage
			});
		} else if (preservedPosition && this.isUpdating) {
			// Используем сохранённую позицию (после перетаскивания)
			finalLeft = preservedPosition;
			finalWidth = `${width}px`;
			console.log('📍 USING preserved position:', { 
				stageId: stage.id,
				finalLeft, 
				finalWidth, 
				calculatedWidth: `${width}px`,
				calendarDays,
				isDraggedStage
			});
		} else {
			// Используем вычисленные значения
			finalLeft = `${position}px`;
			finalWidth = `${width}px`;
			console.log('🧮 USING calculated values:', { 
				stageId: stage.id,
				finalLeft, 
				finalWidth,
				calendarDays,
				isDraggedStage
			});
		}
		
		stageEl.style.left = finalLeft;
		stageEl.style.width = finalWidth;
		
		const isDraggedStageRender = this.dragTarget && this.dragTarget.dataset.stageId === stage.id;
		const renderPrefix = isDraggedStageRender ? '🎯 DRAGGED STAGE FINAL RENDER' : '🎭 FINAL RENDER';
		
		console.log(`${renderPrefix}:`, {
			stageId: stage.id,
			appliedLeft: finalLeft,
			appliedWidth: finalWidth,
			calculatedWidth: `${width}px`,
			calendarDays,
			widthMatches: finalWidth === `${width}px`,
			isDraggedStage: isDraggedStageRender
		});
		
		// 🚨 КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ для перетаскиваемого этапа
		if (isDraggedStageRender && finalWidth !== `${width}px`) {
			console.error('🚨 WIDTH MISMATCH FOR DRAGGED STAGE!', {
				stageId: stage.id,
				expectedWidth: `${width}px`,
				appliedWidth: finalWidth,
				calendarDays,
				workingDays,
				cellWidth: this.getActualCellWidth()
			});
		}
		
		stageEl.style.backgroundColor = stage.color;
		
		// Автоматически выбираем цвет текста на основе яркости фона
		const textColor = getContrastTextColor(stage.color);
		stageEl.style.color = textColor;
		
		// Отладочная информация
		console.log('🎨 COLOR DEBUG:', {
			stageId: stage.id,
			backgroundColor: stage.color,
			brightness: getColorBrightness(stage.color),
			textColor: textColor,
			stageName: stage.name
		});
		
		stageEl.dataset.stageId = stage.id;
		stageEl.dataset.type = 'stage';

		// Добавляем только правый хендл для изменения размера
		stageEl.createEl('div', { cls: 'gantt-resize-handle gantt-resize-right' });
	}

	private renderMilestone(container: HTMLElement, milestone: Milestone) {
		const position = this.getDatePosition(milestone.date);

		const milestoneEl = container.createEl('div', {
			cls: 'gantt-milestone',
			text: milestone.name // Текст ВНУТРИ элемента
		});
		
		// Проверяем есть ли сохраненная позиция для этого мелстоуна
		const preservedPosition = this.preservedPositions.get(milestone.id);
		if (preservedPosition && this.isUpdating) {
			milestoneEl.style.left = preservedPosition;
		} else {
			milestoneEl.style.left = `${position}px`;
		}
		
		// Применяем цвет МАКСИМАЛЬНО ПРОСТО
		if (milestone.color) {
			console.log('🔍 Processing milestone color:', milestone.color, 'for', milestone.name);
			console.log('🔍 Color validation result:', this.isValidColor(milestone.color));
			
			if (this.isValidColor(milestone.color)) {
				// Устанавливаем атрибут для CSS селектора
				milestoneEl.setAttribute('data-custom-color', 'true');
				
				// Простое применение цветов
				milestoneEl.style.backgroundColor = milestone.color;
				milestoneEl.style.borderColor = milestone.color;
				milestoneEl.style.border = `2px solid ${milestone.color}`;
				
				console.log('✅ Applied color:', milestone.color);
				console.log('📋 Element style after:', milestoneEl.style.cssText);
			} else {
				console.warn('❌ Invalid color format:', milestone.color);
			}
		} else {
			console.log('⚪ No color for milestone:', milestone.name);
		}
		
		milestoneEl.dataset.milestoneId = milestone.id;
		milestoneEl.dataset.type = 'milestone';

		if (milestone.assignee) {
			milestoneEl.title = `${milestone.name} (${milestone.assignee.name})`;
		} else {
			milestoneEl.title = milestone.name;
		}
	}

	private setupEventListeners() {
		// Обработка перетаскивания
		this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
		document.addEventListener('mousemove', this.handleMouseMove.bind(this));
		document.addEventListener('mouseup', this.handleMouseUp.bind(this));
	}

	private handleMouseDown(e: MouseEvent) {
		const target = e.target as HTMLElement;
		
		// Проверяем ресайз хендлы
		if (target.classList.contains('gantt-resize-handle')) {
			const stageElement = target.parentElement;
			if (stageElement && stageElement.classList.contains('gantt-stage')) {
							this.isResizing = true;
			this.dragTarget = stageElement;
			this.dragType = 'stage';
			this.resizeType = 'right'; // Только правый resize
				
				// Сохраняем исходные даты этапа
				const stageId = stageElement.dataset.stageId;
				const stage = this.findStageById(stageId!);
				if (stage) {
					this.initialStageStart = new Date(stage.start);
					this.initialStageDuration = stage.duration;
				}
				
				console.log('🎯 RESIZE START:', {
					resizeType: this.resizeType,
					stageId: stageElement.dataset.stageId,
					handleClass: target.className,
					note: 'Только правый resize доступен'
				});
				
				target.classList.add('gantt-resizing');
				e.preventDefault();
				e.stopPropagation();
				return;
			}
		}
		
		// Обычное перетаскивание - ищем ближайший родительский элемент
		const stageElement = target.closest('.gantt-stage') as HTMLElement;
		const milestoneElement = target.closest('.gantt-milestone') as HTMLElement;
		const dragElement = stageElement || milestoneElement;
		
		if (dragElement) {
			this.isDragging = true;
			this.dragTarget = dragElement;
			this.dragType = dragElement.dataset.type as 'stage' | 'milestone';
			
			// 🔧 СОХРАНЯЕМ ИСХОДНЫЕ ДАННЫЕ ЭТАПА/ВЕХИ ДЛЯ ПЕРЕТАСКИВАНИЯ
			if (this.dragType === 'stage') {
				const stageId = dragElement.dataset.stageId;
				const stage = this.findStageById(stageId!);
				if (stage) {
					this.initialStageStart = new Date(stage.start);
					this.initialStageDuration = stage.duration;
					const initialEnd = getStageEndDate(stage);
					console.log('💾 Saving initial stage data for drag:', {
						stageId,
						initialStart: this.initialStageStart.toISOString().split('T')[0],
						initialEnd: initialEnd.toISOString().split('T')[0],
						initialDuration: stage.duration * 24 * 60 * 60 * 1000,
						initialDays: this.getWorkingDaysBetween(this.initialStageStart, initialEnd)
					});
				}
			}
			
			// Вычисляем offset мыши относительно элемента
			const rect = dragElement.getBoundingClientRect();
			this.dragOffset.x = e.clientX - rect.left;
			this.dragOffset.y = e.clientY - rect.top;
			
			dragElement.classList.add('gantt-dragging');
			e.preventDefault();
		}
	}

	private handleMouseMove(e: MouseEvent) {
		if ((!this.isDragging && !this.isResizing) || !this.dragTarget) return;

		// Находим timeline контейнер
		const timeline = this.dragTarget.parentElement;
		if (!timeline) return;
		
		const timelineRect = timeline.getBoundingClientRect();
		const actualCellWidth = this.getActualCellWidth();
		
		if (this.isResizing) {
			// 🎯 ПЛАВНЫЙ РЕЗАЙЗ: Используем позицию мыши напрямую для визуального изменения
			const mouseX = e.clientX - timelineRect.left;
			
			const stageId = this.dragTarget.dataset.stageId;
			const stage = this.findStageById(stageId!);
			if (!stage || !this.initialStageStart || !this.initialStageDuration) return;
			
			console.log('🎯 RESIZE ACTIVE:', {
				resizeType: this.resizeType,
				mouseX: mouseX.toFixed(1),
				stageId,
				hasInitialData: !!(this.initialStageStart && this.initialStageDuration)
			});
			
			// ТОЛЬКО ПРАВЫЙ РЕЗАЙЗ: Плавное изменение правой границы
			const startPosition = this.getDatePosition(stage.start);
			
			// Ограничиваем mouseX чтобы не сделать этап слишком маленьким
			const minMouseX = startPosition + actualCellWidth * 0.5; // минимум 0.5 дня
			const clampedMouseX = Math.max(minMouseX, mouseX);
			
			// Плавное изменение визуального размера
			const newWidth = clampedMouseX - startPosition;
			this.dragTarget.style.width = `${newWidth}px`;
			// НЕ изменяем left для правого resize
			
			console.log('🎯 RIGHT RESIZE:', {
				startPosition: startPosition.toFixed(1),
				mouseX: mouseX.toFixed(1),
				clampedMouseX: clampedMouseX.toFixed(1),
				newWidth: newWidth.toFixed(1),
				minMouseX: minMouseX.toFixed(1)
			});
			
			// ДАННЫЕ НЕ ОБНОВЛЯЮТСЯ! Только визуальное изменение во время движения
			
			console.log('🎨 SMOOTH RESIZE:', {
				resizeType: this.resizeType,
				mouseX: mouseX.toFixed(1),
				currentWidth: this.dragTarget.style.width,
				currentLeft: this.dragTarget.style.left,
				note: 'Только визуальное изменение, данные обновятся при mouseUp'
			});
		} else {
			// Обычное перетаскивание
			const x = e.clientX - timelineRect.left - this.dragOffset.x;
			let gridPosition = Math.round(x / actualCellWidth) * actualCellWidth;
			
			// Ограничиваем перетаскивание в пределах временной шкалы
			const { minPosition, maxPosition } = this.getPositionLimits();
			
			// Для этапов учитываем их ширину при ограничении
			let constrainedPosition = gridPosition;
			if (this.dragType === 'stage') {
				const stageWidth = parseInt(this.dragTarget.style.width) || 0;
				constrainedPosition = Math.max(minPosition, Math.min(maxPosition - stageWidth, gridPosition));
			} else {
				// Для мелстоунов
				constrainedPosition = Math.max(minPosition, Math.min(maxPosition, gridPosition));
			}
			
			// Добавляем визуальную индикацию при достижении границ
			if (constrainedPosition !== gridPosition) {
				this.dragTarget.classList.add('gantt-boundary-constraint');
			} else {
				this.dragTarget.classList.remove('gantt-boundary-constraint');
			}
			
			this.dragTarget.style.left = `${constrainedPosition}px`;
		}
	}

	private getPositionLimits(): { minPosition: number; maxPosition: number } {
		const minPosition = 0; // Начало временной шкалы
		const maxPosition = this.getDatePosition(this.data.endDate); // Конец временной шкалы
		
		return { minPosition, maxPosition };
	}

	private handleMouseUp(e: MouseEvent) {
		if ((!this.isDragging && !this.isResizing) || !this.dragTarget) return;
		
		console.group('🖱️ Mouse Up Event');

		// Убираем классы
		this.dragTarget.classList.remove('gantt-dragging');
		this.dragTarget.classList.remove('gantt-boundary-constraint');
		
		// Убираем класс ресайза с хендла если он есть
		const resizeHandle = e.target as HTMLElement;
		if (resizeHandle && resizeHandle.classList.contains('gantt-resize-handle')) {
			resizeHandle.classList.remove('gantt-resizing');
		}
		
		if (this.isResizing) {
			// 🎯 ОБНОВЛЕНИЕ ДАННЫХ И ФИНАЛЬНАЯ ПРИВЯЗКА К СЕТКЕ
			const stageId = this.dragTarget.dataset.stageId;
			const stage = this.findStageById(stageId!);
			if (stage && this.initialStageStart && this.initialStageDuration) {
				const actualCellWidth = this.getActualCellWidth();
				
				// ТОЛЬКО ПРАВЫЙ RESIZE: Обновляем duration на основе визуальной ширины
				const currentWidth = parseFloat(this.dragTarget.style.width.replace('px', ''));
				const newDuration = Math.round(currentWidth / actualCellWidth);
				
				if (newDuration > 0) {
					stage.duration = newDuration;
				}
				
				// Финальная привязка позиции и размера к сетке дней
				const finalPosition = this.getDatePosition(stage.start);
				const finalWidth = stage.duration * actualCellWidth;
				
				this.dragTarget.style.left = `${finalPosition}px`;
				this.dragTarget.style.width = `${finalWidth}px`;
				
				console.log('🎯 FINAL GRID SNAP:', {
					stageId,
					resizeType: this.resizeType,
					finalStart: stage.start.toISOString().split('T')[0],
					finalDuration: stage.duration,
					finalPosition: `${finalPosition}px`,
					finalWidth: `${finalWidth}px`,
					note: 'Данные обновлены из визуального размера'
				});
			}
			
			// Сохраняем финальные размеры и позицию элемента
			const finalWidth = this.dragTarget.style.width;
			const finalLeft = this.dragTarget.style.left;
			const elementId = this.dragTarget.dataset.stageId;
			if (elementId) {
				this.preservedSizes.set(elementId, { width: finalWidth, left: finalLeft });
			}
			
			// Данные обновлены выше, теперь обновляем текст
			this.isUpdating = true;
			
			this.isResizing = false;
			this.resizeType = null;
			this.initialStageStart = null;
			this.initialStageDuration = null;
			this.dragTarget = null;
			this.dragType = null;
			
			// Задерживаем обновление исходного текста
			setTimeout(() => {
				this.updateCallback(this.data);
				setTimeout(() => {
					this.isUpdating = false;
					this.preservedSizes.clear();
					console.groupEnd();
				}, 50);
			}, 100);
		} else {
			// Обычное перетаскивание
			// Сохраняем финальную позицию элемента
			const finalPosition = this.dragTarget.style.left;
			const finalWidth = this.dragTarget.style.width;
			const elementId = this.dragTarget.dataset.stageId || this.dragTarget.dataset.milestoneId;
			
			if (elementId) {
				this.preservedPositions.set(elementId, finalPosition);
			}
			
			// Обновляем данные
			this.updateItemPosition(this.dragTarget);
			
			// Устанавливаем флаг обновления чтобы предотвратить перерисовку
			this.isUpdating = true;
			
			this.isDragging = false;
			this.dragTarget = null;
			this.dragType = null;
			
			// 🧹 Очищаем сохранённые исходные данные
			this.initialStageStart = null;
			this.initialStageDuration = null;

			// Задерживаем обновление исходного текста и сброс флага
			setTimeout(() => {
				console.log('📄 CALLING updateCallback - will trigger re-render');
				this.updateCallback(this.data);
				// Сбрасываем флаг после обновления и очищаем сохраненные позиции
				setTimeout(() => {
					console.log('🧹 CLEARING update flags');
					this.isUpdating = false;
					this.preservedPositions.clear();
					console.groupEnd();
				}, 50);
			}, 100);
		}
		
		if (!this.isResizing && !this.isDragging) {
			console.groupEnd();
		}
	}

	private updateItemPosition(element: HTMLElement) {
		// Безопасно извлекаем числовое значение из style.left
		const leftValue = parseFloat(element.style.left.replace('px', ''));
		const newDate = this.getDateFromPosition(leftValue);
		

		
		if (this.dragType === 'stage') {
			const stageId = element.dataset.stageId;
			const stage = this.findStageById(stageId!);
			if (stage) {
				// 🔄 НОВАЯ ЛОГИКА: Используем сохранённые start и duration
				const originalStart = this.initialStageStart ? new Date(this.initialStageStart) : new Date(stage.start);
				const originalDuration = this.initialStageDuration ? this.initialStageDuration : stage.duration;
				const originalCalendarDays = originalDuration;
				
				const originalEnd = new Date(originalStart.getTime() + originalDuration * 24 * 60 * 60 * 1000);
				
				console.log('📊 Original stage data (CALENDAR-BASED):', {
					stageId,
					originalStart: originalStart.toISOString().split('T')[0],
					originalEnd: originalEnd.toISOString().split('T')[0],
					originalDuration: originalDuration * 24 * 60 * 60 * 1000,
					originalCalendarDays,
					usedSavedData: this.initialStageStart !== null
				});
				
				// 🔄 НОВАЯ ЛОГИКА: При drag меняем только start, сохраняем duration
				const duration = originalDuration * 24 * 60 * 60 * 1000;
				
				// Вычисляем новые даты, сохраняя длительность
				let newStartDate = new Date(newDate);
				let newEndDate = new Date(newDate.getTime() + duration);
				
						console.log('📈 Calendar-based calculations:', {
			duration,
			durationDays: originalCalendarDays,
			newStartDate: newStartDate.toISOString().split('T')[0],
			newEndDate: newEndDate.toISOString().split('T')[0]
		});
				
				// Проверяем границы как единого блока
				let boundaryAdjusted = false;
				
				// Если этап выходит за левую границу
				if (newStartDate < this.data.startDate) {
					console.log('⬅️ Left boundary hit, adjusting...');
					newStartDate = new Date(this.data.startDate);
					newEndDate = new Date(newStartDate.getTime() + duration);
					boundaryAdjusted = true;
				}
				
				// Если этап выходит за правую границу
				if (newEndDate > this.data.endDate) {
					console.log('➡️ Right boundary hit, adjusting...');
					newEndDate = new Date(this.data.endDate);
					newStartDate = new Date(newEndDate.getTime() - duration);
					boundaryAdjusted = true;
				}
				
				const finalDuration = newEndDate.getTime() - newStartDate.getTime();
				const finalCalendarDays = Math.round(finalDuration / (24 * 60 * 60 * 1000));
				const durationPreserved = finalDuration === originalDuration;
				
				console.log('🎯 Final calculations (DURATION-PRESERVED):', {
					stageId,
					boundaryAdjusted,
					finalStart: newStartDate.toISOString().split('T')[0],
					finalEnd: newEndDate.toISOString().split('T')[0],
					originalCalendarDays,
					finalCalendarDays,
					durationPreserved,
					originalDuration,
					finalDuration
				});
				
				// 🚨 КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ
				if (!durationPreserved) {
					console.error('🚨 DURATION NOT PRESERVED!', {
						stageId,
						originalCalendarDays,
						finalCalendarDays,
						originalDuration,
						finalDuration,
						difference: finalDuration - originalDuration
					});
				}
				
				// 🔄 НОВАЯ ЛОГИКА: Применяем новый start, сохраняем duration
				stage.start = newStartDate;
				stage.duration = originalCalendarDays;
				
				const finalEndDate = getStageEndDate(stage);
				console.log('✅ Stage updated:', {
					stageId,
					newStart: stage.start.toISOString().split('T')[0],
					newEnd: finalEndDate.toISOString().split('T')[0],
					newDuration: stage.duration
				});
			}
		} else if (this.dragType === 'milestone') {
			const milestoneId = element.dataset.milestoneId;
			const milestone = this.findMilestoneById(milestoneId!);
			if (milestone) {
				// Ограничиваем дату мелстоуна границами временной шкалы
				milestone.date = this.clampDate(newDate, this.data.startDate, this.data.endDate);
			}
		}
	}

	private clampDate(date: Date, minDate: Date, maxDate: Date): Date {
		if (date < minDate) return new Date(minDate);
		if (date > maxDate) return new Date(maxDate);
		return new Date(date);
	}

	private findStageById(id: string): Stage | null {
		for (const project of this.data.projects) {
			const stage = project.stages.find(s => s.id === id);
			if (stage) return stage;
		}
		return null;
	}

	private findMilestoneById(id: string): Milestone | null {
		for (const project of this.data.projects) {
			const milestone = project.milestones.find(m => m.id === id);
			if (milestone) return milestone;
		}
		return null;
	}

	// Валидация HEX цвета
	private isValidColor(color: string): boolean {
		if (!color || color.trim() === '#' || color.trim() === '') return false;
		// Проверяем формат HEX цвета
		const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
		return hexRegex.test(color.trim());
	}

	private generateWorkingDaysScale(): Date[] {
		const scale: Date[] = [];
		const current = new Date(this.data.startDate);
		
		while (current <= this.data.endDate) {
			if (this.isWorkingDay(current)) {
				scale.push(new Date(current));
			}
			current.setDate(current.getDate() + 1);
		}
		
		return scale;
	}

	private getDatePosition(date: Date): number {
		const startDate = new Date(this.data.startDate);
		const workingDays = this.getWorkingDaysBetween(startDate, date);
		// ИСПРАВЛЕНИЕ: если дата = startDate, позиция должна быть 0, а не 1 * cellWidth
		const position = Math.max(0, workingDays - 1) * this.getActualCellWidth();
		
		// DEBUG: Временное логирование для проверки позиционирования
		// console.log('📍 DATE POSITION:', {
		//	targetDate: date.toISOString().split('T')[0],
		//	startDate: startDate.toISOString().split('T')[0],
		//	workingDays,
		//	adjustedDays: Math.max(0, workingDays - 1),
		//	position: position.toFixed(1)
		// });
		
		return position;
	}

	private getDateFromPosition(position: number): Date {
		const workingDays = Math.round(position / this.getActualCellWidth());
		const startDate = new Date(this.data.startDate);
		
		// DEBUG: Временное логирование для проверки позиционирования
		// console.log('📍 POSITION TO DATE:', {
		//	position: position.toFixed(1),
		//	workingDays,
		//	startDate: startDate.toISOString().split('T')[0]
		// });
		
		// ИСПРАВЛЕНО: позиция 0 = startDate
		if (workingDays <= 0) {
			return new Date(startDate);
		}
		
		// Теперь если workingDays = 1, это означает startDate + 1 рабочий день
		let currentDate = new Date(startDate);
		let addedDays = 0;
		
		while (addedDays < workingDays) {
			currentDate.setDate(currentDate.getDate() + 1);
			if (this.isWorkingDay(currentDate)) {
				addedDays++;
			}
		}
		
		return currentDate;
	}

	private isWorkingDay(date: Date): boolean {
		const dateStr = date.toISOString().split('T')[0];
		const dayOfWeek = date.getDay();
		
		// Проверяем конкретные даты исключения (приоритет над всем)
		if (this.data.excludeDates.includes(dateStr)) {
			return false;
		}
		
		// Проверяем конкретные даты включения (приоритет над днями недели)
		if (this.data.includeDates.includes(dateStr)) {
			return true;
		}
		
		// Проверяем исключенные дни недели
		if (this.data.excludeWeekdays.includes(dayOfWeek)) {
			return false;
		}
		
		// По умолчанию все дни рабочие (если не исключены выше)
		return true;
	}

	private getWorkingDaysBetween(start: Date, end: Date): number {
		let count = 0;
		const current = new Date(start);
		
		while (current <= end) {
			if (this.isWorkingDay(current)) {
				count++;
			}
			current.setDate(current.getDate() + 1);
		}
		
		return count;
	}

	private isSameDay(date1: Date, date2: Date): boolean {
		return date1.toDateString() === date2.toDateString();
	}

	private getDayNameRu(date: Date): string {
		const dayNames = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
		return dayNames[date.getDay()];
	}
}

class GanttSettingTab extends PluginSettingTab {
	plugin: ProjectGanttPlugin;

	constructor(app: App, plugin: ProjectGanttPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Этапы по умолчанию')
			.setDesc('Список этапов разработки через запятую')
			.addTextArea(text => text
				.setPlaceholder('Анализ, Разработка, Тестирование, Деплой')
				.setValue(this.plugin.settings.defaultStages.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.defaultStages = value.split(',').map(s => s.trim());
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Мелстоуны по умолчанию')
			.setDesc('Список мелстоунов через запятую')
			.addTextArea(text => text
				.setPlaceholder('ПСИ, РЕЛИЗ, Деплой')
				.setValue(this.plugin.settings.defaultMilestones.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.defaultMilestones = value.split(',').map(s => s.trim());
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Ширина ячейки')
			.setDesc('Ширина одного дня в пикселях')
			.addSlider(slider => slider
				.setLimits(20, 60, 5)
				.setValue(this.plugin.settings.cellWidth)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.cellWidth = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Высота строки')
			.setDesc('Высота строки проекта в пикселях')
			.addSlider(slider => slider
				.setLimits(30, 80, 5)
				.setValue(this.plugin.settings.cellHeight)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.cellHeight = value;
					await this.plugin.saveSettings();
				}));
	}
}
