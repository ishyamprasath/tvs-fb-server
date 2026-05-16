import { query, queryOne } from '../db.js';

export interface ConfidentialReportDocument {
  _id: number;
  employee: number;
  employeeId: string;
  businessDateKey: string;
  anonymous: boolean;
  text: string;
  aiCategory: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): ConfidentialReportDocument {
  return {
    _id: row.id,
    employee: row.employee_id,
    employeeId: row.employee_id_str,
    businessDateKey: row.business_date_key,
    anonymous: row.anonymous,
    text: row.text,
    aiCategory: row.ai_category,
    sentiment: row.sentiment,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRows(rows: any[]): ConfidentialReportDocument[] {
  return rows.map(mapRow);
}

export const ConfidentialReport = {
  async find(options?: { sort?: { createdAt?: 1 | -1 }; limit?: number }): Promise<ConfidentialReportDocument[]> {
    let sql = 'SELECT * FROM confidential_reports';
    if (options?.sort?.createdAt === -1) {
      sql += ' ORDER BY created_at DESC';
    } else {
      sql += ' ORDER BY created_at DESC';
    }
    if (options?.limit) {
      sql += ` LIMIT $1`;
      const rows = await query(sql, [options.limit]);
      return mapRows(rows);
    }
    const rows = await query(sql);
    return mapRows(rows);
  },

  async create(data: Omit<ConfidentialReportDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<ConfidentialReportDocument> {
    const row = await queryOne(
      `INSERT INTO confidential_reports (employee_id, employee_id_str, business_date_key, anonymous, text, ai_category, sentiment, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.employee,
        data.employeeId,
        data.businessDateKey,
        data.anonymous,
        data.text,
        data.aiCategory,
        data.sentiment,
        data.priority,
      ]
    );
    return mapRow(row!);
  },

  async deleteMany(): Promise<void> {
    await query('DELETE FROM confidential_reports');
  },
};
