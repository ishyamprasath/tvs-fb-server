import { query, queryOne } from '../db.js';

export interface QuestionDocument {
  _id: number;
  question: string;
  category: string;
  audience: string[];
  type: 'single';
  options: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): QuestionDocument {
  return {
    _id: row.id,
    question: row.question,
    category: row.category,
    audience: row.audience,
    type: row.type,
    options: row.options,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRows(rows: any[]): QuestionDocument[] {
  return rows.map(mapRow);
}

export const Question = {
  async find(filter: { active?: boolean } = {}): Promise<QuestionDocument[]> {
    let sql = 'SELECT * FROM questions';
    const params: any[] = [];

    if (filter.active !== undefined) {
      sql += ` WHERE active = $${params.length + 1}`;
      params.push(filter.active);
    }

    sql += ' ORDER BY id';

    const rows = await query(sql, params);
    return mapRows(rows);
  },

  async create(data: Omit<QuestionDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<QuestionDocument> {
    const row = await queryOne(
      `INSERT INTO questions (question, category, audience, type, options, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.question, data.category, data.audience, data.type, data.options, data.active]
    );
    return mapRow(row!);
  },

  async deleteMany(): Promise<void> {
    await query('DELETE FROM questions');
  },

  async insertMany(items: Omit<QuestionDocument, '_id' | 'createdAt' | 'updatedAt'>[]): Promise<QuestionDocument[]> {
    const results: QuestionDocument[] = [];
    for (const item of items) {
      const created = await this.create(item);
      results.push(created);
    }
    return results;
  },
};
