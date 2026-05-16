import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { ConfidentialReport } from '../models/ConfidentialReport.js';
import { DailyResponse } from '../models/DailyResponse.js';
import { Employee } from '../models/Employee.js';
import { getBusinessDateKey, getBusinessDateOffset } from '../utils/businessDay.js';
import { generateAiInsights } from '../utils/insights.js';
import { pool } from '../db.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/dashboard', async (_req, res) => {
  const todayKey = getBusinessDateKey();
  const employees = await Employee.find({ select: '-password' });
  const responsesToday = await DailyResponse.find({ businessDateKey: todayKey });
  const lastSevenKeys = Array.from({ length: 7 }, (_, index) => getBusinessDateOffset(-6 + index));
  const recentResponses = await DailyResponse.find({ businessDateKey: { $in: lastSevenKeys } });
  const confidentialReports = await ConfidentialReport.find({ sort: { createdAt: -1 }, limit: 8 });

  const totalEmployees = employees.length;
  const submissionRate = totalEmployees ? Math.round((responsesToday.length / totalEmployees) * 100) : 0;
  const averageSentiment = responsesToday.length
    ? Math.round(responsesToday.reduce((sum, item) => sum + item.averageScore, 0) / responsesToday.length)
    : 0;
  const averageStress = responsesToday.length
    ? Math.round(responsesToday.reduce((sum, item) => sum + item.stressScore, 0) / responsesToday.length)
    : 0;
  const averageEngagement = responsesToday.length
    ? Math.round(responsesToday.reduce((sum, item) => sum + item.engagementScore, 0) / responsesToday.length)
    : 0;

  const departments = Array.from(new Set(responsesToday.map((item) => item.department)));
  const departmentStats = departments.map((department) => {
    const items = responsesToday.filter((response) => response.department === department);
    return {
      department,
      count: items.length,
      averageScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.averageScore, 0) / items.length) : 0,
      stressScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.stressScore, 0) / items.length) : 0,
      engagementScore: items.length ? Math.round(items.reduce((sum, item) => sum + item.engagementScore, 0) / items.length) : 0,
    };
  });

  const moodTrend = lastSevenKeys.map((key) => {
    const items = recentResponses.filter((response) => response.businessDateKey === key);
    return {
      date: key,
      mood: items.length ? Math.round(items.reduce((sum, item) => sum + item.moodScore, 0) / items.length) : 0,
      stress: items.length ? Math.round(items.reduce((sum, item) => sum + item.stressScore, 0) / items.length) : 0,
      engagement: items.length ? Math.round(items.reduce((sum, item) => sum + item.engagementScore, 0) / items.length) : 0,
    };
  });

  const burnoutHeatmap = departmentStats.map((item) => ({
    team: item.department,
    burnoutRisk: item.stressScore,
    morale: item.averageScore,
  }));

  const scatter = responsesToday.map((item) => ({
    team: item.department,
    employeeId: item.employeeId,
    stress: item.stressScore,
    productivity: item.productivityScore,
  }));

  const recentAverage = moodTrend.slice(0, 6).filter((item) => item.mood > 0);
  const baseline = recentAverage.length
    ? recentAverage.reduce((sum, item) => sum + item.mood, 0) / recentAverage.length
    : averageSentiment;

  const aiInsights = await generateAiInsights({
    departmentAverages: departmentStats,
    burnoutDepartments: departmentStats.filter((item) => item.stressScore >= 65).map((item) => item.department),
    productivityTrend: averageSentiment - baseline,
    confidentialCount: confidentialReports.length,
  });

  const employeeDirectory = employees
    .filter((employee) => employee.role === 'employee')
    .map((employee) => {
      const latest = recentResponses
        .filter((response) => response.employeeId === employee.employeeId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

      return {
        id: String(employee._id),
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        location: employee.location,
        latestAverageScore: latest?.averageScore || 0,
        latestStressScore: latest?.stressScore || 0,
        lastSubmittedAt: latest?.submittedAt || null,
      };
    });

  const allDailyResponses = await DailyResponse.find({}, { sort: { submittedAt: -1 } });
  const allConfidential = await ConfidentialReport.find();

  const allResponses = allDailyResponses.map((response) => {
    const report = allConfidential.find(
      (r) => r.employeeId === response.employeeId && r.businessDateKey === response.businessDateKey
    );
    return {
      id: String(response._id),
      employeeId: response.employeeId,
      name: response.name,
      department: response.department,
      businessDateKey: response.businessDateKey,
      submittedAt: response.submittedAt,
      mood: response.mood,
      moodScore: response.moodScore,
      averageScore: response.averageScore,
      stressScore: response.stressScore,
      engagementScore: response.engagementScore,
      productivityScore: response.productivityScore,
      answers: response.answers,
      confidentialNote: response.confidentialNote,
      anonymousNote: response.anonymousNote,
      aiCategory: report?.aiCategory,
      sentiment: report?.sentiment,
      priority: report?.priority,
    };
  });

  return res.json({
    overview: {
      totalEmployees,
      submissionsToday: responsesToday.length,
      submissionRate,
      sentimentScore: averageSentiment,
      stressMeter: averageStress,
      engagementScore: averageEngagement,
    },
    departmentStats,
    moodTrend,
    burnoutHeatmap,
    productivityVsStress: scatter,
    confidentialReports: confidentialReports.map((report) => ({
      id: String(report._id),
      employeeId: report.anonymous ? 'Anonymous' : report.employeeId,
      anonymous: report.anonymous,
      text: report.text,
      aiCategory: report.aiCategory,
      sentiment: report.sentiment,
      priority: report.priority,
      businessDateKey: report.businessDateKey,
      createdAt: report.createdAt,
    })),
    aiInsights,
    employeeDirectory,
    allResponses,
  });
});

router.post('/reset', async (_req, res) => {
  await pool.query('DELETE FROM daily_responses');
  await pool.query('DELETE FROM confidential_reports');
  await pool.query("DELETE FROM employees WHERE role != 'admin'");
  return res.json({ message: 'All employee data has been reset. Admin account preserved.' });
});

export default router;
