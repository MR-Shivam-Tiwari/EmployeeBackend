// api/employees.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
require('dotenv').config();

// Database connection optimized for Vercel serverless
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  
  return mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    maxPoolSize: 1,
    minPoolSize: 1
  });
};

// Middleware to handle DB connection and no-cache
router.use(async (req, res, next) => {
  // Set no-cache headers
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// Import Employee model
const Employee = require('../models/Employee');

// GET all employees with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { position, minSalary, department, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (position) filter.position = position;
    if (minSalary) filter.salary = { $gte: Number(minSalary) };
    if (department) filter.department = department;

    const employees = await Employee.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 })
      .select('_id name position department location salary');

    const count = await Employee.countDocuments(filter);

    res.json({
      employees,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ error: 'Server error while fetching employees' });
  }
});

// GET realtime locations
router.get('/realtime/locations', async (req, res) => {
  try {
    const employees = await Employee.find({})
      .select('_id name position department location')
      .lean();
    res.json(employees);
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: 'Server error while fetching locations' });
  }
});

// POST create new employee
router.post('/', async (req, res) => {
  try {
    const employee = new Employee({
      name: req.body.name,
      email: req.body.email,
      position: req.body.position,
      department: req.body.department,
      salary: req.body.salary,
      joinDate: req.body.joinDate || Date.now(),
      leaveBalance: req.body.leaveBalance || 20
    });

    const newEmployee = await employee.save();
    res.status(201).json(newEmployee);
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(400).json({ error: 'Bad request' });
  }
});

// GET single employee
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ error: 'Server error while fetching employee' });
  }
});

// PATCH update employee
router.patch('/:id', async (req, res) => {
  try {
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedEmployee);
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(400).json({ error: 'Bad request' });
  }
});

// Employee payroll endpoints
router.get('/:id/payroll', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .select('name position salary bankAccount taxId');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({
      employee: employee.name,
      position: employee.position,
      basicSalary: employee.salary,
      allowances: 0,
      deductions: 0,
      netSalary: employee.salary,
      bankAccount: employee.bankAccount,
      taxId: employee.taxId,
      paymentDate: new Date().setDate(1)
    });
  } catch (err) {
    console.error('Error fetching payroll:', err);
    res.status(500).json({ error: 'Server error while fetching payroll' });
  }
});

router.post('/:id/payroll/payments', async (req, res) => {
  try {
    const payment = {
      date: new Date(),
      amount: req.body.amount,
      bonus: req.body.bonus || 0,
      deductions: req.body.deductions || 0,
      paymentMethod: req.body.paymentMethod || 'bank transfer',
      status: 'completed'
    };

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $push: { payments: payment } },
      { new: true }
    );

    res.status(201).json(updatedEmployee);
  } catch (err) {
    console.error('Error processing payment:', err);
    res.status(400).json({ error: 'Bad request' });
  }
});

// Employee attendance endpoints
router.get('/:id/attendance', async (req, res) => {
  try {
    const { month, year } = req.query;
    const employee = await Employee.findById(req.params.id)
      .select('attendance');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let attendanceRecords = employee.attendance;

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      attendanceRecords = employee.attendance.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    res.json({
      employeeId: req.params.id,
      records: attendanceRecords,
      total: attendanceRecords.length
    });
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Server error while fetching attendance' });
  }
});

router.post('/:id/attendance', async (req, res) => {
  try {
    const { date, status, checkIn } = req.body;

    if (!date || !status || !['present', 'absent', 'late', 'half-day'].includes(status)) {
      return res.status(400).json({ error: 'Invalid attendance data' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const attendanceDate = new Date(date);
    const existingIndex = employee.attendance.findIndex(record =>
      new Date(record.date).toDateString() === attendanceDate.toDateString()
    );

    const attendanceRecord = {
      date: attendanceDate,
      status,
      checkIn: status === 'present' ? new Date(checkIn) : null,
      checkOut: null
    };

    if (existingIndex >= 0) {
      employee.attendance[existingIndex] = attendanceRecord;
    } else {
      employee.attendance.push(attendanceRecord);
    }

    const updatedEmployee = await employee.save();
    res.status(201).json(updatedEmployee);
  } catch (err) {
    console.error('Error marking attendance:', err);
    res.status(500).json({ error: 'Server error while marking attendance' });
  }
});

// Employee leave endpoints
router.get('/:id/leaves', async (req, res) => {
  try {
    const { status, year } = req.query;
    const employee = await Employee.findById(req.params.id)
      .select('leaves leaveBalance');

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let leaves = employee.leaves;

    if (status) {
      leaves = leaves.filter(leave => leave.status === status);
    }

    if (year) {
      leaves = leaves.filter(leave =>
        new Date(leave.startDate).getFullYear() == year ||
        new Date(leave.endDate).getFullYear() == year
      );
    }

    res.json({
      employeeId: req.params.id,
      leaveBalance: employee.leaveBalance,
      leaves,
      total: leaves.length
    });
  } catch (err) {
    console.error('Error fetching leaves:', err);
    res.status(500).json({ error: 'Server error while fetching leaves' });
  }
});

router.post('/:id/leaves', async (req, res) => {
  try {
    const leave = {
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      reason: req.body.reason,
      type: req.body.type || 'casual',
      status: 'pending',
      appliedOn: new Date()
    };

    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      { $push: { leaves: leave } },
      { new: true }
    );

    res.status(201).json(updatedEmployee);
  } catch (err) {
    console.error('Error applying leave:', err);
    res.status(400).json({ error: 'Bad request' });
  }
});

router.patch('/:id/leaves/:leaveId', async (req, res) => {
  try {
    const { status } = req.body;
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const leaveIndex = employee.leaves.findIndex(
      l => l._id.toString() === req.params.leaveId
    );

    if (leaveIndex === -1) {
      return res.status(404).json({ error: 'Leave application not found' });
    }

    employee.leaves[leaveIndex].status = status;
    employee.leaves[leaveIndex].processedOn = new Date();

    if (status === 'approved') {
      const leaveDays = Math.ceil(
        (employee.leaves[leaveIndex].endDate - employee.leaves[leaveIndex].startDate) /
        (1000 * 60 * 60 * 24)
      ) + 1;

      if (employee.leaveBalance < leaveDays) {
        return res.status(400).json({ error: 'Insufficient leave balance' });
      }

      employee.leaveBalance -= leaveDays;
    }

    await employee.save();
    res.json(employee);
  } catch (err) {
    console.error('Error updating leave:', err);
    res.status(400).json({ error: 'Bad request' });
  }
});

module.exports = router;