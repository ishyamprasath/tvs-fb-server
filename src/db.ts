import { Pool, PoolClient } from 'pg';
import { config } from './config.js';
import { seedQuestions } from './data/seedQuestions.js';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

export async function connectDatabase() {
  await pool.query('SELECT NOW()');
  console.log('PostgreSQL connected');
}

export async function initTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        department VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'employee',
        designation VARCHAR(255) NOT NULL,
        location VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        audience TEXT[] NOT NULL,
        type VARCHAR(20) DEFAULT 'single',
        options TEXT[] NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_responses (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        employee_id_str VARCHAR(50),
        name VARCHAR(255),
        department VARCHAR(100),
        mood VARCHAR(50),
        mood_score INTEGER,
        business_date_key VARCHAR(20),
        submitted_at TIMESTAMP DEFAULT NOW(),
        answers JSONB,
        average_score INTEGER,
        stress_score INTEGER,
        engagement_score INTEGER,
        productivity_score INTEGER,
        confidential_note TEXT,
        anonymous_note BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id_str, business_date_key)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS confidential_reports (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id),
        employee_id_str VARCHAR(50),
        business_date_key VARCHAR(20),
        anonymous BOOLEAN DEFAULT FALSE,
        text TEXT NOT NULL,
        ai_category VARCHAR(100),
        sentiment VARCHAR(20),
        priority VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM questions');
    if (parseInt(rows[0].count, 10) === 0) {
      for (const q of seedQuestions) {
        await client.query(
          `INSERT INTO questions (question, category, audience, type, options, active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [q.question, q.category, q.audience, q.type, q.options, q.active]
        );
      }
      console.log('Seed questions inserted');
    }

    console.log('Tables initialized');
  } finally {
    client.release();
  }
}
