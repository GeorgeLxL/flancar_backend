import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import scheduleRouter from './routes/schedules';
import smaregiRouter from './routes/smaregi';

dotenv.config();

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 86400000, sameSite: 'none', secure: false },
}));

app.use('/auth', authRouter);
app.use('/schedules', scheduleRouter);
app.use('/smaregi', smaregiRouter);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
