/**
 * OPFS Storage Module
 * 
 * Directory Structure:
 * 
 * OPFS Root:
 * ├── preferences/
 * │   ├── apiKey
 * │   ├── selectedModel
 * │   ├── defaultResolution
 * │   ├── defaultAspectRatio
 * │   └── ... (other preference files)
 * └── conversations/
 *     └── {timestamp}/         (epoch seconds, e.g., 1737991234)
 *         ├── conversation.json
 *         ├── summary.json
 *         └── images/
 *             ├── 1.png
 *             ├── 2.png
 *             ├── 3.png
 *             └── ... (sequential numbering for all images in conversation)
 */

import type { Conversation, ConversationSummary } from './types/state';

const STORAGE_PREFERENCES_DIR: string = "preferences";
const STORAGE_CONVERSATIONS_DIR: string = "conversations";
const STORAGE_IMAGES_DIR: string = "images";

/**
 * Gets the OPFS root directory handle
 * @returns {Promise<FileSystemDirectoryHandle>} Root directory handle
 */
export function getOPFSHandle(): Promise<FileSystemDirectoryHandle> {
    return window.navigator.storage.getDirectory();
}

/**
 * Ensures a subdirectory exists within a parent directory
 * @param {FileSystemDirectoryHandle} parentDir - Parent directory handle
 * @param {string} dirName - Directory name to ensure exists
 * @returns {Promise<FileSystemDirectoryHandle>} Directory handle
 */
export async function ensureDirectory(parentDir: FileSystemDirectoryHandle, dirName: string): Promise<FileSystemDirectoryHandle> {
    try {
        return await parentDir.getDirectoryHandle(dirName, { create: true });
    } catch (e) {
        return await parentDir.getDirectoryHandle(dirName);
    }
}

/**
 * Saves a preference to OPFS
 * @param {string} key - Preference key (filename)
 * @param {string} value - Value to store
 * @returns {Promise<void>}
 */
export async function savePreference(key: string, value: string): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const prefsDir = await ensureDirectory(root, STORAGE_PREFERENCES_DIR);
        const fileHandle = await prefsDir.getFileHandle(key, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(value);
        await writable.close();
    } catch (e) {
        console.error("Error saving preference:", e);
    }
}

/**
 * Gets a preference from OPFS
 * @param {string} key - Preference key (filename)
 * @param {string} [defaultValue] - Default value if not found
 * @returns {Promise<string | null>} Preference value
 */
export async function getPreference(key: string, defaultValue?: string): Promise<string | null> {
    try {
        const root = await getOPFSHandle();
        const prefsDir = await ensureDirectory(root, STORAGE_PREFERENCES_DIR);
        const fileHandle = await prefsDir.getFileHandle(key);
        const file = await fileHandle.getFile();
        const content = await file.text();
        if (content && content.trim().length > 0) {
            return content.trim();
        }
        return defaultValue !== undefined ? defaultValue : null;
    } catch (e) {
        return defaultValue !== undefined ? defaultValue : null;
    }
}

/**
 * Lists all preference keys
 * @returns {Promise<string[]>} Array of preference keys
 */
export async function listPreferences(): Promise<string[]> {
    try {
        const root = await getOPFSHandle();
        const prefsDir = await ensureDirectory(root, STORAGE_PREFERENCES_DIR);
        const keys: string[] = [];
        for await (const entry of prefsDir.values()) {
            if (entry.kind === "file") {
                keys.push(entry.name);
            }
        }
        return keys;
    } catch (e) {
        return [];
    }
}

/**
 * Deletes a preference from OPFS
 * @param {string} key - Preference key (filename)
 * @returns {Promise<void>}
 */
export async function deletePreference(key: string): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const prefsDir = await ensureDirectory(root, STORAGE_PREFERENCES_DIR);
        await prefsDir.removeEntry(key);
    } catch (e) {
        console.error("Error deleting preference:", e);
    }
}

/**
 * Clears all preferences
 * @returns {Promise<void>}
 */
export async function clearAllPreferences(): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const prefsDir = await ensureDirectory(root, STORAGE_PREFERENCES_DIR);
        for await (const entry of prefsDir.values()) {
            await prefsDir.removeEntry(entry.name, { recursive: true });
        }
    } catch (e) {
        console.error("Error clearing preferences:", e);
    }
}

/**
 * Creates a new conversation directory
 * @returns {Promise<number>} Epoch timestamp for the conversation
 */
export async function createConversation(): Promise<number> {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await ensureDirectory(convsDir, String(timestamp));
        await ensureDirectory(convDir, STORAGE_IMAGES_DIR);
        return timestamp;
    } catch (e) {
        console.error("Error creating conversation:", e);
        return timestamp;
    }
}

/**
 * Lists all conversation timestamps
 * @returns {Promise<number[]>} Array of epoch timestamps
 */
export async function listConversations(): Promise<number[]> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const timestamps: number[] = [];
        for await (const entry of convsDir.values()) {
            if (entry.kind === "directory") {
                const num = parseInt(entry.name, 10);
                if (!isNaN(num)) {
                    timestamps.push(num);
                }
            }
        }
        timestamps.sort(function(a: number, b: number): number { return b - a; });
        return timestamps;
    } catch (e) {
        return [];
    }
}

/**
 * Loads a conversation by timestamp
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<Conversation | null>} Conversation data
 */
