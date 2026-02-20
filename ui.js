/**
 * UI manipulation functions
 * Handles all DOM updates and user interface interactions
 */

/**
 * @typedef {Object} Conversation
 * @property {number} timestamp - Epoch timestamp of conversation creation
 * @property {Array<Object>} entries - Array of conversation turns
 */

/**
 * Populates the model dropdown with available image generation models
 * @param {Array<Object>} models - Array of model objects
 */
function populateModelDropdown(models) {
    var dropdown = document.getElementById("model-dropdown");
    if (!dropdown) return;

    var menu = document.getElementById("model-menu");
    if (!menu) return;

    menu.innerHTML = "";

    if (!models || models.length === 0) {
        var emptyItem = document.createElement("a");
        emptyItem.className = "dropdown-item";
        emptyItem.textContent = "No models available";
        menu.appendChild(emptyItem);
        return;
    }

    models.forEach(function(model) {
        var item = document.createElement("a");
        item.className = "dropdown-item";
        item.href = "#";
        item.textContent = model.name;
        item.dataset.modelId = model.id;

        item.addEventListener("click", function(e) {
            e.preventDefault();
            dropdown.textContent = "";
            dropdown.textContent = model.name + " ";
            var caret = document.createElement("span");
            caret.className = "caret";
            dropdown.appendChild(caret);
            selectedModel = model.id;
            savePreference("selectedModel", model.id);
        });

        menu.appendChild(item);
    });

    var firstModel = models[0];
    dropdown.textContent = "";
    dropdown.textContent = firstModel.name + " ";
    var caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
    selectedModel = firstModel.id;
}

/**
 * Clears the model dropdown
 */
function clearModelDropdown() {
    var dropdown = document.getElementById("model-dropdown");
    if (!dropdown) return;

    var menu = document.getElementById("model-menu");
    if (!menu) return;

    menu.innerHTML = "";

    var placeholderItem = document.createElement("a");
    placeholderItem.className = "dropdown-item";
    placeholderItem.textContent = "API key required";
    menu.appendChild(placeholderItem);

    dropdown.textContent = "Select Model ";
    var caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);

    selectedModel = null;
}

/**
 * Updates the balance display
 * @param {Object|null} balance - Object with totalCredits and totalUsage, or null
 * @param {string|null} warning - Optional warning message
 */
function updateBalanceDisplay(balance, warning) {
    var balanceElement = document.getElementById("balance-display");
    if (!balanceElement) return;

    if (warning) {
        balanceElement.textContent = warning;
        balanceElement.className = "text-warning";
        return;
    }

    if (!balance) {
        balanceElement.textContent = "Enter API key to view balance";
        balanceElement.className = "text-muted";
        return;
    }

    var available = balance.totalCredits - balance.totalUsage;
    balanceElement.textContent = "$" + available.toFixed(2);
    balanceElement.className = "text-light";
}

/**
 * Toggles the left column visibility
 */
function toggleLeftColumn() {
    var leftColumn = document.getElementById("left-column");
    var rightColumn = document.getElementById("right-column");
    var toggleBtn = document.getElementById("toggle-sidebar-btn");

    if (!leftColumn || !rightColumn) return;

    if (leftColumn.classList.contains("d-none")) {
        leftColumn.classList.remove("d-none");
        leftColumn.classList.add("d-block");
        rightColumn.classList.remove("col-12");
        rightColumn.classList.add("col-8");
        if (toggleBtn) toggleBtn.innerHTML = "&#9776;";
    } else {
        leftColumn.classList.add("d-none");
        leftColumn.classList.remove("d-block");
        rightColumn.classList.remove("col-8");
        rightColumn.classList.add("col-12");
        if (toggleBtn) toggleBtn.innerHTML = "&#9776;";
    }
}

/**
 * Sets the generate button state based on input content
 * @param {boolean} enabled - Whether the button should be enabled
 */
function setGenerateButtonState(enabled) {
    var button = document.getElementById("generate-button");
    if (!button) return;

    button.disabled = !enabled;
}

/**
 * Gets the currently selected resolution
 * @returns {string} Selected resolution (1K, 2K, or 4K)
 */
function getResolution() {
    var dropdown = document.getElementById("resolution-dropdown");
    if (!dropdown) return "1K";
    return dropdown.textContent.trim();
}

/**
 * Gets the currently selected aspect ratio
 * @returns {string} Selected aspect ratio
 */
function getAspectRatio() {
    var dropdown = document.getElementById("aspect-ratio-dropdown");
    if (!dropdown) return "1:1";
    return dropdown.textContent.trim();
}

