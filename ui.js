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
 * Populates the conversation list in the left sidebar with saved conversations
 * @param {Array<number>} timestamps - Array of conversation timestamps
 * @returns {Promise<void>}
 */
async function populateConversationList(timestamps) {
    var historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    clearConversationHistory();

    if (!timestamps || timestamps.length === 0) {
        var emptyDiv = document.createElement("div");
        emptyDiv.className = "small text-muted";
        emptyDiv.textContent = "No saved conversations";
        historyContainer.appendChild(emptyDiv);
        return;
    }

    for (var i = 0; i < timestamps.length; i++) {
        var timestamp = timestamps[i];
        var conversation = await loadConversation(timestamp);
        if (conversation && conversation.entries && conversation.entries.length > 0) {
            createConversationItem(timestamp, conversation);
        }
    }
}

/**
 * Creates a conversation item in the sidebar from template
 * @param {number} timestamp - Conversation timestamp
 * @param {Conversation} conversation - Conversation object
 * @returns {void}
 */
function createConversationItem(timestamp, conversation) {
    var historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    var template = document.getElementById("conversation-item-template");
    if (!template) return;

    var clone = template.content.cloneNode(true);
    var item = clone.querySelector(".conversation-item");

    item.dataset.timestamp = timestamp;
    
    var date = new Date(timestamp * 1000);
    var dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
    
    loadSummary(timestamp).then(function(summary) {
        var title = summary && summary.title ? summary.title : "New Conversation";
        clone.querySelector(".conversation-date").textContent = title;
        clone.querySelector(".conversation-preview").textContent = dateStr + " (" + conversation.entries.length + " messages)";
        
        if (summary && title !== "New Conversation" && title && title.trim().length > 0) {
            return;
        }
        
        if (conversation.entries && conversation.entries.length > 0) {
            var firstPrompt = conversation.entries[0].message.text;
            if (firstPrompt) {
                generateConversationTitle(firstPrompt).then(function(newTitle) {
                    if (newTitle && newTitle.trim().length > 0) {
                        updateConversationSummary(timestamp, newTitle).then(function(summaryData) {
                            updateConversationListItemTitle(timestamp, summaryData.title);
                        }).catch(function(e) {
                            console.error("Error saving new title:", e);
                        });
                    }
                }).catch(function(e) {
                    console.error("Error generating title for existing conversation:", e);
                });
            }
        }
    }).catch(function() {
        clone.querySelector(".conversation-date").textContent = "New Conversation";
        clone.querySelector(".conversation-preview").textContent = dateStr + " (" + conversation.entries.length + " messages)";
    });

    item.addEventListener("click", function() {
        loadConversationIntoView(timestamp);
    });

    historyContainer.appendChild(clone);
}

/**
 * Loads a conversation into the main view
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<void>}
 */
async function loadConversationIntoView(timestamp) {
    var conversation = await loadConversation(timestamp);
    if (!conversation) return;

    currentConversation = conversation;
    conversationHistory = [];

    if (conversation.entries) {
        conversation.entries.forEach(function(entry) {
            conversationHistory.push({
                role: "user",
                content: entry.message.text
            });

            if (entry.response.text) {
                conversationHistory.push({
                    role: "assistant",
                    content: entry.response.text
                });
            }
        });
    }

    clearConversationArea();
    renderConversation(conversation);

    var historyContainer = document.getElementById("conversation-history");
    if (historyContainer) {
        var items = historyContainer.querySelectorAll(".conversation-item");
        items.forEach(function(item) {
            item.classList.remove("selected");
            if (parseInt(item.dataset.timestamp, 10) === timestamp) {
                item.classList.add("selected");
            }
        });
    }
}

/**
 * Starts a new conversation by clearing current view for clean slate
 * @returns {Promise<void>}
 */
async function handleNewConversation() {
    currentConversation = null;
    conversationHistory = [];
    clearConversationArea();
    clearUserInput();

    var historyContainer = document.getElementById("conversation-history");
    if (historyContainer) {
        var selectedItems = historyContainer.querySelectorAll(".selected");
        selectedItems.forEach(function(item) {
            item.classList.remove("selected");
        });
    }
}

/**
 * Initializes Bootstrap tooltips for all elements with data-bs-toggle="tooltip"
 * @returns {void}
 */
function initTooltips() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll("[data-bs-toggle=\"tooltip\"]"));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Initializes a Bootstrap tooltip for a single element
 * @param {HTMLElement} element - Element to initialize tooltip for
 * @returns {void}
 */
function initTooltipForElement(element) {
    if (element && element.getAttribute("data-bs-toggle") === "tooltip") {
        new bootstrap.Tooltip(element);
    }
}

/**
 * Updates the conversation list after adding a new entry
 * @returns {Promise<void>}
 */
async function updateConversationList() {
    var timestamps = await listConversations();
    await populateConversationList(timestamps);
}

/**
 * Updates a single conversation list item's title without full refresh
 * @param {number} timestamp - Conversation timestamp
 * @param {string} newTitle - New title to display
 * @returns {void}
 */
