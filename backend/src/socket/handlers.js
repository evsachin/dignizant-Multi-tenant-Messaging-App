const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Track online users per group: groupId -> Set of userIds
const onlineUsers = new Map();

const setupSocketHandlers = (io) => {
  // Middleware: authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { organization: true },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      socket.orgId = user.orgId;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.user.email} (org: ${socket.orgId})`);

    // Join a group room
    socket.on('join_group', async ({ groupId }, callback) => {
      try {
        // Verify the group belongs to the user's org
        const group = await prisma.group.findFirst({
          where: { id: groupId, orgId: socket.orgId },
        });

        if (!group) {
          const err = { error: 'Group not found or access denied' };
          return callback ? callback(err) : socket.emit('error', err);
        }

        // Verify user is a member (or admin)
        const isMember = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: { groupId, userId: socket.user.id },
          },
        });

        if (!isMember && socket.user.role !== 'ADMIN') {
          const err = { error: 'You are not a member of this group' };
          return callback ? callback(err) : socket.emit('error', err);
        }

        // Use namespaced room: orgId:groupId to prevent cross-org leakage
        const roomId = `${socket.orgId}:${groupId}`;
        socket.join(roomId);

        // Track online users
        if (!onlineUsers.has(groupId)) {
          onlineUsers.set(groupId, new Set());
        }
        onlineUsers.get(groupId).add(socket.user.id);

        // Notify others in the room
        socket.to(roomId).emit('user_joined', {
          userId: socket.user.id,
          email: socket.user.email,
          groupId,
        });

        // Send online users list to the joining user
        const onlineInGroup = Array.from(onlineUsers.get(groupId) || []);
        socket.emit('online_users', { groupId, userIds: onlineInGroup });

        console.log(`👥 ${socket.user.email} joined group ${groupId}`);
        if (callback) callback({ success: true });
      } catch (error) {
        console.error('join_group error:', error);
        const err = { error: 'Failed to join group' };
        if (callback) callback(err);
        else socket.emit('error', err);
      }
    });

    // Leave a group room
    socket.on('leave_group', ({ groupId }) => {
      const roomId = `${socket.orgId}:${groupId}`;
      socket.leave(roomId);

      // Update online users
      if (onlineUsers.has(groupId)) {
        onlineUsers.get(groupId).delete(socket.user.id);
        if (onlineUsers.get(groupId).size === 0) {
          onlineUsers.delete(groupId);
        }
      }

      socket.to(roomId).emit('user_left', {
        userId: socket.user.id,
        email: socket.user.email,
        groupId,
      });

      console.log(`👋 ${socket.user.email} left group ${groupId}`);
    });

    // Send a message via WebSocket
    socket.on('send_message', async ({ groupId, content }, callback) => {
      try {
        if (!content || !content.trim()) {
          const err = { error: 'Message content cannot be empty' };
          return callback ? callback(err) : socket.emit('error', err);
        }

        if (content.length > 4000) {
          const err = { error: 'Message too long' };
          return callback ? callback(err) : socket.emit('error', err);
        }

        // Security: verify group is in user's org
        const group = await prisma.group.findFirst({
          where: { id: groupId, orgId: socket.orgId },
        });

        if (!group) {
          const err = { error: 'Group not found or access denied' };
          return callback ? callback(err) : socket.emit('error', err);
        }

        // Verify user is a member
        const isMember = await prisma.groupMember.findUnique({
          where: {
            groupId_userId: { groupId, userId: socket.user.id },
          },
        });

        if (!isMember) {
          const err = { error: 'You are not a member of this group' };
          return callback ? callback(err) : socket.emit('error', err);
        }

        // Save to database
        const message = await prisma.message.create({
          data: {
            groupId,
            senderId: socket.user.id,
            content: content.trim(),
          },
          include: {
            sender: {
              select: { id: true, email: true, role: true },
            },
          },
        });

        // Broadcast only to this org:group room
        const roomId = `${socket.orgId}:${groupId}`;
        io.to(roomId).emit('receive_message', { message });

        console.log(`💬 Message in group ${groupId} from ${socket.user.email}`);
        if (callback) callback({ success: true, message });
      } catch (error) {
        console.error('send_message error:', error);
        const err = { error: 'Failed to send message' };
        if (callback) callback(err);
        else socket.emit('error', err);
      }
    });

    // Typing indicator
    socket.on('typing_start', ({ groupId }) => {
      const roomId = `${socket.orgId}:${groupId}`;
      socket.to(roomId).emit('user_typing', {
        userId: socket.user.id,
        email: socket.user.email,
        groupId,
      });
    });

    socket.on('typing_stop', ({ groupId }) => {
      const roomId = `${socket.orgId}:${groupId}`;
      socket.to(roomId).emit('user_stopped_typing', {
        userId: socket.user.id,
        groupId,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.user?.email}`);

      // Remove from all online tracking
      for (const [groupId, users] of onlineUsers.entries()) {
        if (users.has(socket.user.id)) {
          users.delete(socket.user.id);
          const roomId = `${socket.orgId}:${groupId}`;
          io.to(roomId).emit('user_left', {
            userId: socket.user.id,
            email: socket.user.email,
            groupId,
          });
          if (users.size === 0) onlineUsers.delete(groupId);
        }
      }
    });
  });
};

module.exports = { setupSocketHandlers };