/**
 * Gets the API key from the input field
 * @returns {string} API key value
 */
function getApiKey() {
    var input = document.getElementById("api-key-input");
    if (!input) return "";
    return input.value.trim();
}

/**
 * Gets the user's prompt from the textarea
 * @returns {string} User's input prompt
 */
function getUserPrompt() {
    var textarea = document.getElementById("user-input");
    if (!textarea) return "";
    return textarea.value.trim();
}

/**
 * Displays an image response in the conversation area
 * @param {Object} response - Chat completion response
 */
function displayImageResponse(response) {
    var conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    var messageDiv = document.createElement("div");
    messageDiv.className = "assistant-message mb-3 p-3 bg-light rounded";

    var assistantLabel = document.createElement("div");
    assistantLabel.className = "text-muted small mb-1";
    assistantLabel.textContent = "Assistant";
    messageDiv.appendChild(assistantLabel);

    if (response.choices && response.choices.length > 0) {
        var message = response.choices[0].message;

        if (message.content) {
            var contentDiv = document.createElement("div");
            contentDiv.className = "mb-2";
            contentDiv.textContent = message.content;
            messageDiv.appendChild(contentDiv);
        }

        if (message.images && message.images.length > 0) {
            message.images.forEach(function(imgObj, index) {
                if (imgObj.image_url && imgObj.image_url.url) {
                    var imgElement = document.createElement("img");
                    imgElement.src = imgObj.image_url.url;
                    imgElement.className = "img-fluid mb-2";
                    imgElement.alt = "Generated image " + (index + 1);
                    imgElement.style.maxWidth = "100%";
                    imgElement.style.height = "auto";
                    messageDiv.appendChild(imgElement);
                }
            });
        }
    }

    conversationArea.appendChild(messageDiv);
    conversationArea.scrollTop = conversationArea.scrollHeight;
}

/**
 * Adds a message to the conversation history in the left column
 * @param {string} role - Role (user or assistant)
 * @param {string} content - Message content
 * @param {Array<Object>} images - Optional array of generated images
 */
