import { generateGeminiInsights } from './gemini.js';

type InsightInput = {
  departmentAverages: Array<{ department: string; averageScore: number; stressScore: number }>;
  burnoutDepartments: string[];
  productivityTrend: number;
  confidentialCount: number;
};

function generateFallbackInsights(input: InsightInput) {
  const lowestMorale = [...input.departmentAverages].sort((a, b) => a.averageScore - b.averageScore)[0];
  const highestStress = [...input.departmentAverages].sort((a, b) => b.stressScore - a.stressScore)[0];
  const insights: string[] = [];

  if (lowestMorale) {
    insights.push(`${lowestMorale.department} shows the lowest morale score today. Consider a focused check-in with the team lead.`);
  }

  if (highestStress) {
    insights.push(`${highestStress.department} has elevated stress signals. Review workload distribution and meeting load.`);
  }

  if (input.burnoutDepartments.length) {
    insights.push(`Potential burnout risk is rising in ${input.burnoutDepartments.join(', ')}. Encourage manager follow-ups and wellness breaks.`);
  }

  if (input.productivityTrend < 0) {
    insights.push('Productivity dipped compared with the recent trend. Check whether delivery pressure or repeated meetings are slowing teams down.');
  } else {
    insights.push('Productivity is stable or improving. Reinforce the practices that are helping teams stay effective.');
  }

  if (input.confidentialCount > 0) {
    insights.push(`${input.confidentialCount} confidential concerns need review today. Prioritize high-severity themes for HR escalation.`);
  }

  return insights.slice(0, 4);
}

function buildInsightPrompt(input: InsightInput) {
  return [
    'You are an HR analytics assistant for TVS Digital. Generate exactly 4 concise executive insights based on the data below.',
    'Each insight must be a single actionable sentence. Do not include labels like "Role", "Input", "Department", or "Burnout".',
    'Do not repeat the raw data. Synthesize it into human-readable recommendations.',
    '',
    `Departments: ${input.departmentAverages.map((d) => `${d.department} (morale ${d.averageScore}%, stress ${d.stressScore}%)`).join('; ')}`,
    `High burnout risk in: ${input.burnoutDepartments.join(', ') || 'none'}`,
    `Productivity trend: ${input.productivityTrend > 0 ? '+' : ''}${input.productivityTrend} points`,
    `Confidential reports today: ${input.confidentialCount}`,
  ].join('\n');
}

export function categorizeConfidentialNote(text: string) {
  const lower = text.toLowerCase();

  if (/(harass|unsafe|abuse|bully|discriminat)/.test(lower)) {
    return { aiCategory: 'Harassment / Safety', sentiment: 'negative' as const, priority: 'high' as const };
  }

  if (/(workload|deadline|burnout|stress|pressure|overtime)/.test(lower)) {
    return { aiCategory: 'Work Pressure', sentiment: 'negative' as const, priority: 'high' as const };
  }

  if (/(system|network|laptop|wifi|tool|software|infra)/.test(lower)) {
    return { aiCategory: 'Infrastructure Issue', sentiment: 'negative' as const, priority: 'medium' as const };
  }

  if (/(manager|leadership|team lead|supervisor)/.test(lower)) {
    return { aiCategory: 'Management Concern', sentiment: 'negative' as const, priority: 'high' as const };
  }

  if (/(thanks|great|good|appreciate|happy)/.test(lower)) {
    return { aiCategory: 'Positive Note', sentiment: 'positive' as const, priority: 'low' as const };
  }

  return { aiCategory: 'General Feedback', sentiment: 'neutral' as const, priority: 'medium' as const };
}

export async function generateAiInsights(input: InsightInput) {
  const geminiInsights = await generateGeminiInsights(buildInsightPrompt(input));

  if (geminiInsights?.length) {
    return geminiInsights;
  }

  return generateFallbackInsights(input);
}
