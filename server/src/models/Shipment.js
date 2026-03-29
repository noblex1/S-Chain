import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String, default: '' },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, unique: true, sparse: true },
    origin: { type: pointSchema, required: true },
    destination: { type: pointSchema, required: true },
    packageDetails: {
      description: { type: String, default: '' },
      weightKg: { type: Number, default: 0 },
      dimensions: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'delivered'],
      default: 'pending',
    },
    currentLocation: {
      type: pointSchema,
      default: null,
    },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'SChainUser', default: null },
    vehicle: { type: String, default: '' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'SChainUser', required: true },
    estimatedDeliveryAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shipmentSchema.pre('save', function genTracking(next) {
  if (!this.trackingNumber) {
    this.trackingNumber = `SC-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  next();
});

shipmentSchema.index({ customer: 1, updatedAt: -1 });
shipmentSchema.index({ updatedAt: -1 });
shipmentSchema.index({ status: 1, updatedAt: -1 });

export default mongoose.model('SChainShipment', shipmentSchema);
