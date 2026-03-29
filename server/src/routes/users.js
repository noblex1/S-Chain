import { Router } from 'express';
import User from '../models/User.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);
router.use(requireRoles('admin', 'logistics_manager'));

router.get('/', async (req, res, next) => {
  try {
    const role = req.query.role;
    const filter = {};
    if (role) filter.role = role;
    const list = await User.find(filter).select('name email role').sort({ name: 1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

export default router;
