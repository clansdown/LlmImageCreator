/**
 * Agent - Main entry point and orchestration
 * Handles initialization and user interaction flow
 */

import { STATE } from './state.js';
import { SYSTEM_PROMPT, TITLE_GENERATION_PROMPT } from './prompt.js';
import { fetchModels, fetchBalance, generateImage, getGenerationInfo, generateTitle } from './openrouter.js';
import { savePreference, getPreference, listConversations, createConversation, loadConversation, saveConversation, deletePreference, getImage, saveImage, saveSummary, loadSummary } from './storage.js';
import * as ui from './ui.js';
import { generateRandomSeed, generateConversationTitle, updateConversationSummary } from './util.js';

/**
 * @typedef {Object} ConversationMessage
 * @property {string} systemPrompt - System prompt used for generation
 * @property {string} text - User's prompt text
 * @property {number|null} seed - Seed value used in request for reproducibility
 */

/**
 * @typedef {Object} ConversationResponse
 * @property {string|null} text - Any text content returned from generation
 * @property {Array<string>} imageFilenames - Filenames of generated images (e.g., ["1.png", "2.png"])
 * @property {Array<string>} imageResolutions - Resolution for each image (e.g., ["1K", "2K"])
 * @property {Object} responseData - API response data (excludes binary image data)
 * @property {Object} generationData - Usage and cost information from generation query
 */

/**
 * @typedef {Object} ConversationEntry
 * @property {ConversationMessage} message - Input message with system prompt, text, and seed
 * @property {ConversationResponse} response - Response with text, images, and metadata
 */

/**
 * @typedef {Object} Conversation
 * @property {number} timestamp - Epoch timestamp of conversation creation
 * @property {ConversationEntry[]} entries - Array of conversation turns
 */

/**
 * @typedef {Object} ConversationSummary
 * @property {string} title - Conversation title
 * @property {number} imageCount - Total images across all conversation entries
 * @property {number} entryCount - Number of conversation turns
 * @property {number} created - Conversation creation timestamp (epoch seconds)
 * @property {number} updated - Last update timestamp (epoch seconds)
 */

window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    STATE.deferredPrompt = e;
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
    STATE.deferredPrompt = null;
});

const installBtn = document.getElementById('install-btn');
if (installBtn) {
    installBtn.addEventListener('click', function() {
        if (STATE.deferredPrompt) {
            STATE.deferredPrompt.prompt();
            STATE.deferredPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted install');
                }
                STATE.deferredPrompt = null;
                const btn = document.getElementById('install-btn');
                if (btn) btn.style.display = 'none';
            });
        }
    });
}

window.addEventListener('online', handleOnlineStatusChange);
window.addEventListener('offline', handleOnlineStatusChange);

/**
 * Handles online/offline status changes
 */
export function handleOnlineStatusChange() {
    if (!navigator.onLine) {
        displayWarning('Network unavailable. Some features may not work offline.');
    }
}

/**
 * Checks if the browser is online
 * @returns {boolean} True if online, false otherwise
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Initializes the application
 * Sets up event listeners but does not fetch data until API key is provided
 */
