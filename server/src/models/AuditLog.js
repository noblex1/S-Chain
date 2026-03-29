import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'SChainUser', default: null },
    actorRole: { type: String, default: '' },
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
    ip: { type: String, default: '' },
    action: {
      type: String,
      required: true,
      enum: ['create', 'update', 'delete'],
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['shipment', 'user'],
    },
    resourceId: { type: String, required: true },
    summary: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resourceType: 1, createdAt: -1 });

export default mongoose.model('SChainAuditLog', auditLogSchema);
