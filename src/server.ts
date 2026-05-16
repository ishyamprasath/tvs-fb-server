import cors from 'cors';
import express from 'express';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employee.js';
import adminRoutes from './routes/admin.js';
import { connectDatabase, initTables } from './db.js';
import { config } from './config.js';

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/admin', adminRoutes);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  return res.status(500).json({ message: error.message || 'Internal server error.' });
});

async function start() {
  await connectDatabase();
  await initTables();
  app.listen(config.port, () => {
    console.log(`TVS Feedback server running on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
