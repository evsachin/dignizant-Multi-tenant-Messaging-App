const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /groups - Admin creates a new group
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Group name is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name } = req.body;
      const orgId = req.orgId;

      // Check if group name exists in this org
      const existing = await prisma.group.findUnique({
        where: { name_orgId: { name, orgId } },
      });
      if (existing) {
        return res.status(409).json({ error: 'A group with this name already exists' });
      }

      const group = await prisma.$transaction(async (tx) => {
        const newGroup = await tx.group.create({
          data: {
            name,
            orgId,
            createdBy: req.user.id,
          },
        });

        // Auto-add the creator as a member
        await tx.groupMember.create({
          data: {
            groupId: newGroup.id,
            userId: req.user.id,
          },
        });

        return newGroup;
      });

      const groupWithCount = await prisma.group.findUnique({
        where: { id: group.id },
        include: {
          _count: { select: { members: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, role: true } },
            },
          },
        },
      });

      res.status(201).json({ group: groupWithCount });
    } catch (error) {
      next(error);
    }
  }
);

// GET /groups - Get groups for the current user
router.get('/', authenticate, async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'ADMIN';

    let groups;
    if (isAdmin) {
      // Admins see all groups in their org
      groups = await prisma.group.findMany({
        where: { orgId: req.orgId },
        include: {
          _count: { select: { members: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, role: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    } else {
      // Members only see groups they belong to
      groups = await prisma.group.findMany({
        where: {
          orgId: req.orgId,
          members: {
            some: { userId: req.user.id },
          },
        },
        include: {
          _count: { select: { members: true } },
          members: {
            include: {
              user: { select: { id: true, email: true, role: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    // Add isMember flag
    const groupsWithMembership = groups.map(g => ({
      ...g,
      isMember: g.members.some(m => m.userId === req.user.id),
    }));

    res.json({ groups: groupsWithMembership });
  } catch (error) {
    next(error);
  }
});

// GET /groups/:groupId - Get single group details
router.get('/:groupId', authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.group.findFirst({
      where: { id: groupId, orgId: req.orgId },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, role: true } },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isMember = group.members.some(m => m.userId === req.user.id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isMember && !isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ group: { ...group, isMember } });
  } catch (error) {
    next(error);
  }
});

// POST /groups/:groupId/members - Admin adds a member to a group
router.post(
  '/:groupId/members',
  authenticate,
  requireAdmin,
  [
    body('userId').notEmpty().withMessage('userId is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { groupId } = req.params;
      const { userId } = req.body;

      // Verify group belongs to admin's org
      const group = await prisma.group.findFirst({
        where: { id: groupId, orgId: req.orgId },
      });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Verify user belongs to same org
      const user = await prisma.user.findFirst({
        where: { id: userId, orgId: req.orgId },
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found in your organization' });
      }

      // Check if already a member
      const existing = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (existing) {
        return res.status(409).json({ error: 'User is already a member of this group' });
      }

      await prisma.groupMember.create({
        data: { groupId, userId },
      });

      const updatedGroup = await prisma.group.findUnique({
        where: { id: groupId },
        include: {
          members: {
            include: {
              user: { select: { id: true, email: true, role: true } },
            },
          },
        },
      });

      res.status(201).json({ group: updatedGroup });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /groups/:groupId/members/:userId - Admin removes a member
router.delete('/:groupId/members/:userId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;

    const group = await prisma.group.findFirst({
      where: { id: groupId, orgId: req.orgId },
    });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /groups/:groupId - Admin deletes a group
router.delete('/:groupId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.group.findFirst({
      where: { id: groupId, orgId: req.orgId },
    });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await prisma.group.delete({ where: { id: groupId } });
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
