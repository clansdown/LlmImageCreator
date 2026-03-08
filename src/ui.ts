/**
 * UI manipulation functions
 * Handles all DOM updates and user interface interactions
 */

import { STATE } from './state';
import { SYSTEM_PROMPT } from './prompt';
import { savePreference, getPreference, loadConversation, getImage, loadSummary, listConversations, getReferenceImageDataUrl, getAllAvailableImages, uploadReferenceImage, saveConversation, getImageDataURL } from './storage';
import { generateConversationTitle, getApiKey, updateConversationSummary, cloneTemplate } from './util';
import { fetchVisionModels } from './openrouter';
import { handleRegenerateWithNewSeed, handleRegenerateLarger, handleRegenerateX5, handleRegenerateEntryX5, getUpscalingModel } from './agent';
import { getAllTags, getTagsForImage, setTags, ensureMetadataArray } from './tagManager';
import type { Conversation, ConversationSummary, ReferenceImage } from './types/state';
import type { VisionModel, ChatCompletionResponse } from './types/api';
import type { ErrorInfo } from './types/error';

export { getApiKey, updateConversationSummary, getUpscalingModel, handleRegenerateWithNewSeed, handleRegenerateLarger, handleRegenerateX5, handleRegenerateEntryX5 };

/** @type {Array<{timestamp: number; imageIndex: number; title: string}>} */
let availableImagesCache: Array<{timestamp: number; imageIndex: number; title: string}> = [];

/**
 * @typedef {Object} ImageItem
 * @property {number} timestamp
 * @property {number} imageIndex
 * @property {string} title
 * @property {HTMLElement} item
 * @property {HTMLInputElement} checkbox
 * @property {HTMLImageElement} img
 * @property {boolean} isSelected
 * @property {boolean} isBroken
 * @property {boolean} isVisible
 */

/**
 * @typedef {Object} ConversationGroup
 * @property {number} timestamp
 * @property {string} title
 * @property {number} imageCount
 * @property {HTMLElement} group
 * @property {HTMLButtonElement} button
 * @property {HTMLElement} chevron
 * @property {HTMLElement} collapse
 * @property {HTMLElement} grid
 * @property {HTMLElement} spinner
 * @property {boolean} isExpanded
 * @property {boolean} isLoaded
 * @property {boolean} isVisible
 * @property {Array<ImageItem>} imageItems
 */

/**
 * @typedef {Object} DialogState
 * @property {string} searchTerm
 * @property {Array<ConversationGroup>} conversations
 * @property {number} lastUpdated
 */

/** @type {DialogState} */
let dialogState: {
    searchTerm: string;
    tagFilter: string;
    conversations: Array<{
        timestamp: number;
        title: string;
        imageCount: number;
        group: HTMLElement;
        titleBar: HTMLElement;
        chevron: HTMLElement;
        collapse: HTMLElement;
        grid: HTMLElement;
        spinner: HTMLElement | null;
        isExpanded: boolean;
        isLoaded: boolean;
        isVisible: boolean;
        imageItems: Array<{
            timestamp: number;
            imageIndex: number;
            title: string;
            tags: string[];
            item: HTMLElement;
            checkbox: HTMLInputElement;
            img: HTMLImageElement;
            isSelected: boolean;
            isBroken: boolean;
            isVisible: boolean;
        }>;
    }>;
    lastUpdated: number;
} = {
    searchTerm: "",
    tagFilter: "",
    conversations: [],
    lastUpdated: 0
};

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
 * Gets the system prompt from preferences or default
 * @returns {Promise<string>} System prompt value
 */
