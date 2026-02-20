/**
 * Utility functions
 * Shared functions used by both ui.js and agent.js
 */

/**
 * Gets the API key from the input field
 * @returns {string} API key value
 */
function getApiKey() {
    var input = document.getElementById("api-key-input");
    if (!input) return "";
    return input.value.trim();
}

/**
 * Generates a random 32-bit signed integer for reproducible generation
 * @returns {number} Random integer in range -2147483648 to 2147483647
 */
function generateRandomSeed() {
    return Math.floor(Math.random() * 0x7FFFFFFF);
}

/**
 * Generates a conversation title using the gemma model
 * @param {string} prompt - User's prompt to summarize
 * @returns {Promise<string>} Generated title
 */
async function generateConversationTitle(prompt) {
    var apiKey = getApiKey();
    if (!apiKey) return "";
    
    try {
        return await generateTitle(apiKey, prompt, TITLE_GENERATION_PROMPT, "google/gemma-3n-e4b-it");
    } catch (e) {
        console.error("Error generating title:", e);
        return "";
    }
}
