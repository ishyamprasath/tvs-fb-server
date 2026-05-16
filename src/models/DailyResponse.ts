import { query, queryOne } from '../db.js';

export interface AnswerItem {
  questionId: string;
  question: string;
  answer: string;
  score: number;
}

export interface DailyResponseDocument {
  _id: number;
  employee: number;
  employeeId: string;
  name: string;
  department: string;
  mood: string;
  moodScore: number;
  businessDateKey: string;
  submittedAt: Date;
  answers: AnswerItem[];
  averageScore: number;
  stressScore: number;
  engagementScore: number;
  productivityScore: number;
  confidentialNote?: string;
  anonymousNote: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): DailyResponseDocument {
  return {
    _id: row.id,
    employee: row.employee_id,
    employeeId: row.employee_id_str,
    name: row.name,
    department: row.department,
    mood: row.mood,
    moodScore: row.mood_score,
    businessDateKey: row.business_date_key,
    submittedAt: row.submitted_at,
    answers: row.answers || [],
    averageScore: row.average_score,
    stressScore: row.stress_score,
    engagementScore: row.engagement_score,
    productivityScore: row.productivity_score,
    confidentialNote: row.confidential_note,
    anonymousNote: row.anonymous_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRows(rows: any[]): DailyResponseDocument[] {
  return rows.map(mapRow);
}

export const DailyResponse = {
  async findOne(filter: { employeeId?: string; businessDateKey?: string }): Promise<DailyResponseDocument | null> {
    let sql = 'SELECT * FROM daily_responses WHERE 1=1';
    const params: any[] = [];

    if (filter.employeeId) {
      sql += ` AND employee_id_str = $${params.length + 1}`;
      params.push(filter.employeeId);
    }
    if (filter.businessDateKey) {
      sql += ` AND business_date_key = $${params.length + 1}`;
      params.push(filter.businessDateKey);
    }

    const row = await queryOne(sql, params);
    return row ? mapRow(row) : null;
  },

  async find(
    filter: { businessDateKey?: string | { $in: string[] }; employeeId?: string } = {},
    options?: { sort?: { submittedAt?: 1 | -1; createdAt?: 1 | -1 }; limit?: number; lean?: boolean }
  ): Promise<DailyResponseDocument[]> {
    let sql = 'SELECT * FROM daily_responses WHERE 1=1';
    const params: any[] = [];

    if (filter.businessDateKey) {
      if (typeof filter.businessDateKey === 'string') {
        sql += ` AND business_date_key = $${params.length + 1}`;
        params.push(filter.businessDateKey);
      } else if ('$in' in filter.businessDateKey) {
        const placeholders = filter.businessDateKey.$in.map((_, i) => `$${params.length + 1 + i}`).join(',');
        sql += ` AND business_date_key IN (${placeholders})`;
        params.push(...filter.businessDateKey.$in);
      }
    }

    if (filter.employeeId) {
      sql += ` AND employee_id_str = $${params.length + 1}`;
      params.push(filter.employeeId);
    }

    if (options?.sort?.submittedAt === -1 || options?.sort?.createdAt === -1) {
      sql += ' ORDER BY submitted_at DESC';
    } else if (options?.sort?.submittedAt === 1 || options?.sort?.createdAt === 1) {
      sql += ' ORDER BY submitted_at ASC';
    } else {
      sql += ' ORDER BY submitted_at DESC';
    }

    if (options?.limit) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }

    const rows = await query(sql, params);
    return mapRows(rows);
  },

  async create(data: Omit<DailyResponseDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<DailyResponseDocument> {
    const row = await queryOne(
      `INSERT INTO daily_responses
       (employee_id, employee_id_str, name, department, mood, mood_score, business_date_key, submitted_at, answers, average_score, stress_score, engagement_score, productivity_score, confidential_note, anonymous_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        data.employee,
        data.employeeId,
        data.name,
        data.department,
        data.mood,
        data.moodScore,
        data.businessDateKey,
        data.submittedAt,
        JSON.stringify(data.answers),
        data.averageScore,
        data.stressScore,
        data.engagementScore,
        data.productivityScore,
        data.confidentialNote || null,
        data.anonymousNote,
      ]
    );
    return mapRow(row!);
  },

  async deleteMany(): Promise<void> {
    await query('DELETE FROM daily_responses');
  },
};
