import { Quiz } from "../types";

// Service deprecated as per user request to remove AI.
export const geminiService = {
  generateDailyQuiz: async (): Promise<Quiz | null> => {
    return null;
  }
};