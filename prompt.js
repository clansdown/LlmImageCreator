/**
 * System prompt constants for OpenRouter API
 */

export const SYSTEM_PROMPT = `Generate an image according to the instructions of the user.`;

export const TITLE_GENERATION_PROMPT = 
    `Generate a short, descriptive title (max 5 words) for this conversation prompt. 
    The title should capture the essence of what the user wants to generate. Return only the title text.`;

export const UPSCALE_PROMPT = 
    `Upscale this image to 4K resolution (3840x2160 pixels) while maintaining maximum quality, detail, and fidelity. Return only the upscaled image.`;
