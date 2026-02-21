/**
 * Agent - Main entry point and orchestration
 * Handles initialization and user interaction flow
 */

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

/** @type {string | null} */
let selectedModel = null;

/** @type {Conversation | null} */
let currentConversation = null;

/** @type {Array<{role: string, content: string}>} */
let conversationHistory = [];

/** @type {boolean} */
let isGenerating = false;

/** @type {any} */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
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

const installBtn = document.getElementById('install-btn');
if (installBtn) {
    installBtn.addEventListener('click', function() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted install');
                }
                deferredPrompt = null;
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
function handleOnlineStatusChange() {
    if (!navigator.onLine) {
        displayWarning('Network unavailable. Some features may not work offline.');
    }
}

/**
 * Checks if the browser is online
 * @returns {boolean} True if online, false otherwise
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Initializes the application
 * Sets up event listeners but does not fetch data until API key is provided
 */
function init() {
    setupEventListeners();
    loadPreferencesAndInitialize();

    listConversations().then(function(timestamps) {
        populateConversationList(timestamps);
    });

    initTooltips();

    if (!navigator.onLine) {
        displayWarning("Network unavailable. Some features may not work offline.");
    }
}

/**
 * Sets up all event listeners for the application
 */
function setupEventListeners() {
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
            toggleLeftColumn();
        });
    }

    const userInput = document.getElementById("user-input");
    if (userInput) {
        userInput.addEventListener("input", function() {
            const hasContent = this.value.trim().length > 0;
            setGenerateButtonState(hasContent);
        });
    }

    const generateButton = document.getElementById("generate-button");
    if (generateButton) {
        generateButton.addEventListener("click", handleGenerate);
    }

    const newConversationBtn = document.getElementById("new-conversation-btn");
    if (newConversationBtn) {
        newConversationBtn.addEventListener("click", handleNewConversation);
    }

    setupDropdownEventListeners();
}

/**
 * Sets up event listeners for dropdown menus (resolution and aspect ratio)
 */
