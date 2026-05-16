import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

export async function generateGeminiInsights(prompt: string) {
  if (!config.geminiApiKey) {
    return null;
  }

  try {
    const client = new GoogleGenerativeAI(config.geminiApiKey);
    const model = client.getGenerativeModel({ model: config.geminiModel });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    if (!text?.trim()) {
      return null;
    }

    const lines = text
      .split('\n')
      .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
      .filter((line) => {
        if (!line) return false;
        const lower = line.toLowerCase();
        const junk = ['role:', 'input', 'department averages', 'burnout risk', 'productivity trend', 'confidential', 'you are an hr', 'generate exactly', 'each insight', 'do not', 'departments:', 'constraints:', 'exactly', 'single', 'morale', 'stress', 'points', 'none'];
        if (junk.some((phrase) => lower.includes(phrase))) return false;
        if (/^\w+:\s*\d+%/.test(line)) return false;
        if (/^\w+:\s*\w+:\s*\d+%/.test(line)) return false;
        return true;
      })
      .slice(0, 4);

    return lines.length >= 2 ? lines : null;
  } catch (error) {
    console.error('Gemini insight generation failed, using fallback insights.', error);
    return null;
  }
}
