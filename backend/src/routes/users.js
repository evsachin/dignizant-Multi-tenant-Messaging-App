const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /users/invite - Admin invites a new user to their org
router.post(
  '/invite',
  authenticate,
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['ADMIN', 'MEMBER']).withMessage('Role must be ADMIN or MEMBER'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, role = 'MEMBER' } = req.body;
      const orgId = req.orgId;

      // Check if user already exists in this org
      const existingUser = await prisma.user.findUnique({
        where: { email_orgId: { email, orgId } },
      });

      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists in your organization' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          orgId,
          email,
          passwordHash,
          role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          orgId: true,
          createdAt: true,
        },
      });

      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// GET /users - List all users in the same org (admin only)
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { orgId: req.orgId },
      select: {
        id: true,
        email: true,
        role: true,
        orgId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// DELETE /users/:userId - Admin removes a user from org
router.delete('/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Ensure user belongs to admin's org
    const user = await prisma.user.findFirst({
      where: { id: userId, orgId: req.orgId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in your organization' });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'User removed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
