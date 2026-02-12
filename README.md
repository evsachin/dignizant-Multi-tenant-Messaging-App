## Project- RealTime Messaging App

##  Project Architecture

```
messaging-app/
├── backend/        # Express + Socket.IO API server
│   ├── prisma/     # Database schema and migrations
│   └── src/
│       ├── routes/     # REST API routes
│       ├── socket/     # Socket.IO real-time handlers
│       ├── middleware/ # Auth, error handling
│       └── lib/        # Prisma client, etc.
└── frontend/       # React + Vite SPA
    └── src/
        ├── components/ # Sidebar, ChatWindow, AdminPanel
        ├── pages/      # Login, Register, AppLayout
        ├── context/    # Auth context
        └── lib/        # API client, Socket client
```

## Features included

- **Multi-Tenant Isolation**: Each organization's data is completely isolated. Users can only see their org's channels and messages.
- **JWT Auth**: Stateless token-based authentication per org.
- **Real-time Messaging**: WebSocket via Socket.IO with org-namespaced rooms.
- **Role-Based Access**: ADMIN and MEMBER roles with fine-grained permissions.
- **Typing Indicators**: See who's typing in real time.
- **Online Presence**: Track who's online in each channel.
- **Pagination**: Cursor-based pagination for message history.
- **Admin Panel**: Create channels, invite users, manage group membership.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Socket.IO |
| Frontend | React + Vite |
| Auth | JWT (jsonwebtoken) |
| Passwords | bcryptjs |
| HTTP Client | axios |


## Setup Instructions

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed with demo data
npm run db:seed

# Start server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```



## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register-org-admin` | Create new org + admin user |
| POST | `/auth/login` | Login with email + password + orgName |
| GET | `/auth/me` | Get current user info |

### Users (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/users/invite` | Invite user to org |
| GET | `/users` | List all org users |
| DELETE | `/users/:id` | Remove user from org |

### Groups
| Method | Path | Description |
|--------|------|-------------|
| POST | `/groups` | Create group (admin) |
| GET | `/groups` | List groups (member: own, admin: all) |
| GET | `/groups/:id` | Get group details |
| DELETE | `/groups/:id` | Delete group (admin) |
| POST | `/groups/:id/members` | Add member (admin) |
| DELETE | `/groups/:id/members/:userId` | Remove member (admin) |

### Messages
| Method | Path | Description |
|--------|------|-------------|
| GET | `/groups/:id/messages` | Get messages with pagination |
| POST | `/groups/:id/messages` | Send message (REST fallback) |

## WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_group` | `{ groupId }` | Join a group room |
| `leave_group` | `{ groupId }` | Leave a group room |
| `send_message` | `{ groupId, content }` | Send a message |
| `typing_start` | `{ groupId }` | Start typing indicator |
| `typing_stop` | `{ groupId }` | Stop typing indicator |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `receive_message` | `{ message }` | New message broadcast |
| `user_typing` | `{ userId, email, groupId }` | Someone started typing |
| `user_stopped_typing` | `{ userId, groupId }` | Someone stopped typing |
| `online_users` | `{ groupId, userIds }` | Online users in group |
| `user_joined` | `{ userId, email, groupId }` | User joined group |
| `user_left` | `{ userId, email, groupId }` | User left group |

## Multi-Tenant Security

1. **JWT tokens** encode `userId`, `orgId`, and `role`
2. **All DB queries** filter by `orgId` from the authenticated token
3. **Socket rooms** are namespaced as `orgId:groupId` to prevent cross-org message leakage
4. **Group membership** is checked before every message send (REST + WebSocket)
5. **Users cannot access** another org's data even with a valid token

## Demo Accounts

After seeding (`npm run db:seed`):

**Org: Acme Corp**
- `admin@acme.com` / `password123` (ADMIN)
- `alice@acme.com` / `password123` (MEMBER)
- `bob@acme.com` / `password123` (MEMBER)

**Org: Globex Inc**
- `admin@globex.com` / `password123` (ADMIN)
- `carol@globex.com` / `password123` (MEMBER)


