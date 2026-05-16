import { Router } from 'express';
import { z } from 'zod';
import { Employee } from '../models/Employee.js';
import { requireAuth } from '../middleware/auth.js';
import { comparePassword, hashPassword, signToken } from '../utils/auth.js';

const router = Router();

const emailSchema = z.string().email().refine((value) => value.toLowerCase().endsWith('@tvsd.ai'), {
  message: 'Only tvsd.ai email addresses are allowed.',
});

const registerSchema = z.object({
  employeeId: z.string().min(4),
  name: z.string().min(2),
  email: emailSchema,
  password: z.string().min(8),
  department: z.string().min(2),
  designation: z.string().min(2),
  location: z.string().min(2),
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid registration data.' });
  }

  const { employeeId, name, email, password, department, designation, location } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await Employee.findOne({
    $or: [{ employeeId: employeeId.trim() }, { email: normalizedEmail }],
  });

  if (existing) {
    return res.status(409).json({ message: 'An account with this employee ID or email already exists.' });
  }

  const employee = await Employee.create({
    employeeId: employeeId.trim().toUpperCase(),
    name: name.trim(),
    email: normalizedEmail,
    password: await hashPassword(password),
    department: department.trim(),
    role: 'employee',
    designation: designation.trim(),
    location: location.trim(),
  });

  const token = signToken({ id: String(employee._id), email: employee.email });

  return res.status(201).json({
    token,
    user: {
      id: String(employee._id),
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      role: employee.role,
      designation: employee.designation,
      location: employee.location,
    },
  });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid login data.' });
  }

  const { identifier, password } = parsed.data;
  const isEmail = identifier.includes('@');
  const normalizedIdentifier = identifier.trim();

  if (isEmail && !normalizedIdentifier.toLowerCase().endsWith('@tvsd.ai')) {
    return res.status(400).json({ message: 'Only tvsd.ai email addresses are allowed.' });
  }

  const employee = await Employee.findOne(
    isEmail
      ? { email: normalizedIdentifier.toLowerCase() }
      : { employeeId: normalizedIdentifier.toUpperCase() }
  );

  if (!employee) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const passwordMatches = await comparePassword(password, employee.password);

  if (!passwordMatches) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = signToken({ id: String(employee._id), email: employee.email });

  return res.json({
    token,
    user: {
      id: String(employee._id),
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      role: employee.role,
      designation: employee.designation,
      location: employee.location,
    },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  const employee = await Employee.findById(req.user.id);

  if (!employee) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const { password, ...userWithoutPassword } = employee as any;
  return res.json({ user: userWithoutPassword });
});

export default router;
