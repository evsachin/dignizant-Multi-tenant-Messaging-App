const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');

const router = express.Router();

const generateToken = (userId, orgId, role) => {
  return jwt.sign(
    { userId, orgId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// POST /auth/register-org-admin
// Creates a new organization and its first admin user
router.post(
  '/register-org-admin',
  [
    body('orgName').trim().notEmpty().withMessage('Organization name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { orgName, email, password } = req.body;

      // Check if org name already taken
      const existingOrg = await prisma.organization.findUnique({
        where: { name: orgName },
      });
      if (existingOrg) {
        return res.status(409).json({ error: 'Organization name already taken' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create org and admin in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName },
        });

        const user = await tx.user.create({
          data: {
            orgId: org.id,
            email,
            passwordHash,
            role: 'ADMIN',
          },
        });

        return { org, user };
      });

      const token = generateToken(result.user.id, result.org.id, result.user.role);

      res.status(201).json({
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          orgId: result.org.id,
          orgName: result.org.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('orgName').trim().notEmpty().withMessage('Organization name is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, orgName } = req.body;

      // Find org
      const org = await prisma.organization.findUnique({
        where: { name: orgName },
      });
      if (!org) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Find user within that org
      const user = await prisma.user.findUnique({
        where: {
          email_orgId: { email, orgId: org.id },
        },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user.id, org.id, user.role);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: org.id,
          orgName: org.name,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /auth/me - get current user info
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { organization: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        orgName: user.organization.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
