import { db } from './db';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * RAG Service uses Gemini model to answer gym queries based strictly on the current Gym context.
 */
export async function getAiChatbotResponse(gymId: string, memberId: string, query: string): Promise<string | null> {
  try {
    const gym = await db.gym.findUnique({
      where: { id: gymId },
      include: {
        plans: true,
        chatbotSettings: true,
      },
    });

    if (!gym) return null;

    const knowledgeBase = gym.chatbotSettings?.aiKnowledgeBase || '';
    const plansStr = gym.plans
      .map((p: any) => `- ${p.name}: ₹${p.price} for ${p.durationDays} days (${p.description || 'No description'})`)
      .join('\n');

    // Build the strict RAG context
    const context = `
Gym Name: ${gym.name}
Active Membership Plans:
${plansStr || 'No plans configured yet.'}

Gym Timings, Trainers, FAQs, and Special Offers:
${knowledgeBase || 'Gym timings are Mon-Sat: 6 AM to 10 PM. Personal training is available.'}
`;

    const prompt = `
You are an AI Assistant for "${gym.name}" Gym. Your job is to answer the member's query using ONLY the gym details provided in the Context below.

Context:
${context}

Rules:
1. Do NOT hallucinate. Do NOT invent details.
2. If the answer cannot be found in the Context, respond exactly with: "I'm sorry, I don't have that information. Let me redirect you to our staff or type '4' to get our contact details."
3. Keep your response brief, helpful, and highly professional.

Member's Query: "${query}"
AI Response:
`;

    if (GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return response.text?.trim() || null;
    } else {
      // Elegant keyword fallback if Gemini API key is missing
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('plan') || lowerQuery.includes('package') || lowerQuery.includes('price') || lowerQuery.includes('cost')) {
        return `Here are our plans at ${gym.name}:\n${gym.plans.map((p: any) => `🏋️ ${p.name}: ₹${p.price} (${p.durationDays} Days)`).join('\n')}\nType '2' to renew now!`;
      }
      if (lowerQuery.includes('timing') || lowerQuery.includes('open') || lowerQuery.includes('close') || lowerQuery.includes('hours')) {
        return `We are open Monday to Saturday from 6:00 AM to 10:00 PM. We are closed on Sundays.`;
      }
      if (lowerQuery.includes('trainer') || lowerQuery.includes('coach') || lowerQuery.includes('personal')) {
        return `Yes, we have certified personal trainers at ${gym.name} to guide you. Contact gym owner to book a slot.`;
      }
      if (lowerQuery.includes('offer') || lowerQuery.includes('discount') || lowerQuery.includes('deal')) {
        return `Currently, we offer a 10% discount on Annual Membership! Ask at the reception for more details.`;
      }

      return null; // Signals fallback to chatbot menu
    }
  } catch (error) {
    console.error('RAG Service error:', error);
    return null;
  }
}
