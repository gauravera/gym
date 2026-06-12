import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routers
import authRouter from './routes/auth';
import membersRouter from './routes/members';
import plansRouter from './routes/plans';
import paymentsRouter from './routes/payments';
import chatbotRouter from './routes/chatbot';
import whatsappRouter from './routes/whatsapp';
import webhookRouter from './routes/webhook';
import cronRouter from './routes/cron';
import checkInRouter from './routes/check-in';
import liveChatRouter from './routes/live-chat';
import razorpayRouter from './routes/razorpay';
import dashboardRouter from './routes/dashboard';

// Import background services
import { queueService } from './services/queue-service';
import { cronJobs } from './jobs/cron-jobs';

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS to work with Next.js frontend rewriting and direct access
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL || 'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`[Backend Request] ${req.method} ${req.url}`);
  next();
});

// Define routes
app.use('/api/auth', authRouter);
app.use('/api/dashboard/:gymSlug/members', membersRouter);
app.use('/api/dashboard/:gymSlug/plans', plansRouter);
app.use('/api/dashboard/:gymSlug/payments', paymentsRouter);
app.use('/api/dashboard/:gymSlug/chatbot', chatbotRouter);
app.use('/api/dashboard/:gymSlug/whatsapp', whatsappRouter);
app.use('/api/dashboard/:gymSlug/check-in', checkInRouter);
app.use('/api/dashboard/:gymSlug/live-chat', liveChatRouter);
app.use('/api/dashboard/:gymSlug', dashboardRouter); // Dashboard home router
app.use('/api/webhooks/whatsapp', webhookRouter);
app.use('/api/webhooks/razorpay', razorpayRouter);
app.use('/api/cron', cronRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start listening
app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`   FITFLOW SaaS Express Backend Running on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log('==================================================');

  // Start background queue processing worker
  queueService.startWorker(5000);

  // Initialize node-cron daily jobs
  cronJobs.init();
});
