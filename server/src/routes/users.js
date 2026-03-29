import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Shipment from '../models/Shipment.js';
import { authRequired, requireRoles } from '../middleware/auth.js';
import { writeAudit } from '../utils/audit.js';

const router = Router();

const ASSIGNABLE_ROLES = ['admin', 'logistics_manager', 'customer'];

router.use(authRequired);

/** Logistics: directory for operations. Admin: full directory including admins. */
router.get('/', async (req, res, next) => {
  try {
    const role = req.query.role;
    const filter = {};

    if (req.userRole === 'logistics_manager') {
      if (role === 'admin') {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      if (role) {
        filter.role = role;
      } else {
        filter.role = { $in: ['customer', 'logistics_manager'] };
      }
    } else if (req.userRole === 'admin') {
      if (role) filter.role = role;
    } else {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const list = await User.find(filter).select('name email role createdAt').sort({ name: 1 });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.use(requireRoles('admin'));

router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }
    const r = ASSIGNABLE_ROLES.includes(role) ? role : 'customer';
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hash,
      role: r,
    });
    await writeAudit(req, {
      action: 'create',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Created user ${user.email}`,
      details: { email: user.email, role: user.role, name: user.name },
    });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    const user = await User.findById(id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const before = { name: user.name, email: user.email, role: user.role };

    const { name, email, role, password } = req.body;

    if (email !== undefined) {
      const nextEmail = String(email).toLowerCase().trim();
      const taken = await User.findOne({ email: nextEmail, _id: { $ne: id } });
      if (taken) return res.status(409).json({ message: 'Email already in use' });
      user.email = nextEmail;
    }
    if (name !== undefined) user.name = String(name).trim();
    if (password !== undefined && password !== '') {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      user.password = await bcrypt.hash(password, 10);
    }

    if (role !== undefined) {
      if (!ASSIGNABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      if (user.role === 'admin' && role !== 'admin') {
        const otherAdmins = await User.countDocuments({ role: 'admin', _id: { $ne: id } });
        if (otherAdmins < 1) {
          return res.status(400).json({ message: 'Cannot remove the last admin' });
        }
      }
      user.role = role;
    }

    await user.save();
    await writeAudit(req, {
      action: 'update',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Updated user ${user.email}`,
      details: {
        before,
        after: { name: user.name, email: user.email, role: user.role },
        passwordChanged: Boolean(password && String(password).length > 0),
      },
    });
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    if (id === req.userId) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin' });
      }
    }
    const linked = await Shipment.exists({
      $or: [{ customer: id }, { assignedDriver: id }],
    });
    if (linked) {
      return res.status(400).json({
        message: 'User is linked to shipments. Reassign or remove those shipments first.',
      });
    }
    await writeAudit(req, {
      action: 'delete',
      resourceType: 'user',
      resourceId: user._id,
      summary: `Deleted user ${user.email}`,
      details: { email: user.email, role: user.role, name: user.name },
    });
    await User.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
