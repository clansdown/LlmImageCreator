/**
 * Tag management helper functions
 * Reusable functions for image tagging across the application
 */

import type { Conversation, ConversationEntry, TaggedImage } from './types/state';

/**
 * Normalizes a tag string (lowercase, trimmed)
 * @param {string} tag - Raw tag string
 * @returns {string} Normalized tag
 */
export function normalizeTag(tag: string): string {
    return tag.toLowerCase().trim();
}

/**
 * Validates tag is not empty after normalization
 * @param {string} tag - Raw tag string
 * @returns {boolean} True if tag is valid
 */
export function isValidTag(tag: string): boolean {
    const normalized = normalizeTag(tag);
    return normalized.length > 0;
}

/**
 * Ensures imageMetadata array exists and is correct size for the entry
 * @param {ConversationEntry} entry - Conversation entry to ensure metadata for
 */
export function ensureMetadataArray(entry: ConversationEntry): void {
    const imageCount = entry.response.imageFilenames.length;
    if (!entry.response.imageMetadata) {
        entry.response.imageMetadata = [];
    }
    while (entry.response.imageMetadata.length < imageCount) {
        entry.response.imageMetadata.push({ tags: [] });
    }
}

/**
 * Gets tags for a specific image in an entry
 * @param {ConversationEntry} entry - Conversation entry
 * @param {number} imageIndex - Index of the image
 * @returns {string[]} Array of tags for the image
 */
export function getTagsForImage(entry: ConversationEntry, imageIndex: number): string[] {
    if (!entry.response.imageMetadata) {
        return [];
    }
    const metadata = entry.response.imageMetadata[imageIndex];
    return metadata?.tags ?? [];
}

/**
 * Adds a tag to an image (normalized, deduplicated)
 * @param {ConversationEntry} entry - Conversation entry
 * @param {number} imageIndex - Index of the image
 * @param {string} tag - Tag to add
 * @returns {boolean} True if tag was added, false if already exists or invalid
 */
export function addTag(entry: ConversationEntry, imageIndex: number, tag: string): boolean {
    const normalized = normalizeTag(tag);
    if (!isValidTag(normalized)) {
        return false;
    }

    ensureMetadataArray(entry);
    const metadata = entry.response.imageMetadata?.[imageIndex];
    if (!metadata) {
        return false;
    }

    if (metadata.tags.includes(normalized)) {
        return false;
    }

    metadata.tags.push(normalized);
    return true;
}

/**
 * Removes a tag from an image
 * @param {ConversationEntry} entry - Conversation entry
 * @param {number} imageIndex - Index of the image
 * @param {string} tag - Tag to remove
 * @returns {boolean} True if tag was removed, false if not found
 */
export function removeTag(entry: ConversationEntry, imageIndex: number, tag: string): boolean {
    if (!entry.response.imageMetadata) {
        return false;
    }

    const metadata = entry.response.imageMetadata[imageIndex];
    if (!metadata) {
        return false;
    }

    const normalized = normalizeTag(tag);
    const index = metadata.tags.indexOf(normalized);
    if (index === -1) {
        return false;
    }

    metadata.tags.splice(index, 1);
    return true;
}

/**
 * Sets all tags for an image (replaces existing tags)
 * @param {ConversationEntry} entry - Conversation entry
 * @param {number} imageIndex - Index of the image
 * @param {string[]} tags - Array of tags to set
 */
export function setTags(entry: ConversationEntry, imageIndex: number, tags: string[]): void {
    ensureMetadataArray(entry);
    const normalizedTags = tags
        .map(normalizeTag)
        .filter(isValidTag)
        .filter((tag, index, arr) => arr.indexOf(tag) === index);

    if (entry.response.imageMetadata?.[imageIndex]) {
        entry.response.imageMetadata[imageIndex].tags = normalizedTags;
    }
}

/**
 * Gets all unique tags across all conversations
 * @param {Conversation[]} conversations - Array of conversations
 * @returns {string[]} Sorted array of unique tags
 */
