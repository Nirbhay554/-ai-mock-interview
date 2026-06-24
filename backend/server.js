import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import interviewRoutes from './routes/interview.js';
import resumeRoutes from './routes/resume.js';
import aptitudeRoutes from './routes/aptitude.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS: only allow your frontend ──────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/interview', interviewRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/aptitude', aptitudeRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'AI Mock Interview API running' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
