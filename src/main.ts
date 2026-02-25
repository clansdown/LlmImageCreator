/**
 * Main entry point for the application
 * Imports agent.ts and initializes the application
 */

import { init } from './agent';

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
