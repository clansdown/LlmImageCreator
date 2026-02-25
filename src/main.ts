/**
 * Main entry point for the application
 * Imports agent.js and initializes the application
 */

import { init } from './agent.js';

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
