/**
 * Utility functions
 * Shared functions used by ui.ts and agent.ts
 */

import { STATE } from './state';
import { generateTitle } from './openrouter';
import { TITLE_GENERATION_PROMPT } from './prompt';
import { loadConversation, saveConversation, saveSummary, loadSummary } from './storage';

/**
 * Gets the API key from state
 * @returns {string} API key value
 */
export function getApiKey(): string {
    return STATE.apiKey;
}

/**
 * Generates a random 32-bit signed integer for reproducible generation
 * @returns {number} Random integer in range -2147483648 to 2147483647
 */
export function generateRandomSeed(): number {
    return Math.floor(Math.random() * 0x7FFFFFFF);
}

/**
 * Clones template, inserts into container, and returns first element
 * @param {string} templateId - ID of template element
 * @param {HTMLElement} container - Parent element to append to
 * @returns {HTMLElement | null} First child element of cloned template, or null if template not found or empty
 */
export function cloneTemplate(templateId: string, container: HTMLElement): HTMLElement | null {
    const template = document.getElementById(templateId) as HTMLTemplateElement | null;
    if (!template) {
        console.error('cloneTemplate: Template not found with id:', templateId);
        return null;
    }
    
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const element = clone.firstElementChild as HTMLElement | null;
    
    if (!element) {
        console.error('cloneTemplate: Template has no first child with id:', templateId);
        return null;
    }
    
    container.appendChild(element);
    return element;
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
 * Generates a unique project ID
 * @returns {string} Unique project ID
 */
export function generateProjectId(): string {
    return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

/**
 * Default project settings with all values null (inherit from parent)
 * @returns {import('./types/state').ProjectSettings}
 */
export function createDefaultProjectSettings(): import('./types/state').ProjectSettings {
    return {
        model: null,
        instructions: null,
        systemPrompt: null,
        defaultResolution: null,
        defaultAspectRatio: null,
        defaultRatingFilter: null
    };
}

/**
 * Resolves inherited project settings by walking the parent chain.
 * For instructions: accumulates ALL ancestor instructions (concatenated, root first).
 * For all other settings: first non-null value wins (nearest override).
 * @param {import('./types/state').Project} project - Project to resolve settings for
 * @param {import('./types/state').Project[]} allProjects - All projects for parent lookup
 * @param {import('./types/state').ProjectSettings} globalDefaults - Fallback defaults when chain yields null
 * @returns {import('./types/state').ProjectSettings} Resolved settings (all non-null values)
 */
export function resolveInheritedSettings(
    project: import('./types/state').Project,
    allProjects: import('./types/state').Project[],
    globalDefaults: import('./types/state').ProjectSettings
): import('./types/state').ProjectSettings {
    /** @type {import('./types/state').ProjectSettings} */
    const resolved: import('./types/state').ProjectSettings = {
        model: null,
        instructions: null,
        systemPrompt: null,
        defaultResolution: null,
        defaultAspectRatio: null,
        defaultRatingFilter: null
    };

    /** @type {string[]} */
    const instructionBlocks: string[] = [];

    /** @type {import('./types/state').Project | null} */
    let current: import('./types/state').Project | null = project;
    const visited = new Set<string>();

    while (current) {
        if (visited.has(current.id)) break;
        visited.add(current.id);

        const s = current.settings;
        if (resolved.model === null && s.model !== null) resolved.model = s.model;
        if (s.instructions !== null) instructionBlocks.push(s.instructions);
        if (resolved.systemPrompt === null && s.systemPrompt !== null) resolved.systemPrompt = s.systemPrompt;
        if (resolved.defaultResolution === null && s.defaultResolution !== null) resolved.defaultResolution = s.defaultResolution;
        if (resolved.defaultAspectRatio === null && s.defaultAspectRatio !== null) resolved.defaultAspectRatio = s.defaultAspectRatio;
        if (resolved.defaultRatingFilter === null && s.defaultRatingFilter !== null) resolved.defaultRatingFilter = s.defaultRatingFilter;

        if (current.parentId) {
            current = allProjects.find(p => p.id === current!.parentId) ?? null;
        } else {
            break;
        }
    }

    // Instructions accumulate: root first, then child, then grandchild...
    if (instructionBlocks.length > 0) {
        resolved.instructions = instructionBlocks.reverse().join('\n\n');
    }

    // Fill remaining nulls with global defaults
    if (resolved.model === null) resolved.model = globalDefaults.model;
    if (resolved.instructions === null) resolved.instructions = globalDefaults.instructions;
    if (resolved.systemPrompt === null) resolved.systemPrompt = globalDefaults.systemPrompt;
    if (resolved.defaultResolution === null) resolved.defaultResolution = globalDefaults.defaultResolution;
    if (resolved.defaultAspectRatio === null) resolved.defaultAspectRatio = globalDefaults.defaultAspectRatio;
    if (resolved.defaultRatingFilter === null) resolved.defaultRatingFilter = globalDefaults.defaultRatingFilter;

    return resolved;
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
