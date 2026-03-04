/**
 * Agent - Main entry point and orchestration
 * Handles initialization and user interaction flow
 */

import { STATE } from './state';
import { UPSCALE_PROMPT } from './prompt';
import { fetchModels, fetchBalance, generateImage, getGenerationInfo } from './openrouter';
import { savePreference, getPreference, listConversations, createConversation, loadConversation, saveConversation, deletePreference, getImage, saveImage, saveSummary, loadSummary } from './storage';
import * as ui from './ui';
import { generateRandomSeed, generateConversationTitle, updateConversationSummary, getApiKey } from './util';
import type { Conversation, ConversationSummary, ConversationEntry, Message, ReferenceImage } from './types/state';
import type { VisionModel, ChatCompletionResponse, ImageConfig, BalanceInfo, GenerationInfo, Message as ApiMessage } from './types/api';

export { getUpscalingModel };

async function getUpscalingModel(): Promise<string | null> {
    return await getPreference("upscalingModel");
}

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
 * Gets a model's name by its ID from stored vision models
 * @param {string} modelId - Model ID to look up
 * @returns {string} Model name, or model ID if not found
 */
function getModelName(modelId: string): string {
    const model = STATE.visionModels.find(function(m: {id: string; name: string}) {
        return m.id === modelId;
    });
    return model ? model.name : modelId;
}

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
    console.log("Initializing application");

    STATE.currentConversation = {
        timestamp: 0,
        entries: [],
        referenceImages: []
    };

    setupEventListeners();
    ui.initSettingsDialog();
    loadPreferencesAndInitialize();

    listConversations().then(function(timestamps: number[]) {
        ui.populateConversationList(timestamps);
    });

    ui.renderReferenceImagesToolbar(STATE.currentConversation);
    ui.initTooltips();
    ui.expandTextarea();

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
        userInput.addEventListener("focus", function() {
            ui.expandTextarea();
        });
        userInput.addEventListener("blur", function() {
            const hasMessages = STATE.currentConversation?.entries?.length ?? 0 > 0;
            if (hasMessages) {
                ui.shrinkTextarea();
            }
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
            STATE.visionModels = models;
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
    if (filenames.length > 0) {
        ui.invalidateDialogState();
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
 * @param {string} modelId - Model ID used for generation
 * @param {string} modelName - Model name used for generation
 * @param {string} systemPrompt - System prompt used for generation
 * @returns {ConversationEntry} Created conversation entry
 */
export function createConversationEntry(prompt: string, seed: number, response: ChatCompletionResponse, imageFilenames: string[], imageConfig: ImageConfig, modelId: string, modelName: string, systemPrompt: string, referenceImages?: ReferenceImage[]): ConversationEntry {
    const message = response.choices[0].message;
    const resolution = imageConfig && imageConfig.imageSize ? imageConfig.imageSize : "1K";
    const resolutions: string[] = [];
    for (let i = 0; i < imageFilenames.length; i++) {
        resolutions.push(resolution);
    }
    const entry: ConversationEntry = {
        message: {
            systemPrompt: systemPrompt,
            text: prompt,
            seed: seed,
            modelId: modelId,
            modelName: modelName,
            referenceImages: referenceImages
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
 * Handles image generation with spinner display
 * @param {string} apiKey - OpenRouter API key
 * @param {Conversation} conversation - Conversation to add image to
 * @param {ConversationEntry | null} targetEntry - Existing entry for regeneration, or null for new entry
 * @param {string} prompt - User prompt
 * @param {string} model - Model to use
 * @param {string | null} systemPrompt - System prompt to use
 * @param {Array<{role: string, content: string}>} conversationHistory - Conversation history
 * @param {ImageConfig} imageConfig - Image configuration
 * @param {number | undefined} seed - Random seed for generation
 * @param {{imageData: string} | undefined} imageInput - Optional image input for upscaling
 * @returns {Promise<void>}
 */
export async function handleImageGenerationWithSpinner(
    apiKey: string,
    conversation: Conversation,
    targetEntry: ConversationEntry | null,
    prompt: string,
    model: string,
    systemPrompt: string | null,
    conversationHistory: Array<{role: string, content: string}>,
    imageConfig: ImageConfig,
    seed?: number,
    imageInput?: {imageData: string},
    referenceImages?: ReferenceImage[]
): Promise<void> {
    const resolution = imageConfig.imageSize;
    const isNewEntry = targetEntry === null;
    let entryIndex: number;

    if (isNewEntry) {
        const placeholderEntry: ConversationEntry = {
            message: {
                systemPrompt: systemPrompt || "",
                text: prompt,
                seed: seed as number,
                referenceImages: referenceImages
            },
            response: {
                text: null,
                imageFilenames: ["generating"],
                imageResolutions: [resolution as '1K' | '2K' | '4K'],
                responseData: null,
                generationData: null
            }
        };
        conversation.entries.push(placeholderEntry);
        entryIndex = conversation.entries.length - 1;
    } else {
        targetEntry.response.imageFilenames.push("generating");
        targetEntry.response.imageResolutions ??= [];
        targetEntry.response.imageResolutions.push(resolution as '1K' | '2K' | '4K');
        entryIndex = conversation.entries.indexOf(targetEntry);
    }

    await ui.renderConversation(conversation);

    let referenceImagesDataUrls: string[] = [];
    if (referenceImages && referenceImages.length > 0) {
        referenceImagesDataUrls = await ui.getReferenceImagesDataUrls(referenceImages);
    }

    try {
        const response = await generateImage(apiKey, prompt, model, systemPrompt, conversationHistory as ApiMessage[], imageConfig, seed, imageInput, referenceImagesDataUrls);

        if (!response.choices || response.choices.length === 0) {
            throw new Error("No response from API");
        }

        const urls = ui.extractImageUrls(response);
        if (urls.length === 0) {
            throw new Error("No images returned from API");
        }

        const imageFilenames: string[] = [];
        for (const url of urls) {
            const newIndex = await saveImage(conversation.timestamp, url);
            if (newIndex !== null) {
                imageFilenames.push(String(newIndex));
            }
        }

        if (isNewEntry) {
            const modelId = response.model;
            const modelName = getModelName(modelId);
            const entry = createConversationEntry(prompt, seed as number, response, imageFilenames, imageConfig, modelId, modelName, systemPrompt || "", referenceImages);
            conversation.entries[entryIndex] = entry;
        } else {
            const placeholderIdx = targetEntry.response.imageFilenames.indexOf("generating");
            if (placeholderIdx !== -1) {
                targetEntry.response.imageFilenames[placeholderIdx] = imageFilenames[0];
                for (let i = 1; i < imageFilenames.length; i++) {
                    targetEntry.response.imageFilenames.push(imageFilenames[i]);
                    targetEntry.response.imageResolutions.push(resolution as '1K' | '2K' | '4K');
                }
            }
            targetEntry.response.responseData = response;
        }

        await saveConversation(conversation.timestamp, conversation);
        if (imageFilenames.length > 0) {
            ui.invalidateDialogState();
        }
        await ui.renderConversation(conversation);
    } catch (error) {
        console.error("Error generating image:", error);

        const errorInfo = (error as unknown as { info?: { message: string; status?: number; code?: string; type?: string; rawResponse?: string } }).info;
        if (errorInfo) {
            ui.displayError(errorInfo);
        } else {
            ui.displayError((error as Error).message);
        }

        if (isNewEntry && conversation.entries.length > 0) {
            const lastEntry = conversation.entries[conversation.entries.length - 1];
            if (lastEntry.response.imageFilenames?.[0] === "generating") {
                conversation.entries.pop();
                await ui.renderConversation(conversation);
            }
        } else if (!isNewEntry) {
            const placeholderIdx = targetEntry.response.imageFilenames.indexOf("generating");
            if (placeholderIdx !== -1) {
                targetEntry.response.imageFilenames.splice(placeholderIdx, 1);
                targetEntry.response.imageResolutions.splice(placeholderIdx, 1);
            }
            await saveConversation(conversation.timestamp, conversation);
            await ui.renderConversation(conversation);
        }
    } finally {
        fetchBalance(apiKey).then(function(balance: BalanceInfo) {
            ui.updateBalanceDisplay(balance);
        }).catch(function() {
            ui.updateBalanceDisplay(null, "Balance unavailable - check API key permissions");
        });

        STATE.isGenerating = false;
        ui.setLoadingState(false);
    }
}

/**
 * Handles the generate button click - initiates image generation
 */
export async function handleGenerate(): Promise<void> {
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

    const seed = generateRandomSeed();
    let timestamp = Math.floor(Date.now() / 1000);

    if (!STATE.currentConversation || STATE.currentConversation.timestamp === 0) {
        STATE.currentConversation = {
            timestamp: timestamp,
            entries: [],
            referenceImages: STATE.currentConversation?.referenceImages ?? []
        };
    } else {
        timestamp = STATE.currentConversation.timestamp;
    }

    const resolution = ui.getResolution();
    const aspectRatio = ui.getAspectRatio();
    const imageConfig: ImageConfig = {
        imageSize: resolution as ImageConfig['imageSize'],
        aspectRatio: aspectRatio as ImageConfig['aspectRatio']
    };

    const referenceImages = STATE.currentConversation?.referenceImages ?? [];

    STATE.conversationHistory.push({
        role: "user",
        content: prompt
    });

    STATE.isGenerating = true;
    ui.setLoadingState(true);

    const systemPrompt = await ui.getSystemPrompt();

    createConversation(STATE.currentConversation.timestamp).then(function() {
        return handleImageGenerationWithSpinner(
            apiKey,
            STATE.currentConversation!,
            null,
            prompt,
            STATE.selectedModel!,
            systemPrompt,
            STATE.conversationHistory,
            imageConfig,
            seed,
            undefined,
            referenceImages
        );
    }).then(function() {
        ui.clearUserInput();
        ui.shrinkTextarea();

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

        const lastEntry = STATE.currentConversation!.entries[STATE.currentConversation!.entries.length - 1];
        if (lastEntry?.response?.responseData) {
            const response = lastEntry.response.responseData as ChatCompletionResponse;
            const generationId = response.id;
            fetchGenerationDataWithRetry(apiKey, generationId, 5).then(function(generationData: GenerationInfo | null) {
                if (generationData) {
                    lastEntry.response.generationData = generationData;
                    saveConversation(STATE.currentConversation!.timestamp, STATE.currentConversation!);
                }
            });
        }
    }).catch(function() {
    });
}

/**
 * Handles regenerating an image with a new seed
 * @param {number} entryIndex - Index of the entry in conversation
 * @param {number} imageIndex - Index of the image within the entry
 */
export async function handleRegenerateWithNewSeed(entryIndex: number, imageIndex: number): Promise<void> {
    if (!STATE.currentConversation || !STATE.currentConversation.entries[entryIndex]) return;
    const entry = STATE.currentConversation.entries[entryIndex];

    const apiKey = ui.getApiKey();
    if (!apiKey) return;

    const aspectRatio = ui.getAspectRatio();
    const resolution = entry.response.imageResolutions?.[imageIndex] ?? "1K";

    const imageConfig: ImageConfig = {
        imageSize: resolution as ImageConfig['imageSize'],
        aspectRatio: aspectRatio as ImageConfig['aspectRatio']
    };

    const newSeed = generateRandomSeed();
    const prompt = entry.message.text;
    const referenceImages = entry.message.referenceImages;

    STATE.isGenerating = true;
    ui.setLoadingState(true);

    await handleImageGenerationWithSpinner(
        apiKey,
        STATE.currentConversation,
        entry,
        prompt,
        entry.message.modelId || STATE.selectedModel || "",
        entry.message.systemPrompt || null,
        [],
        imageConfig,
        newSeed,
        undefined,
        referenceImages
    );
}

/**
 * Handles regenerating an image at 4K resolution using upscaling
 * @param {number} entryIndex - Index of the entry in conversation
 * @param {number} imageIndex - Index of the image within the entry
 */
export async function handleRegenerateLarger(entryIndex: number, imageIndex: number): Promise<void> {
    if (!STATE.currentConversation || !STATE.currentConversation.entries[entryIndex]) return;
    const entry = STATE.currentConversation.entries[entryIndex];
    if (entry.response.imageResolutions?.[imageIndex] === "4K") return;

    const upscalingModel = await ui.getUpscalingModel();
    if (!upscalingModel) {
        ui.displayError("Please select an upscaling model in Settings first");
        return;
    }

    const apiKey = ui.getApiKey();
    if (!apiKey) return;

    const conversationTimestamp = STATE.currentConversation.timestamp;
    const imageFilename = entry.response.imageFilenames[imageIndex];

    STATE.isGenerating = true;
    ui.setLoadingState(true);

    try {
        const blob = await getImage(conversationTimestamp, parseInt(imageFilename, 10));
        if (!blob) throw new Error("Failed to load image");

        const dataUrl = await new Promise<string>(function(resolve, reject) {
            const reader = new FileReader();
            reader.onloadend = function() {
                if (reader.result) {
                    resolve(reader.result as string);
                } else {
                    reject(new Error("Failed to read image data"));
                }
            };
            reader.onerror = function() {
                reject(new Error("Failed to read image data"));
            };
            reader.readAsDataURL(blob);
        });

        const imageConfig: ImageConfig = {
            imageSize: "4K"
        };

        const referenceImages = entry.message.referenceImages;

        await handleImageGenerationWithSpinner(
            apiKey,
            STATE.currentConversation,
            entry,
            UPSCALE_PROMPT,
            upscalingModel,
            null,
            [],
            imageConfig,
            undefined,
            { imageData: dataUrl },
            referenceImages
        );
    } catch (error) {
        console.error("Error upscaling image:", error);
        const errorInfo = (error as unknown as { info?: { message: string; status?: number; code?: string; type?: string; rawResponse?: string } }).info;
        if (errorInfo) {
            ui.displayError(errorInfo);
        } else {
            ui.displayError((error as Error).message);
        }
        STATE.isGenerating = false;
        ui.setLoadingState(false);
    }
}
