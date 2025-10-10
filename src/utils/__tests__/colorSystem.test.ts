/**
 * Tests for ColorSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ColorSystem } from '../colorSystem';

describe('ColorSystem', () => {
  let colorSystem: ColorSystem;

  beforeEach(() => {
    colorSystem = new ColorSystem();
  });

  describe('getColorBrightness', () => {
    it('should calculate brightness for light colors', () => {
      const white = colorSystem.getColorBrightness('#ffffff');
      expect(white).toBe(255);

      const lightGray = colorSystem.getColorBrightness('#cccccc');
      expect(lightGray).toBeGreaterThan(128);
    });

    it('should calculate brightness for dark colors', () => {
      const black = colorSystem.getColorBrightness('#000000');
      expect(black).toBe(0);

      const darkGray = colorSystem.getColorBrightness('#333333');
      expect(darkGray).toBeLessThan(128);
    });

    it('should handle invalid colors', () => {
      const result = colorSystem.getColorBrightness('invalid');
      expect(result).toBe(128); // default value
    });
  });

  describe('getContrastTextColor', () => {
    it('should return dark text for light backgrounds', () => {
      const white = colorSystem.getContrastTextColor('#ffffff');
      expect(white).toBe('#2c2c2c');

      const lightBlue = colorSystem.getContrastTextColor('#87CEEB');
      expect(lightBlue).toBe('#2c2c2c');
    });

    it('should return light text for dark backgrounds', () => {
      const black = colorSystem.getContrastTextColor('#000000');
      expect(black).toBe('#ffffff');

      const darkBlue = colorSystem.getContrastTextColor('#191970');
      expect(darkBlue).toBe('#ffffff');
    });
  });

  describe('isValidHexColor', () => {
    it('should validate correct hex colors', () => {
      expect(colorSystem.isValidHexColor('#ffffff')).toBe(true);
      expect(colorSystem.isValidHexColor('#000000')).toBe(true);
      expect(colorSystem.isValidHexColor('#123ABC')).toBe(true);
      expect(colorSystem.isValidHexColor('#abc')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(colorSystem.isValidHexColor('')).toBe(false);
      expect(colorSystem.isValidHexColor('#')).toBe(false);
      expect(colorSystem.isValidHexColor('ffffff')).toBe(false);
      expect(colorSystem.isValidHexColor('#gggggg')).toBe(false);
      expect(colorSystem.isValidHexColor('#12')).toBe(false);
      expect(colorSystem.isValidHexColor('invalid')).toBe(false);
    });
  });

  describe('generateStageColors', () => {
    it('should generate specified number of colors', () => {
      const colors5 = colorSystem.generateStageColors(5);
      expect(colors5).toHaveLength(5);

      const colors10 = colorSystem.generateStageColors(10);
      expect(colors10).toHaveLength(10);
    });

    it('should generate valid hex colors', () => {
      const colors = colorSystem.generateStageColors(5);

      colors.forEach(color => {
        expect(colorSystem.isValidHexColor(color)).toBe(true);
      });
    });

    it('should generate different colors', () => {
      const colors = colorSystem.generateStageColors(5);
      const uniqueColors = new Set(colors);

      // All colors should be different
      expect(uniqueColors.size).toBe(colors.length);
    });

    it('should use default count of 10', () => {
      const colors = colorSystem.generateStageColors();
      expect(colors).toHaveLength(10);
    });
  });

  describe('getAccentColor', () => {
    it('should return default color when window is undefined', () => {
      const color = colorSystem.getAccentColor();
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });
  });

  describe('getThemeMode', () => {
    it('should return a valid theme mode', () => {
      const mode = colorSystem.getThemeMode();
      expect(['light', 'dark']).toContain(mode);
    });
  });

  describe('refresh', () => {
    it('should not throw errors', () => {
      expect(() => colorSystem.refresh()).not.toThrow();
    });
  });
});
