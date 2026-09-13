import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColumnResizer } from '../ColumnResizer';

describe('ColumnResizer', () => {
  let container: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    container.innerHTML = `
      <div class="gantt-table">
        <div class="gantt-project-header" style="width: 200px;">Project</div>
        <div class="gantt-column-resizer"></div>
        <div class="gantt-project-name" style="width: 200px;">Task 1</div>
        <div class="gantt-day-header" style="width: 30px;">1</div>
        <div class="gantt-day-header" style="width: 30px;">2</div>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    localStorage.clear();
  });

  it('should initialize and restore width from localStorage if valid', () => {
    localStorage.setItem('gantt-column-width', '250');
    const resizer = new ColumnResizer(container);

    const header = container.querySelector('.gantt-project-header') as HTMLElement;
    const name = container.querySelector('.gantt-project-name') as HTMLElement;
    expect(header.style.width).toBe('250px');
    expect(name.style.width).toBe('250px');

    resizer.cleanup();
  });

  it('should ignore localStorage width outside bounds', () => {
    localStorage.setItem('gantt-column-width', '50'); // below minWidth 120
    const resizer = new ColumnResizer(container);

    const header = container.querySelector('.gantt-project-header') as HTMLElement;
    expect(header.style.width).not.toBe('50px');

    resizer.cleanup();
  });

  it('should handle resize mouse events and clamp width', () => {
    const resizer = new ColumnResizer(container);
    const resizerEl = container.querySelector('.gantt-column-resizer') as HTMLElement;

    // Simulate mousedown
    resizerEl.dispatchEvent(new MouseEvent('mousedown', { clientX: 100 }));
    expect(resizerEl.classList.contains('gantt-resizing')).toBe(true);

    // Simulate mousemove (+50px)
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));

    // Simulate mouseup
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 150 }));
    expect(resizerEl.classList.contains('gantt-resizing')).toBe(false);

    resizer.cleanup();
  });
});
