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
    const dropdown = document.getElementById("model-dropdown");
    if (!dropdown) return;

    const menu = document.getElementById("model-menu");
    if (!menu) return;

    menu.innerHTML = "";

    if (!models || models.length === 0) {
        const emptyItem = document.createElement("a");
        emptyItem.className = "dropdown-item";
        emptyItem.textContent = "No models available";
        menu.appendChild(emptyItem);
        return;
    }

    models.forEach(function(model) {
        const item = document.createElement("a");
        item.className = "dropdown-item";
        item.href = "#";
        item.textContent = model.name;
        item.dataset.modelId = model.id;

        item.addEventListener("click", function(e) {
            e.preventDefault();
            dropdown.textContent = "";
            dropdown.textContent = model.name + " ";
            const caret = document.createElement("span");
            caret.className = "caret";
            dropdown.appendChild(caret);
            selectedModel = model.id;
            savePreference("selectedModel", model.id);
        });

        menu.appendChild(item);
    });

    const firstModel = models[0];
    dropdown.textContent = "";
    dropdown.textContent = firstModel.name + " ";
    const caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
    selectedModel = firstModel.id;
}

/**
 * Clears the model dropdown
 */
function clearModelDropdown() {
    const dropdown = document.getElementById("model-dropdown");
    if (!dropdown) return;

    const menu = document.getElementById("model-menu");
    if (!menu) return;

    menu.innerHTML = "";

    const placeholderItem = document.createElement("a");
    placeholderItem.className = "dropdown-item";
    placeholderItem.textContent = "API key required";
    menu.appendChild(placeholderItem);

    dropdown.textContent = "Select Model ";
    const caret = document.createElement("span");
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
    const balanceElement = document.getElementById("balance-display");
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

    const available = balance.totalCredits - balance.totalUsage;
    balanceElement.textContent = "$" + available.toFixed(2);
    balanceElement.className = "text-light";
}

/**
 * Toggles the left column visibility
 */
function toggleLeftColumn() {
    const leftColumn = document.getElementById("left-column");
    const rightColumn = document.getElementById("right-column");
    const toggleBtn = document.getElementById("toggle-sidebar-btn");

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
    const button = document.getElementById("generate-button");
    if (!button) return;

    button.disabled = !enabled;
}

function getResolution() {
    const dropdown = document.getElementById("resolution-dropdown");
    if (!dropdown) return "1K";
    return dropdown.textContent.trim();
}

function getAspectRatio() {
    const dropdown = document.getElementById("aspect-ratio-dropdown");
    if (!dropdown) return "1:1";
    return dropdown.textContent.trim();
}

function getUserPrompt() {
    const textarea = document.getElementById("user-input");
    if (!textarea) return "";
    return textarea.value.trim();
}

function clearConversationHistory() {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    historyContainer.innerHTML = "";
}

/**
 * Gets the currently selected resolution
 * @returns {string} Selected resolution (1K, 2K, or 4K)
 */
function getResolution() {
    const dropdown = document.getElementById("resolution-dropdown");
    if (!dropdown) return "1K";
    return dropdown.textContent.trim();
}

/**
 * Gets the currently selected aspect ratio
 * @returns {string} Selected aspect ratio
 */
function getAspectRatio() {
    const dropdown = document.getElementById("aspect-ratio-dropdown");
    if (!dropdown) return "1:1";
    return dropdown.textContent.trim();
}

/**
 * Gets the user's prompt from the textarea
 * @returns {string} User's input prompt
 */
function getUserPrompt() {
    const textarea = document.getElementById("user-input");
    if (!textarea) return "";
    return textarea.value.trim();
}

/**
 * Clears the conversation history display
 */
function clearConversationHistory() {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    historyContainer.innerHTML = "";
}

/**
 * Populates the conversation list in the left sidebar with saved conversations
 * @param {Array<number>} timestamps - Array of conversation timestamps
 * @returns {Promise<void>}
 */
async function populateConversationList(timestamps) {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    clearConversationHistory();

    if (!timestamps || timestamps.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "small text-muted";
        emptyDiv.textContent = "No saved conversations";
        historyContainer.appendChild(emptyDiv);
        return;
    }

    for (let i = 0; i < timestamps.length; i++) {
        const timestamp = timestamps[i];
        const conversation = await loadConversation(timestamp);
        if (conversation && conversation.entries && conversation.entries.length > 0) {
            createConversationItem(timestamp, conversation);
        }
    }
}

