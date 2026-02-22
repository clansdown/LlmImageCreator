/**
 * OpenRouter API functions
 * Handles communication with OpenRouter for models, balance, and image generation
 */

import { SYSTEM_PROMPT } from './prompt.js';

/** @type {string} */
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Fetches all available models from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Array<Object>>} Array of model objects with image generation capability
 * @throws {Error} If API request fails
 */
export function fetchModels(apiKey) {
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
        const allModels = data.data || [];
        const imageModels = allModels.filter(function(model) {
            return model.architecture &&
                   model.architecture.output_modalities &&
                   model.architecture.output_modalities.indexOf("image") !== -1;
        });
        imageModels.sort(function(a, b) {
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });
        return imageModels;
    });
}

/**
 * Fetches all available vision models from OpenRouter (image input + image output)
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Array<Object>>} Array of vision model objects
 * @throws {Error} If API request fails
 */
export function fetchVisionModels(apiKey) {
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
        const allModels = data.data || [];
        const visionModels = allModels.filter(function(model) {
            const hasImageOut = model.architecture &&
                                model.architecture.output_modalities &&
                                model.architecture.output_modalities.indexOf("image") !== -1;
            const hasImageIn = model.architecture &&
                               model.architecture.input_modalities &&
                               model.architecture.input_modalities.indexOf("image") !== -1;
            return hasImageOut && hasImageIn;
        });
        visionModels.sort(function(a, b) {
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        });
        return visionModels;
    });
}

/**
 * Fetches the account balance from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @returns {Promise<Object>} Object with total_credits and total_usage
 * @throws {Error} If API request fails
 */
export function fetchBalance(apiKey) {
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
 * @param {Object} [imageInput] - Optional image input for vision models
 * @param {string} imageInput.imageData - Base64 data URL of the image
 * @returns {Promise<Object>} Chat completion response with images
 * @throws {Error} If API request fails
 */
export async function generateImage(apiKey, prompt, model, systemPrompt, conversationHistory, imageConfig, seed, imageInput) {
    /** @type {Array<{role: string, content: string}>} */
    const messages = [];

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

    if (imageInput && imageInput.imageData) {
        messages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: prompt
                },
                {
                    type: "image_url",
                    image_url: {
                        url: imageInput.imageData
                    }
                }
            ]
        });
    } else {
        messages.push({
            role: "user",
            content: prompt
        });
    }

    /** @type {Object} */
    const body = {
        model: model,
        messages: messages,
        modalities: ["image", "text"]
    };

    if (imageConfig) {
        /** @type {Object} */
        const imageConfigObj = {};
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

    console.log("Image generation request:", {
        model: model,
        prompt: prompt.substring(0, 100) + "...",
        image_config: imageConfig,
        hasImageInput: !!imageInput
    });

    try {
        const response = await fetch(OPENROUTER_BASE_URL + "/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        console.log("Response status:", response.status, response.statusText);

        if (!response.ok) {
            const text = await response.text();
            console.log("Error response body:", text);

            let errorMessage = "Failed to generate image: " + response.status;

            try {
                const errorData = JSON.parse(text);
                console.log("Parsed error data:", errorData);

                if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                    if (errorData.error.code) {
                        errorMessage += " (code: " + errorData.error.code + ")";
                    }
                    if (errorData.error.type) {
                        errorMessage += " (type: " + errorData.error.type + ")";
                    }
                }
            } catch (e) {
                errorMessage += " - " + text;
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();

        console.log("Response structure keys:", Object.keys(data));
        console.log("Choices count:", data.choices?.length);

        if (!data.choices || data.choices.length === 0) {
            console.error("Invalid response: No choices in response");
            throw new Error("No choices returned from OpenRouter");
        }

        const message = data.choices[0].message;
        console.log("Message keys:", message ? Object.keys(message) : "null");

        const images = message?.images;
        if (!images || images.length === 0) {
            console.error("No images returned in response");
            console.log("Full response data:", JSON.stringify(data, null, 2));
            throw new Error("No images returned by model");
        }

        console.log("Images count:", images.length);

        return data;
    } catch (error) {
        console.error("generateImage error:", error);
        throw error;
    }
}

/**
 * Queries generation information from OpenRouter
 * @param {string} apiKey - OpenRouter API key
 * @param {string} generationId - Generation ID from chat completion response
 * @returns {Promise<Object>} Generation info with usage and cost
 * @throws {Error} If API request fails
 */
export function getGenerationInfo(apiKey, generationId) {
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

/**
 * Generates text-only completion for conversation title
 * @param {string} apiKey - OpenRouter API key
 * @param {string} prompt - User's prompt to summarize
 * @param {string} systemPrompt - System prompt for title generation
 * @param {string} model - Model ID (google/gemma-3n-e4b-it)
 * @returns {Promise<string>} Generated title text
 * @throws {Error} If API request fails
 */
export function generateTitle(apiKey, prompt, systemPrompt, model) {
    /** @type {Array<{role: string, content: string}>} */
    const messages = [];
    
    messages.push({
        role: "system",
        content: systemPrompt
    });
    
    messages.push({
        role: "user",
        content: prompt
    });
    
    /** @type {Object} */
    const body = {
        model: model,
        messages: messages
    };
    
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
                throw new Error("Failed to generate title: " + response.status + " - " + text);
            });
        }
        return response.json();
    }).then(function(data) {
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            return data.choices[0].message.content || "";
        }
        return "";
    });
}
