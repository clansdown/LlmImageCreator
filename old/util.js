/**
 * Utility functions
 * Shared functions used by ui.js and agent.js
 */

import { generateTitle } from './openrouter.js';
import { TITLE_GENERATION_PROMPT } from './prompt.js';
import { loadConversation, saveConversation, saveSummary, loadSummary } from './storage.js';

/**
 * Gets the API key from the input field
 * @returns {string} API key value
 */
export function getApiKey() {
    const input = document.getElementById("api-key-input");
    if (!input) return "";
    return input.value.trim();
}

/**
 * Generates a random 32-bit signed integer for reproducible generation
 * @returns {number} Random integer in range -2147483648 to 2147483647
 */
export function generateRandomSeed() {
    return Math.floor(Math.random() * 0x7FFFFFFF);
}

/**
 * Generates a conversation title using the gemma model
 * @param {string} prompt - User's prompt to summarize
 * @returns {Promise<string>} Generated title
 */
export async function generateConversationTitle(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) return "";
    
    try {
        return await generateTitle(apiKey, prompt, TITLE_GENERATION_PROMPT, "google/gemma-3n-e4b-it");
    } catch (e) {
        console.error("Error generating title:", e);
        return "";
    }
}

/**
 * @typedef {Object} ConversationSummary
 * @property {string} title - Conversation title
 * @property {number} imageCount - Total images across all conversation entries
 * @property {number} entryCount - Number of conversation turns
 * @property {number} created - Conversation creation timestamp (epoch seconds)
 * @property {number} updated - Last update timestamp (epoch seconds)
 */

/**
 * Updates the conversation summary with current stats and optional new title
 * @param {number} timestamp - Conversation timestamp
 * @param {string} [title] - Optional new title
 * @returns {Promise<ConversationSummary>} Updated summary data
 */
export async function updateConversationSummary(timestamp, title) {
    const conversation = await loadConversation(timestamp);
    if (!conversation) return null;
    
    /** @type {ConversationSummary} */
    const summary = await loadSummary(timestamp) || {
        title: "New Conversation",
        imageCount: 0,
        entryCount: 0,
        created: timestamp,
        updated: timestamp
    };
    let imageCount = 0;
    conversation.entries.forEach(function(entry) {
        if (entry.response.imageFilenames) {
            imageCount += entry.response.imageFilenames.length;
        }
    });
    
    /** @type {ConversationSummary} */
    const summaryData = {
        title: title || summary.title,
        imageCount: imageCount,
        entryCount: conversation.entries.length,
        created: summary.created || timestamp,
        updated: Math.floor(Date.now() / 1000)
    };
    
    await saveSummary(timestamp, summaryData);
    return summaryData;
}
