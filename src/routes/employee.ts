import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { DailyResponse } from '../models/DailyResponse.js';
import { Employee } from '../models/Employee.js';
import { Question } from '../models/Question.js';
import { ConfidentialReport } from '../models/ConfidentialReport.js';
import { getBusinessDateKey, getNextResetAt } from '../utils/businessDay.js';
import { pickQuestions } from '../utils/questionPicker.js';
import { categorizeConfidentialNote } from '../utils/insights.js';

const router = Router();

const moodScores: Record<string, number> = {
  excited: 5,
  happy: 4,
  neutral: 3,
  tired: 2,
  stressed: 1,
};

const submitSchema = z.object({
  mood: z.enum(['excited', 'happy', 'neutral', 'tired', 'stressed']),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string().min(1),
    })
  ).min(5).max(10),
  confidentialNote: z.string().max(1200).optional().or(z.literal('')),
  anonymousNote: z.boolean().default(false),
});

function getWellnessTip(averageScore: number, stressScore: number) {
  if (stressScore >= 70) {
    return 'Your stress indicators look elevated. Try blocking recovery time and raise blockers with your manager early.';
  }

  if (averageScore >= 80) {
    return 'You are showing strong energy today. Keep momentum by protecting focused work time.';
  }

  return 'Build your day around one priority outcome, one collaboration task, and one short reset break.';
}

router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  const employee = await Employee.findById(req.user.id);

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  const businessDateKey = getBusinessDateKey();
  const allQuestions = await Question.find({ active: true });
  const questions = pickQuestions(allQuestions, businessDateKey, employee.department);
  const todayResponse = await DailyResponse.findOne({ employeeId: employee.employeeId, businessDateKey });
  const history = await DailyResponse.find(
    { employeeId: employee.employeeId },
    { sort: { submittedAt: -1 }, limit: 7 }
  );

  const latestAverage = history.length
    ? Math.round(history.reduce((sum, item) => sum + item.averageScore, 0) / history.length)
    : 0;
  const latestStress = history.length
    ? Math.round(history.reduce((sum, item) => sum + item.stressScore, 0) / history.length)
    : 0;

  return res.json({
    employee,
    todayStatus: {
      businessDateKey,
      canSubmit: !todayResponse,
      submittedAt: todayResponse?.submittedAt || null,
      nextResetAt: getNextResetAt().toISOString(),
    },
    todayResponse,
    questions,
    history: history.reverse(),
    summary: {
      averageScore: latestAverage,
      stressScore: latestStress,
      tip: getWellnessTip(latestAverage, latestStress),
    },
    notification: {
      title: 'Good Morning! Please complete today’s workplace pulse check.',
      description: 'Your feedback helps TVS Digital improve workplace culture, support, and wellbeing.',
    },
  });
});

router.post('/submit', async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid submission payload.' });
  }

  if (!req.user?.id) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const employee = await Employee.findById(req.user.id);

  if (!employee) {
    return res.status(404).json({ message: 'Employee not found.' });
  }

  const businessDateKey = getBusinessDateKey();
  const existing = await DailyResponse.findOne({ employeeId: employee.employeeId, businessDateKey });

  if (existing) {
    return res.status(409).json({ message: 'You have already submitted feedback for today.' });
  }

  const allQuestions = await Question.find({ active: true });
  const selectedQuestions = pickQuestions(allQuestions, businessDateKey, employee.department);

  if (parsed.data.answers.length !== selectedQuestions.length) {
    return res.status(400).json({ message: 'Please answer all daily questions before submitting.' });
  }

  const answerRecords = selectedQuestions.map((question) => {
    const submitted = parsed.data.answers.find((item) => item.questionId === question.id);

    if (!submitted) {
      throw new Error('Missing answer for one or more questions.');
    }

    const optionIndex = question.options.findIndex((option) => option === submitted.answer);

    if (optionIndex === -1) {
      throw new Error(`Invalid answer supplied for question: ${question.question}`);
    }

    return {
      questionId: question.id,
      question: question.question,
      answer: submitted.answer,
      score: Math.max(1, 5 - optionIndex),
      category: question.category,
    };
  });

  const averageBase = answerRecords.reduce((sum, item) => sum + item.score, 0) / answerRecords.length;
  const stressItems = answerRecords.filter((item) => item.category === 'Stress & Wellness');
  const productivityItems = answerRecords.filter((item) => item.category === 'Productivity & Support');
  const engagementItems = answerRecords.filter((item) => item.category === 'Environment & Culture' || item.category === 'Innovation & Growth');

  const averageScore = Math.round(averageBase * 20);
  const stressScore = stressItems.length
    ? Math.round((stressItems.reduce((sum, item) => sum + (6 - item.score), 0) / stressItems.length) * 20)
    : Math.round((6 - averageBase) * 20);
  const productivityScore = productivityItems.length
    ? Math.round((productivityItems.reduce((sum, item) => sum + item.score, 0) / productivityItems.length) * 20)
    : averageScore;
  const engagementScore = engagementItems.length
    ? Math.round((engagementItems.reduce((sum, item) => sum + item.score, 0) / engagementItems.length) * 20)
    : averageScore;

  const createdResponse = await DailyResponse.create({
    employee: employee._id,
    employeeId: employee.employeeId,
    name: employee.name,
    department: employee.department,
    mood: parsed.data.mood,
    moodScore: moodScores[parsed.data.mood] * 20,
    businessDateKey,
    submittedAt: new Date(),
    answers: answerRecords.map(({ category, ...answer }) => answer),
    averageScore,
    stressScore,
    engagementScore,
    productivityScore,
    confidentialNote: parsed.data.confidentialNote || undefined,
    anonymousNote: parsed.data.anonymousNote,
  });

  if (parsed.data.confidentialNote && parsed.data.confidentialNote.trim()) {
    const classified = categorizeConfidentialNote(parsed.data.confidentialNote);
    await ConfidentialReport.create({
      employee: employee._id,
      employeeId: employee.employeeId,
      businessDateKey,
      anonymous: parsed.data.anonymousNote,
      text: parsed.data.confidentialNote.trim(),
      aiCategory: classified.aiCategory,
      sentiment: classified.sentiment,
      priority: classified.priority,
    });
  }

  return res.status(201).json({
    message: 'Thank you for helping improve workplace culture.',
    response: createdResponse,
    nextResetAt: getNextResetAt().toISOString(),
  });
});

export default router;
