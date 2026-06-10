export interface SaveChatExchangeParams{
    sessionId: string;
    projectId?: string;
    userMessage: string;
    aireply: string;
    engine: string;
}

export const chatPersistenceService = {

    async saveChatExchange(_params: SaveChatExchangeParams): Promise<void>{

    },

    async saveDailySummary(_params: {
        sessionId: string;
        projectId?: string;
        content: string;
        weaknesses?: string;
    }):Promise<void>{

    },

    async saveMemory(_params: {
    sessionId: string;
    type: "weakness" | "progress" | "preference";
    title: string;
    content: string;
  }): Promise<void> {
    
  }
}

