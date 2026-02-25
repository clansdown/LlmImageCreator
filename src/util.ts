/**
 * Utility functions
 * Shared functions used by ui.ts and agent.ts
 */

import { generateTitle } from './openrouter';
import { TITLE_GENERATION_PROMPT } from './prompt';
import { loadConversation, saveConversation, saveSummary, loadSummary } from './storage';

/**
 * Gets the API key from the input field
 * @returns {string} API key value
 */
export function getApiKey(): string {
    const input = document.getElementById("api-key-input");
    if (!input) return "";
    return (input as HTMLInputElement).value.trim();
}

/**
 * Generates a random 32-bit signed integer for reproducible generation
 * @returns {number} Random integer in range -2147483648 to 2147483647
 */
export function generateRandomSeed(): number {
    return Math.floor(Math.random() * 0x7FFFFFFF);
}

/**
 * Generates a conversation title using the gemma model
 * @param {string} prompt - User's prompt to summarize
 * @returns {Promise<string>} Generated title
 */
export async function generateConversationTitle(prompt: string): Promise<string> {
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
 * Updates the conversation summary with current stats and optional new title
 * @param {number} timestamp - Conversation timestamp
 * @param {string} [title] - Optional new title
 * @returns {Promise<import('./types/state').ConversationSummary | null>} Updated summary data
 */
export async function updateConversationSummary(timestamp: number, title?: string): Promise<import('./types/state').ConversationSummary | null> {
    const conversation = await loadConversation(timestamp);
    if (!conversation) return null;
    
    const summary: import('./types/state').ConversationSummary = await loadSummary(timestamp) || {
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
    
    const summaryData: import('./types/state').ConversationSummary = {
        title: title || summary.title,
        imageCount: imageCount,
        entryCount: conversation.entries.length,
        created: summary.created || timestamp,
        updated: Math.floor(Date.now() / 1000)
    };
    
    await saveSummary(timestamp, summaryData);
    return summaryData;
}