export async function getSystemPrompt(): Promise<string> {
    const savedPrompt = await getPreference("systemPrompt");
    return savedPrompt || SYSTEM_PROMPT;
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
 * Shrinks the user input textarea to collapsed state (small)
 */
export function shrinkTextarea(): void {
    const textarea = document.getElementById("user-input") as HTMLTextAreaElement | null;
    if (!textarea) return;
    textarea.classList.remove("user-input-expanded");
    textarea.classList.add("user-input-collapsed");
}

/**
 * Expands the user input textarea to expanded state (big)
 */
export function expandTextarea(): void {
    const textarea = document.getElementById("user-input") as HTMLTextAreaElement | null;
    if (!textarea) return;
    textarea.classList.remove("user-input-collapsed");
    textarea.classList.add("user-input-expanded");
}

/**
 * Sets the textarea initial state based on whether conversation has messages
 * @param {boolean} conversationHasMessages - Whether the conversation has 1+ entries
 */
export function setTextareaInitialState(conversationHasMessages: boolean): void {
    if (conversationHasMessages) {
        shrinkTextarea();
    } else {
        expandTextarea();
    }
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
    STATE.currentConversation = {
        timestamp: 0,
        entries: [],
        referenceImages: []
    };
    STATE.conversationHistory = [];
    clearConversationArea();
    clearUserInput();
    expandTextarea();
    renderReferenceImagesToolbar(STATE.currentConversation);

    const historyContainer = document.getElementById("conversation-history");
    if (historyContainer) {
        const selectedItems = historyContainer.querySelectorAll(".selected");
        selectedItems.forEach(function(item: Element) {
            item.classList.remove("selected");
        });
    }
}

/**
 * Initializes the settings dialog modal and populates the upscaling model dropdown
 */
export async function initSettingsDialog(): Promise<void> {
    const modal = cloneTemplate("settings-dialog-template", document.body);
    if (!modal) return;

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

    const systemPromptTextarea = document.getElementById("system-prompt-textarea") as HTMLTextAreaElement | null;
    if (systemPromptTextarea) {
        getPreference("systemPrompt").then(function(savedPrompt: string | null) {
            if (savedPrompt && savedPrompt.length > 0) {
                systemPromptTextarea.value = savedPrompt;
            } else {
                systemPromptTextarea.value = SYSTEM_PROMPT;
            }
        });

        systemPromptTextarea.addEventListener("input", function(e) {
            const prompt = (e.target as HTMLTextAreaElement).value;
            if (prompt && prompt.trim().length > 0) {
                savePreference("systemPrompt", prompt.trim());
            } else {
                savePreference("systemPrompt", SYSTEM_PROMPT);
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

    const systemPromptTextarea = document.getElementById("system-prompt-textarea") as HTMLTextAreaElement | null;
    if (systemPromptTextarea) {
        const savedPrompt = await getPreference("systemPrompt");
        systemPromptTextarea.value = savedPrompt || SYSTEM_PROMPT;
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

    const hasMessages = conversation.entries && conversation.entries.length > 0;
    setTextareaInitialState(hasMessages);
    clearConversationArea();
    clearReferenceImagesToolbar();
    renderConversation(conversation);
    renderReferenceImagesToolbar(conversation);

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

    const conversationItem = cloneTemplate("conversation-item-template", historyContainer);
    if (!conversationItem) return;

    const item = conversationItem;
    item.dataset.timestamp = String(timestamp);

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

    const tempContainer = document.createElement('div');
    const tempItem = cloneTemplate("conversation-item-template", tempContainer);
    if (!tempItem) return;
    setConversationItemUI(tempItem, summary, timestamp, conversation);

    const dateElement = item.querySelector(".conversation-date") as HTMLElement | null;
    const previewElement = item.querySelector(".conversation-preview") as HTMLElement | null;
    const tempDateElement = tempItem.querySelector(".conversation-date") as HTMLElement | null;
    const tempPreviewElement = tempItem.querySelector(".conversation-preview") as HTMLElement | null;

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
 * Displays detailed error information in the error box
 * @param {ErrorInfo | string} errorInfo - Error information to display
 */
export function displayError(errorInfo: ErrorInfo | string): void {
    let info: ErrorInfo;

    if (typeof errorInfo === 'string') {
        info = { message: errorInfo };
    } else {
        info = errorInfo;
    }

    if (!info.message) return;

    const errorContainer = document.getElementById("error-container");
    if (!errorContainer) return;

    const errorBox = cloneTemplate("error-box-template", errorContainer);
    if (!errorBox) return;

    const errorTitle = errorBox.querySelector(".error-title") as HTMLElement;
    const errorMessage = errorBox.querySelector(".error-message") as HTMLElement;
    const errorDetails = errorBox.querySelector(".error-details") as HTMLElement;
    const errorStatus = errorBox.querySelector(".error-status") as HTMLElement;
    const errorCode = errorBox.querySelector(".error-code") as HTMLElement;
    const errorType = errorBox.querySelector(".error-type") as HTMLElement;
    const errorRaw = errorBox.querySelector(".error-raw") as HTMLElement;
    const errorDismiss = errorBox.querySelector(".error-dismiss") as HTMLButtonElement;

    errorTitle.textContent = "Error";
    errorMessage.textContent = info.message;

    const hasDetails = info.status || info.code || info.type || info.rawResponse;
    if (hasDetails) {
        errorDetails.style.display = "block";
        errorDetails.style.marginTop = "0.5rem";
        errorDetails.style.paddingTop = "0.5rem";
        errorDetails.style.borderTop = "1px solid rgba(255,255,255,0.1)";

        if (info.status) {
            errorStatus.textContent = "Status: " + info.status;
            errorStatus.style.display = "block";
        }
        if (info.code) {
            errorCode.textContent = "Code: " + info.code;
            errorCode.style.display = "block";
        }
        if (info.type) {
            errorType.textContent = "Type: " + info.type;
            errorType.style.display = "block";
        }
        if (info.rawResponse) {
            errorRaw.textContent = "Raw: " + info.rawResponse;
            errorRaw.style.display = "block";
        }
    }

    if (errorDismiss) {
        errorDismiss.addEventListener("click", function() {
            errorBox.remove();
        });
    }
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
 * Smoothly scrolls the conversation area to the bottom
 * @param {HTMLElement} conversationArea - The conversation area element
 */
function scrollConversationToBottom(conversationArea: HTMLElement): void {
    if (!conversationArea) return;
    conversationArea.scrollTo({
        top: conversationArea.scrollHeight,
        behavior: 'smooth' as ScrollBehavior
    });
}

/**
 * Renders a range of images from imageFilenames
 * @param {Conversation['entries'][0]} entry - Conversation entry containing images
 * @param {number} conversationTimestamp - Conversation timestamp for image loading
 * @param {number} startIndex - Starting index (inclusive)
 * @param {number} endIndex - Ending index (exclusive)
 * @param {HTMLElement} imagesContainer - Container to append images to
 * @param {number} entryIndex - Entry index in conversation
 */
function renderExistingImages(
    entry: Conversation['entries'][0],
    conversationTimestamp: number,
    startIndex: number,
    endIndex: number,
    imagesContainer: HTMLElement,
    entryIndex: number
): void {
    if (startIndex >= endIndex) return;

    getUpscalingModel().then(function(upscalingModel: string | null) {
        for (let imgIndex = startIndex; imgIndex < endIndex; imgIndex++) {
            const filename = entry.response.imageFilenames[imgIndex];
            if (filename === "generating") continue;

            const resolution = entry.response.imageResolutions?.[imgIndex] ?? "1K";

            getImage(conversationTimestamp, parseInt(filename, 10)).then(function(blob: Blob | null) {
                if (!blob) return;

                const imgItemContainer = cloneTemplate("image-entry-template", imagesContainer);
                if (!imgItemContainer) return;
                const imgElement = imgItemContainer.querySelector(".generated-image") as HTMLImageElement;

                const objectUrl = URL.createObjectURL(blob);
                imgElement.onload = function() {
                    URL.revokeObjectURL(objectUrl);
                    
                    if (entry.response.imageFilenames.includes("generating")) {
                        const convArea = document.getElementById("conversation-area");
                        if (convArea) {
                            setTimeout(function() {
                                scrollConversationToBottom(convArea);
                            }, 50);
                        }
                    }
                };
                imgElement.src = objectUrl;
                imgElement.style.maxWidth = "100%";
                imgElement.dataset.conversationTimestamp = String(conversationTimestamp);
                imgElement.dataset.entryIndex = String(entryIndex);
                imgElement.dataset.imageIndex = String(imgIndex);

                const downloadBtn = imgItemContainer.querySelector(".download-btn") as HTMLButtonElement;
                downloadBtn.dataset.conversationTimestamp = String(conversationTimestamp);
                downloadBtn.dataset.entryIndex = String(entryIndex);
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

                    const tagBtn = imgItemContainer.querySelector(".tag-btn") as HTMLButtonElement;
                    tagBtn.dataset.conversationTimestamp = String(conversationTimestamp);
                    tagBtn.dataset.entryIndex = String(entryIndex);
                    tagBtn.dataset.imageIndex = String(imgIndex);
                    tagBtn.addEventListener("click", function() {
                        const ts = parseInt(String(conversationTimestamp), 10);
                        const eIdx = parseInt(String(entryIndex), 10);
                        const iIdx = parseInt(String(imgIndex), 10);
                        openTagEditor(ts, eIdx, iIdx);
                    });

                    const regenerateNewBtn = imgItemContainer.querySelector(".regenerate-new-btn") as HTMLButtonElement;
                    regenerateNewBtn.dataset.entryIndex = String(entryIndex);
                    regenerateNewBtn.dataset.imageIndex = String(imgIndex);
                    regenerateNewBtn.addEventListener("click", function() {
                        const filename = entry.response.imageFilenames[imgIndex];
                        const storageIndex = parseInt(filename, 10);
                        const additionalRef: ReferenceImage = {
                            conversationTimestamp: conversationTimestamp,
                            imageIndex: storageIndex
                        };
                        handleRegenerateWithNewSeed(entryIndex, imgIndex, additionalRef);
                    });

                    const regenerateX5Btn = imgItemContainer.querySelector(".regenerate-x5-btn") as HTMLButtonElement;
                    regenerateX5Btn.dataset.entryIndex = String(entryIndex);
                    regenerateX5Btn.dataset.imageIndex = String(imgIndex);
                    regenerateX5Btn.addEventListener("click", function() {
                        handleRegenerateX5(entryIndex, imgIndex);
                    });

                    const regenerateLargerBtn = imgItemContainer.querySelector(".regenerate-larger-btn") as HTMLButtonElement;
                const isDisabled = (resolution === "4K") || !upscalingModel;
                regenerateLargerBtn.disabled = isDisabled;
                if (!upscalingModel) {
                    regenerateLargerBtn.setAttribute("data-bs-title", "Select upscaling model in Settings first");
                }
                regenerateLargerBtn.dataset.entryIndex = String(entryIndex);
                regenerateLargerBtn.dataset.imageIndex = String(imgIndex);
                regenerateLargerBtn.addEventListener("click", function() {
                    handleRegenerateLarger(entryIndex, imgIndex);
                });

                const tagsContainer = imgItemContainer.querySelector(".image-tags-container") as HTMLElement;
                const metadata = entry.response.imageMetadata?.[imgIndex];
                if (metadata && metadata.tags.length > 0) {
                    renderImageTags(tagsContainer, metadata.tags, conversationTimestamp, entryIndex, imgIndex);
                }
            });
        }
    });
}

/**
 * Renders a single conversation entry using the template
 * @param {Conversation['entries'][0]} entry - Conversation entry to render
 * @param {number} index - Entry index in conversation
 * @param {number} conversationTimestamp - Conversation timestamp for image loading
 * @param {boolean} scrollTo - Whether to scroll this entry into view after rendering
 * @returns {Promise<void>}
 */
export async function renderMessageEntry(entry: Conversation['entries'][0], index: number, conversationTimestamp: number, scrollTo: boolean = false): Promise<void> {
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    const messageEntry = cloneTemplate("message-entry-template", conversationArea);
    if (!messageEntry) return;

    const instructionsHeader = messageEntry.querySelector(".model-name-display") as HTMLElement;
    const modelDisplayName = entry.message.modelName || entry.message.modelId || "[Unknown Model]";
    instructionsHeader.textContent = modelDisplayName + ":";

    const userPromptText = messageEntry.querySelector(".user-prompt-text") as HTMLElement;
    userPromptText.textContent = entry.message.text;
    userPromptText.style.maxHeight = "2.8em";
    userPromptText.style.overflow = "hidden";
    userPromptText.style.position = "relative";
    const fadeElement = document.createElement("div");
    fadeElement.className = "prompt-fade-out";
    const computedStyle = window.getComputedStyle(userPromptText);
    const backgroundColor = computedStyle.backgroundColor;
    fadeElement.style.position = "absolute";
    fadeElement.style.bottom = "0";
    fadeElement.style.left = "0";
    fadeElement.style.right = "0";
    fadeElement.style.height = "1.5em";
    fadeElement.style.background = "linear-gradient(to bottom, transparent 0%, " + backgroundColor + " 100%)";
    fadeElement.style.pointerEvents = "none";
    userPromptText.appendChild(fadeElement);

    const imagesContainer = messageEntry.querySelector(".images-container") as HTMLElement;
    if (entry.response.imageFilenames && entry.response.imageFilenames.length > 0) {
        const hasGenerating = entry.response.imageFilenames.includes("generating");

        if (hasGenerating) {
            for (let imgIndex = 0; imgIndex < entry.response.imageFilenames.length; imgIndex++) {
                const filename = entry.response.imageFilenames[imgIndex];
                if (filename === "generating") {
                    const spinnerTemplate = document.getElementById("image-loading-template");
                    if (spinnerTemplate) {
                        const spinnerItem = cloneTemplate("image-loading-template", imagesContainer);
                        if (!spinnerItem) return;
                    }
                } else {
                    const tempContainer = document.createElement("div");
                    imagesContainer.appendChild(tempContainer);
                    renderExistingImages(entry, conversationTimestamp, imgIndex, imgIndex + 1, tempContainer, index);
                }
            }
        } else {
            renderExistingImages(entry, conversationTimestamp, 0, entry.response.imageFilenames.length, imagesContainer, index);
        }
    }

    const llmTextBtn = messageEntry.querySelector(".toggle-llm-text") as HTMLElement;
    const llmTextContent = messageEntry.querySelector(".llm-text-content") as HTMLElement;
    const expandIcon = messageEntry.querySelector(".expand-icon") as HTMLElement;
    const collapseIcon = messageEntry.querySelector(".collapse-icon") as HTMLElement;
    const btnText = messageEntry.querySelector(".btn-text") as HTMLElement;
    const copyLlmBtn = messageEntry.querySelector(".copy-llm-btn") as HTMLButtonElement;
    
    if (entry.response.text) {
        (messageEntry.querySelector(".llm-text-body") as HTMLElement).textContent = entry.response.text;
        
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

    const copyToTextareaBtn = messageEntry.querySelector(".copy-to-textarea-btn") as HTMLButtonElement;
    copyToTextareaBtn.addEventListener("click", function() {
        const userInput = document.getElementById("user-input");
        if (userInput) {
            (userInput as HTMLTextAreaElement).value = entry.message.text;
            userInput.dispatchEvent(new Event("input", { bubbles: true }));
            (userInput as HTMLTextAreaElement).focus();
        }
    });

    const copyPromptBtn = messageEntry.querySelector(".copy-prompt-btn") as HTMLButtonElement;
    copyPromptBtn.addEventListener("click", function() {
        navigator.clipboard.writeText(entry.message.text).then(function() {
            const originalHtml = copyPromptBtn.innerHTML;
            copyPromptBtn.innerHTML = "<span>✓</span>";
            setTimeout(function() {
                copyPromptBtn.innerHTML = originalHtml;
            }, 1500);
        }).catch(function(err) {
            console.error("Failed to copy prompt:", err);
        });
    });

    const regenerateEntryBtn = messageEntry.querySelector(".regenerate-entry-btn") as HTMLButtonElement;
    regenerateEntryBtn.addEventListener("click", function() {
        handleRegenerateWithNewSeed(index, 0);
    });

    const regenerateEntryX5Btn = messageEntry.querySelector(".regenerate-entry-x5-btn") as HTMLButtonElement;
    regenerateEntryX5Btn.addEventListener("click", function() {
        handleRegenerateEntryX5(index);
    });

    if (scrollTo) {
        await new Promise(function(resolve) {
            setTimeout(resolve, 50);
        });
        scrollConversationToBottom(conversationArea);
    }
}

/**
 * Renders a complete conversation in the conversation area
 * @param {Conversation} conversation - Conversation object with entries
 * @returns {Promise<void>}
 */
export async function renderConversation(conversation: Conversation): Promise<void> {
    const conversationArea = document.getElementById("conversation-area");
    if (!conversationArea) return;

    conversationArea.innerHTML = "";

    if (!conversation || !conversation.entries) return;

    const promises: Promise<void>[] = [];
    conversation.entries.forEach(function(entry: Conversation['entries'][0], index: number) {
        const isLast = index === conversation.entries.length - 1;
        promises.push(renderMessageEntry(entry, index, conversation.timestamp, isLast));
    });

    await Promise.all(promises);

    scrollConversationToBottom(conversationArea);
}

/**
 * Renders the reference images toolbar with plus button and thumbnails
 * @param {Conversation} conversation - Current conversation object
 */
export function renderReferenceImagesToolbar(conversation: Conversation): void {
    const container = document.getElementById("ref-images-toolbar-container");
    if (!container) return;

    container.innerHTML = "";

    const toolbar = cloneTemplate("ref-images-toolbar-template", container);
    if (!toolbar) return;

    const refImages = conversation.referenceImages ?? [];
    const containerEl = toolbar.querySelector("#ref-images-container") as HTMLElement;

    if (!containerEl) return;

    if (refImages.length === 0) {
        toolbar.classList.add("empty");
        toolbar.classList.remove("with-images");
    } else {
        toolbar.classList.remove("empty");
        toolbar.classList.add("with-images");
    }

    const addBtn = toolbar.querySelector("#add-ref-image-btn") as HTMLButtonElement;
    if (addBtn) {
        addBtn.addEventListener("click", function() {
            openReferenceImagesDialog();
        });
    }

    for (let i = 0; i < refImages.length; i++) {
        const refImage = refImages[i];
        renderReferenceImageThumbnail(refImage, i, containerEl);
    }
}

/**
 * Renders a single reference image thumbnail in the toolbar
 * @param {ReferenceImage} refImage - Reference image object
 * @param {number} index - Index in the reference images array
 * @param {HTMLElement} containerEl - Container to append thumbnail to
 */
async function renderReferenceImageThumbnail(refImage: ReferenceImage, index: number, containerEl: HTMLElement): Promise<void> {
    const template = document.getElementById("ref-image-item-template") as HTMLTemplateElement | null;
    if (!template) return;

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const item = clone.firstElementChild as HTMLElement;
    if (!item) return;

    const img = item.querySelector(".ref-image-thumbnail") as HTMLImageElement;
    const removeBtn = item.querySelector(".remove-ref-image-btn") as HTMLButtonElement;

    let dataUrl: string | null = null;
    const isReference = refImage.conversationTimestamp < 0;

    if (isReference) {
        const timestamp = Math.abs(refImage.conversationTimestamp);
        dataUrl = await getReferenceImageDataUrl(timestamp, refImage.imageIndex);
    } else {
        dataUrl = await getImageDataURL(refImage.conversationTimestamp, refImage.imageIndex);
    }

    if (dataUrl && img) {
        img.src = dataUrl;
    }

    if (removeBtn) {
        removeBtn.addEventListener("click", async function() {
            await removeReferenceImage(index);
        });
    }

    containerEl.appendChild(item);
}

/**
 * Clears the reference images toolbar UI
 */
export function clearReferenceImagesToolbar(): void {
    const container = document.getElementById("ref-images-toolbar-container");
    if (!container) return;
    container.innerHTML = "";
}

/**
 * Invalidates the dialog data structure
 * Called when images are added to OPFS
 */
export function invalidateDialogState(): void {
    dialogState.conversations = [];
    dialogState.searchTerm = "";
    dialogState.lastUpdated = 0;
}

/**
 * Checks if the dialog data structure is valid
 * @returns {Promise<boolean>} True if valid, false if needs rebuild
 */
async function isDialogStateValid(): Promise<boolean> {
    if (dialogState.conversations.length === 0) {
        return false;
    }
    
    const currentTimestamps = await listConversations();
    currentTimestamps.sort(function(a, b) { return a - b; });
    
    const stateTimestamps = dialogState.conversations.map(function(g) { return g.timestamp; });
    stateTimestamps.sort(function(a, b) { return a - b; });
    
    if (currentTimestamps.length !== stateTimestamps.length) {
        return false;
    }
    
    for (let i = 0; i < currentTimestamps.length; i++) {
        if (currentTimestamps[i] !== stateTimestamps[i]) {
            return false;
        }
    }
    
    return true;
}

/**
 * Creates a ConversationGroup object with all DOM elements and handlers
 * @param {number} timestamp - Conversation timestamp
 * @param {Array<{timestamp: number; imageIndex: number; title: string}>} images - Images for this conversation
 * @returns {Promise<Object>} Conversation group object
 */
async function createConversationGroup(timestamp: number, images: Array<{timestamp: number; imageIndex: number; title: string}>): Promise<{
    timestamp: number;
    title: string;
    imageCount: number;
    group: HTMLElement;
    titleBar: HTMLElement;
    chevron: HTMLElement;
    collapse: HTMLElement;
    grid: HTMLElement;
    spinner: HTMLElement | null;
    isExpanded: boolean;
    isLoaded: boolean;
    isVisible: boolean;
    imageItems: Array<{
        timestamp: number;
        imageIndex: number;
        title: string;
        tags: string[];
        item: HTMLElement;
        checkbox: HTMLInputElement;
        img: HTMLImageElement;
        isSelected: boolean;
        isBroken: boolean;
        isVisible: boolean;
    }>;
}> {
    const template = document.getElementById("ref-image-dialog-group-template") as HTMLTemplateElement;
    const cloneTemplateNode = template.content.cloneNode(true) as DocumentFragment;
    const groupElement = cloneTemplateNode.firstElementChild as HTMLElement;
    
    const titleBar = groupElement.querySelector(".ref-image-title-bar") as HTMLElement;
    const chevron = groupElement.querySelector(".chevron") as HTMLElement;
    const collapse = groupElement.querySelector(".collapse") as HTMLElement;
    const grid = groupElement.querySelector(".ref-images-grid") as HTMLElement;
    const titleEl = groupElement.querySelector(".conversation-title") as HTMLElement;
    const countEl = groupElement.querySelector(".conversation-count") as HTMLElement;
    
    const title = images[0].title;
    titleEl.textContent = title;
    countEl.textContent = String(images.length);
    
    const uniqueId = "ref-collapse-" + timestamp;
    collapse.id = uniqueId;
    titleBar.setAttribute("aria-controls", uniqueId);
    titleBar.setAttribute("aria-expanded", "false");
    
    const group: {
        timestamp: number;
        title: string;
        imageCount: number;
        group: HTMLElement;
        titleBar: HTMLElement;
        chevron: HTMLElement;
        collapse: HTMLElement;
        grid: HTMLElement;
        spinner: HTMLElement | null;
        isExpanded: boolean;
        isLoaded: boolean;
        isVisible: boolean;
        imageItems: Array<{
            timestamp: number;
            imageIndex: number;
            title: string;
            tags: string[];
            item: HTMLElement;
            checkbox: HTMLInputElement;
            img: HTMLImageElement;
            isSelected: boolean;
            isBroken: boolean;
            isVisible: boolean;
        }>;
    } = {
        timestamp: timestamp,
        title: title,
        imageCount: images.length,
        group: groupElement,
        titleBar: titleBar,
        chevron: chevron,
        collapse: collapse,
        grid: grid,
        spinner: null,
        isExpanded: false,
        isLoaded: false,
        isVisible: true,
        imageItems: []
    };
    
    titleBar.addEventListener("click", function(e) {
        handleConversationClick(e, group);
    });
    
    titleBar.addEventListener("keydown", function(e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleConversationClick(e, group);
        }
    });
    
    return group;
}

/**
 * Handles click on conversation expand/collapse
 * @param {Event} _e - Click event (unused)
 * @param {Object} group - Conversation group object
 */
function handleConversationClick(_e: Event, group: {
    timestamp: number;
    title: string;
    imageCount: number;
    group: HTMLElement;
    titleBar: HTMLElement;
    chevron: HTMLElement;
    collapse: HTMLElement;
    grid: HTMLElement;
    spinner: HTMLElement | null;
    isExpanded: boolean;
    isLoaded: boolean;
    isVisible: boolean;
    imageItems: Array<{
        timestamp: number;
        imageIndex: number;
        title: string;
        tags: string[];
        item: HTMLElement;
        checkbox: HTMLInputElement;
        img: HTMLImageElement;
        isSelected: boolean;
        isBroken: boolean;
        isVisible: boolean;
    }>;
}): void {
    if (group.isExpanded) {
        collapseConversation(group);
    } else {
        expandConversation(group);
    }
}

/**
 * Expands a conversation group
 * @param {Object} group - Conversation group object
 */
function expandConversation(group: {
    collapse: HTMLElement;
    titleBar: HTMLElement;
    chevron: HTMLElement;
    grid: HTMLElement;
    spinner: HTMLElement | null;
    isExpanded: boolean;
    isLoaded: boolean;
    imageItems: Array<any>;
    timestamp: number;
}): void {
    group.collapse.classList.add("show");
    group.titleBar.setAttribute("aria-expanded", "true");
    group.chevron.classList.remove("collapsed");
    group.chevron.classList.add("expanded");
    group.isExpanded = true;
    
    if (!group.isLoaded) {
        loadImagesForConversation(group);
    }
}

/**
 * Collapses a conversation group
 * @param {Object} group - Conversation group object
 */
function collapseConversation(group: {
    collapse: HTMLElement;
    titleBar: HTMLElement;
    chevron: HTMLElement;
    isExpanded: boolean;
}): void {
    group.collapse.classList.remove("show");
    group.titleBar.setAttribute("aria-expanded", "false");
    group.chevron.classList.remove("expanded");
    group.chevron.classList.add("collapsed");
    group.isExpanded = false;
}

/**
 * Lazily loads images for a conversation
 * @param {Object} group - Conversation group object
 */
async function loadImagesForConversation(group: {
    timestamp: number;
    grid: HTMLElement;
    spinner: HTMLElement | null;
    isLoaded: boolean;
    imageItems: Array<any>;
}): Promise<void> {
    const spinner = document.createElement("div");
    spinner.className = "spinner-overlay";
    group.grid.appendChild(spinner);
    group.spinner = spinner;
    
    const images = availableImagesCache.filter(function(img) {
        return img.timestamp === group.timestamp;
    });
    
    for (const imgData of images) {
        const imageItem = await createImageItem(imgData);
        group.imageItems.push(imageItem);
        group.grid.appendChild(imageItem.item);
    }
    
    if (group.spinner) {
        group.spinner.remove();
        group.spinner = null;
    }
    
    group.isLoaded = true;
}

/**
 * Creates an ImageItem object with DOM elements and handlers
 * @param {Object} imgData - Image data
 * @returns {Promise<Object>} Image item object
 */
async function createImageItem(imgData: {
    timestamp: number;
    imageIndex: number;
    title: string;
}): Promise<{
    timestamp: number;
    imageIndex: number;
    title: string;
    tags: string[];
    item: HTMLElement;
    checkbox: HTMLInputElement;
    img: HTMLImageElement;
    isSelected: boolean;
    isBroken: boolean;
    isVisible: boolean;
}> {
    const template = document.getElementById("ref-image-dialog-item-template") as HTMLTemplateElement;
    const cloneTemplateNode = template.content.cloneNode(true) as DocumentFragment;
    const itemElement = cloneTemplateNode.firstElementChild as HTMLElement;
    
    const checkbox = itemElement.querySelector(".ref-image-checkbox") as HTMLInputElement;
    const img = itemElement.querySelector(".ref-image-dialog-thumbnail") as HTMLImageElement;
    
    const dataUrl = await getImageDataURL(imgData.timestamp, imgData.imageIndex);
    const isBroken = !dataUrl;
    
    /** @type {string[]} */
    let tags: string[] = [];
    try {
        const conversation = await loadConversation(imgData.timestamp);
        if (conversation && conversation.entries[imgData.imageIndex]) {
            const entry = conversation.entries[imgData.imageIndex];
            tags = entry.response.imageMetadata?.[imgData.imageIndex]?.tags ?? [];
        }
    } catch {
        tags = [];
    }
    
    if (dataUrl) {
        img.src = dataUrl;
    } else {
        img.src = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%236c757d'%3E%3Cpath d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E";
        itemElement.classList.add("broken-image");
        checkbox.disabled = true;
    }
    
    const imageItem: {
        timestamp: number;
        imageIndex: number;
        title: string;
        tags: string[];
        item: HTMLElement;
        checkbox: HTMLInputElement;
        img: HTMLImageElement;
        isSelected: boolean;
        isBroken: boolean;
        isVisible: boolean;
    } = {
        timestamp: imgData.timestamp,
        imageIndex: imgData.imageIndex,
        title: imgData.title,
        tags: tags,
        item: itemElement,
        checkbox: checkbox,
        img: img,
        isSelected: false,
        isBroken: isBroken,
        isVisible: true
    };
    
    checkbox.addEventListener("change", function(e) {
        handleImageCheckboxChange(e, imageItem);
    });
    
    itemElement.addEventListener("click", function(e) {
        handleImageItemClick(e, imageItem);
    });
    
    return imageItem;
}

/**
 * Handles checkbox change on image item
 * @param {Event} _e - Change event
 * @param {Object} imageItem - Image item object
 */
function handleImageCheckboxChange(_e: Event, imageItem: {
    checkbox: HTMLInputElement;
    isSelected: boolean;
}): void {
    imageItem.isSelected = imageItem.checkbox.checked;
    updateSelectedCount();
}

/**
 * Handles click on image item container
 * @param {Event} e - Click event
 * @param {Object} imageItem - Image item object
 */
function handleImageItemClick(e: Event, imageItem: {
    item: HTMLElement;
    checkbox: HTMLInputElement;
    isSelected: boolean;
}): void {
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") {
        e.preventDefault();
        e.stopPropagation();
        imageItem.checkbox.checked = !imageItem.checkbox.checked;
        imageItem.checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
}

/**
 * Updates the selected images count display
 */
function updateSelectedCount(): void {
    let count = 0;
    
    for (const group of dialogState.conversations) {
        for (const imageItem of group.imageItems) {
            if (imageItem.isSelected) {
                count++;
            }
        }
    }
    
    const countEl = document.getElementById("ref-images-selected-count");
    const addBtn = document.getElementById("ref-images-add-selected-btn") as HTMLButtonElement;
    
    if (countEl) {
        countEl.textContent = count + " images selected";
    }
    
    if (addBtn) {
        addBtn.disabled = count === 0;
    }
}

/**
 * Filters conversations by search term and tag filter
 * @param {string} searchTerm - Search term for conversation titles
 * @param {string} tagFilter - Tag filter for images
 */
function filterConversationsBySearchAndTag(searchTerm: string, tagFilter: string): void {
    dialogState.searchTerm = searchTerm;
    dialogState.tagFilter = tagFilter;
    
    const term = searchTerm.toLowerCase().trim();
    const tag = tagFilter.toLowerCase().trim();
    
    for (const group of dialogState.conversations) {
        let matchesTitle = term.length === 0 || group.title.toLowerCase().includes(term);
        
        let matchesTag = false;
        if (tag.length > 0 && group.isLoaded) {
            for (const imageItem of group.imageItems) {
                if (imageItem.tags && imageItem.tags.some(t => t.includes(tag))) {
                    matchesTag = true;
                    break;
                }
            }
        }
        
        const matches = matchesTitle && (tag.length === 0 || matchesTag);
        
        group.isVisible = matches;
        group.group.style.display = matches ? "block" : "none";
        
        if (!matches && group.isExpanded) {
            collapseConversation(group);
        }
    }
}

/**
 * Rebuilds the dialog data structure from OPFS
 * @returns {Promise<void>}
 */
async function rebuildDialogState(): Promise<void> {
    dialogState.conversations = [];
    dialogState.searchTerm = "";
    dialogState.tagFilter = "";
    
    if (availableImagesCache.length === 0) {
        availableImagesCache = await getAllAvailableImages();
    }
    
    const groupedByConversation: Record<number, Array<{timestamp: number; imageIndex: number; title: string}>> = {};
    for (const img of availableImagesCache) {
        if (!groupedByConversation[img.timestamp]) {
            groupedByConversation[img.timestamp] = [];
        }
        groupedByConversation[img.timestamp].push(img);
    }
    
    const sortedTimestamps = Object.keys(groupedByConversation)
        .map(Number)
        .sort(function(a, b) { return b - a; });
    
    for (const timestamp of sortedTimestamps) {
        const images = groupedByConversation[timestamp];
        if (images.length === 0) continue;
        
        const group = await createConversationGroup(timestamp, images);
        dialogState.conversations.push(group);
    }
    
    dialogState.lastUpdated = Date.now();
}

/**
 * Opens the reference images selection dialog
 */
export async function openReferenceImagesDialog(): Promise<void> {
    console.log("Opening reference images dialog");
    const existingDialog = document.getElementById("ref-images-dialog");
    if (existingDialog) {
        existingDialog.remove();
    }
    
    const dialog = cloneTemplate("ref-images-dialog-template", document.body);
    if (!dialog) return;
    
    const modal = new bootstrap.Modal(dialog);
    
    const isValid = await isDialogStateValid();
    
    if (!isValid) {
        await rebuildDialogState();
    }
    
    const browseList = document.getElementById("ref-images-browse-list");
    if (browseList) {
        for (const group of dialogState.conversations) {
            browseList.appendChild(group.group);
        }
    }
    
    const searchInput = dialog.querySelector("#ref-images-search") as HTMLInputElement;
    if (searchInput) {
        searchInput.value = dialogState.searchTerm;
    }
    
    const tagFilterInput = dialog.querySelector("#ref-images-tag-filter") as HTMLInputElement;
    if (tagFilterInput) {
        tagFilterInput.value = dialogState.tagFilter;
    }
    
    filterConversationsBySearchAndTag(dialogState.searchTerm, dialogState.tagFilter);
    
    for (const group of dialogState.conversations) {
        if (group.isExpanded) {
            expandConversation(group);
        }
    }
    
    setupReferenceImagesDialogListeners(dialog);
    
    modal.show();
}

/**
 * Sets up event listeners for the reference images dialog
 * @param {HTMLElement} dialogElement - The dialog element to search within
 */
export function setupReferenceImagesDialogListeners(dialogElement: HTMLElement): void {
    const uploadBtn = dialogElement.querySelector("#ref-images-upload-btn");
    const fileInput = dialogElement.querySelector("#ref-images-file-input") as HTMLInputElement | null;
    const addSelectedBtn = dialogElement.querySelector("#ref-images-add-selected-btn");
    const searchInput = dialogElement.querySelector("#ref-images-search");
    const modalElement = dialogElement as HTMLElement & {instance?: import("bootstrap").Modal};

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener("click", function() {
            fileInput.click();
        });

        fileInput.addEventListener("change", async function() {
            const file = fileInput.files?.[0];
            if (file && STATE.currentConversation) {
                const index = await uploadReferenceImage(STATE.currentConversation.timestamp, file);
                if (index !== null) {
                    invalidateDialogState();
                    await addReferenceImage(STATE.currentConversation.timestamp, index, true);
                }
                fileInput.value = "";
            }
        });
    }

    if (addSelectedBtn) {
        addSelectedBtn.addEventListener("click", async function() {
            for (const group of dialogState.conversations) {
                for (const imageItem of group.imageItems) {
                    if (imageItem.isSelected) {
                        await addReferenceImage(imageItem.timestamp, imageItem.imageIndex, false);
                        imageItem.isSelected = false;
                        imageItem.checkbox.checked = false;
                    }
                }
            }
            modalElement.instance?.hide();
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", function(e) {
            const term = (e.target as HTMLInputElement).value;
            const tagInput = dialogElement.querySelector("#ref-images-tag-filter") as HTMLInputElement;
            const tagFilter = tagInput?.value ?? "";
            filterConversationsBySearchAndTag(term, tagFilter);
        });
    }

    const tagFilterInput = dialogElement.querySelector("#ref-images-tag-filter") as HTMLInputElement;
    if (tagFilterInput) {
        tagFilterInput.addEventListener("input", function(e) {
            const tagTerm = (e.target as HTMLInputElement).value;
            const searchInputEl = dialogElement.querySelector("#ref-images-search") as HTMLInputElement;
            const searchTerm = searchInputEl?.value ?? "";
            filterConversationsBySearchAndTag(searchTerm, tagTerm);
        });
        tagFilterInput.addEventListener("blur", function() {
            const suggestionsContainer = dialogElement.querySelector("#tag-filter-suggestions") as HTMLElement;
            if (suggestionsContainer) {
                suggestionsContainer.style.display = "none";
            }
        });
    }

    dialogElement.addEventListener("hidden.bs.modal", function() {
        invalidateDialogState();
    });
}

/**
 * Adds a reference image to the current conversation's reference list and saves conversation
 * @param {number} conversationTimestamp - Source conversation's timestamp
 * @param {number} imageIndex - Image index in source conversation
 * @param {boolean} isReference - Whether this is from the reference directory (negative timestamp in storage)
 */
export async function addReferenceImage(conversationTimestamp: number, imageIndex: number, isReference: boolean): Promise<void> {
    if (!STATE.currentConversation) return;

    STATE.currentConversation.referenceImages ??= [];

    const refImage: ReferenceImage = {
        conversationTimestamp: isReference ? -conversationTimestamp : conversationTimestamp,
        imageIndex: imageIndex
    };

    STATE.currentConversation.referenceImages.push(refImage);

    await saveConversation(STATE.currentConversation.timestamp, STATE.currentConversation);

    renderReferenceImagesToolbar(STATE.currentConversation);
}

/**
 * Removes a reference image from the current conversation's reference list and saves conversation
 * @param {number} index - Index in referenceImages array to remove
 */
export async function removeReferenceImage(index: number): Promise<void> {
    if (!STATE.currentConversation?.referenceImages) return;

    STATE.currentConversation.referenceImages.splice(index, 1);

    await saveConversation(STATE.currentConversation.timestamp, STATE.currentConversation);

    renderReferenceImagesToolbar(STATE.currentConversation);
}

/**
 * Gets the data URLs for all reference images in a conversation
 * @param {ReferenceImage[]} referenceImages - Array of reference image objects
 * @returns {Promise<string[]>} Array of base64 data URLs
 */
export async function getReferenceImagesDataUrls(referenceImages: ReferenceImage[]): Promise<string[]> {
    const urls: string[] = [];

    for (const refImage of referenceImages) {
        const isReference = refImage.conversationTimestamp < 0;
        const timestamp = Math.abs(refImage.conversationTimestamp);

        let dataUrl: string | null = null;
        if (isReference) {
            dataUrl = await getReferenceImageDataUrl(timestamp, refImage.imageIndex);
        } else {
            dataUrl = await getImageDataURL(refImage.conversationTimestamp, refImage.imageIndex);
        }

        if (dataUrl) {
            urls.push(dataUrl);
        }
    }

    return urls;
}

/**
 * Loads reference images for a conversation and renders the toolbar
 * @param {Conversation} conversation - Conversation to load reference images for
 */
export function loadReferenceImagesToolbar(conversation: Conversation): void {
    if (conversation.referenceImages && conversation.referenceImages.length > 0) {
        renderReferenceImagesToolbar(conversation);
    } else {
        clearReferenceImagesToolbar();
    }
}

/**
 * Renders tag badges on an image entry
 * @param {HTMLElement} container - Container to render tags in
 * @param {string[]} tags - Array of tags to display
 * @param {number} conversationTimestamp - Conversation timestamp for edit handlers
 * @param {number} entryIndex - Entry index for edit handlers
 * @param {number} imageIndex - Image index for edit handlers
 */
function renderImageTags(container: HTMLElement, tags: string[], conversationTimestamp: number, entryIndex: number, imageIndex: number): void {
    container.innerHTML = "";
    for (const tag of tags) {
        const badgeTemplate = document.getElementById("tag-badge-template") as HTMLTemplateElement | null;
        if (!badgeTemplate) continue;
        const clone = badgeTemplate.content.cloneNode(true) as DocumentFragment;
        const badge = clone.firstElementChild as HTMLElement;
        const tagText = badge.querySelector(".tag-text") as HTMLElement;
        tagText.textContent = tag;
        const removeBtn = badge.querySelector(".remove-tag-btn") as HTMLButtonElement;
        removeBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            openTagEditor(conversationTimestamp, entryIndex, imageIndex);
        });
        container.appendChild(badge);
    }
}

/**
 * Opens the tag editor modal for an image
 * @param {number} conversationTimestamp - Conversation timestamp
 * @param {number} entryIndex - Entry index in conversation
 * @param {number} imageIndex - Image index in entry
 */
export async function openTagEditor(conversationTimestamp: number, entryIndex: number, imageIndex: number): Promise<void> {
    const conversation = await loadConversation(conversationTimestamp);
    if (!conversation) {
        displayError("Conversation not found");
        return;
    }

    const entry = conversation.entries[entryIndex];
    if (!entry) {
        displayError("Entry not found");
        return;
    }

    ensureMetadataArray(entry);

    const timestamps = await listConversations();
    /** @type {Conversation[]} */
    const allConversations: Conversation[] = [];
    for (const ts of timestamps) {
        const conv = await loadConversation(ts);
        if (conv) {
            allConversations.push(conv);
        }
    }

    const modalTemplate = document.getElementById("tag-editor-modal-template") as HTMLTemplateElement | null;
    if (!modalTemplate) {
        displayError("Tag editor template not found");
        return;
    }

    const existingModal = document.getElementById("tag-editor-modal");
    if (existingModal) {
        existingModal.remove();
    }

    const modalClone = modalTemplate.content.cloneNode(true) as DocumentFragment;
    const modalElement = modalClone.firstElementChild as HTMLElement;
    document.body.appendChild(modalElement);

    const currentTagsContainer = modalElement.querySelector(".current-tags") as HTMLElement;
    const tagInput = modalElement.querySelector(".tag-input") as HTMLInputElement;
    const suggestionsContainer = modalElement.querySelector(".tag-suggestions") as HTMLElement;
    const saveBtn = modalElement.querySelector(".save-tags-btn") as HTMLButtonElement;

    function renderCurrentTags(): void {
        currentTagsContainer.innerHTML = "";
        const updatedTags = getTagsForImage(entry, imageIndex);
        for (const tag of updatedTags) {
            const badgeTemplate = document.getElementById("tag-badge-template") as HTMLTemplateElement | null;
            if (!badgeTemplate) continue;
            const clone = badgeTemplate.content.cloneNode(true) as DocumentFragment;
            const badge = clone.firstElementChild as HTMLElement;
            const tagText = badge.querySelector(".tag-text") as HTMLElement;
            tagText.textContent = tag;
            const removeBtn = badge.querySelector(".remove-tag-btn") as HTMLButtonElement;
            removeBtn.addEventListener("click", function(e) {
                e.stopPropagation();
                setTags(entry, imageIndex, updatedTags.filter(t => t !== tag));
                renderCurrentTags();
            });
            currentTagsContainer.appendChild(badge);
        }
    }

    function showSuggestions(filter: string): void {
        suggestionsContainer.innerHTML = "";
        if (allConversations.length === 0) return;

        const normalizedFilter = filter.toLowerCase().trim();
        const allTagsList = getAllTags(allConversations);
        const currentTagsNow = getTagsForImage(entry, imageIndex);
        const suggestions = allTagsList
            .filter(t => !currentTagsNow.includes(t))
            .filter(t => !normalizedFilter || t.includes(normalizedFilter))
            .slice(0, 10);

        if (suggestions.length === 0) {
            suggestionsContainer.style.display = "none";
            return;
        }

        for (const tag of suggestions) {
            const item = document.createElement("a");
            item.className = "dropdown-item";
            item.href = "#";
            item.textContent = tag;
            item.addEventListener("click", function(e) {
                e.preventDefault();
                const currentTagsNow2 = getTagsForImage(entry, imageIndex);
                if (!currentTagsNow2.includes(tag)) {
                    const newTags = [...currentTagsNow2, tag];
                    setTags(entry, imageIndex, newTags);
                }
                tagInput.value = "";
                suggestionsContainer.style.display = "none";
                renderCurrentTags();
            });
            suggestionsContainer.appendChild(item);
        }

        suggestionsContainer.style.display = "block";
    }

    tagInput.addEventListener("input", function() {
        showSuggestions(tagInput.value);
    });

    tagInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            const newTag = tagInput.value.trim();
            if (newTag) {
                const currentTagsNow = getTagsForImage(entry, imageIndex);
                if (!currentTagsNow.includes(newTag.toLowerCase().trim())) {
                    const newTags = [...currentTagsNow, newTag.toLowerCase().trim()];
                    setTags(entry, imageIndex, newTags);
                }
                tagInput.value = "";
                suggestionsContainer.style.display = "none";
                renderCurrentTags();
            }
        }
    });

    tagInput.addEventListener("blur", function() {
        setTimeout(function() {
            suggestionsContainer.style.display = "none";
        }, 200);
    });

    renderCurrentTags();

    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    modalElement.addEventListener("hidden.bs.modal", function() {
        modalElement.remove();
    });

    saveBtn.addEventListener("click", async function() {
        await saveConversation(conversationTimestamp, conversation);
        invalidateDialogState();
        await renderConversation(conversation);
        modal.hide();
    });
}

/**
 * Updates the sync button appearance based on state
 * @param {boolean} enabled - Whether sync is enabled
 * @param {boolean} syncing - Whether sync is in progress
 */
export function updateSyncButton(enabled: boolean, syncing: boolean): void {
    const syncBtn = document.getElementById("sync-directory-btn");
    if (!syncBtn) return;

    if (enabled) {
        syncBtn.textContent = "✓💾";
        if (syncing) {
            syncBtn.setAttribute("title", "Syncing to external directory (click to stop)");
        } else {
            syncBtn.setAttribute("title", "Syncing enabled - click to stop");
        }
    } else {
        syncBtn.textContent = "💾";
        syncBtn.setAttribute("title", "Save to external directory");
    }
}

/**
 * Shows the sync progress bar
 * @param {number} current - Current progress value
 * @param {number} total - Total progress value
 */
export function showSyncProgress(current: number, total: number): void {
    const container = document.getElementById("sync-progress-container");
    const progressBar = document.getElementById("sync-progress-bar");
    const progressText = document.getElementById("sync-progress-text");

    if (!container || !progressBar || !progressText) return;

    container.style.display = "block";
    const percentage = Math.round((current / total) * 100);
    progressBar.style.width = percentage + "%";
    progressText.textContent = "Syncing " + current + "/" + total + " conversations...";
}

/**
 * Hides the sync progress bar
 * @param {boolean} showComplete - Whether to show "Complete" message
 */
export function hideSyncProgress(showComplete: boolean = false): void {
    const container = document.getElementById("sync-progress-container");
    const progressBar = document.getElementById("sync-progress-bar");
    const progressText = document.getElementById("sync-progress-text");

    if (!container || !progressBar || !progressText) return;

    if (showComplete) {
        progressBar.style.width = "100%";
        progressBar.classList.remove("progress-bar-animated");
        progressText.textContent = "Sync complete!";
        setTimeout(function() {
            container.style.display = "none";
            progressBar.classList.add("progress-bar-animated");
            progressBar.style.width = "0%";
        }, 2000);
    } else {
        container.style.display = "none";
        progressBar.style.width = "0%";
    }
}
