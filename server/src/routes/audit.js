import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);
router.use(requireRoles('admin'));

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const filter = {};
    if (req.query.resourceType === 'shipment' || req.query.resourceType === 'user') {
      filter.resourceType = req.query.resourceType;
    }
    if (req.query.action === 'create' || req.query.action === 'update' || req.query.action === 'delete') {
      filter.action = req.query.action;
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ items, total, limit, skip });
  } catch (e) {
    next(e);
  }
});

export default router;