function updateConversationListItemTitle(timestamp, newTitle) {
    var historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    
    var item = historyContainer.querySelector('.conversation-item[data-timestamp="' + timestamp + '"]');
    if (item) {
        var dateElement = item.querySelector(".conversation-date");
        if (dateElement) {
            dateElement.textContent = newTitle;
        }
    }
}

/**
 * Updates the date/message count preview for a conversation item
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<void>}
 */
async function updateConversationListDate(timestamp) {
    var conversation = await loadConversation(timestamp);
    if (!conversation) return;
    
    var historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    
    var item = historyContainer.querySelector('.conversation-item[data-timestamp="' + timestamp + '"]');
    if (item) {
        var previewElement = item.querySelector(".conversation-preview");
        if (previewElement) {
            previewElement.textContent = conversation.entries.length + " messages";
        }
    }
}

/**
 * Renders a single conversation entry using the template
 * @param {Object} entry - Conversation entry to render
 * @param {number} index - Entry index in conversation
 * @param {number} conversationTimestamp - Conversation timestamp for image loading
 * @returns {void}
 */
function renderMessageEntry(entry, index, conversationTimestamp) {
    var conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    var template = document.getElementById("message-entry-template");
    if (!template) return;

    var clone = template.content.cloneNode(true);
    var messageEntry = clone.querySelector(".message-entry");

    clone.querySelector(".user-prompt-text").textContent = entry.message.text;

    var imagesContainer = clone.querySelector(".images-container");
    if (entry.response.imageFilenames && entry.response.imageFilenames.length > 0) {
        entry.response.imageFilenames.forEach(function(filename, imgIndex) {
            var resolution = entry.response.imageResolutions ? entry.response.imageResolutions[imgIndex] : "1K";
            getImage(conversationTimestamp, parseInt(filename, 10)).then(function(blob) {
                if (!blob) return;
                
                var template = document.getElementById("image-entry-template");
                var imgTemplate = template.content.cloneNode(true);
                var imgItemContainer = imgTemplate.querySelector(".image-item-container");
                var imgWrapper = imgTemplate.querySelector(".image-wrapper");
                var imgElement = imgTemplate.querySelector(".generated-image");
                
                var objectUrl = URL.createObjectURL(blob);
                imgElement.onload = function() {
                    URL.revokeObjectURL(objectUrl);
                    imgWrapper.style.width = imgElement.width + "px";
                    imgWrapper.style.height = imgElement.height + "px";
                };
                imgElement.src = objectUrl;
                imgElement.style.maxWidth = "100%";
                imgElement.style.height = "auto";
                imgElement.dataset.conversationTimestamp = conversationTimestamp;
                imgElement.dataset.entryIndex = index;
                imgElement.dataset.imageIndex = imgIndex;
                
                var downloadBtn = imgTemplate.querySelector(".download-btn");
                downloadBtn.className = "btn btn-sm btn-outline-light";
                downloadBtn.dataset.conversationTimestamp = conversationTimestamp;
                downloadBtn.dataset.entryIndex = index;
                downloadBtn.dataset.imageIndex = imgIndex;
                downloadBtn.dataset.filename = filename;
                downloadBtn.addEventListener("click", function(e) {
                    var ts = parseInt(conversationTimestamp, 10);
                    var fn = filename;
                    getImage(ts, parseInt(fn, 10)).then(function(imgBlob) {
                        if (!imgBlob) return;
                        var url = URL.createObjectURL(imgBlob);
                        var a = document.createElement("a");
                        a.href = url;
                        a.download = "image_" + ts + "_" + fn + ".png";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(function() {
                            URL.revokeObjectURL(url);
                        }, 100);
                    });
                });
                initTooltipForElement(downloadBtn);
                
                var regenerateNewBtn = imgTemplate.querySelector(".regenerate-new-btn");
                regenerateNewBtn.className = "btn btn-sm btn-outline-light";
                regenerateNewBtn.dataset.entryIndex = index;
                regenerateNewBtn.dataset.imageIndex = imgIndex;
                regenerateNewBtn.addEventListener("click", function() {
                    handleRegenerateWithNewSeed(index, imgIndex);
                });
                initTooltipForElement(regenerateNewBtn);
                
                var regenerateLargerBtn = imgTemplate.querySelector(".regenerate-larger-btn");
                regenerateLargerBtn.className = "btn btn-sm btn-outline-light";
                regenerateLargerBtn.disabled = (resolution === "4K");
                regenerateLargerBtn.dataset.entryIndex = index;
                regenerateLargerBtn.dataset.imageIndex = imgIndex;
                regenerateLargerBtn.addEventListener("click", function() {
                    handleRegenerateLarger(index, imgIndex);
                });
                initTooltipForElement(regenerateLargerBtn);
                
                imagesContainer.appendChild(imgItemContainer);
            });
        });
    }

    var llmTextBtn = clone.querySelector(".toggle-llm-text");
    var llmTextContent = clone.querySelector(".llm-text-content");
    var expandIcon = clone.querySelector(".expand-icon");
    var collapseIcon = clone.querySelector(".collapse-icon");
    var btnText = clone.querySelector(".btn-text");
    var copyLlmBtn = clone.querySelector(".copy-llm-btn");
    
    initTooltipForElement(llmTextBtn);
    initTooltipForElement(copyLlmBtn);
    
    if (entry.response.text) {
        clone.querySelector(".llm-text-body").textContent = entry.response.text;
        
        llmTextBtn.addEventListener("click", function() {
            if (llmTextContent.classList.contains("collapsed")) {
                llmTextContent.classList.remove("collapsed");
                expandIcon.style.display = "none";
                collapseIcon.style.display = "inline";
                btnText.textContent = " Hide Response";
            } else {
                llmTextContent.classList.add("collapsed");
                expandIcon.style.display = "inline";
                collapseIcon.style.display = "none";
                btnText.textContent = " Show Response";
            }
        });

        copyLlmBtn.addEventListener("click", function() {
            navigator.clipboard.writeText(entry.response.text).then(function() {
                var originalHtml = copyLlmBtn.innerHTML;
                copyLlmBtn.innerHTML = "<span>Copied!</span>";
                setTimeout(function() {
                    copyLlmBtn.innerHTML = originalHtml;
                }, 1500);
            });
        });
    } else {
        llmTextBtn.style.display = "none";
    }

    var copyToTextareaBtn = clone.querySelector(".copy-to-textarea-btn");
    copyToTextareaBtn.addEventListener("click", function() {
        var userInput = document.getElementById("user-input");
        if (userInput) {
            userInput.value = entry.message.text;
            userInput.focus();
        }
    });
    initTooltipForElement(copyToTextareaBtn);

    conversationArea.appendChild(messageEntry);
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
 * Regenerates image with a new random seed
 * @param {number} entryIndex - Index of the entry in conversation
 * @param {number} imageIndex - Index of the image within the entry
 * @returns {Promise<void>}
 */
async function handleRegenerateWithNewSeed(entryIndex, imageIndex) {
    if (!currentConversation || !currentConversation.entries[entryIndex]) return;
    var entry = currentConversation.entries[entryIndex];
    
    var apiKey = getApiKey();
    if (!apiKey) return;

    var aspectRatio = getAspectRatio();
    var resolution = entry.response.imageResolutions ? entry.response.imageResolutions[imageIndex] : "1K";
    
    var imageConfig = {
        imageSize: resolution,
        aspectRatio: aspectRatio
    };
    
    var newSeed = generateRandomSeed();
    var prompt = entry.message.text;
    
    setLoadingState(true);
    
    generateImage(apiKey, prompt, selectedModel, SYSTEM_PROMPT, conversationHistory, imageConfig, newSeed)
        .then(function(response) {
            var urls = extractImageUrls(response);
            if (urls.length === 0) return Promise.resolve();
            
            return saveImage(currentConversation.timestamp, urls[0]).then(function(newIndex) {
                if (newIndex !== null) {
                    entry.response.imageFilenames.push(String(newIndex));
                    entry.response.imageResolutions.push(resolution);
                    saveConversation(currentConversation.timestamp, currentConversation);
                    renderConversation(currentConversation);
                }
            });
        })
        .catch(function(error) {
            console.error("Error regenerating image:", error);
            displayError(error.message);
        })
        .finally(function() {
            setLoadingState(false);
        });
}

/**
 * Handles regenerate larger image with 4K resolution
 * @param {number} entryIndex - Index of the entry in conversation
 * @param {number} imageIndex - Index of the image within the entry
 * @returns {Promise<void>}
 */
async function handleRegenerateLarger(entryIndex, imageIndex) {
    if (!currentConversation || !currentConversation.entries[entryIndex]) return;
    var entry = currentConversation.entries[entryIndex];
    if (entry.response.imageResolutions[imageIndex] === "4K") return;

    var apiKey = getApiKey();
    if (!apiKey) return;
    
    var aspectRatio = getAspectRatio();

    var imageConfig = {
        imageSize: "4K",
        aspectRatio: aspectRatio
    };

    var seed = entry.message.seed;
    var prompt = entry.message.text;

    setLoadingState(true);

    generateImage(apiKey, prompt, selectedModel, SYSTEM_PROMPT, conversationHistory, imageConfig, seed)
        .then(function(response) {
            var urls = extractImageUrls(response);
            if (urls.length === 0) return Promise.resolve();

            return saveImage(currentConversation.timestamp, urls[0]).then(function(newIndex) {
                if (newIndex !== null) {
                    entry.response.imageFilenames.push(String(newIndex));
                    entry.response.imageResolutions.push("4K");
                    saveConversation(currentConversation.timestamp, currentConversation);
                    renderConversation(currentConversation);
                }
            });
        })
        .catch(function(error) {
            console.error("Error regenerating image:", error);
            displayError(error.message);
        })
        .finally(function() {
            setLoadingState(false);
        });
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

    conversation.entries.forEach(function(entry, index) {
        renderMessageEntry(entry, index, conversation.timestamp);
    });

    conversationArea.scrollTop = conversationArea.scrollHeight;
}
