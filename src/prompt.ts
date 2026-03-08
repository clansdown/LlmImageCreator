/**
 * System prompt constants for OpenRouter API
 */

export const SYSTEM_PROMPT: string = `Generate an image according to the instructions of the user.`;

export const TITLE_GENERATION_PROMPT: string = 
    `Generate a short, descriptive title (max 5 words) for the image the user wants in the conversation prompt. 
    The title should capture the essence of the image the user wants to generate. 
    Do not include words such as "image", "photo", "picture", "render", "generate", "create", "artwork", or "illustration" in the title. These are obvious.
    Return only the title text.`;

export const UPSCALE_PROMPT: string = 
    `Upscale this image to 4K resolution (3840x2160 pixels) while maintaining maximum quality, detail, and fidelity. Return only the upscaled image.`;
