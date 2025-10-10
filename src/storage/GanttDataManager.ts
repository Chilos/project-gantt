/**
 * GanttDataManager
 * Handles saving/loading Gantt data to/from Logseq blocks
 */

import type { GanttData, IGanttRepository } from '../types';
import { encodeGanttData, decodeGanttData, createDefaultGanttData, validateGanttData, sanitizeGanttData } from '../utils/encoding';
import { RENDERER_TYPE } from '../utils/constants';

export class GanttDataManager implements IGanttRepository {
  /**
   * Сохраняет данные Gantt в блок Logseq
   */
  async save(uuid: string, data: GanttData): Promise<void> {
    const encoded = encodeGanttData(data);
    const content = `{{renderer ${RENDERER_TYPE}, ${encoded}}}`;

    const block = await logseq.Editor.getBlock(uuid);
    if (!block) {
      throw new Error('Block not found');
    }

    await logseq.Editor.updateBlock(uuid, content);
  }

  /**
   * Загружает данные Gantt из блока Logseq
   */
  async load(uuid: string): Promise<GanttData> {
    const block = await logseq.Editor.getBlock(uuid);
    if (!block) {
      throw new Error('Block not found');
    }

    const content: string = block.content ?? '';
    const macroRegex = /\{\{renderer\s+([^,\s]+)\s*,\s*([^}]+)\}\}/i;
    const match = content.match(macroRegex);

    if (!match) {
      return createDefaultGanttData();
    }

    const [, type, encoded] = match;
    if (type !== RENDERER_TYPE) {
      return createDefaultGanttData();
    }

    try {
      const decoded = decodeGanttData(encoded.trim());
      if (!validateGanttData(decoded)) {
        return createDefaultGanttData();
      }
      return sanitizeGanttData(decoded);
    } catch {
      return createDefaultGanttData();
    }
  }

  /**
   * Удаляет данные Gantt из блока
   */
  async delete(uuid: string): Promise<void> {
    const block = await logseq.Editor.getBlock(uuid);
    if (!block) {
      throw new Error('Block not found');
    }

    await logseq.Editor.updateBlock(uuid, '');
  }
}
