import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import shipmentRoutes from './routes/shipments.js';
import trackingRoutes from './routes/tracking.js';
import userRoutes from './routes/users.js';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Using insecure default for development only.');
  process.env.JWT_SECRET = 'dev-only-change-me';
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join:shipment', (shipmentId) => {
    if (shipmentId) socket.join(`shipment:${shipmentId}`);
  });
  socket.on('leave:shipment', (shipmentId) => {
    if (shipmentId) socket.leave(`shipment:${shipmentId}`);
  });
});

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/users', userRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/s-chain';

mongoose
  .connect(mongoUri)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`API + WebSocket listening on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });
