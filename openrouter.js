/**
 * OpenRouter API functions
 * Handles communication with OpenRouter for models, balance, and image generation
 */

/** @type {string} */
var OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Fetches all available models from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Array<Object>>} Array of model objects with image generation capability
 * @throws {Error} If API request fails
 */
function fetchModels(apiKey) {
    return fetch(OPENROUTER_BASE_URL + "/models", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json"
        }
    }).then(function(response) {
        if (!response.ok) {
            throw new Error("Failed to fetch models: " + response.status);
        }
        return response.json();
    }).then(function(data) {
        var allModels = data.data || [];
        var imageModels = allModels.filter(function(model) {
            return model.architecture &&
                   model.architecture.output_modalities &&
                   model.architecture.output_modalities.indexOf("image") !== -1;
        });
        imageModels.sort(function(a, b) {
            var nameA = (a.name || "").toLowerCase();
            var nameB = (b.name || "").toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });
        return imageModels;
    });
}

/**
 * Fetches the account balance from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Object>} Object with total_credits and total_usage
 * @throws {Error} If API request fails
 */
function fetchBalance(apiKey) {
    return fetch(OPENROUTER_BASE_URL + "/credits", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json"
        }
    }).then(function(response) {
        if (!response.ok) {
            throw new Error("Failed to fetch balance: " + response.status);
        }
        return response.json();
    }).then(function(data) {
        return {
            totalCredits: data.data.total_credits,
            totalUsage: data.data.total_usage
        };
    });
}

/**
 * Generates an image using OpenRouter chat completion
 * @param {string} apiKey - OpenRouter API key
 * @param {string} prompt - User's image generation prompt
 * @param {string} model - Model ID to use
 * @param {string} systemPrompt - System prompt
 * @param {Array<Object>} conversationHistory - Previous messages for context
 * @param {Object} imageConfig - Image configuration options
 * @param {string} imageConfig.imageSize - Image size (1K, 2K, 4K)
 * @param {string} imageConfig.aspectRatio - Aspect ratio (1:1, 16:9, 3:2, 21:9)
 * @param {number} [seed] - Seed for reproducible generation
 * @returns {Promise<Object>} Chat completion response with images
 * @throws {Error} If API request fails
 */
function generateImage(apiKey, prompt, model, systemPrompt, conversationHistory, imageConfig, seed) {
    /** @type {Array<{role: string, content: string}>} */
    var messages = [];

    if (systemPrompt) {
        messages.push({
            role: "system",
            content: systemPrompt
        });
    }

    if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach(function(msg) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });
    }

    messages.push({
        role: "user",
        content: prompt
    });

    /** @type {Object} */
    var body = {
        model: model,
        messages: messages,
        modalities: ["image", "text"]
    };

    if (imageConfig) {
        /** @type {Object} */
        var imageConfigObj = {};
        if (imageConfig.imageSize) {
            imageConfigObj.image_size = imageConfig.imageSize;
        }
        if (imageConfig.aspectRatio) {
            imageConfigObj.aspect_ratio = imageConfig.aspectRatio;
        }
        if (Object.keys(imageConfigObj).length > 0) {
            body.image_config = imageConfigObj;
        }
    }

    if (typeof seed !== "undefined" && seed !== null) {
        body.seed = seed;
    }

    return fetch(OPENROUTER_BASE_URL + "/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    }).then(function(response) {
        if (!response.ok) {
            return response.text().then(function(text) {
                throw new Error("Failed to generate image: " + response.status + " - " + text);
            });
        }
        return response.json();
    });
}

/**
 * Queries generation information from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @param {string} generationId - Generation ID from chat completion response
 * @returns {Promise<Object>} Generation info with usage and cost
 * @throws {Error} If API request fails
 */
function getGenerationInfo(apiKey, generationId) {
    return fetch(OPENROUTER_BASE_URL + "/generation?id=" + generationId, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + apiKey,
            "Content-Type": "application/json"
        }
    }).then(function(response) {
        if (!response.ok) {
            throw new Error("Failed to fetch generation info: " + response.status);
        }
        return response.json();
    });
}
