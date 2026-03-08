export interface Message {
    role: string;
    content: string;
}

export interface ReferenceImage {
    conversationTimestamp: number;
    imageIndex: number;
}

export interface Conversation {
    timestamp: number;
    entries: ConversationEntry[];
    referenceImages?: ReferenceImage[];
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
    referenceImages?: ReferenceImage[];
}

export interface ImageMetadata {
    tags: string[];
    rating?: number | null;
}

export interface ResponseData {
    text: string | null;
    imageFilenames: string[];
    imageResolutions: Array<'1K' | '2K' | '4K'>;
    responseData: unknown;
    generationData: unknown;
    imageMetadata?: ImageMetadata[];
}

export interface TaggedImage {
    conversationTimestamp: number;
    imageIndex: number;
    tags: string[];
    rating?: number | null;
    conversationTitle?: string;
}

export interface ConversationSummary {
    title: string;
    imageCount: number;
    entryCount: number;
    created: number;
    updated: number;
}

export interface ExternalSyncState {
    directoryHandle: FileSystemDirectoryHandle | null;
    isSyncing: boolean;
    syncEnabled: boolean;
    syncProgress: { current: number; total: number } | null;
}

export interface AppState {
    selectedModel: string | null;
    visionModels: Array<{id: string; name: string}>;
    currentConversation: Conversation | null;
    conversationHistory: Message[];
    isGenerating: boolean;
    deferredPrompt: Event | null;
    externalSync: ExternalSyncState;
}
