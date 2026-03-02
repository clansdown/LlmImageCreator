/**
 * Centralized state management for the application
 * Contains all global state variables used across modules
 */

import type { AppState } from './types/state';

/**
 * Global application state
 */
export const STATE: AppState = {
    selectedModel: null,
    visionModels: [],
    currentConversation: null,
    conversationHistory: [],
    isGenerating: false,
    deferredPrompt: null
};
