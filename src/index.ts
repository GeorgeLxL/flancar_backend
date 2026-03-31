import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import scheduleRouter from './routes/schedules';
import smaregiRouter from './routes/smaregi';
import path from 'path';

dotenv.config();

const app = express();

const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 86400000,
    sameSite: 'lax',
    secure: isProd,
  },
}));

app.use('/auth', authRouter);
app.use('/schedules', scheduleRouter);
app.use('/smaregi', smaregiRouter);

// Serve frontend
app.use(express.static(path.join(__dirname, '../build')));

// All routes fallback to index.html (for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
