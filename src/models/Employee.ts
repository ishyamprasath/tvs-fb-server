import { query, queryOne } from '../db.js';

export type EmployeeRole = 'employee' | 'admin';

export interface EmployeeDocument {
  _id: number;
  employeeId: string;
  name: string;
  email: string;
  password: string;
  department: string;
  role: EmployeeRole;
  designation: string;
  location: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: any): EmployeeDocument {
  return {
    _id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    email: row.email,
    password: row.password,
    department: row.department,
    role: row.role,
    designation: row.designation,
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRows(rows: any[]): EmployeeDocument[] {
  return rows.map(mapRow);
}

export const Employee = {
  async findOne(filter: { email?: string; employeeId?: string } | { $or: Array<{ email?: string; employeeId?: string }> }): Promise<EmployeeDocument | null> {
    let sql = 'SELECT * FROM employees WHERE 1=1';
    const params: any[] = [];

    if ('$or' in filter) {
      const conditions: string[] = [];
      for (const cond of filter.$or) {
        if (cond.email) {
          conditions.push(`email = $${params.length + 1}`);
          params.push(cond.email.toLowerCase());
        }
        if (cond.employeeId) {
          conditions.push(`employee_id = $${params.length + 1}`);
          params.push(cond.employeeId.trim().toUpperCase());
        }
      }
      sql = `SELECT * FROM employees WHERE ${conditions.join(' OR ')}`;
    } else {
      if (filter.email) {
        sql += ` AND email = $${params.length + 1}`;
        params.push(filter.email.toLowerCase());
      }
      if (filter.employeeId) {
        sql += ` AND employee_id = $${params.length + 1}`;
        params.push(filter.employeeId.trim().toUpperCase());
      }
    }

    const row = await queryOne(sql, params);
    return row ? mapRow(row) : null;
  },

  async findById(id: string | number): Promise<EmployeeDocument | null> {
    const row = await queryOne('SELECT * FROM employees WHERE id = $1', [Number(id)]);
    return row ? mapRow(row) : null;
  },

  async find(options?: { select?: string }): Promise<EmployeeDocument[]> {
    let sql = 'SELECT * FROM employees ORDER BY id';
    if (options?.select === '-password') {
      sql = 'SELECT id, employee_id, name, email, department, role, designation, location, created_at, updated_at FROM employees ORDER BY id';
    }
    const rows = await query(sql);
    return mapRows(rows);
  },

  async lean(): Promise<EmployeeDocument[]> {
    const rows = await query('SELECT * FROM employees ORDER BY id');
    return mapRows(rows);
  },

  async create(data: Omit<EmployeeDocument, '_id' | 'createdAt' | 'updatedAt'>): Promise<EmployeeDocument> {
    const row = await queryOne(
      `INSERT INTO employees (employee_id, name, email, password, department, role, designation, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.employeeId.trim().toUpperCase(),
        data.name.trim(),
        data.email.toLowerCase(),
        data.password,
        data.department.trim(),
        data.role,
        data.designation.trim(),
        data.location.trim(),
      ]
    );
    return mapRow(row!);
  },

  async deleteMany(): Promise<void> {
    await query('DELETE FROM employees');
  },

  async insertMany(items: Omit<EmployeeDocument, '_id' | 'createdAt' | 'updatedAt'>[]): Promise<EmployeeDocument[]> {
    const results: EmployeeDocument[] = [];
    for (const item of items) {
      const created = await this.create(item);
      results.push(created);
    }
    return results;
  },
};
