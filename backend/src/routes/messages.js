const express = require('express');
const { body, query, validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /groups/:groupId/messages?limit=50&cursor=<messageId>
router.get(
  '/:groupId/messages',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('cursor').optional().isString(),
  ],
  async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const cursor = req.query.cursor;

      // Verify group is in the user's org
      const group = await prisma.group.findFirst({
        where: { id: groupId, orgId: req.orgId },
      });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Verify user is a member (or admin)
      const isMember = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
      });

      if (!isMember && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      // Cursor-based pagination
      const queryOptions = {
        where: { groupId },
        include: {
          sender: {
            select: { id: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // take one extra to check if there are more
      };

      if (cursor) {
        queryOptions.cursor = { id: cursor };
        queryOptions.skip = 1; // skip the cursor itself
      }

      const messages = await prisma.message.findMany(queryOptions);

      const hasMore = messages.length > limit;
      if (hasMore) messages.pop();

      const nextCursor = hasMore ? messages[messages.length - 1]?.id : null;

      res.json({
        messages,
        pagination: {
          hasMore,
          nextCursor,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /groups/:groupId/messages
router.post(
  '/:groupId/messages',
  authenticate,
  [
    body('content').trim().notEmpty().withMessage('Message content is required'),
    body('content').isLength({ max: 4000 }).withMessage('Message too long (max 4000 chars)'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { groupId } = req.params;
      const { content } = req.body;

      // Verify group is in the user's org
      const group = await prisma.group.findFirst({
        where: { id: groupId, orgId: req.orgId },
      });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Verify user is a member
      const isMember = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
      });

      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }

      const message = await prisma.message.create({
        data: {
          groupId,
          senderId: req.user.id,
          content,
        },
        include: {
          sender: {
            select: { id: true, email: true, role: true },
          },
        },
      });

      res.status(201).json({ message });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
