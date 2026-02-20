/**
 * Agent - Main entry point and orchestration
 * Handles initialization and user interaction flow
 */

/** @type {string | null} */
var selectedModel = null;

/** @type {Array<{role: string, content: string}>} */
var conversationHistory = [];

/** @type {boolean} */
var isGenerating = false;

/** @type {any} */
var deferredPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    var installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.style.display = 'inline-block';
    }
});

window.addEventListener('appinstalled', function() {
    var installBtn = document.getElementById('install-btn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
    deferredPrompt = null;
});

var installBtn = document.getElementById('install-btn');
if (installBtn) {
    installBtn.addEventListener('click', function() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted install');
                }
                deferredPrompt = null;
                var btn = document.getElementById('install-btn');
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
    
    if (!navigator.onLine) {
        displayWarning('Network unavailable. Some features may not work offline.');
    }
}

/**
 * Sets up all event listeners for the application
 */
function setupEventListeners() {
    var apiKeyForm = document.querySelector("#api-key-input").closest("form");
    if (apiKeyForm) {
        apiKeyForm.addEventListener("submit", function(e) {
            e.preventDefault();
            handleApiKeyEntry();
        });
    }

    var apiKeyInput = document.getElementById("api-key-input");
    if (apiKeyInput) {
        apiKeyInput.addEventListener("blur", handleApiKeyEntry);
        apiKeyInput.addEventListener("keyup", function(e) {
            if (e.key === "Enter") {
                handleApiKeyEntry();
            }
        });
    }

    var toggleBtn = document.getElementById("toggle-sidebar-btn");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", function(e) {
            e.preventDefault();
            toggleLeftColumn();
        });
    }

    var userInput = document.getElementById("user-input");
    if (userInput) {
        userInput.addEventListener("input", function() {
            var hasContent = this.value.trim().length > 0;
            setGenerateButtonState(hasContent);
        });
    }

    var generateButton = document.getElementById("generate-button");
    if (generateButton) {
        generateButton.addEventListener("click", handleGenerate);
    }

    setupDropdownEventListeners();
}

/**
 * Sets up event listeners for dropdown menus (resolution and aspect ratio)
 */
function setupDropdownEventListeners() {
    var resolutionItems = document.querySelectorAll("#resolution-menu .dropdown-item");
    resolutionItems.forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            var dropdown = document.getElementById("resolution-dropdown");
            if (dropdown) {
                dropdown.textContent = "";
                dropdown.textContent = this.textContent + " ";
                var caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
                savePreference("defaultResolution", this.textContent.trim());
            }
        });
    });

    var aspectRatioItems = document.querySelectorAll("#aspect-ratio-menu .dropdown-item");
    aspectRatioItems.forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            var dropdown = document.getElementById("aspect-ratio-dropdown");
            if (dropdown) {
                dropdown.textContent = "";
                dropdown.textContent = this.textContent + " ";
                var caret = document.createElement("span");
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
    var apiKey = await getPreference("apiKey");

    if (apiKey && apiKey.length > 0) {
        var apiKeyInput = document.getElementById("api-key-input");
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
    var apiKey = getApiKey();

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
                    var found = selectModelById(savedModelId, models);
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
 * Handles the generate button click - initiates image generation
 */
function handleGenerate() {
    if (isGenerating) return;

    if (!isOnline()) {
        displayError('Network unavailable. Please check your connection.');
        return;
    }

    var apiKey = getApiKey();
    if (!apiKey || apiKey.length === 0) {
        displayError("Please enter your API key first");
        return;
    }

    var prompt = getUserPrompt();
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

    var resolution = getResolution();
    var aspectRatio = getAspectRatio();
    /** @type {{imageSize: string, aspectRatio: string}} */
    var imageConfig = {
        imageSize: resolution,
        aspectRatio: aspectRatio
    };

    conversationHistory.push({
        role: "user",
        content: prompt
    });

    addToConversationHistory("user", prompt);

    generateImage(apiKey, prompt, selectedModel, SYSTEM_PROMPT, conversationHistory, imageConfig)
        .then(function(response) {
            if (response.choices && response.choices.length > 0) {
                var message = response.choices[0].message;
                var responseText = message.content || "Image generated";
                var images = message.images || [];

                conversationHistory.push({
                    role: "assistant",
                    content: responseText
                });

                addToConversationHistory("assistant", responseText, images);
                displayImageResponse(response);
                clearUserInput();
            }
        })
        .catch(function(error) {
            console.error("Error generating image:", error);
            displayError(error.message);
        })
        .finally(function() {
            fetchBalance(apiKey)
                .then(function(balance) {
                    updateBalanceDisplay(balance);
                })
                .catch(function(error) {
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
