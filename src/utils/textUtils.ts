/**
 * Text utilities for parsing and rendering markdown links
 */

/**
 * Парсит markdown-ссылки формата [текст](url)
 * @param text - Текст с возможными markdown-ссылками
 * @returns Массив частей текста и ссылок
 */
export function parseMarkdownLinks(text: string): Array<{ type: 'text' | 'link', content: string, url?: string }> {
  const parts: Array<{ type: 'text' | 'link', content: string, url?: string }> = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Добавляем текст до ссылки
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    // Добавляем ссылку
    parts.push({
      type: 'link',
      content: match[1], // текст ссылки
      url: match[2]      // URL
    });

    lastIndex = regex.lastIndex;
  }

  // Добавляем оставшийся текст
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  // Если ничего не нашли, возвращаем весь текст
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: text
    });
  }

  return parts;
}

/**
 * Рендерит текст с markdown-ссылками в HTML с кликабельными ссылками
 * @param text - Текст с возможными markdown-ссылками (может содержать уже экранированный HTML)
 * @param escapeHtml - Функция экранирования HTML
 * @returns HTML-строка с кликабельными ссылками
 */
export function renderTextWithLinks(text: string, escapeHtml: (str: string) => string): string {
  const parts = parseMarkdownLinks(text);

  return parts.map(part => {
    if (part.type === 'link') {
      // URL экранируем для безопасности, а текст - нет, так как он может содержать уже экранированный HTML
      const escapedUrl = part.url!.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `<a href="${escapedUrl}" class="gantt-logseq-link" target="_blank" rel="noopener noreferrer">${part.content}</a>`;
    } else {
      // Обычный текст оставляем как есть (он может содержать уже экранированный HTML из предыдущих обработок)
      return part.content;
    }
  }).join('');
}

/**
 * Извлекает только текст из строки с markdown-ссылками и Logseq-ссылками (без URL и скобок)
 * @param text - Текст с возможными markdown-ссылками и Logseq-ссылками
 * @returns Текст без markdown-разметки и без скобок Logseq
 */
export function extractPlainText(text: string): string {
  // Сначала убираем Logseq-ссылки [[Page Name]] или [[Page Name|Alias]]
  let result = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, pageName, alias) => {
    // Если есть алиас, используем его, иначе - название страницы
    return alias || pageName;
  });

  // Затем обрабатываем markdown-ссылки [text](url) - оставляем только текст
  const parts = parseMarkdownLinks(result);
  return parts.map(part => part.content).join('');
}