function setupDropdownEventListeners() {
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
function initializeDropdowns() {
    clearModelDropdown();
    updateBalanceDisplay(null);
}

/**
 * Loads saved preferences from storage and initializes the application
 * @returns {Promise<void>}
 */
async function loadPreferencesAndInitialize() {
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
function handleApiKeyEntry() {
    const apiKey = getApiKey();

    if (!isOnline()) {
        displayError('Network unavailable. Please check your connection.');
        return;
    }

    if (apiKey && apiKey.length > 0) {
        savePreference("apiKey", apiKey);

        fetchModels(apiKey).then(function(models) {
            populateModelDropdown(models);
            
            getPreference("selectedModel").then(function(savedModelId) {
                if (savedModelId && savedModelId.length > 0) {
                    const found = selectModelById(savedModelId, models);
                    if (!found) {
                        displayWarning("Saved model no longer available. Preference has been removed.");
                        deletePreference("selectedModel");
                    }
                }
            });
            
            getPreference("defaultResolution", "1K").then(function(savedResolution) {
                setResolution(savedResolution);
            });
            
            getPreference("defaultAspectRatio", "1:1").then(function(savedAspectRatio) {
                setAspectRatio(savedAspectRatio);
            });
        }).catch(function(error) {
            console.error("Error fetching models:", error);
            displayError("Failed to fetch models: " + error.message);
        });

        fetchBalance(apiKey).then(function(balance) {
            updateBalanceDisplay(balance);
        }).catch(function(error) {
            console.error("Error fetching balance:", error);
            updateBalanceDisplay(null, "Balance unavailable - check API key permissions");
        });
    } else {
        savePreference("apiKey", "");
        clearModelDropdown();
        updateBalanceDisplay(null);
    }
}

/**
 * Extracts image URLs from chat completion response
 * @param {Object} response - OpenRouter chat completion response
 * @returns {Array<string>} Array of image URLs
 */
function extractImageUrls(response) {
    const urls = [];
    if (response.choices && response.choices.length > 0) {
        const message = response.choices[0].message;
        if (message.images && message.images.length > 0) {
            message.images.forEach(function(imgObj) {
                if (imgObj.image_url && imgObj.image_url.url) {
                    urls.push(imgObj.image_url.url);
                }
            });
        }
    }
    return urls;
}

/**
 * Saves images from response to conversation directory
 * @param {number} timestamp - Conversation timestamp
 * @param {Object} response - OpenRouter chat completion response
 * @returns {Promise<Array<string>>} Array of image filenames
 */
async function saveImagesToConversation(timestamp, response) {
    const urls = extractImageUrls(response);
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
function createConversationEntry(prompt, seed, response, imageFilenames, imageConfig) {
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
async function fetchGenerationDataWithRetry(apiKey, generationId, maxRetries) {
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
async function initializeConversationSummary(timestamp) {
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
 * Updates the conversation summary with current stats and optional new title
 * @param {number} timestamp - Conversation timestamp
 * @param {string} [title] - Optional new title
 * @returns {Promise<ConversationSummary>} Updated summary data
 */
async function updateConversationSummary(timestamp, title) {
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

/**
 * Handles the generate button click - initiates image generation
 */
function handleGenerate() {
    if (isGenerating) return;

    if (!isOnline()) {
        displayError("Network unavailable. Please check your connection.");
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey || apiKey.length === 0) {
        displayError("Please enter your API key first");
        return;
    }

    const prompt = getUserPrompt();
    if (!prompt || prompt.length === 0) {
        displayError("Please enter a prompt");
        return;
    }

    if (!selectedModel) {
        displayError("Please wait for models to load");
        return;
    }

    isGenerating = true;
    setLoadingState(true);

    const seed = generateRandomSeed();
    const timestamp = Math.floor(Date.now() / 1000);

    if (!currentConversation) {
        currentConversation = {
            timestamp: timestamp,
            entries: []
        };
    }

    const resolution = getResolution();
    const aspectRatio = getAspectRatio();
    /** @type {{imageSize: string, aspectRatio: string}} */
    const imageConfig = {
        imageSize: resolution,
        aspectRatio: aspectRatio
    };

    conversationHistory.push({
        role: "user",
        content: prompt
    });

    createConversation(currentConversation.timestamp).then(function() {
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
        currentConversation.entries.push(placeholderEntry);
        renderConversation(currentConversation);

        return generateImage(apiKey, prompt, selectedModel, SYSTEM_PROMPT, conversationHistory, imageConfig, seed);
    }).then(function(response) {
        if (response.choices && response.choices.length > 0) {
            const message = response.choices[0].message;
            const responseText = message.content || "Image generated";
            const images = message.images || [];

            conversationHistory.push({
                role: "assistant",
                content: responseText
            });

            return saveImagesToConversation(currentConversation.timestamp, response).then(function(imageFilenames) {
                const placeholderIndex = currentConversation.entries.length - 1;
                const entry = createConversationEntry(prompt, seed, response, imageFilenames, imageConfig);
                currentConversation.entries[placeholderIndex] = entry;

                return saveConversation(currentConversation.timestamp, currentConversation).then(function() {
                    renderConversation(currentConversation);
                    clearUserInput();

                    if (currentConversation.entries.length === 1) {
                        initializeConversationSummary(currentConversation.timestamp).then(function() {
                            updateConversationList();
                        });
                        generateConversationTitle(prompt).then(function(title) {
                            if (title && title !== "New Conversation") {
                                updateConversationSummary(currentConversation.timestamp, title).then(function(summaryData) {
                                    updateConversationListItemTitle(currentConversation.timestamp);
                                });
                            }
                        }).catch(function() {
                            console.log("Title generation failed, keeping placeholder");
                        });
                    } else {
                        updateConversationSummary(currentConversation.timestamp).then(function() {
                            updateConversationListDate(currentConversation.timestamp);
                        });
                    }

                    const generationId = response.id;
                    fetchGenerationDataWithRetry(apiKey, generationId, 5).then(function(generationData) {
                        if (generationData) {
                            entry.response.generationData = generationData;
                            saveConversation(currentConversation.timestamp, currentConversation);
                        }
                    });
                });
            });
        }
    }).catch(function(error) {
        console.error("Error generating image:", error);
        displayError(error.message);
        if (currentConversation && currentConversation.entries.length > 0) {
            const lastEntry = currentConversation.entries[currentConversation.entries.length - 1];
            if (lastEntry.response && lastEntry.response.imageFilenames &&
                lastEntry.response.imageFilenames[0] === "generating") {
                currentConversation.entries.pop();
                renderConversation(currentConversation);
            }
        }
    }).finally(function() {
        fetchBalance(apiKey).then(function(balance) {
            updateBalanceDisplay(balance);
        }).catch(function(error) {
            console.error("Error fetching balance:", error);
            updateBalanceDisplay(null, "Balance unavailable - check API key permissions");
        });

        isGenerating = false;
        setLoadingState(false);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
