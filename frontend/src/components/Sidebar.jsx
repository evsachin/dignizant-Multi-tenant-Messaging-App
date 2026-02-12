import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const getInitials = (email) => email.slice(0, 2).toUpperCase();

export default function Sidebar({
  groups,
  selectedGroup,
  onSelectGroup,
  onAdminPanel,
  showAdmin,
  loadingGroups,
  onRefreshGroups,
}) {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      {/* Workspace Header */}
      <div className="sidebar-workspace">
        <div className="workspace-logo">{user?.orgName?.slice(0, 1)?.toUpperCase()}</div>
        <div className="workspace-info">
          <span className="workspace-name">{user?.orgName}</span>
          <span className="workspace-status">
            <span className="online-dot" style={{ width: 6, height: 6 }} />
            Online
          </span>
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Groups Section */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Channels</span>
          <button className="btn-icon" onClick={onRefreshGroups} title="Refresh">
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-channels">
          {loadingGroups ? (
            <div className="sidebar-loading">
              {[1, 2, 3].map(i => <div key={i} className="skeleton-channel" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="sidebar-empty">No channels yet</div>
          ) : (
            groups.map(group => (
              <button
                key={group.id}
                className={`channel-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                onClick={() => onSelectGroup(group)}
              >
                <span className="channel-hash">#</span>
                <span className="channel-name">{group.name}</span>
                <span className="channel-count">{group._count?.members || group.members?.length || 0}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Admin Panel Button */}
      {user?.role === 'ADMIN' && (
        <div className="sidebar-admin-btn">
          <button
            className={`admin-panel-btn ${showAdmin ? 'active' : ''}`}
            onClick={onAdminPanel}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Admin Panel
          </button>
        </div>
      )}

      <div className="sidebar-divider" />

      {/* User Footer */}
      <div className="sidebar-user">
        <div className="avatar" style={{ background: 'var(--accent-dim2)', color: 'var(--accent)' }}>
          {getInitials(user?.email || 'U')}
        </div>
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
          <span className="user-role">{user?.role}</span>
        </div>
        <button className="btn-icon" onClick={logout} title="Sign out">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
