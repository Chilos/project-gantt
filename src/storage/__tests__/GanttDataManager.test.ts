/**
 * Tests for GanttDataManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GanttDataManager } from '../GanttDataManager';
import { encodeGanttData, createDefaultGanttData } from '../../utils/encoding';
import type { GanttData } from '../../types';

// Mock logseq global
global.logseq = {
  Editor: {
    getBlock: vi.fn(),
    updateBlock: vi.fn(),
  },
} as any;

describe('GanttDataManager', () => {
  let manager: GanttDataManager;
  let mockGanttData: GanttData;

  beforeEach(() => {
    manager = new GanttDataManager();
    mockGanttData = createDefaultGanttData();
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('should save gantt data to block', async () => {
      const uuid = 'test-uuid';
      const mockBlock = { content: '', uuid };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);
      vi.mocked(logseq.Editor.updateBlock).mockResolvedValue(undefined as any);

      await manager.save(uuid, mockGanttData);

      expect(logseq.Editor.getBlock).toHaveBeenCalledWith(uuid);
      expect(logseq.Editor.updateBlock).toHaveBeenCalledWith(
        uuid,
        expect.stringContaining('{{renderer project-gantt,')
      );
    });

    it('should throw error if block not found', async () => {
      const uuid = 'nonexistent-uuid';
      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(null);

      await expect(manager.save(uuid, mockGanttData)).rejects.toThrow('Block not found');
    });

    it('should encode data correctly', async () => {
      const uuid = 'test-uuid';
      const mockBlock = { content: '', uuid };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);
      vi.mocked(logseq.Editor.updateBlock).mockResolvedValue(undefined as any);

      await manager.save(uuid, mockGanttData);

      const encoded = encodeGanttData(mockGanttData);
      expect(logseq.Editor.updateBlock).toHaveBeenCalledWith(
        uuid,
        `{{renderer project-gantt, ${encoded}}}`
      );
    });
  });

  describe('load', () => {
    it('should load gantt data from block', async () => {
      const uuid = 'test-uuid';
      const encoded = encodeGanttData(mockGanttData);
      const mockBlock = {
        content: `{{renderer project-gantt, ${encoded}}}`,
        uuid,
      };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);

      const result = await manager.load(uuid);

      expect(logseq.Editor.getBlock).toHaveBeenCalledWith(uuid);
      expect(result).toBeDefined();
      expect(result.projects).toEqual(mockGanttData.projects);
    });

    it('should return default data if block not found', async () => {
      const uuid = 'nonexistent-uuid';
      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(null);

      await expect(manager.load(uuid)).rejects.toThrow('Block not found');
    });

    it('should return default data for invalid content', async () => {
      const uuid = 'test-uuid';
      const mockBlock = {
        content: 'invalid content',
        uuid,
      };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);

      const result = await manager.load(uuid);

      expect(result).toEqual(createDefaultGanttData());
    });

    it('should return default data for wrong renderer type', async () => {
      const uuid = 'test-uuid';
      const mockBlock = {
        content: '{{renderer wrong-type, data}}',
        uuid,
      };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);

      const result = await manager.load(uuid);

      expect(result).toEqual(createDefaultGanttData());
    });

    it('should return default data for corrupted encoded data', async () => {
      const uuid = 'test-uuid';
      const mockBlock = {
        content: '{{renderer project-gantt, corrupted-base64-!!!}}',
        uuid,
      };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);

      const result = await manager.load(uuid);

      expect(result).toEqual(createDefaultGanttData());
    });

    it('should handle empty content', async () => {
      const uuid = 'test-uuid';
      const mockBlock = {
        content: '',
        uuid,
      };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);

      const result = await manager.load(uuid);

      expect(result).toEqual(createDefaultGanttData());
    });
  });

  describe('delete', () => {
    it('should delete gantt data from block', async () => {
      const uuid = 'test-uuid';
      const mockBlock = { content: 'some content', uuid };

      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(mockBlock as any);
      vi.mocked(logseq.Editor.updateBlock).mockResolvedValue(undefined as any);

      await manager.delete(uuid);

      expect(logseq.Editor.getBlock).toHaveBeenCalledWith(uuid);
      expect(logseq.Editor.updateBlock).toHaveBeenCalledWith(uuid, '');
    });

    it('should throw error if block not found', async () => {
      const uuid = 'nonexistent-uuid';
      vi.mocked(logseq.Editor.getBlock).mockResolvedValue(null);

      await expect(manager.delete(uuid)).rejects.toThrow('Block not found');
    });
  });
});
