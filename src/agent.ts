/**
 * Agent - Main entry point and orchestration
 * Handles initialization and user interaction flow
 */

import { STATE } from './state';
import { SYSTEM_PROMPT } from './prompt';
import { fetchModels, fetchBalance, generateImage, getGenerationInfo } from './openrouter';
import { savePreference, getPreference, listConversations, createConversation, loadConversation, saveConversation, deletePreference, getImage, saveImage, saveSummary, loadSummary } from './storage';
import * as ui from './ui';
import { generateRandomSeed, generateConversationTitle, updateConversationSummary } from './util';
import type { Conversation, ConversationSummary, ConversationEntry, Message } from './types/state';
import type { VisionModel, ChatCompletionResponse, ImageConfig, BalanceInfo, GenerationInfo } from './types/api';

declare global {
    interface Window {
        beforeinstallprompt: Event & {
            prompt(): void;
            userChoice: Promise<{outcome: string}>;
        };
    }
}

const deferredPromptEvent = (function(): BeforeInstallPromptEvent | null {
    let deferredPrompt: BeforeInstallPromptEvent | null = null;

    window.addEventListener('beforeinstallprompt', function(e: Event) {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.style.display = 'inline-block';
        }
    });

    window.addEventListener('appinstalled', function() {
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
        deferredPrompt = null;
    });

    return deferredPrompt;
})();

interface BeforeInstallPromptEvent extends Event {
    prompt(): void;
    userChoice: Promise<{outcome: string}>;
}

const installBtn = document.getElementById('install-btn');
if (installBtn) {
    installBtn.addEventListener('click', async function() {
        const deferredPrompt = window as unknown as {deferredPrompt?: BeforeInstallPromptEvent};
        if (deferredPrompt && deferredPrompt.deferredPrompt) {
            deferredPrompt.deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.deferredPrompt.userChoice;
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted install');
            }
            deferredPrompt.deferredPrompt = undefined;
            const btn = document.getElementById('install-btn');
            if (btn) btn.style.display = 'none';
        }
    });
}

window.addEventListener('online', handleOnlineStatusChange);
window.addEventListener('offline', handleOnlineStatusChange);

/**
 * Handles online/offline status changes
 */
export function handleOnlineStatusChange(): void {
    if (!navigator.onLine) {
        ui.displayWarning('Network unavailable. Some features may not work offline.');
    }
}

/**
 * Checks if the browser is online
 * @returns {boolean} True if online, false otherwise
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Initializes the application
 * Sets up event listeners but does not fetch data until API key is provided
 */
export function init(): void {
    setupEventListeners();
    ui.initSettingsDialog();
    loadPreferencesAndInitialize();

    listConversations().then(function(timestamps: number[]) {
        ui.populateConversationList(timestamps);
    });

    ui.initTooltips();

    if (!navigator.onLine) {
        ui.displayWarning("Network unavailable. Some features may not work offline.");
    }
}

/**
 * Sets up all event listeners for the application
 */
export function setupEventListeners(): void {
    const apiKeyForm = document.querySelector("#api-key-input")?.closest("form");
    if (apiKeyForm) {
        apiKeyForm.addEventListener("submit", function(e: Event) {
            e.preventDefault();
            handleApiKeyEntry();
        });
    }

    const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement | null;
    if (apiKeyInput) {
        apiKeyInput.addEventListener("blur", handleApiKeyEntry);
        apiKeyInput.addEventListener("keyup", function(e: KeyboardEvent) {
            if (e.key === "Enter") {
                handleApiKeyEntry();
            }
        });
    }

    const toggleBtn = document.getElementById("toggle-sidebar-btn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function(e: Event) {
            e.preventDefault();
            ui.toggleLeftColumn();
        });
    }

    const userInput = document.getElementById("user-input") as HTMLTextAreaElement | null;
    if (userInput) {
        userInput.addEventListener("input", function() {
            const hasContent = userInput.value.trim().length > 0;
            ui.setGenerateButtonState(hasContent);
        });
    }

    const generateButton = document.getElementById("generate-button");
    if (generateButton) {
        generateButton.addEventListener("click", handleGenerate);
    }

    const newConversationBtn = document.getElementById("new-conversation-btn");
    if (newConversationBtn) {
        newConversationBtn.addEventListener("click", ui.handleNewConversation);
    }

    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", function() {
            ui.handleSettingsOpen();
            const settingsModal = document.getElementById("settings-modal");
            if (settingsModal && (settingsModal as HTMLElement & {instance?: {show(): void}}).instance) {
                (settingsModal as HTMLElement & {instance?: {show(): void}}).instance!.show();
            }
        });
    }

    setupDropdownEventListeners();
}

