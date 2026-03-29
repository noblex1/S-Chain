import { Router } from 'express';
import mongoose from 'mongoose';
import Shipment from '../models/Shipment.js';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';
import { distanceKm, etaFromRemainingKm } from '../utils/geo.js';
import { writeAudit } from '../utils/audit.js';

const router = Router();

router.use(authRequired);

function canViewAll(role) {
  return role === 'admin' || role === 'logistics_manager';
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post('/', async (req, res, next) => {
  try {
    if (!canViewAll(req.userRole) && req.userRole !== 'customer') {
      return res.status(403).json({ message: 'Cannot create shipments' });
    }
    const body = req.body;
    let customerId = body.customer;
    if (req.userRole === 'customer') {
      customerId = req.userId;
    }
    if (!customerId && canViewAll(req.userRole)) {
      return res.status(400).json({ message: 'customer (user id) is required for staff-created shipments' });
    }
    if (customerId) {
      const c = await User.findById(customerId);
      if (!c) return res.status(400).json({ message: 'Customer user not found' });
    }

    const totalKm = distanceKm(body.origin, body.destination);
    const estimatedDeliveryAt = etaFromRemainingKm(totalKm);

    const shipment = await Shipment.create({
      origin: body.origin,
      destination: body.destination,
      packageDetails: body.packageDetails || {},
      status: body.status || 'pending',
      currentLocation: body.currentLocation || { ...body.origin },
      assignedDriver: body.assignedDriver || null,
      vehicle: body.vehicle || '',
      customer: customerId,
      estimatedDeliveryAt,
    });

    const populated = await Shipment.findById(shipment._id)
      .populate('customer', 'name email')
      .populate('assignedDriver', 'name email');

    req.app.get('io')?.emit('shipment:created', { shipment: populated });
    await writeAudit(req, {
      action: 'create',
      resourceType: 'shipment',
      resourceId: shipment._id,
      summary: `Created shipment ${shipment.trackingNumber}`,
      details: {
        trackingNumber: shipment.trackingNumber,
        customerId: String(customerId),
        status: shipment.status,
      },
    });
    res.status(201).json(populated);
  } catch (e) {
    next(e);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const match = {};
    if (req.userRole === 'customer') {
      match.customer = new mongoose.Types.ObjectId(req.userId);
    }
    const agg = await Shipment.aggregate([
      { $match: match },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const by = Object.fromEntries(agg.map((x) => [x._id, x.n]));
    const total = agg.reduce((s, x) => s + x.n, 0);
    res.json({
      total,
      pending: by.pending || 0,
      in_transit: by.in_transit || 0,
      delivered: by.delivered || 0,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.userRole === 'customer') {
      filter.customer = req.userId;
    }
    const st = req.query.status;
    if (['pending', 'in_transit', 'delivered'].includes(st)) {
      filter.status = st;
    }

    const rawQ = String(req.query.q ?? '').trim();
    if (rawQ.length > 0) {
      const q = rawQ.slice(0, 64);
      filter.trackingNumber = new RegExp(escapeRegex(q), 'i');
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 20, 1), 100);
    const page = Math.max(parseInt(String(req.query.page), 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Shipment.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'name email')
        .populate('assignedDriver', 'name email')
        .lean(),
      Shipment.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await Shipment.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('assignedDriver', 'name email');
    if (!s) return res.status(404).json({ message: 'Shipment not found' });
    if (req.userRole === 'customer' && s.customer._id.toString() !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(s);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (req.userRole === 'customer') {
      return res.status(403).json({ message: 'Customers cannot update shipments' });
    }
    const s = await Shipment.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Shipment not found' });

    const prevStatus = s.status;
    const updates = req.body;
    const allowed = [
      'origin',
      'destination',
      'packageDetails',
      'status',
      'currentLocation',
      'assignedDriver',
      'vehicle',
      'customer',
      'estimatedDeliveryAt',
    ];
    for (const k of allowed) {
      if (updates[k] !== undefined) s[k] = updates[k];
    }

    if (updates.origin || updates.destination) {
      const totalKm = distanceKm(s.origin, s.destination);
      s.estimatedDeliveryAt = etaFromRemainingKm(totalKm);
    }

    await s.save();
    const populated = await Shipment.findById(s._id)
      .populate('customer', 'name email')
      .populate('assignedDriver', 'name email');

    const io = req.app.get('io');
    io?.to(`shipment:${s._id}`).emit('shipment:updated', { shipment: populated });
    io?.emit('shipment:updated', { shipment: populated });

    if (updates.status && updates.status !== prevStatus) {
      io?.emit('notification', {
        type: 'status',
        shipmentId: s._id.toString(),
        status: populated.status,
        message: `Shipment ${populated.trackingNumber} is now ${populated.status.replace('_', ' ')}`,
      });
    }
    if (updates.status === 'delivered') {
      io?.emit('notification', {
        type: 'delivered',
        shipmentId: s._id.toString(),
        message: `Shipment ${populated.trackingNumber} has reached its destination`,
      });
    }

    const touched = allowed.filter((k) => updates[k] !== undefined);
    await writeAudit(req, {
      action: 'update',
      resourceType: 'shipment',
      resourceId: s._id,
      summary: `Updated shipment ${populated.trackingNumber}`,
      details: {
        touched,
        statusBefore: prevStatus,
        statusAfter: populated.status,
        trackingNumber: populated.trackingNumber,
      },
    });

    res.json(populated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Only admin can delete' });
    }
    const s = await Shipment.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Shipment not found' });
    await writeAudit(req, {
      action: 'delete',
      resourceType: 'shipment',
      resourceId: s._id,
      summary: `Deleted shipment ${s.trackingNumber}`,
      details: { trackingNumber: s.trackingNumber, status: s.status },
    });
    await Shipment.findByIdAndDelete(req.params.id);
    req.app.get('io')?.emit('shipment:deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