export function init() {
    setupEventListeners();
    loadPreferencesAndInitialize();

    listConversations().then(function(timestamps) {
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
export function setupEventListeners() {
    const apiKeyForm = document.querySelector("#api-key-input").closest("form");
    if (apiKeyForm) {
        apiKeyForm.addEventListener("submit", function(e) {
            e.preventDefault();
            handleApiKeyEntry();
        });
    }

    const apiKeyInput = document.getElementById("api-key-input");
    if (apiKeyInput) {
        apiKeyInput.addEventListener("blur", handleApiKeyEntry);
        apiKeyInput.addEventListener("keyup", function(e) {
            if (e.key === "Enter") {
                handleApiKeyEntry();
            }
        });
    }

    const toggleBtn = document.getElementById("toggle-sidebar-btn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function(e) {
            e.preventDefault();
            ui.toggleLeftColumn();
        });
    }

    const userInput = document.getElementById("user-input");
    if (userInput) {
        userInput.addEventListener("input", function() {
            const hasContent = this.value.trim().length > 0;
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

    setupDropdownEventListeners();
}

/**
 * Sets up event listeners for dropdown menus (resolution and aspect ratio)
 */
export function setupDropdownEventListeners() {
    const resolutionItems = document.querySelectorAll("#resolution-menu .dropdown-item");
    resolutionItems.forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            const dropdown = document.getElementById("resolution-dropdown");
            if (dropdown) {
                dropdown.textContent = "";
                dropdown.textContent = this.textContent + " ";
                const caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
                savePreference("defaultResolution", this.textContent.trim());
            }
        });
    });

    const aspectRatioItems = document.querySelectorAll("#aspect-ratio-menu .dropdown-item");
    aspectRatioItems.forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            const dropdown = document.getElementById("aspect-ratio-dropdown");
            if (dropdown) {
                dropdown.textContent = "";
                dropdown.textContent = this.textContent + " ";
                const caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
                savePreference("defaultAspectRatio", this.textContent.trim());
            }
        });
    });
}

/**
 * Initializes dropdowns to default/empty state
 */
export function initializeDropdowns() {
    ui.clearModelDropdown();
    ui.updateBalanceDisplay(null);
}

/**
 * Loads saved preferences from storage and initializes the application
 * @returns {Promise<void>}
 */
