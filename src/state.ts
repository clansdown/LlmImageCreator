/**
 * Centralized state management for the application
 * Contains all global state variables used across modules
 * STATE is a reactive Proxy: property assignments trigger registered listeners.
 * Updates are deferred until the DOM signals readiness via markDomReady(key).
 */

import type { AppState } from './types/state';

/** @type {Array<function(string, unknown): void>} */
const listeners: Array<(key: string, value: unknown) => void> = [];

/**
 * Registers a listener that fires when any STATE property is assigned
 * @param {function(string, unknown): void} listener - Callback receiving (key, value)
 */
export function onStateChange(listener: (key: string, value: unknown) => void): void {
    listeners.push(listener);
}

/** @type {Set<string>} Keys whose DOM elements are ready to receive updates */
const domReadyFlags: Set<string> = new Set();

/** @type {Map<string, unknown>} Pending updates deferred until DOM readiness */
const pendingSets: Map<string, unknown> = new Map();

/**
 * Marks that DOM elements for a key are ready to receive updates.
 * If a value was set before DOM was ready, it fires the listeners now.
 * @param {string} key - The STATE key whose DOM is now ready
 */
export function markDomReady(key: string): void {
    domReadyFlags.add(key);
    if (pendingSets.has(key)) {
        const value = pendingSets.get(key)!;
        pendingSets.delete(key);
        listeners.forEach(function(l: (key: string, value: unknown) => void) {
            l(key, value);
        });
    }
}

const internalState: AppState = {
    selectedModel: null,
    visionModels: [],
    currentConversation: null,
    conversationHistory: [],
    isGenerating: false,
    apiKey: '',
    deferredPrompt: null,
    externalSync: {
        directoryHandle: null,
        isSyncing: false,
        syncEnabled: false,
        syncProgress: null
    },
    conversationView: {
        minRatingFilter: null,
        entryElementCache: new Map(),
        imageElementCache: new Map()
    },
    projects: [],
    currentProjectId: 'root'
};

/**
 * Global application state — reactive Proxy.
 * Property assignments are stored immediately but listener notifications
 * are deferred until the corresponding DOM key is marked ready.
 */
export const STATE: AppState = new Proxy(internalState, {
    set(target: AppState, key: string | symbol, value: unknown): boolean {
        (target as unknown as Record<string, unknown>)[key as string] = value;
        const keyStr = key as string;
        if (domReadyFlags.has(keyStr)) {
            listeners.forEach(function(l: (key: string, value: unknown) => void) {
                l(keyStr, value);
            });
        } else {
            pendingSets.set(keyStr, value);
        }
        return true;
    },
    get(target: AppState, key: string | symbol): unknown {
        return (target as unknown as Record<string, unknown>)[key as string];
    }
});
