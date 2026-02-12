import React from 'react';
import { useAuth } from '../context/AuthContext';
import './WelcomeScreen.css';

export default function WelcomeScreen({ groups, onSelectGroup, onOpenAdmin }) {
  const { user } = useAuth();

  return (
    <div className="welcome-screen">
      <div className="welcome-bg">
        <div className="welcome-grid" />
        <div className="welcome-glow" />
      </div>

      <div className="welcome-content">
        <div className="welcome-logo">N</div>
        <h1 className="welcome-title">Welcome to Group</h1>
        <p className="welcome-subtitle">
          <span className="welcome-org">{user?.orgName}</span>
        </p>
        <p className="welcome-desc">Select a channel from the sidebar to start chatting.</p>

        {groups.length > 0 ? (
          <div className="welcome-channels">
            <div className="welcome-channels-label">Jump to a channel</div>
            <div className="welcome-channel-list">
              {groups.slice(0, 6).map(group => (
                <button
                  key={group.id}
                  className="welcome-channel-btn"
                  onClick={() => onSelectGroup(group)}
                >
                  <span className="welcome-channel-hash">#</span>
                  <span>{group.name}</span>
                  <span className="welcome-channel-count">{group._count?.members || group.members?.length || 0}</span>
                </button>
              ))}
            </div>
          </div>
        ) : user?.role === 'ADMIN' ? (
          <div className="welcome-actions">
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
              No channels yet. Create your first one!
            </p>
            <button className="btn btn-primary" onClick={onOpenAdmin}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create a Channel
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Ask your admin to add you to a channel.
          </p>
        )}
      </div>
    </div>
  );
}