export async function loadPreferencesAndInitialize() {
    const apiKey = await getPreference("apiKey");

    if (apiKey && apiKey.length > 0) {
        const apiKeyInput = document.getElementById("api-key-input");
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
export function handleApiKeyEntry() {
    const apiKey = ui.getApiKey();

    if (!isOnline()) {
        ui.displayError('Network unavailable. Please check your connection.');
        return;
    }

    if (apiKey && apiKey.length > 0) {
        savePreference("apiKey", apiKey);

        fetchModels(apiKey).then(function(models) {
            ui.populateModelDropdown(models);
            
            getPreference("selectedModel").then(function(savedModelId) {
                if (savedModelId && savedModelId.length > 0) {
                    const found = ui.selectModelById(savedModelId, models);
                    if (!found) {
                        ui.displayWarning("Saved model no longer available. Preference has been removed.");
                        deletePreference("selectedModel");
                    }
                }
            });
            
            getPreference("defaultResolution", "1K").then(function(savedResolution) {
                ui.setResolution(savedResolution);
            });
            
            getPreference("defaultAspectRatio", "1:1").then(function(savedAspectRatio) {
                ui.setAspectRatio(savedAspectRatio);
            });
        }).catch(function(error) {
            console.error("Error fetching models:", error);
            ui.displayError("Failed to fetch models: " + error.message);
        });

        fetchBalance(apiKey).then(function(balance) {
            ui.updateBalanceDisplay(balance);
        }).catch(function(error) {
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
 * @param {Object} response - OpenRouter chat completion response
 * @returns {Promise<Array<string>>} Array of image filenames
 */
export async function saveImagesToConversation(timestamp, response) {
    const urls = ui.extractImageUrls(response);
    const filenames = [];
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
 * @param {Object} response - OpenRouter chat completion response
 * @param {Array<string>} imageFilenames - Saved image filenames
 * @param {Object} imageConfig - Image configuration options
 * @returns {ConversationEntry} Created conversation entry
 */
export function createConversationEntry(prompt, seed, response, imageFilenames, imageConfig) {
    const message = response.choices[0].message;
    const resolution = imageConfig && imageConfig.imageSize ? imageConfig.imageSize : "1K";
    const resolutions = [];
    for (let i = 0; i < imageFilenames.length; i++) {
        resolutions.push(resolution);
    }
    const entry = {
        message: {
            systemPrompt: SYSTEM_PROMPT,
            text: prompt,
            seed: seed
        },
        response: {
            text: message.content || null,
            imageFilenames: imageFilenames,
            imageResolutions: resolutions,
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
 * @returns {Promise<Object|null>} Generation data or null on failure
 */
export async function fetchGenerationDataWithRetry(apiKey, generationId, maxRetries) {
    if (typeof maxRetries === "undefined") {
        maxRetries = 5;
    }
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        await new Promise(function(resolve) {
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
 * @returns {Promise<void>}
 */
export async function initializeConversationSummary(timestamp) {
    /** @type {ConversationSummary} */
    const summaryData = {
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
export function handleGenerate() {
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
    /** @type {{imageSize: string, aspectRatio: string}} */
    const imageConfig = {
        imageSize: resolution,
        aspectRatio: aspectRatio
    };

    STATE.conversationHistory.push({
        role: "user",
        content: prompt
    });

    createConversation(STATE.currentConversation.timestamp).then(function() {
        const placeholderEntry = {
            message: {
                systemPrompt: SYSTEM_PROMPT,
                text: prompt,
                seed: seed
            },
            response: {
                text: null,
                imageFilenames: ["generating"],
                imageResolutions: [resolution],
                responseData: null,
                generationData: null
            }
        };
        STATE.currentConversation.entries.push(placeholderEntry);
        ui.renderConversation(STATE.currentConversation);

        return generateImage(apiKey, prompt, STATE.selectedModel, SYSTEM_PROMPT, STATE.conversationHistory, imageConfig, seed);
    }).then(function(response) {
        if (response.choices && response.choices.length > 0) {
            const message = response.choices[0].message;
            const responseText = message.content || "Image generated";
            const images = message.images || [];

            STATE.conversationHistory.push({
                role: "assistant",
                content: responseText
            });

            return saveImagesToConversation(STATE.currentConversation.timestamp, response).then(function(imageFilenames) {
                const placeholderIndex = STATE.currentConversation.entries.length - 1;
                const entry = createConversationEntry(prompt, seed, response, imageFilenames, imageConfig);
                STATE.currentConversation.entries[placeholderIndex] = entry;

                return saveConversation(STATE.currentConversation.timestamp, STATE.currentConversation).then(function() {
                    ui.renderConversation(STATE.currentConversation);
                    ui.clearUserInput();

                    if (STATE.currentConversation.entries.length === 1) {
                        initializeConversationSummary(STATE.currentConversation.timestamp).then(function() {
                            ui.updateConversationList();
                        });
                        generateConversationTitle(prompt).then(function(title) {
                            if (title && title !== "New Conversation") {
                                updateConversationSummary(STATE.currentConversation.timestamp, title).then(function(summaryData) {
                                    ui.updateConversationListItemTitle(STATE.currentConversation.timestamp);
                                });
                            }
                        }).catch(function() {
                            console.log("Title generation failed, keeping placeholder");
                        });
                    } else {
                        updateConversationSummary(STATE.currentConversation.timestamp).then(function() {
                            ui.updateConversationListDate(STATE.currentConversation.timestamp);
                        });
                    }

                    const generationId = response.id;
                    fetchGenerationDataWithRetry(apiKey, generationId, 5).then(function(generationData) {
                        if (generationData) {
                            entry.response.generationData = generationData;
                            saveConversation(STATE.currentConversation.timestamp, STATE.currentConversation);
                        }
                    });
                });
            });
        }
    }).catch(function(error) {
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
        fetchBalance(apiKey).then(function(balance) {
            ui.updateBalanceDisplay(balance);
        }).catch(function(error) {
            console.error("Error fetching balance:", error);
            ui.updateBalanceDisplay(null, "Balance unavailable - check API key permissions");
        });

        STATE.isGenerating = false;
        ui.setLoadingState(false);
    });
}
