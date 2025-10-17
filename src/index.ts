/**
 * Project Gantt Plugin Entry Point
 * Entry point that initializes the plugin
 */

/// <reference types="@logseq/libs" />

import { ProjectGanttPlugin } from './plugin';

// Create plugin instance
const plugin = new ProjectGanttPlugin();

/**
 * Main entry point
 */
async function main() {
  try {
    await plugin.initialize();
  } catch (error) {
    console.error('[Project Gantt] Failed to initialize plugin:', error);
    throw error;
  }
}

// Register cleanup handler
logseq.beforeunload(async () => {
  await plugin.cleanup();
});

// Start the plugin
logseq.ready(main).catch((err: Error) => {
  console.error('[Project Gantt] Plugin failed to load:', err);
});
