/**
 * Agent - Main entry point and orchestration
 * Handles initialization and user interaction flow
 */

var selectedModel = null;
var conversationHistory = [];
var isGenerating = false;

/**
 * Initializes the application
 * Sets up event listeners but does not fetch data until API key is provided
 */
function init() {
    setupEventListeners();
    initializeDropdowns();
}

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

function setupDropdownEventListeners() {
    var resolutionItems = document.querySelectorAll("#resolution-menu .dropdown-item");
    resolutionItems.forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            var dropdown = document.getElementById("resolution-dropdown");
            if (dropdown) {
                dropdown.textContent = this.textContent + " ";
                var caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
            }
        });
    });

    var aspectRatioItems = document.querySelectorAll("#aspect-ratio-menu .dropdown-item");
    aspectRatioItems.forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            var dropdown = document.getElementById("aspect-ratio-dropdown");
            if (dropdown) {
                dropdown.textContent = this.textContent + " ";
                var caret = document.createElement("span");
                caret.className = "caret";
                dropdown.appendChild(caret);
            }
        });
    });
}

function initializeDropdowns() {
    clearModelDropdown();
    updateBalanceDisplay(null);
}

function handleApiKeyEntry() {
    var apiKey = getApiKey();

    if (apiKey && apiKey.length > 0) {
        fetchModels(apiKey).then(function(models) {
            populateModelDropdown(models);
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
        clearModelDropdown();
        updateBalanceDisplay(null);
    }
}

function handleGenerate() {
    if (isGenerating) return;

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