function addToConversationHistory(role, content, images) {
    var historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    var messageDiv = document.createElement("div");
    messageDiv.className = "message-item mb-2 p-2 rounded";

    if (role === "user") {
        messageDiv.classList.add("bg-primary", "text-white");
    } else {
        messageDiv.classList.add("bg-light");
    }

    var roleLabel = document.createElement("div");
    roleLabel.className = "small fw-bold";
    roleLabel.textContent = role === "user" ? "You" : "Assistant";
    messageDiv.appendChild(roleLabel);

    var contentDiv = document.createElement("div");
    contentDiv.className = "small";
    contentDiv.textContent = content;
    messageDiv.appendChild(contentDiv);

    if (images && images.length > 0) {
        var imagesLabel = document.createElement("div");
        imagesLabel.className = "small text-muted mt-1";
        imagesLabel.textContent = "[Image generated]";
        messageDiv.appendChild(imagesLabel);
    }

    historyContainer.appendChild(messageDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
}

/**
 * Clears the conversation history display
 */
function clearConversationHistory() {
    var historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    historyContainer.innerHTML = "";
}

/**
 * Clears the conversation area in the right column
 */
function clearConversationArea() {
    var conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;
    conversationArea.innerHTML = "";
}

/**
 * Clears the user input textarea
 */
function clearUserInput() {
    var textarea = document.getElementById("user-input");
    if (!textarea) return;
    textarea.value = "";
    setGenerateButtonState(false);
}

/**
 * Displays an error message in the conversation area
 * @param {string} errorMessage - Error message to display
 */
function displayError(errorMessage) {
    var conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    var errorDiv = document.createElement("div");
    errorDiv.className = "alert alert-danger mb-3";
    errorDiv.textContent = "Error: " + errorMessage;

    conversationArea.appendChild(errorDiv);
    conversationArea.scrollTop = conversationArea.scrollHeight;
}

/**
 * Sets the loading state of the UI
 * @param {boolean} isLoading - Whether the UI is in loading state
 */
function setLoadingState(isLoading) {
    var generateButton = document.getElementById("generate-button");
    var userInput = document.getElementById("user-input");
    var apiKeyInput = document.getElementById("api-key-input");
    var modelDropdown = document.getElementById("model-dropdown");
    var resolutionDropdown = document.getElementById("resolution-dropdown");
    var aspectRatioDropdown = document.getElementById("aspect-ratio-dropdown");

    if (generateButton) {
        generateButton.disabled = isLoading;
        generateButton.textContent = isLoading ? "Generating..." : "Generate";
    }

    if (userInput) {
        userInput.disabled = isLoading;
    }

    if (apiKeyInput) {
        apiKeyInput.disabled = isLoading;
    }

    if (modelDropdown) {
        modelDropdown.parentElement.classList.toggle("disabled", isLoading);
    }

    if (resolutionDropdown) {
        resolutionDropdown.parentElement.classList.toggle("disabled", isLoading);
    }

    if (aspectRatioDropdown) {
        aspectRatioDropdown.parentElement.classList.toggle("disabled", isLoading);
    }
}

/**
 * Programmatically sets the resolution dropdown value
 * @param {string} resolution - Resolution value (1K, 2K, 4K)
 */
function setResolution(resolution) {
    var dropdown = document.getElementById("resolution-dropdown");
    if (!dropdown) return;
    dropdown.textContent = "";
    dropdown.textContent = resolution + " ";
    var caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
}

/**
 * Programmatically sets the aspect ratio dropdown value
 * @param {string} aspectRatio - Aspect ratio value (1:1, 16:9, 3:2, 21:9)
 */
function setAspectRatio(aspectRatio) {
    var dropdown = document.getElementById("aspect-ratio-dropdown");
    if (!dropdown) return;
    dropdown.textContent = "";
    dropdown.textContent = aspectRatio + " ";
    var caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
}

/**
 * Programmatically selects a model by ID from the dropdown
 * @param {string} modelId - Model ID to select
 * @param {Array<Object>} models - Available models
 * @returns {boolean} true if model found and selected
 */
function selectModelById(modelId, models) {
    var dropdown = document.getElementById("model-dropdown");
    var menu = document.getElementById("model-menu");
    if (!dropdown || !menu) return false;

    var foundModel = models.find(function(model) {
        return model.id === modelId;
    });

    if (!foundModel) return false;

    dropdown.textContent = "";
    dropdown.textContent = foundModel.name + " ";
    var caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
    selectedModel = modelId;
    return true;
}

/**
 * Displays a warning message in the conversation area
 * @param {string} message - Warning message to display
 */
function displayWarning(message) {
    var warningDisplay = document.getElementById("warning-display");
    if (!warningDisplay) return;

    warningDisplay.style.display = "block";
    warningDisplay.className = "alert alert-warning mb-3";
    warningDisplay.textContent = message;

    var conversationArea = document.getElementById("conversation-area");
    if (conversationArea) {
        if (conversationArea.children.length > 0) {
            conversationArea.insertBefore(warningDisplay, conversationArea.firstChild);
        } else {
            conversationArea.appendChild(warningDisplay);
        }
    }
}

/**
 * Renders a complete conversation in the conversation area
 * @param {Conversation} conversation - Conversation object with entries
 * @returns {void}
 */
function renderConversation(conversation) {
    var conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    conversationArea.innerHTML = "";

    if (!conversation || !conversation.entries) return;

    conversation.entries.forEach(function(entry) {
        var userDiv = document.createElement("div");
        userDiv.className = "user-message mb-3 p-3 bg-primary text-white rounded";
        userDiv.textContent = entry.message.text;
        conversationArea.appendChild(userDiv);

        var assistantDiv = document.createElement("div");
        assistantDiv.className = "assistant-message mb-3 p-3 bg-light rounded";

        var assistantLabel = document.createElement("div");
        assistantLabel.className = "text-muted small mb-1";
        assistantLabel.textContent = "Assistant";
        assistantDiv.appendChild(assistantLabel);

        if (entry.response.text) {
            var contentDiv = document.createElement("div");
            contentDiv.className = "mb-2";
            contentDiv.textContent = entry.response.text;
            assistantDiv.appendChild(contentDiv);
        }

        if (entry.response.imageFilenames && entry.response.imageFilenames.length > 0) {
            entry.response.imageFilenames.forEach(function(filename, index) {
                var imageIndex = parseInt(filename, 10);
                getImage(conversation.timestamp, imageIndex).then(function(blob) {
                    if (!blob) return;
                    var imgElement = document.createElement("img");
                    var objectUrl = URL.createObjectURL(blob);
                    imgElement.onload = function() {
                        URL.revokeObjectURL(objectUrl);
                    };
                    imgElement.src = objectUrl;
                    imgElement.className = "img-fluid mb-2";
                    imgElement.alt = "Generated image " + (index + 1);
                    imgElement.style.maxWidth = "100%";
                    imgElement.style.height = "auto";
                    assistantDiv.appendChild(imgElement);
                });
            });
        }

        conversationArea.appendChild(assistantDiv);
    });

    conversationArea.scrollTop = conversationArea.scrollHeight;
}
