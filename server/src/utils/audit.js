import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

function safeDetails(obj) {
  if (obj == null || typeof obj !== 'object') return undefined;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return undefined;
  }
}

/**
 * Best-effort audit row; failures are logged but never break the request.
 */
export async function writeAudit(req, { action, resourceType, resourceId, summary, details }) {
  try {
    let actorName = '';
    let actorEmail = '';
    if (req.userId) {
      const u = await User.findById(req.userId).select('name email').lean();
      if (u) {
        actorName = u.name || '';
        actorEmail = u.email || '';
      }
    }
    const created = await AuditLog.create({
      actorId: req.userId || null,
      actorRole: req.userRole || '',
      actorName,
      actorEmail,
      ip: req.ip || req.socket?.remoteAddress || '',
      action,
      resourceType,
      resourceId: resourceId != null ? String(resourceId) : '',
      summary: String(summary).slice(0, 2000),
      details: safeDetails(details),
    });
    req.app
      ?.get('io')
      ?.emit('audit:created', {
        _id: created._id,
        createdAt: created.createdAt,
        action: created.action,
        resourceType: created.resourceType,
        resourceId: created.resourceId,
        summary: created.summary,
        actorName: created.actorName,
        actorRole: created.actorRole,
      });
  } catch (e) {
    console.error('[audit]', e.message);
  }
}
