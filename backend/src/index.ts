import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import eventRoutes from './routes/events';
import questionnaireRoutes from './routes/questionnaires';
import healthRoutes from './routes/health';
import matchRoutes from './routes/matches';
import statsRoutes from './routes/stats';
import injuryRoutes from './routes/injuries';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/questionnaires', questionnaireRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/injuries', injuryRoutes);

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`RCF API running on port ${PORT}`);
});
