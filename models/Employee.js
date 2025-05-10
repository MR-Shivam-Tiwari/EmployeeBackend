const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'half-day'], required: true },
  checkIn: { type: Date },
  checkOut: { type: Date },
  notes: { type: String }
});

const leaveSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  type: { type: String, enum: ['casual', 'sick', 'paid', 'unpaid'], default: 'casual' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  appliedOn: { type: Date, default: Date.now },
  processedOn: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId }
});

const paymentSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  bonus: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'bank transfer' },
  status: { type: String, default: 'completed' }
});

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  position: { type: String, required: true },
  department: { type: String, required: true },
  salary: { type: Number, required: true },
  joinDate: { type: Date, default: Date.now },
  leaveBalance: { type: Number, default: 20 },
  bankAccount: { type: String },
  taxId: { type: String },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    city: { type: String, required: true },
    lastUpdated: { type: Date, default: Date.now, required: true }
  },
  attendance: [attendanceSchema],
  leaves: [leaveSchema],
  payments: [paymentSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

employeeSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  if (this._update.location) {
    this._update.location.lastUpdated = new Date();
  }
  next();;
});

module.exports = mongoose.model('Employee', employeeSchema);