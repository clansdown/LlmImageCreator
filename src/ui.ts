/**
 * UI manipulation functions
 * Handles all DOM updates and user interface interactions
 */

import { STATE } from './state';
import { savePreference, getPreference, loadConversation, getImage, loadSummary, listConversations } from './storage';
import { generateConversationTitle, getApiKey, updateConversationSummary } from './util';
import { fetchVisionModels } from './openrouter';
import { handleRegenerateWithNewSeed, handleRegenerateLarger, getUpscalingModel } from './agent';
import type { Conversation, ConversationSummary } from './types/state';
import type { VisionModel, ChatCompletionResponse } from './types/api';

export { getApiKey, updateConversationSummary, getUpscalingModel, handleRegenerateWithNewSeed, handleRegenerateLarger };

/**
 * Populates the model dropdown with available image generation models
 * @param {VisionModel[]} models - Array of model objects
 */
export function populateModelDropdown(models: VisionModel[]): void {
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

    models.forEach(function(model: VisionModel) {
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
            STATE.selectedModel = model.id;
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
    STATE.selectedModel = firstModel.id;
}

/**
 * Clears the model dropdown
 */
export function clearModelDropdown(): void {
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

    STATE.selectedModel = null;
}

/**
 * Updates the balance display
 * @param {{totalCredits: number; totalUsage: number} | null} balance - Object with totalCredits and totalUsage, or null
 * @param {string | null} warning - Optional warning message
 */
export function updateBalanceDisplay(balance: {totalCredits: number; totalUsage: number} | null, warning: string | null): void {
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
export function toggleLeftColumn(): void {
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
export function setGenerateButtonState(enabled: boolean): void {
    const button = document.getElementById("generate-button");
    if (!button) return;

    button.disabled = !enabled;
}

/**
 * Gets the currently selected resolution
 * @returns {string} Selected resolution (1K, 2K, or 4K)
 */
export function getResolution(): string {
    const dropdown = document.getElementById("resolution-dropdown");
    if (!dropdown) return "1K";
    return dropdown.textContent.trim();
}

/**
 * Gets the currently selected aspect ratio
 * @returns {string} Selected aspect ratio
 */
export function getAspectRatio(): string {
    const dropdown = document.getElementById("aspect-ratio-dropdown");
    if (!dropdown) return "1:1";
    return dropdown.textContent.trim();
}

/**
 * Gets the user's prompt from the textarea
 * @returns {string} User's input prompt
 */
export function getUserPrompt(): string {
    const textarea = document.getElementById("user-input");
    if (!textarea) return "";
    return (textarea as HTMLTextAreaElement).value.trim();
}

/**
 * Clears the conversation history display
 */
export function clearConversationHistory(): void {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    historyContainer.innerHTML = "";
}

/**
 * Starts a new conversation by clearing current view for clean slate
 */
export async function handleNewConversation(): Promise<void> {
    STATE.currentConversation = null;
    STATE.conversationHistory = [];
    clearConversationArea();
    clearUserInput();

    const historyContainer = document.getElementById("conversation-history");
    if (historyContainer) {
        const selectedItems = historyContainer.querySelectorAll(".selected");
        selectedItems.forEach(function(item: Element) {
            item.classList.remove("selected");
        });
    }
}

/**
 * Initializes Bootstrap tooltips for all elements with data-bs-toggle="tooltip"
 */
export function initTooltips(): void {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl: Element) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Initializes a Bootstrap tooltip for a single element
 * @param {HTMLElement} element - Element to initialize tooltip for
 */
export function initTooltipForElement(element: HTMLElement): void {
    if (element && element.getAttribute("data-bs-toggle") === "tooltip") {
        new bootstrap.Tooltip(element);
    }
}

/**
 * Initializes the settings dialog modal and populates the upscaling model dropdown
 */
export async function initSettingsDialog(): Promise<void> {
    const template = document.getElementById("settings-dialog-template");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    document.body.appendChild(clone);

    const settingsModal = document.getElementById("settings-modal");
    if (!settingsModal) return;

    (settingsModal as HTMLElement & {instance?: bootstrap.Modal}).instance = new bootstrap.Modal(settingsModal);

    const apiKey = getApiKey();

    if (apiKey && apiKey.length > 0) {
        try {
            const visionModels = await fetchVisionModels(apiKey);
            populateUpscalingModelDropdown(visionModels);
        } catch (error) {
            console.error("Error fetching vision models:", error);
        }
    }

    const upscalingModelSelect = document.getElementById("upscaling-model-select") as HTMLSelectElement | null;
    if (upscalingModelSelect) {
        upscalingModelSelect.addEventListener("change", function(e) {
            const modelId = (e.target as HTMLSelectElement).value;
            if (modelId) {
                savePreference("upscalingModel", modelId);
            }
        });
    }
}

/**
 * Populates the upscaling model dropdown with available vision models
 * @param {VisionModel[]} visionModels - Array of vision model objects
 */
export function populateUpscalingModelDropdown(visionModels: VisionModel[]): void {
    const select = document.getElementById("upscaling-model-select") as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = "";
    
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a model for upscaling images to 4K";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    if (!visionModels || visionModels.length === 0) {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "No vision-capable models available";
        emptyOption.disabled = true;
        select.appendChild(emptyOption);
        return;
    }

    visionModels.forEach(function(model: VisionModel) {
        const item = document.createElement("option");
        item.value = model.id;
        item.textContent = model.name;
        select.appendChild(item);
    });

    getPreference("upscalingModel").then(function(savedModelId: string | null) {
        if (savedModelId && savedModelId.length > 0) {
            select.value = savedModelId;
        }
    });
}

/**
 * Handles settings dialog open - loads saved preference
 */
export async function handleSettingsOpen(): Promise<void> {
    const apiKey = getApiKey();
    const select = document.getElementById("upscaling-model-select") as HTMLSelectElement | null;
    
    if (apiKey && apiKey.length > 0 && select && select.options.length <= 2) {
        try {
            const visionModels = await fetchVisionModels(apiKey);
            populateUpscalingModelDropdown(visionModels);
        } catch (error) {
            console.error("Error fetching vision models:", error);
        }
    }

    const modelId = await getPreference("upscalingModel");
    if (select && modelId) {
        select.value = modelId;
    }
}

/**
 * Updates the conversation list after adding a new entry
 */
export async function updateConversationList(): Promise<void> {
    const timestamps = await listConversations();
    await populateConversationList(timestamps);
}

/**
 * Loads a conversation into the main view
 * @param {number} timestamp - Conversation timestamp
 */
export async function loadConversationIntoView(timestamp: number): Promise<void> {
    const conversation = await loadConversation(timestamp);
    if (!conversation) return;

    STATE.currentConversation = conversation;
    STATE.conversationHistory = [];

    if (conversation.entries) {
        conversation.entries.forEach(function(entry) {
            STATE.conversationHistory.push({
                role: "user",
                content: entry.message.text
            });

            if (entry.response.text) {
                STATE.conversationHistory.push({
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
        items.forEach(function(item: Element) {
            item.classList.remove("selected");
            if (parseInt((item as HTMLElement).dataset.timestamp || "0", 10) === timestamp) {
                item.classList.add("selected");
            }
        });
    }
}

/**
 * Populates the conversation list in the left sidebar with saved conversations
 * @param {number[]} timestamps - Array of conversation timestamps
 */
export async function populateConversationList(timestamps: number[]): Promise<void> {
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
 * @param {HTMLElement} element - The conversation item DOM element
 * @param {ConversationSummary} summary - Summary data object
 * @param {number} timestamp - Conversation timestamp
 * @param {Conversation} conversation - Conversation object
 */
export function setConversationItemUI(element: HTMLElement, summary: ConversationSummary | null, timestamp: number, conversation: Conversation): void {
    const dateElement = element.querySelector(".conversation-date") as HTMLElement | null;
    const previewElement = element.querySelector(".conversation-preview") as HTMLElement | null;
    if (!dateElement || !previewElement) {
        console.log("There's a problem with the conversation UI items.", element, dateElement, previewElement);
        return;
    }

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
 */
export function createConversationItem(timestamp: number, conversation: Conversation): void {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    const template = document.getElementById("conversation-item-template");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const item = clone.querySelector(".conversation-item") as HTMLElement;

    item.dataset.timestamp = String(timestamp);

    const conversationItem = clone.firstElementChild as HTMLElement;
    historyContainer.appendChild(clone);

    const defaultSummary: ConversationSummary = { title: "New Conversation", imageCount: 0, entryCount: 0, created: timestamp, updated: timestamp };

    loadSummary(timestamp).then(function(summary: ConversationSummary | null) {
        const summaryTyped = summary || defaultSummary;

        setConversationItemUI(conversationItem, summaryTyped, timestamp, conversation);

        const title = (summaryTyped && summaryTyped.title && summaryTyped.title.trim().length > 0) ? summaryTyped.title : "New Conversation";
        if (title === "New Conversation" && conversation.entries && conversation.entries.length > 0) {
            const firstPrompt = conversation.entries[0].message.text;
            if (firstPrompt) {
                generateConversationTitle(firstPrompt).then(function(newTitle: string) {
                    if (newTitle && newTitle.trim().length > 0) {
                        updateConversationSummary(timestamp, newTitle).then(function(summaryData: ConversationSummary | null) {
                            if (summaryData) {
                                setConversationItemUI(conversationItem, summaryData, timestamp, conversation);
                            }
                        }).catch(function(e: Error) {
                            console.error("Error saving new title for conversation", timestamp, ":", e);
                        });
                    }
                }).catch(function(e: Error) {
                    console.error("Error generating title for conversation", timestamp, ":", e);
                });
            }
        }
    }).catch(function(e: Error) {
        console.error("Failed to load summary for conversation", timestamp, e);
        setConversationItemUI(conversationItem, defaultSummary, timestamp, conversation);
    });

    item.addEventListener("click", function() {
        loadConversationIntoView(timestamp);
    });
}

/**
 * Updates a single conversation list item's title without full refresh
 * @param {number} timestamp - Conversation timestamp
 */
export async function updateConversationListItemTitle(timestamp: number): Promise<void> {
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;

    const item = historyContainer.querySelector('.conversation-item[data-timestamp="' + timestamp + '"]') as HTMLElement | null;
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
    setConversationItemUI(tempClone as unknown as HTMLElement, summary, timestamp, conversation);

    const dateElement = item.querySelector(".conversation-date") as HTMLElement | null;
    const previewElement = item.querySelector(".conversation-preview") as HTMLElement | null;
    const tempDateElement = (tempClone as unknown as HTMLElement).querySelector(".conversation-date") as HTMLElement | null;
    const tempPreviewElement = (tempClone as unknown as HTMLElement).querySelector(".conversation-preview") as HTMLElement | null;

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
 */
export async function updateConversationListDate(timestamp: number): Promise<void> {
    const conversation = await loadConversation(timestamp);
    if (!conversation) return;
    
    const historyContainer = document.getElementById("conversation-history");
    if (!historyContainer) return;
    
    const item = historyContainer.querySelector('.conversation-item[data-timestamp="' + timestamp + '"]') as HTMLElement | null;
    if (item) {
        const previewElement = item.querySelector(".conversation-preview") as HTMLElement | null;
        if (previewElement) {
            previewElement.textContent = conversation.entries.length + " messages";
        }
    }
}

/**
 * Extracts image URLs from chat completion response
 * @param {ChatCompletionResponse} response - OpenRouter chat completion response
 * @returns {string[]} Array of image URLs
 */
export function extractImageUrls(response: ChatCompletionResponse): string[] {
    const urls: string[] = [];
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
 * Displays an error message in the conversation area
 * @param {string} errorMessage - Error message to display
 */
export function displayError(errorMessage: string): void {
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
export function setLoadingState(isLoading: boolean): void {
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
        (userInput as HTMLTextAreaElement).disabled = isLoading;
    }

    if (apiKeyInput) {
        (apiKeyInput as HTMLInputElement).disabled = isLoading;
    }

    if (modelDropdown && modelDropdown.parentElement) {
        modelDropdown.parentElement.classList.toggle("disabled", isLoading);
    }

    if (resolutionDropdown && resolutionDropdown.parentElement) {
        resolutionDropdown.parentElement.classList.toggle("disabled", isLoading);
    }

    if (aspectRatioDropdown && aspectRatioDropdown.parentElement) {
        aspectRatioDropdown.parentElement.classList.toggle("disabled", isLoading);
    }
}

/**
 * Programmatically sets the resolution dropdown value
 * @param {string} resolution - Resolution value (1K, 2K, 4K)
 */
export function setResolution(resolution: string): void {
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
export function setAspectRatio(aspectRatio: string): void {
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
 * @param {VisionModel[]} models - Available models
 * @returns {boolean} true if model found and selected
 */
export function selectModelById(modelId: string, models: VisionModel[]): boolean {
    const dropdown = document.getElementById("model-dropdown");
    const menu = document.getElementById("model-menu");
    if (!dropdown || !menu) return false;

    const foundModel = models.find(function(model: VisionModel) {
        return model.id === modelId;
    });

    if (!foundModel) return false;

    dropdown.textContent = "";
    dropdown.textContent = foundModel.name + " ";
    const caret = document.createElement("span");
    caret.className = "caret";
    dropdown.appendChild(caret);
    STATE.selectedModel = modelId;
    return true;
}

/**
 * Displays a warning message in the conversation area
 * @param {string} message - Warning message to display
 */
export function displayWarning(message: string): void {
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
 * Clears the conversation area in the right column
 */
export function clearConversationArea(): void {
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;
    conversationArea.innerHTML = "";
}

/**
 * Clears the user input textarea
 */
export function clearUserInput(): void {
    const textarea = document.getElementById("user-input");
    if (!textarea) return;
    (textarea as HTMLTextAreaElement).value = "";
    setGenerateButtonState(false);
}

/**
 * Renders a single conversation entry using the template
 * @param {Conversation['entries'][0]} entry - Conversation entry to render
 * @param {number} index - Entry index in conversation
 * @param {number} conversationTimestamp - Conversation timestamp for image loading
 */
export function renderMessageEntry(entry: Conversation['entries'][0], index: number, conversationTimestamp: number): void {
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    const template = document.getElementById("message-entry-template");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const messageEntry = clone.querySelector(".message-entry") as HTMLElement;

    (clone.querySelector(".user-prompt-text") as HTMLElement).textContent = entry.message.text;

    const imagesContainer = clone.querySelector(".images-container") as HTMLElement;
    if (entry.response.imageFilenames && entry.response.imageFilenames.length > 0) {
        if (entry.response.imageFilenames[0] === "generating") {
            const spinnerTemplate = document.getElementById("image-loading-template");
            if (spinnerTemplate) {
                const spinnerClone = spinnerTemplate.content.cloneNode(true);
                imagesContainer.appendChild(spinnerClone);
            }
        } else {
            getUpscalingModel().then(function(upscalingModel: string | null) {
                entry.response.imageFilenames.forEach(function(filename: string, imgIndex: number) {
                    const resolution = entry.response.imageResolutions?.[imgIndex] ?? "1K";
                    getImage(conversationTimestamp, parseInt(filename, 10)).then(function(blob: Blob | null) {
                        if (!blob) return;
                        
                        const template = document.getElementById("image-entry-template");
                        if (!template) return;
                        const imgTemplate = template.content.cloneNode(true);
                        const imgItemContainer = imgTemplate.querySelector(".image-item-container") as HTMLElement;
                        const imgWrapper = imgTemplate.querySelector(".image-wrapper") as HTMLElement;
                        const imgElement = imgTemplate.querySelector(".generated-image") as HTMLImageElement;
                        
                        const objectUrl = URL.createObjectURL(blob);
                        imgElement.onload = function() {
                            URL.revokeObjectURL(objectUrl);
                            imgWrapper.style.width = imgElement.width + "px";
                            imgWrapper.style.height = imgElement.height + "px";
                        };
                        imgElement.src = objectUrl;
                        imgElement.style.maxWidth = "100%";
                        imgElement.style.height = "auto";
                        imgElement.dataset.conversationTimestamp = String(conversationTimestamp);
                        imgElement.dataset.entryIndex = String(index);
                        imgElement.dataset.imageIndex = String(imgIndex);
                        
                        const downloadBtn = imgTemplate.querySelector(".download-btn") as HTMLButtonElement;
                        downloadBtn.dataset.conversationTimestamp = String(conversationTimestamp);
                        downloadBtn.dataset.entryIndex = String(index);
                        downloadBtn.dataset.imageIndex = String(imgIndex);
                        downloadBtn.dataset.filename = filename;
                        downloadBtn.addEventListener("click", function() {
                            const ts = parseInt(String(conversationTimestamp), 10);
                            const fn = filename;
                            getImage(ts, parseInt(fn, 10)).then(function(imgBlob: Blob | null) {
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
                        
                        const regenerateNewBtn = imgTemplate.querySelector(".regenerate-new-btn") as HTMLButtonElement;
                        regenerateNewBtn.dataset.entryIndex = String(index);
                        regenerateNewBtn.dataset.imageIndex = String(imgIndex);
                        regenerateNewBtn.addEventListener("click", function() {
                            handleRegenerateWithNewSeed(index, imgIndex);
                        });
                        initTooltipForElement(regenerateNewBtn);
                        
                        const regenerateLargerBtn = imgTemplate.querySelector(".regenerate-larger-btn") as HTMLButtonElement;
                        const isDisabled = (resolution === "4K") || !upscalingModel;
                        regenerateLargerBtn.disabled = isDisabled;
                        if (!upscalingModel) {
                            regenerateLargerBtn.setAttribute("data-bs-title", "Select upscaling model in Settings first");
                        }
                        regenerateLargerBtn.dataset.entryIndex = String(index);
                        regenerateLargerBtn.dataset.imageIndex = String(imgIndex);
                        regenerateLargerBtn.addEventListener("click", function() {
                            handleRegenerateLarger(index, imgIndex);
                        });
                        initTooltipForElement(regenerateLargerBtn);
                        
                        imagesContainer.appendChild(imgItemContainer);
                    });
                });
            });
        }
    }

    const llmTextBtn = clone.querySelector(".toggle-llm-text") as HTMLElement;
    const llmTextContent = clone.querySelector(".llm-text-content") as HTMLElement;
    const expandIcon = clone.querySelector(".expand-icon") as HTMLElement;
    const collapseIcon = clone.querySelector(".collapse-icon") as HTMLElement;
    const btnText = clone.querySelector(".btn-text") as HTMLElement;
    const copyLlmBtn = clone.querySelector(".copy-llm-btn") as HTMLButtonElement;
    
    initTooltipForElement(llmTextBtn);
    initTooltipForElement(copyLlmBtn);
    
    if (entry.response.text) {
        (clone.querySelector(".llm-text-body") as HTMLElement).textContent = entry.response.text;
        
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

    const copyToTextareaBtn = clone.querySelector(".copy-to-textarea-btn") as HTMLButtonElement;
    copyToTextareaBtn.addEventListener("click", function() {
        const userInput = document.getElementById("user-input");
        if (userInput) {
            (userInput as HTMLTextAreaElement).value = entry.message.text;
            (userInput as HTMLTextAreaElement).focus();
        }
    });
    initTooltipForElement(copyToTextareaBtn);

    conversationArea.appendChild(messageEntry);
}

/**
 * Renders a complete conversation in the conversation area
 * @param {Conversation} conversation - Conversation object with entries
 */
export function renderConversation(conversation: Conversation): void {
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    conversationArea.innerHTML = "";

    if (!conversation || !conversation.entries) return;

    conversation.entries.forEach(function(entry: Conversation['entries'][0], index: number) {
        renderMessageEntry(entry, index, conversation.timestamp);
    });

    conversationArea.scrollTop = conversationArea.scrollHeight;
}
