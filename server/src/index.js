import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { verifyAccessToken } from './middleware/auth.js';
import Shipment from './models/Shipment.js';
import authRoutes from './routes/auth.js';
import shipmentRoutes from './routes/shipments.js';
import trackingRoutes from './routes/tracking.js';
import userRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

if (!process.env.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set. Using insecure default for development only.');
  process.env.JWT_SECRET = 'dev-only-change-me';
}

const app = express();
/** Set to 1 behind one reverse proxy (nginx, Render, etc.) so rate limits use client IP */
if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

app.set('io', io);

io.use((socket, next) => {
  const raw =
    socket.handshake.auth?.token ||
    (typeof socket.handshake.headers.authorization === 'string' &&
    socket.handshake.headers.authorization.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.slice(7)
      : null);
  const session = verifyAccessToken(raw);
  if (!session) {
    return next(new Error('Authentication required'));
  }
  socket.data.userId = session.userId;
  socket.data.userRole = session.role;
  next();
});

io.on('connection', (socket) => {
  socket.on('leave:shipment', (shipmentId) => {
    if (shipmentId) socket.leave(`shipment:${shipmentId}`);
  });

  socket.on('join:shipment', async (shipmentId, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};

    if (!shipmentId || !mongoose.isValidObjectId(String(shipmentId))) {
      socket.emit('shipment:join_denied', { shipmentId, message: 'Invalid shipment' });
      reply({ ok: false, message: 'Invalid shipment' });
      return;
    }

    try {
      const shipment = await Shipment.findById(shipmentId).select('customer');
      if (!shipment) {
        socket.emit('shipment:join_denied', { shipmentId, message: 'Shipment not found' });
        reply({ ok: false, message: 'Not found' });
        return;
      }

      const uid = socket.data.userId;
      const role = socket.data.userRole;
      const isStaff = role === 'admin' || role === 'logistics_manager';
      const isCustomer = shipment.customer?.toString() === uid;

      if (!isStaff && !isCustomer) {
        socket.emit('shipment:join_denied', {
          shipmentId,
          message: 'You do not have access to this shipment',
        });
        reply({ ok: false, message: 'Forbidden' });
        return;
      }

      socket.join(`shipment:${shipmentId}`);
      reply({ ok: true });
    } catch {
      socket.emit('shipment:join_denied', { shipmentId, message: 'Could not join room' });
      reply({ ok: false, message: 'Server error' });
    }
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
app.use('/api/audit', auditRoutes);

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
