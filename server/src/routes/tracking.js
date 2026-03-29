import { Router } from 'express';
import Shipment from '../models/Shipment.js';
import TrackingLog from '../models/TrackingLog.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { distanceKm, etaFromRemainingKm } from '../utils/geo.js';

const router = Router();

router.use(authRequired);

router.post('/update-location', requireRoles('admin', 'logistics_manager'), async (req, res, next) => {
  try {
    const { shipmentId, lat, lng } = req.body;
    if (!shipmentId || lat == null || lng == null) {
      return res.status(400).json({ message: 'shipmentId, lat, lng required' });
    }

    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

    shipment.currentLocation = { lat: Number(lat), lng: Number(lng), address: '' };
    if (shipment.status === 'pending') {
      shipment.status = 'in_transit';
    }

    const remainingKm = distanceKm(shipment.currentLocation, shipment.destination);
    shipment.estimatedDeliveryAt = etaFromRemainingKm(remainingKm);

    await shipment.save();
    await TrackingLog.create({
      shipmentId: shipment._id,
      location: { lat: Number(lat), lng: Number(lng) },
    });

    const payload = {
      shipmentId: shipment._id.toString(),
      trackingNumber: shipment.trackingNumber,
      location: shipment.currentLocation,
      status: shipment.status,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt,
    };

    const io = req.app.get('io');
    io?.to(`shipment:${shipmentId}`).emit('shipment:location', payload);
    io?.emit('shipment:location', payload);

    if (remainingKm < 0.5 && shipment.status !== 'delivered') {
      shipment.status = 'delivered';
      await shipment.save();
      const full = await Shipment.findById(shipment._id)
        .populate('customer', 'name email')
        .populate('assignedDriver', 'name email');
      io?.emit('shipment:updated', { shipment: full });
      io?.emit('notification', {
        type: 'delivered',
        shipmentId: shipment._id.toString(),
        message: `Shipment ${shipment.trackingNumber} has reached its destination`,
      });
    }

    const populated = await Shipment.findById(shipment._id)
      .populate('customer', 'name email')
      .populate('assignedDriver', 'name email');

    res.json({ ok: true, shipment: populated, broadcast: payload });
  } catch (e) {
    next(e);
  }
});

router.get('/logs/:shipmentId', async (req, res, next) => {
  try {
    const shipment = await Shipment.findById(req.params.shipmentId);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    if (req.userRole === 'customer' && shipment.customer.toString() !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const logs = await TrackingLog.find({ shipmentId: req.params.shipmentId })
      .sort({ timestamp: -1 })
      .limit(200);
    res.json(logs);
  } catch (e) {
    next(e);
  }
});

export default router;