export async function loadConversation(timestamp: number): Promise<Conversation | null> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await convsDir.getDirectoryHandle(String(timestamp));
        const fileHandle = await convDir.getFileHandle("conversation.json");
        const file = await fileHandle.getFile();
        const content = await file.text();
        const conversation = JSON.parse(content) as Conversation;

        if (conversation.entries) {
            conversation.entries.forEach(function(entry) {
                if (entry.response?.imageFilenames && !entry.response.imageResolutions) {
                    entry.response.imageResolutions = entry.response.imageFilenames.map(function(): string { return "1K"; });
                }
            });
        }

        return conversation;
    } catch (e) {
        return null;
    }
}

/**
 * Saves a conversation
 * @param {number} timestamp - Conversation timestamp
 * @param {Conversation} conversationData - Conversation object
 * @returns {Promise<void>}
 */
export async function saveConversation(timestamp: number, conversationData: Conversation): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await ensureDirectory(convsDir, String(timestamp));
        const fileHandle = await convDir.getFileHandle("conversation.json", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(conversationData, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Error saving conversation:", e);
    }
}

/**
 * Deletes a conversation and all its contents
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<void>}
 */
export async function deleteConversation(timestamp: number): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        await convsDir.removeEntry(String(timestamp), { recursive: true });
    } catch (e) {
        console.error("Error deleting conversation:", e);
    }
}

/**
 * Saves an image to a conversation
 * @param {number} timestamp - Conversation timestamp
 * @param {string} imageData - Base64 data URL or raw base64 string
 * @returns {Promise<number | null>} Image index number, or null on error
 */
export async function saveImage(timestamp: number, imageData: string): Promise<number | null> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await convsDir.getDirectoryHandle(String(timestamp));
        const imagesDir = await ensureDirectory(convDir, STORAGE_IMAGES_DIR);

        const nextIndex = await getNextImageIndex(imagesDir);

        let base64Data = imageData;
        if (imageData.startsWith("data:")) {
            const parts = imageData.split(",");
            if (parts.length > 1) {
                base64Data = parts[1];
            }
        }

        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const fileHandle = await imagesDir.getFileHandle(String(nextIndex) + ".png", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(bytes);
        await writable.close();

        return nextIndex;
    } catch (e) {
        console.error("Error saving image:", e);
        return null;
    }
}

/**
 * Gets the next available image index for a conversation
 * @param {FileSystemDirectoryHandle} imagesDir - Images directory handle
 * @returns {Promise<number>} Next image number
 */
export async function getNextImageIndex(imagesDir: FileSystemDirectoryHandle): Promise<number> {
    let maxIndex = 0;
    for await (const entry of imagesDir.values()) {
        if (entry.kind === "file" && entry.name.endsWith(".png")) {
            const num = parseInt(entry.name.replace(".png", ""), 10);
            if (!isNaN(num) && num > maxIndex) {
                maxIndex = num;
            }
        }
    }
    return maxIndex + 1;
}

/**
 * Gets an image from a conversation
 * @param {number} timestamp - Conversation timestamp
 * @param {number} imageIndex - Image index number
 * @returns {Promise<Blob | null>} Image blob
 */
export async function getImage(timestamp: number, imageIndex: number): Promise<Blob | null> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await convsDir.getDirectoryHandle(String(timestamp));
        const imagesDir = await ensureDirectory(convDir, STORAGE_IMAGES_DIR);
        const fileHandle = await imagesDir.getFileHandle(String(imageIndex) + ".png");
        return await fileHandle.getFile();
    } catch (e) {
        return null;
    }
}

/**
 * Gets the data URL for an image
 * @param {number} timestamp - Conversation timestamp
 * @param {number} imageIndex - Image index number
 * @returns {Promise<string | null>} Base64 data URL
 */
export async function getImageDataURL(timestamp: number, imageIndex: number): Promise<string | null> {
    try {
        const blob = await getImage(timestamp, imageIndex);
        if (!blob) return null;
        return new Promise<string | null>(function(resolve) {
            const reader = new FileReader();
            reader.onloadend = function() {
                resolve(reader.result as string);
            };
            reader.onerror = function() {
                resolve(null);
            };
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return null;
    }
}

/**
 * Deletes all images for a conversation
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<void>}
 */
export async function deleteImagesForConversation(timestamp: number): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await convsDir.getDirectoryHandle(String(timestamp));
        const imagesDir = await ensureDirectory(convDir, STORAGE_IMAGES_DIR);
        for await (const entry of imagesDir.values()) {
            await imagesDir.removeEntry(entry.name);
        }
    } catch (e) {
        console.error("Error deleting images:", e);
    }
}

/**
 * Saves or updates summary.json for a conversation
 * @param {number} timestamp - Conversation timestamp
 * @param {ConversationSummary} summaryData - Summary data object
 * @returns {Promise<void>}
 */
export async function saveSummary(timestamp: number, summaryData: ConversationSummary): Promise<void> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await convsDir.getDirectoryHandle(String(timestamp), { create: true });
        const fileHandle = await convDir.getFileHandle("summary.json", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(summaryData, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Error saving summary:", e);
    }
}

/**
 * Loads summary.json for a conversation
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<ConversationSummary | null>} Summary data or null
 */
export async function loadSummary(timestamp: number): Promise<ConversationSummary | null> {
    try {
        const root = await getOPFSHandle();
        const convsDir = await ensureDirectory(root, STORAGE_CONVERSATIONS_DIR);
        const convDir = await convsDir.getDirectoryHandle(String(timestamp));
        const fileHandle = await convDir.getFileHandle("summary.json");
        const file = await fileHandle.getFile();
        const content = await file.text();
        return JSON.parse(content) as ConversationSummary;
    } catch (e) {
        return null;
    }
}