export function getAllTags(conversations: Conversation[]): string[] {
    /** @type {Set<string>} */
    const tagSet = new Set();

    for (const conversation of conversations) {
        for (const entry of conversation.entries) {
            if (entry.response.imageMetadata) {
                for (const metadata of entry.response.imageMetadata) {
                    for (const tag of metadata.tags) {
                        tagSet.add(tag);
                    }
                }
            }
        }
    }

    return Array.from(tagSet).sort() as string[];
}

/**
 * Gets all unique tags with their usage count
 * @param {Conversation[]} conversations - Array of conversations
 * @returns {Map<string, number>} Map of tag to usage count
 */
export function getAllTagsWithCount(conversations: Conversation[]): Map<string, number> {
    /** @type {Map<string, number>} */
    const tagCounts = new Map();

    for (const conversation of conversations) {
        for (const entry of conversation.entries) {
            if (entry.response.imageMetadata) {
                for (const metadata of entry.response.imageMetadata) {
                    for (const tag of metadata.tags) {
                        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
                    }
                }
            }
        }
    }

    return tagCounts;
}

/**
 * Searches for images with a specific tag across all conversations
 * @param {Conversation[]} conversations - Array of conversations
 * @param {string} tag - Tag to search for (will be normalized)
 * @returns {TaggedImage[]} Array of tagged images with context
 */
export async function searchImagesByTag(conversations: Conversation[], tag: string): Promise<TaggedImage[]> {
    const normalized = normalizeTag(tag);
    if (!isValidTag(normalized)) {
        return [];
    }

    /** @type {TaggedImage[]} */
    const results = [];
    const { loadSummary } = await import('./storage');

    for (const conversation of conversations) {
        let conversationTitle = `Conversation ${conversation.timestamp}`;
        try {
            const summary = await loadSummary(conversation.timestamp);
            if (summary) {
                conversationTitle = summary.title;
            }
        } catch {
        }

        for (const entry of conversation.entries) {
            if (entry.response.imageMetadata) {
                for (let i = 0; i < entry.response.imageMetadata.length; i++) {
                    const metadata = entry.response.imageMetadata[i];
                    if (metadata.tags.includes(normalized)) {
                        results.push({
                            conversationTimestamp: conversation.timestamp,
                            imageIndex: i,
                            tags: metadata.tags,
                            conversationTitle: conversationTitle
                        });
                    }
                }
            }
        }
    }

    return results;
}

/**
 * Searches for images matching multiple tags (OR logic - any tag match)
 * @param {Conversation[]} conversations - Array of conversations
 * @param {string[]} tags - Tags to search for
 * @returns {TaggedImage[]} Array of tagged images with context
 */
export async function searchImagesByTags(conversations: Conversation[], tags: string[]): Promise<TaggedImage[]> {
    const normalizedTags = tags.map(normalizeTag).filter(isValidTag);
    if (normalizedTags.length === 0) {
        return [];
    }

    /** @type {TaggedImage[]} */
    const results = [];
    const { loadSummary } = await import('./storage');

    for (const conversation of conversations) {
        let conversationTitle = `Conversation ${conversation.timestamp}`;
        try {
            const summary = await loadSummary(conversation.timestamp);
            if (summary) {
                conversationTitle = summary.title;
            }
        } catch {
        }

        for (const entry of conversation.entries) {
            if (entry.response.imageMetadata) {
                for (let i = 0; i < entry.response.imageMetadata.length; i++) {
                    const metadata = entry.response.imageMetadata[i];
                    const hasMatch = normalizedTags.some(tag => metadata.tags.includes(tag));
                    if (hasMatch) {
                        results.push({
                            conversationTimestamp: conversation.timestamp,
                            imageIndex: i,
                            tags: metadata.tags,
                            conversationTitle: conversationTitle
                        });
                    }
                }
            }
        }
    }

    return results;
}