/**
 * Sets the UI text for a conversation item in the sidebar
 * @param {DocumentFragment} clone - Cloned template node
 * @param {ConversationSummary} summary - Summary data object
 * @param {number} timestamp - Conversation timestamp
 * @param {Conversation} conversation - Conversation object
 * @returns {void}
 */
function setConversationItemUI(clone, summary, timestamp, conversation) {
    const dateElement = clone.querySelector("#conversation-date");
    const previewElement = clone.querySelector("#conversation-preview");
    if (!dateElement || !previewElement) return;

    const title = (summary && summary.title && summary.title.trim().length > 0) ? summary.title : "New Conversation";
    dateElement.textContent = title;

    const date = new Date(timestamp * 1000);
    const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});

    const messageCount = conversation && conversation.entries ? conversation.entries.length : 0;
    const messageText = messageCount === 1 ? "message" : "messages";
    previewElement.textContent = dateStr + " (" + messageCount + " " + messageText + ")";
}

/**
 * Creates a conversation item in the sidebar from template
 * @param {number} timestamp - Conversation timestamp
 * @param {Conversation} conversation - Conversation object
 * @returns {void}
 */
function createConversationItem(timestamp, conversation) {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    const template = document.getElementById("conversation-item-template");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const item = clone.querySelector(".conversation-item");

    item.dataset.timestamp = timestamp;

    const date = new Date(timestamp * 1000);
    const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"});
    const messageCount = conversation && conversation.entries ? conversation.entries.length : 0;

    /** @type {ConversationSummary} */
    const defaultSummary = { title: "New Conversation", imageCount: 0, entryCount: 0, created: timestamp, updated: timestamp };

    loadSummary(timestamp).then(function(summary) {
        /** @type {ConversationSummary} */
        const summaryTyped = summary || defaultSummary;

        setConversationItemUI(clone, summaryTyped, timestamp, conversation);

        const title = (summaryTyped && summaryTyped.title && summaryTyped.title.trim().length > 0) ? summaryTyped.title : "New Conversation";
        if (title === "New Conversation" && conversation.entries && conversation.entries.length > 0) {
            const firstPrompt = conversation.entries[0].message.text;
            if (firstPrompt) {
                generateConversationTitle(firstPrompt).then(function(newTitle) {
                    if (newTitle && newTitle.trim().length > 0) {
                        updateConversationSummary(timestamp, newTitle).then(function(summaryData) {
                            setConversationItemUI(clone, summaryData, timestamp, conversation);
                        }).catch(function(e) {
                            console.error("Error saving new title for conversation", timestamp, ":", e);
                        });
                    }
                }).catch(function(e) {
                    console.error("Error generating title for conversation", timestamp, ":", e);
                });
            }
        }
    }).catch(function(e) {
        console.error("Failed to load summary for conversation", timestamp, e);
        setConversationItemUI(clone, defaultSummary, timestamp, conversation);
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
    const conversation = await loadConversation(timestamp);
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

    const historyContainer = document.getElementById("conversation-history");
    if (historyContainer) {
        const items = historyContainer.querySelectorAll(".conversation-item");
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

    const historyContainer = document.getElementById("conversation-history");
    if (historyContainer) {
        const selectedItems = historyContainer.querySelectorAll(".selected");
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
    const tooltipTriggerList = [].slice.call(document.querySelectorAll("[data-bs-toggle=\"tooltip\"]"));
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
    const timestamps = await listConversations();
    await populateConversationList(timestamps);
}

/**
 * Updates a single conversation list item's title without full refresh
 * @param {number} timestamp - Conversation timestamp
 * @param {string} newTitle - New title to display
 * @returns {Promise<void>}
 */
async function updateConversationListItemTitle(timestamp) {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    const item = historyContainer.querySelector('.conversation-item[data-timestamp="' + timestamp + '"]');
    if (!item) return;

    const conversation = await loadConversation(timestamp);
    if (!conversation) return;

    let summary = await loadSummary(timestamp);
    if (!summary) {
        summary = { title: "New Conversation", imageCount: 0, entryCount: 0, created: timestamp, updated: timestamp };
    }

    const template = document.getElementById("conversation-item-template");
    if (!template) return;
    const tempClone = template.content.cloneNode(true);
    setConversationItemUI(tempClone, summary, timestamp, conversation);

    const dateElement = item.querySelector("#conversation-date");
    const previewElement = item.querySelector("#conversation-preview");
    const tempDateElement = tempClone.querySelector("#conversation-date");
    const tempPreviewElement = tempClone.querySelector("#conversation-preview");

    if (dateElement && tempDateElement) {
        dateElement.textContent = tempDateElement.textContent;
    }
    if (previewElement && tempPreviewElement) {
        previewElement.textContent = tempPreviewElement.textContent;
    }
}

/**
 * Updates the date/message count preview for a conversation item
 * @param {number} timestamp - Conversation timestamp
 * @returns {Promise<void>}
 */
async function updateConversationListDate(timestamp) {
    const conversation = await loadConversation(timestamp);
    if (!conversation) return;
    
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    
    const item = historyContainer.querySelector('.conversation-item[data-timestamp="' + timestamp + '"]');
    if (item) {
        const previewElement = item.querySelector(".conversation-preview");
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
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    const template = document.getElementById("message-entry-template");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const messageEntry = clone.querySelector(".message-entry");

    clone.querySelector(".user-prompt-text").textContent = entry.message.text;

    const imagesContainer = clone.querySelector(".images-container");
    if (entry.response.imageFilenames && entry.response.imageFilenames.length > 0) {
        if (entry.response.imageFilenames[0] === "generating") {
            const spinnerTemplate = document.getElementById("image-loading-template");
            const spinnerClone = spinnerTemplate.content.cloneNode(true);
            imagesContainer.appendChild(spinnerClone);
        } else {
            entry.response.imageFilenames.forEach(function(filename, imgIndex) {
                const resolution = entry.response.imageResolutions ? entry.response.imageResolutions[imgIndex] : "1K";
                getImage(conversationTimestamp, parseInt(filename, 10)).then(function(blob) {
                    if (!blob) return;
                    
                    const template = document.getElementById("image-entry-template");
                    const imgTemplate = template.content.cloneNode(true);
                    const imgItemContainer = imgTemplate.querySelector(".image-item-container");
                    const imgWrapper = imgTemplate.querySelector(".image-wrapper");
                    const imgElement = imgTemplate.querySelector(".generated-image");
                    
                    const objectUrl = URL.createObjectURL(blob);
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
                    
                    const downloadBtn = imgTemplate.querySelector(".download-btn");
                    downloadBtn.className = "btn btn-sm btn-outline-light";
                    downloadBtn.dataset.conversationTimestamp = conversationTimestamp;
                    downloadBtn.dataset.entryIndex = index;
                    downloadBtn.dataset.imageIndex = imgIndex;
                    downloadBtn.dataset.filename = filename;
                    downloadBtn.addEventListener("click", function(e) {
                        const ts = parseInt(conversationTimestamp, 10);
                        const fn = filename;
                        getImage(ts, parseInt(fn, 10)).then(function(imgBlob) {
                            if (!imgBlob) return;
                            const url = URL.createObjectURL(imgBlob);
                            const a = document.createElement("a");
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
                    
                    const regenerateNewBtn = imgTemplate.querySelector(".regenerate-new-btn");
                    regenerateNewBtn.className = "btn btn-sm btn-outline-light";
                    regenerateNewBtn.dataset.entryIndex = index;
                    regenerateNewBtn.dataset.imageIndex = imgIndex;
                    regenerateNewBtn.addEventListener("click", function() {
                        handleRegenerateWithNewSeed(index, imgIndex);
                    });
                    initTooltipForElement(regenerateNewBtn);
                    
                    const regenerateLargerBtn = imgTemplate.querySelector(".regenerate-larger-btn");
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
    }

    const llmTextBtn = clone.querySelector(".toggle-llm-text");
    const llmTextContent = clone.querySelector(".llm-text-content");
    const expandIcon = clone.querySelector(".expand-icon");
    const collapseIcon = clone.querySelector(".collapse-icon");
    const btnText = clone.querySelector(".btn-text");
    const copyLlmBtn = clone.querySelector(".copy-llm-btn");
    
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
                const originalHtml = copyLlmBtn.innerHTML;
                copyLlmBtn.innerHTML = "<span>Copied!</span>";
                setTimeout(function() {
                    copyLlmBtn.innerHTML = originalHtml;
                }, 1500);
            });
        });
    } else {
        llmTextBtn.style.display = "none";
    }

    const copyToTextareaBtn = clone.querySelector(".copy-to-textarea-btn");
    copyToTextareaBtn.addEventListener("click", function() {
        const userInput = document.getElementById("user-input");
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
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;
    conversationArea.innerHTML = "";
}

function clearUserInput() {
    const textarea = document.getElementById("user-input");
    if (!textarea) return;
    textarea.value = "";
    setGenerateButtonState(false);
}

/**
 * Clears the user input textarea
 */
function clearUserInput() {
    const textarea = document.getElementById("user-input");
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
    const entry = currentConversation.entries[entryIndex];
    
    const apiKey = getApiKey();
    if (!apiKey) return;

    const aspectRatio = getAspectRatio();
    const resolution = entry.response.imageResolutions ? entry.response.imageResolutions[imageIndex] : "1K";
    
    const imageConfig = {
        imageSize: resolution,
        aspectRatio: aspectRatio
    };
    
    const newSeed = generateRandomSeed();
    const prompt = entry.message.text;
    
    setLoadingState(true);
    
    generateImage(apiKey, prompt, selectedModel, SYSTEM_PROMPT, conversationHistory, imageConfig, newSeed)
        .then(function(response) {
            const urls = extractImageUrls(response);
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
    const entry = currentConversation.entries[entryIndex];
    if (entry.response.imageResolutions[imageIndex] === "4K") return;

    const apiKey = getApiKey();
    if (!apiKey) return;
    
    const aspectRatio = getAspectRatio();

    const imageConfig = {
        imageSize: "4K",
        aspectRatio: aspectRatio
    };

    const seed = entry.message.seed;
    const prompt = entry.message.text;

    setLoadingState(true);

    generateImage(apiKey, prompt, selectedModel, SYSTEM_PROMPT, conversationHistory, imageConfig, seed)
        .then(function(response) {
            const urls = extractImageUrls(response);
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
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    const errorDiv = document.createElement("div");
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
    const generateButton = document.getElementById("generate-button");
    const userInput = document.getElementById("user-input");
    const apiKeyInput = document.getElementById("api-key-input");
    const modelDropdown = document.getElementById("model-dropdown");
    const resolutionDropdown = document.getElementById("resolution-dropdown");
    const aspectRatioDropdown = document.getElementById("aspect-ratio-dropdown");

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
    const dropdown = document.getElementById("resolution-dropdown");
    if (!dropdown) return;
    dropdown.textContent = "";
    dropdown.textContent = resolution + " ";
    const caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
}

/**
 * Programmatically sets the aspect ratio dropdown value
 * @param {string} aspectRatio - Aspect ratio value (1:1, 16:9, 3:2, 21:9)
 */
function setAspectRatio(aspectRatio) {
    const dropdown = document.getElementById("aspect-ratio-dropdown");
    if (!dropdown) return;
    dropdown.textContent = "";
    dropdown.textContent = aspectRatio + " ";
    const caret = document.createElement("span");
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
    const dropdown = document.getElementById("model-dropdown");
    const menu = document.getElementById("model-menu");
    if (!dropdown || !menu) return false;

    const foundModel = models.find(function(model) {
        return model.id === modelId;
    });

    if (!foundModel) return false;

    dropdown.textContent = "";
    dropdown.textContent = foundModel.name + " ";
    const caret = document.createElement("span");
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
    const warningDisplay = document.getElementById("warning-display");
    if (!warningDisplay) return;

    warningDisplay.style.display = "block";
    warningDisplay.className = "alert alert-warning mb-3";
    warningDisplay.textContent = message;

    const conversationArea = document.getElementById("conversation-area");
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
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    conversationArea.innerHTML = "";

    if (!conversation || !conversation.entries) return;

    conversation.entries.forEach(function(entry, index) {
        renderMessageEntry(entry, index, conversation.timestamp);
    });

    conversationArea.scrollTop = conversationArea.scrollHeight;
}
