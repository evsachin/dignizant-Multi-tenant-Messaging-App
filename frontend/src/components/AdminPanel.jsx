import React, { useState, useEffect } from 'react';
import { groupsAPI, usersAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './AdminPanel.css';

const getInitials = (email) => email?.slice(0, 2).toUpperCase() || '??';

export default function AdminPanel({ groups, onGroupCreated, onGroupDeleted, onGroupUpdated, onRefreshGroups }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('groups');
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [showManageGroup, setShowManageGroup] = useState(null); // group

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await usersAPI.list();
      setUsers(res.data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-header-icon">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div>
          <h1>Admin Panel</h1>
          <p className="admin-org">{user?.orgName}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Channels ({groups.length})
        </button>
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Members ({users.length})
        </button>
      </div>

      {/* Groups Tab */}
      {tab === 'groups' && (
        <div className="admin-content">
          <div className="admin-toolbar">
            <h3>All Channels</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateGroup(true)}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Channel
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="admin-empty">
              <p>No channels yet. Create the first one!</p>
            </div>
          ) : (
            <div className="admin-list">
              {groups.map(group => (
                <div key={group.id} className="admin-item">
                  <div className="admin-item-icon">#</div>
                  <div className="admin-item-info">
                    <span className="admin-item-name">{group.name}</span>
                    <span className="admin-item-meta">
                      {group._count?.members || group.members?.length || 0} members
                    </span>
                  </div>
                  <div className="admin-item-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowManageGroup(group)}
                    >
                      Manage
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!confirm(`Delete #${group.name}?`)) return;
                        try {
                          await groupsAPI.delete(group.id);
                          onGroupDeleted(group.id);
                        } catch (err) {
                          alert(err.response?.data?.error || 'Failed to delete');
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="admin-content">
          <div className="admin-toolbar">
            <h3>Team Members</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowInviteUser(true)}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Invite User
            </button>
          </div>

          {users.length === 0 ? (
            <div className="admin-empty"><p>No users yet.</p></div>
          ) : (
            <div className="admin-list">
              {users.map(u => (
                <div key={u.id} className="admin-item">
                  <div className="avatar">{getInitials(u.email)}</div>
                  <div className="admin-item-info">
                    <span className="admin-item-name">{u.email}</span>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-member'}`}>
                      {u.role}
                    </span>
                  </div>
                  {u.id !== user.id && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        if (!confirm(`Remove ${u.email}?`)) return;
                        try {
                          await usersAPI.remove(u.id);
                          setUsers(prev => prev.filter(x => x.id !== u.id));
                        } catch (err) {
                          alert(err.response?.data?.error || 'Failed to remove');
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(group) => {
            onGroupCreated(group);
            setShowCreateGroup(false);
          }}
        />
      )}

      {/* Invite User Modal */}
      {showInviteUser && (
        <InviteUserModal
          onClose={() => setShowInviteUser(false)}
          onInvited={(u) => {
            setUsers(prev => [...prev, u]);
            setShowInviteUser(false);
          }}
        />
      )}

      {/* Manage Group Modal */}
      {showManageGroup && (
        <ManageGroupModal
          group={showManageGroup}
          allUsers={users}
          onClose={() => setShowManageGroup(null)}
          onUpdated={(updated) => {
            onGroupUpdated(updated);
            setShowManageGroup(updated);
          }}
        />
      )}
    </div>
  );
}

// --- Create Group Modal ---
function CreateGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await groupsAPI.create({ name: name.trim() });
      onCreated(res.data.group);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create Channel</h2>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Channel Name</label>
            <input
              className="input"
              placeholder="e.g. general"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Invite User Modal ---
function InviteUserModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'MEMBER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await usersAPI.invite(form);
      onInvited(res.data.user);
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? errors.map(e => e.msg).join(', ') : err.response?.data?.error || 'Failed to invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Invite Team Member</h2>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" placeholder="user@company.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus />
          </div>
          <div className="form-group">
            <label>Initial Password</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Inviting...' : 'Invite User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Manage Group Modal ---
function ManageGroupModal({ group, allUsers, onClose, onUpdated }) {
  const [currentGroup, setCurrentGroup] = useState(group);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const members = currentGroup.members || [];
  const nonMembers = allUsers.filter(u => !members.find(m => m.userId === u.id));

  const addMember = async (userId) => {
    setLoading(true);
    setError('');
    try {
      const res = await groupsAPI.addMember(currentGroup.id, userId);
      setCurrentGroup(res.data.group);
      onUpdated(res.data.group);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId) => {
    setLoading(true);
    setError('');
    try {
      await groupsAPI.removeMember(currentGroup.id, userId);
      const updated = {
        ...currentGroup,
        members: currentGroup.members.filter(m => m.userId !== userId),
        _count: { members: (currentGroup._count?.members || 0) - 1 },
      };
      setCurrentGroup(updated);
      onUpdated(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Manage #{currentGroup.name}</h2>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Current members */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              Members ({members.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="avatar avatar-sm">{getInitials(m.user?.email)}</div>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{m.user?.email}</span>
                  <span className={`badge ${m.user?.role === 'ADMIN' ? 'badge-admin' : 'badge-member'}`}>{m.user?.role}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => removeMember(m.userId)} disabled={loading}>
                    Remove
                  </button>
                </div>
              ))}
              {members.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>No members yet</p>}
            </div>
          </div>

          {/* Add members */}
          {nonMembers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                Add Members
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {nonMembers.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-panel)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="avatar avatar-sm" style={{ opacity: 0.5 }}>{getInitials(u.email)}</div>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>{u.email}</span>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-member'}`}>{u.role}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => addMember(u.id)} disabled={loading}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

