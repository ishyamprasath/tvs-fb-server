import { pool, connectDatabase, initTables } from './db.js';
import { Employee } from './models/Employee.js';
import { Question } from './models/Question.js';
import { DailyResponse } from './models/DailyResponse.js';
import { ConfidentialReport } from './models/ConfidentialReport.js';
import { seedQuestions } from './data/seedQuestions.js';
import { hashPassword } from './utils/auth.js';
import { getBusinessDateOffset } from './utils/businessDay.js';
import { categorizeConfidentialNote } from './utils/insights.js';

const employees = [
  {
    employeeId: 'ADMIN001',
    name: 'Priya Narayanan',
    email: 'admin@tvsd.ai',
    password: 'Admin@123',
    department: 'hr',
    role: 'admin' as const,
    designation: 'HR Business Partner',
    location: 'Chennai HQ',
  },
  {
    employeeId: 'TVS1001',
    name: 'Anita Raman',
    email: 'anita@tvsd.ai',
    password: 'Password@123',
    department: 'engineering',
    role: 'employee' as const,
    designation: 'Senior Developer',
    location: 'Chennai',
  },
  {
    employeeId: 'TVS1002',
    name: 'Rahul Iyer',
    email: 'rahul@tvsd.ai',
    password: 'Password@123',
    department: 'design',
    role: 'employee' as const,
    designation: 'Product Designer',
    location: 'Bengaluru',
  },
  {
    employeeId: 'TVS1003',
    name: 'Meena Karthik',
    email: 'meena@tvsd.ai',
    password: 'Password@123',
    department: 'hr',
    role: 'employee' as const,
    designation: 'People Operations Specialist',
    location: 'Chennai HQ',
  },
  {
    employeeId: 'TVS1004',
    name: 'Arjun S',
    email: 'arjun@tvsd.ai',
    password: 'Password@123',
    department: 'engineering',
    role: 'employee' as const,
    designation: 'Platform Engineer',
    location: 'Pune',
  },
];

function createSeedAnswer(questionId: string, question: string, answer: string, score: number) {
  return { questionId, question, answer, score };
}

async function main() {
  await connectDatabase();
  await initTables();

  await Question.deleteMany();
  await Employee.deleteMany();
  await DailyResponse.deleteMany();
  await ConfidentialReport.deleteMany();

  await Question.insertMany(seedQuestions as any);

  const insertedEmployees: Array<{ _id: number; employeeId: string; name: string; department: string }> = [];

  for (const employee of employees) {
    const created = await Employee.create({
      ...employee,
      password: await hashPassword(employee.password),
    });

    insertedEmployees.push({
      _id: created._id,
      employeeId: created.employeeId,
      name: created.name,
      department: created.department,
    });
  }

  const questions = await Question.find({ active: true });
  const commonQuestions = questions.slice(0, 6);

  const seedNotes = [
    'Workload pressure increased after deployment meetings this week.',
    'The design review process is collaborative and helpful.',
    'Laptop performance slowed down during production support.',
    'I appreciate the flexibility from the team lead today.',
  ];

  for (let dayOffset = -5; dayOffset <= 0; dayOffset += 1) {
    const businessDateKey = getBusinessDateOffset(dayOffset);

    for (const [index, employee] of insertedEmployees.entries()) {
      if (employee.employeeId === 'ADMIN001') {
        continue;
      }

      const baseScore = 5 - ((index + dayOffset + 7) % 3);
      const averageScore = Math.max(45, Math.min(92, baseScore * 18 + 8));
      const stressScore = Math.max(18, Math.min(88, 100 - averageScore + index * 6));
      const engagementScore = Math.max(40, Math.min(95, averageScore + 4));
      const productivityScore = Math.max(38, Math.min(96, averageScore + 2 - index * 3));

      const answers = commonQuestions.map((question: any, questionIndex: number) => {
        const optionIndex = Math.min(question.options.length - 1, Math.max(0, 5 - baseScore + (questionIndex % 2 === 0 ? 0 : 1)));
        const score = Math.max(1, 5 - optionIndex);
        return createSeedAnswer(String(question._id), question.question, question.options[optionIndex], score);
      });

      const mood = averageScore >= 80 ? 'happy' : averageScore >= 65 ? 'neutral' : 'stressed';
      const note = dayOffset % 2 === 0 && index % 2 === 0 ? seedNotes[(index + dayOffset + seedNotes.length) % seedNotes.length] : undefined;

      await DailyResponse.create({
        employee: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        department: employee.department,
        mood,
        moodScore: mood === 'happy' ? 80 : mood === 'neutral' ? 60 : 30,
        businessDateKey,
        submittedAt: new Date(),
        answers,
        averageScore,
        stressScore,
        engagementScore,
        productivityScore,
        confidentialNote: note,
        anonymousNote: Boolean(note && index % 3 === 0),
      } as any);

      if (note) {
        const classified = categorizeConfidentialNote(note);
        await ConfidentialReport.create({
          employee: employee._id,
          employeeId: employee.employeeId,
          businessDateKey,
          anonymous: index % 3 === 0,
          text: note,
          aiCategory: classified.aiCategory,
          sentiment: classified.sentiment,
          priority: classified.priority,
        } as any);
      }
    }
  }

  console.log('Seed complete. Demo users and analytics data are ready.');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Seed failed', error);
  await pool.end();
  process.exit(1);
});
