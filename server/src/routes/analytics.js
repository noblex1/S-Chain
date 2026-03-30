import { Router } from 'express';
import { authRequired, requireRoles } from '../middleware/auth.js';
import Shipment from '../models/Shipment.js';
import AuditLog from '../models/AuditLog.js';
import TrackingLog from '../models/TrackingLog.js';

const router = Router();

router.use(authRequired);
router.use(requireRoles('admin'));

router.get('/admin-summary', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [shipmentByStatus, totalShipments, auditsLast24h, trackingLast24h] = await Promise.all([
      Shipment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Shipment.countDocuments(),
      AuditLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$action', n: { $sum: 1 } } },
      ]),
      TrackingLog.countDocuments({ timestamp: { $gte: since } }),
    ]);

    const statusMap = Object.fromEntries(shipmentByStatus.map((x) => [x._id, x.n]));
    const actionMap = Object.fromEntries(auditsLast24h.map((x) => [x._id, x.n]));

    const recentActivities = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select('createdAt action resourceType resourceId summary actorName actorRole')
      .lean();

    res.json({
      generatedAt: new Date(),
      shipments: {
        total: totalShipments,
        pending: statusMap.pending || 0,
        in_transit: statusMap.in_transit || 0,
        delivered: statusMap.delivered || 0,
      },
      activityLast24h: {
        creates: actionMap.create || 0,
        updates: actionMap.update || 0,
        deletes: actionMap.delete || 0,
        trackingPings: trackingLast24h,
      },
      recentActivities,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