/**
 * Sets up event listeners for dropdown menus (resolution and aspect ratio)
 */
export function setupDropdownEventListeners(): void {
    const resolutionItems = document.querySelectorAll("#resolution-menu .dropdown-item");
    resolutionItems.forEach(function(item: Element) {
        item.addEventListener("click", function(e: Event) {
            e.preventDefault();
            const dropdown = document.getElementById("resolution-dropdown");
            if (dropdown) {
                dropdown.textContent = "";
                dropdown.textContent = (item as HTMLElement).textContent + " ";
                const caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
                savePreference("defaultResolution", (item as HTMLElement).textContent?.trim() || "1K");
            }
        });
    });

    const aspectRatioItems = document.querySelectorAll("#aspect-ratio-menu .dropdown-item");
    aspectRatioItems.forEach(function(item: Element) {
        item.addEventListener("click", function(e: Event) {
            e.preventDefault();
            const dropdown = document.getElementById("aspect-ratio-dropdown");
            if (dropdown) {
                dropdown.textContent = "";
                dropdown.textContent = (item as HTMLElement).textContent + " ";
                const caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
                savePreference("defaultAspectRatio", (item as HTMLElement).textContent?.trim() || "1:1");
            }
        });
    });
}

/**
 * Initializes dropdowns to default/empty state
 */
export function initializeDropdowns(): void {
    ui.clearModelDropdown();
    ui.updateBalanceDisplay(null);
}

/**
 * Loads saved preferences from storage and initializes the application
 */
export async function loadPreferencesAndInitialize(): Promise<void> {
    const apiKey = await getPreference("apiKey");

    if (apiKey && apiKey.length > 0) {
        const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement | null;
        if (apiKeyInput) {
            apiKeyInput.value = apiKey;
        }

        handleApiKeyEntry();
    } else {
        initializeDropdowns();
    }
}

/**
 * Handles API key entry - fetches models and balance
 */
export function handleApiKeyEntry(): void {
    const apiKey = ui.getApiKey();

    if (!isOnline()) {
        ui.displayError('Network unavailable. Please check your connection.');
        return;
    }

    if (apiKey && apiKey.length > 0) {
        savePreference("apiKey", apiKey);

        fetchModels(apiKey).then(function(models: VisionModel[]) {
            ui.populateModelDropdown(models);
            
            getPreference("selectedModel").then(function(savedModelId: string | null) {
                if (savedModelId && savedModelId.length > 0) {
                    const found = ui.selectModelById(savedModelId, models);
                    if (!found) {
                        ui.displayWarning("Saved model no longer available. Preference has been removed.");
                        deletePreference("selectedModel");
                    }
                }
            });
            
            getPreference("defaultResolution", "1K").then(function(savedResolution: string | null) {
                ui.setResolution(savedResolution || "1K");
            });
            
            getPreference("defaultAspectRatio", "1:1").then(function(savedAspectRatio: string | null) {
                ui.setAspectRatio(savedAspectRatio || "1:1");
            });
        }).catch(function(error: Error) {
            console.error("Error fetching models:", error);
            ui.displayError("Failed to fetch models: " + error.message);
        });

        fetchBalance(apiKey).then(function(balance: BalanceInfo) {
            ui.updateBalanceDisplay(balance);
        }).catch(function(error: Error) {
            console.error("Error fetching balance:", error);
            ui.updateBalanceDisplay(null, "Balance unavailable - check API key permissions");
        });
    } else {
        savePreference("apiKey", "");
        ui.clearModelDropdown();
        ui.updateBalanceDisplay(null);
    }
}

