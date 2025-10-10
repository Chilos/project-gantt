/**
 * Color System
 * Adaptive color generation based on Logseq theme
 */

import type { HSL, RGB, ThemeMode } from '../types';

export class ColorSystem {
  private themeMode: ThemeMode = 'light';
  private accentColor: string = '#045591';

  constructor() {
    this.refresh();
  }

  /**
   * Обновляет цветовую систему из CSS переменных Logseq
   */
  refresh(): void {
    this.themeMode = this.detectThemeMode();
    this.accentColor = this.getAccentColor();
  }

  /**
   * Определяет текущую тему (светлая/темная)
   */
  private detectThemeMode(): ThemeMode {
    if (typeof window === 'undefined') return 'light';

    const root = document.documentElement;
    const bgColor = getComputedStyle(root).getPropertyValue('--ls-primary-background-color');

    if (!bgColor) return 'light';

    const rgb = this.parseColor(bgColor);
    if (!rgb) return 'light';

    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness < 128 ? 'dark' : 'light';
  }

  /**
   * Получает акцентный цвет из CSS переменных
   */
  getAccentColor(): string {
    if (typeof window === 'undefined') return '#045591';

    const root = document.documentElement;
    const color = getComputedStyle(root).getPropertyValue('--ls-link-text-color');
    return color?.trim() || '#045591';
  }

  /**
   * Получает текущий режим темы
   */
  getThemeMode(): ThemeMode {
    return this.themeMode;
  }

  /**
   * Парсит цвет из строки в RGB
   */
  private parseColor(color: string): RGB | null {
    if (!color) return null;

    // Убираем пробелы
    color = color.trim();

    // Проверяем HEX формат
    if (color.startsWith('#')) {
      return this.hexToRgb(color);
    }

    // Проверяем RGB формат
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
        };
      }
    }

    return null;
  }

  /**
   * Конвертирует HEX в RGB
   */
  private hexToRgb(hex: string): RGB | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }

  /**
   * Конвертирует RGB в HEX
   */
  private rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  /**
   * Конвертирует RGB в HSL
   */
  private rgbToHsl(rgb: RGB): HSL {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Конвертирует HSL в RGB
   */
  private hslToRgb(hsl: HSL): RGB {
    const h = hsl.h / 360;
    const s = hsl.s / 100;
    const l = hsl.l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  /**
   * Вычисляет яркость цвета
   */
  getColorBrightness(hex: string): number {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 128;

    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  }

  /**
   * Получает контрастный цвет текста (черный или белый)
   */
  getContrastTextColor(backgroundColor: string): string {
    const brightness = this.getColorBrightness(backgroundColor);
    return brightness > 128 ? '#2c2c2c' : '#ffffff';
  }

  /**
   * Генерирует палитру цветов для этапов
   */
  generateStageColors(count: number = 10): string[] {
    const colors: string[] = [];
    const baseHue = this.getAccentHue();

    for (let i = 0; i < count; i++) {
      const hue = (baseHue + (i * 360 / count)) % 360;
      const saturation = this.themeMode === 'dark' ? 60 : 70;
      const lightness = this.themeMode === 'dark' ? 50 : 60;

      const rgb = this.hslToRgb({ h: hue, s: saturation, l: lightness });
      colors.push(this.rgbToHex(rgb));
    }

    return colors;
  }

  /**
   * Получает оттенок акцентного цвета
   */
  private getAccentHue(): number {
    const rgb = this.parseColor(this.accentColor);
    if (!rgb) return 210; // default blue hue

    const hsl = this.rgbToHsl(rgb);
    return hsl.h;
  }

  /**
   * Проверяет валидность HEX цвета
   */
  isValidHexColor(color: string): boolean {
    if (!color || color.trim() === '#' || color.trim() === '') return false;
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color.trim());
  }
}
