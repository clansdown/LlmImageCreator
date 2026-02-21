/**
 * Centralized state management for the application
 * Contains all global state variables used across modules
 */

/**
 * @typedef {Object} Conversation
 * @property {number} timestamp - Epoch timestamp of conversation creation
 * @property {Array<Object>} entries - Array of conversation turns
 */

/**
 * @typedef {Object} ConversationSummary
 * @property {string} title - Conversation title
 * @property {number} imageCount - Total images across all conversation entries
 * @property {number} entryCount - Number of conversation turns
 * @property {number} created - Conversation creation timestamp (epoch seconds)
 * @property {number} updated - Last update timestamp (epoch seconds)
 */

/**
 * Global application state
 * @type {Object}
 */
export const STATE = {
    selectedModel: null,
    currentConversation: null,
    conversationHistory: [],
    isGenerating: false,
    deferredPrompt: null
};