/**
 * Saves images from response to conversation directory
 * @param {number} timestamp - Conversation timestamp
 * @param {ChatCompletionResponse} response - OpenRouter chat completion response
 * @returns {Promise<string[]>} Array of image filenames
 */
export async function saveImagesToConversation(timestamp: number, response: ChatCompletionResponse): Promise<string[]> {
    const urls = ui.extractImageUrls(response);
    const filenames: string[] = [];
    for (let i = 0; i < urls.length; i++) {
        const index = await saveImage(timestamp, urls[i]);
        if (index !== null) {
            filenames.push(String(index));
        }
    }
    return filenames;
}

/**
 * Creates a conversation entry from generation response
 * @param {string} prompt - User prompt text
 * @param {number} seed - Generation seed
 * @param {ChatCompletionResponse} response - OpenRouter chat completion response
 * @param {string[]} imageFilenames - Saved image filenames
 * @param {ImageConfig} imageConfig - Image configuration options
 * @returns {ConversationEntry} Created conversation entry
 */
export function createConversationEntry(prompt: string, seed: number, response: ChatCompletionResponse, imageFilenames: string[], imageConfig: ImageConfig): ConversationEntry {
    const message = response.choices[0].message;
    const resolution = imageConfig && imageConfig.imageSize ? imageConfig.imageSize : "1K";
    const resolutions: string[] = [];
    for (let i = 0; i < imageFilenames.length; i++) {
        resolutions.push(resolution);
    }
    const entry: ConversationEntry = {
        message: {
            systemPrompt: SYSTEM_PROMPT,
            text: prompt,
            seed: seed
        },
        response: {
            text: message.content || null,
            imageFilenames: imageFilenames,
            imageResolutions: resolutions as Array<'1K' | '2K' | '4K'>,
            responseData: response,
            generationData: null
        }
    };
    return entry;
}

/**
 * Polls generation info endpoint with retry logic
 * @param {string} apiKey - OpenRouter API key
 * @param {string} generationId - Generation ID from response
 * @param {number} [maxRetries=5] - Maximum retry attempts
 * @returns {Promise<GenerationInfo | null>} Generation data or null on failure
 */
export async function fetchGenerationDataWithRetry(apiKey: string, generationId: string, maxRetries: number = 5): Promise<GenerationInfo | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        await new Promise<void>(function(resolve) {
            setTimeout(resolve, 200);
        });
        try {
            const generationInfo = await getGenerationInfo(apiKey, generationId);
            if (generationInfo) {
                return generationInfo;
            }
        } catch (e) {
            if (attempt === maxRetries - 1) {
                return null;
            }
        }
    }
    return null;
}

/**
 * Initializes summary.json with placeholder
 * @param {number} timestamp - Conversation timestamp
 */
export async function initializeConversationSummary(timestamp: number): Promise<void> {
    const summaryData: ConversationSummary = {
        title: "New Conversation",
        imageCount: 0,
        entryCount: 0,
        created: timestamp,
        updated: timestamp
    };
    await saveSummary(timestamp, summaryData);
}

/**
 * Handles the generate button click - initiates image generation
 */
