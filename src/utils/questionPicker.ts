import { QuestionDocument } from '../models/Question.js';

function hashString(value: string) {
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function pickQuestions(
  questions: QuestionDocument[],
  businessDateKey: string,
  department: string
) {
  const normalizedDepartment = department.trim().toLowerCase();
  const filtered = questions.filter((question) => {
    return question.audience.includes('all') || question.audience.includes(normalizedDepartment);
  });

  const sorted = [...filtered].sort((a, b) => {
    const left = hashString(`${businessDateKey}-${normalizedDepartment}-${a.question}`);
    const right = hashString(`${businessDateKey}-${normalizedDepartment}-${b.question}`);
    return left - right;
  });

  return sorted.slice(0, 6).map((question) => ({
    id: String(question._id),
    question: question.question,
    category: question.category,
    options: question.options,
  }));
}
