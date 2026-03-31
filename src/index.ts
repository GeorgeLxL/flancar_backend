import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import scheduleRouter from './routes/schedules';
import smaregiRouter from './routes/smaregi';

declare global {
  var email: string;
}

dotenv.config();

global.email = "";

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
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
  },
}));

app.use('/auth', authRouter);
app.use('/schedules', scheduleRouter);
app.use('/smaregi', smaregiRouter);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
