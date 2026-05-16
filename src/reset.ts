import { pool, connectDatabase, initTables } from './db.js';
import { Question } from './models/Question.js';
import { seedQuestions } from './data/seedQuestions.js';

async function main() {
  await connectDatabase();
  await initTables();
  await pool.query('DROP TABLE IF EXISTS daily_responses, confidential_reports, questions, employees CASCADE');
  console.log('Tables dropped successfully.');
  await initTables();
  await Question.insertMany(seedQuestions as any);
  console.log('Question library re-inserted.');
  await pool.end();
}

main().catch(async (error) => {
  console.error('Failed to drop database', error);
  await pool.end();
  process.exit(1);
});
