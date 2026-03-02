export interface Message {
    role: string;
    content: string;
}

export interface Conversation {
    timestamp: number;
    entries: ConversationEntry[];
}

export interface ConversationEntry {
    message: ConversationMessage;
    response: ResponseData;
}

export interface ConversationMessage {
    systemPrompt: string;
    text: string;
    seed: number;
    modelId?: string;
    modelName?: string;
}

export interface ResponseData {
    text: string | null;
    imageFilenames: string[];
    imageResolutions: Array<'1K' | '2K' | '4K'>;
    responseData: unknown;
    generationData: unknown;
}

export interface ConversationSummary {
    title: string;
    imageCount: number;
    entryCount: number;
    created: number;
    updated: number;
}

export interface AppState {
    selectedModel: string | null;
    visionModels: Array<{id: string; name: string}>;
    currentConversation: Conversation | null;
    conversationHistory: Message[];
    isGenerating: boolean;
    deferredPrompt: Event | null;
}
