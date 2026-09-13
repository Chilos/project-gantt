import { describe, it, expect } from 'vitest';
import { parseMarkdownLinks, renderTextWithLinks, extractPlainText } from '../textUtils';

describe('textUtils', () => {
  describe('parseMarkdownLinks', () => {
    it('should return raw text when no links present', () => {
      const parts = parseMarkdownLinks('Plain text without links');
      expect(parts).toEqual([{ type: 'text', content: 'Plain text without links' }]);
    });

    it('should parse single markdown link', () => {
      const parts = parseMarkdownLinks('Check [Google](https://google.com)');
      expect(parts).toEqual([
        { type: 'text', content: 'Check ' },
        { type: 'link', content: 'Google', url: 'https://google.com' }
      ]);
    });

    it('should parse multiple markdown links with surrounding text', () => {
      const parts = parseMarkdownLinks('[A](url1) middle [B](url2) end');
      expect(parts).toEqual([
        { type: 'link', content: 'A', url: 'url1' },
        { type: 'text', content: ' middle ' },
        { type: 'link', content: 'B', url: 'url2' },
        { type: 'text', content: ' end' }
      ]);
    });
  });

  describe('renderTextWithLinks', () => {
    it('should render HTML anchor for links and escape quotes in url', () => {
      const result = renderTextWithLinks('Visit [Example](https://example.com?q="test")');
      expect(result).toBe('Visit <a href="https://example.com?q=&quot;test&quot;" class="gantt-logseq-link" target="_blank" rel="noopener noreferrer">Example</a>');
    });

    it('should leave plain text untouched', () => {
      expect(renderTextWithLinks('Just text')).toBe('Just text');
    });
  });

  describe('extractPlainText', () => {
    it('should strip Logseq page links [[Page]]', () => {
      expect(extractPlainText('See [[My Page]] here')).toBe('See My Page here');
    });

    it('should use alias in Logseq page links [[Page|Alias]]', () => {
      expect(extractPlainText('See [[My Page|Custom Alias]] here')).toBe('See Custom Alias here');
    });

    it('should strip markdown links [text](url)', () => {
      expect(extractPlainText('Link to [My Site](https://example.com) now')).toBe('Link to My Site now');
    });
  });
});