export function handleGenerate(): void {
    if (STATE.isGenerating) return;

    if (!isOnline()) {
        ui.displayError("Network unavailable. Please check your connection.");
        return;
    }

    const apiKey = ui.getApiKey();
    if (!apiKey || apiKey.length === 0) {
        ui.displayError("Please enter your API key first");
        return;
    }

    const prompt = ui.getUserPrompt();
    if (!prompt || prompt.length === 0) {
        ui.displayError("Please enter a prompt");
        return;
    }

    if (!STATE.selectedModel) {
        ui.displayError("Please wait for models to load");
        return;
    }

    STATE.isGenerating = true;
    ui.setLoadingState(true);

    const seed = generateRandomSeed();
    const timestamp = Math.floor(Date.now() / 1000);

    if (!STATE.currentConversation) {
        STATE.currentConversation = {
            timestamp: timestamp,
            entries: []
        };
    }

    const resolution = ui.getResolution();
    const aspectRatio = ui.getAspectRatio();
    const imageConfig: ImageConfig = {
        imageSize: resolution as ImageConfig['imageSize'],
        aspectRatio: aspectRatio as ImageConfig['aspectRatio']
    };

    STATE.conversationHistory.push({
        role: "user",
        content: prompt
    });

    createConversation(STATE.currentConversation.timestamp).then(function() {
        const placeholderEntry: ConversationEntry = {
            message: {
                systemPrompt: SYSTEM_PROMPT,
                text: prompt,
                seed: seed
            },
            response: {
                text: null,
                imageFilenames: ["generating"],
                imageResolutions: [resolution as '1K' | '2K' | '4K'],
                responseData: null,
                generationData: null
            }
        };
        STATE.currentConversation!.entries.push(placeholderEntry);
        ui.renderConversation(STATE.currentConversation!);

        return generateImage(apiKey, prompt, STATE.selectedModel!, SYSTEM_PROMPT, STATE.conversationHistory, imageConfig, seed, undefined);
    }).then(function(response: ChatCompletionResponse) {
        if (response.choices && response.choices.length > 0) {
            const message = response.choices[0].message;
            const responseText = message.content || "Image generated";
            const images = message.images || [];

            STATE.conversationHistory.push({
                role: "assistant",
                content: responseText
            });

            return saveImagesToConversation(STATE.currentConversation!.timestamp, response).then(function(imageFilenames: string[]) {
                const placeholderIndex = STATE.currentConversation!.entries.length - 1;
                const entry = createConversationEntry(prompt, seed, response, imageFilenames, imageConfig);
                STATE.currentConversation!.entries[placeholderIndex] = entry;

                return saveConversation(STATE.currentConversation!.timestamp, STATE.currentConversation!).then(function() {
                    ui.renderConversation(STATE.currentConversation!);
                    ui.clearUserInput();

                    if (STATE.currentConversation!.entries.length === 1) {
                        initializeConversationSummary(STATE.currentConversation!.timestamp).then(function() {
                            ui.updateConversationList();
                        });
                        generateConversationTitle(prompt).then(function(title: string) {
                            if (title && title !== "New Conversation") {
                                updateConversationSummary(STATE.currentConversation!.timestamp, title).then(function() {
                                    ui.updateConversationListItemTitle(STATE.currentConversation!.timestamp);
                                });
                            }
                        }).catch(function() {
                            console.log("Title generation failed, keeping placeholder");
                        });
                    } else {
                        updateConversationSummary(STATE.currentConversation!.timestamp).then(function() {
                            ui.updateConversationListDate(STATE.currentConversation!.timestamp);
                        });
                    }

                    const generationId = response.id;
                    fetchGenerationDataWithRetry(apiKey, generationId, 5).then(function(generationData: GenerationInfo | null) {
                        if (generationData) {
                            entry.response.generationData = generationData;
                            saveConversation(STATE.currentConversation!.timestamp, STATE.currentConversation!);
                        }
                    });
                });
            });
        }
        return undefined;
    }).catch(function(error: Error) {
        console.error("Error generating image:", error);
        ui.displayError(error.message);
        if (STATE.currentConversation && STATE.currentConversation.entries.length > 0) {
            const lastEntry = STATE.currentConversation.entries[STATE.currentConversation.entries.length - 1];
            if (lastEntry.response && lastEntry.response.imageFilenames &&
                lastEntry.response.imageFilenames[0] === "generating") {
                STATE.currentConversation.entries.pop();
                ui.renderConversation(STATE.currentConversation);
            }
        }
    }).finally(function() {
        fetchBalance(apiKey).then(function(balance: BalanceInfo) {
            ui.updateBalanceDisplay(balance);
        }).catch(function(error: Error) {
            console.error("Error fetching balance:", error);
            ui.updateBalanceDisplay(null, "Balance unavailable - check API key permissions");
        });

        STATE.isGenerating = false;
        ui.setLoadingState(false);
    });
}
