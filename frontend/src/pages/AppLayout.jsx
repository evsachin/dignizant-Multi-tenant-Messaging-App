import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { groupsAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import AdminPanel from '../components/AdminPanel';
import WelcomeScreen from '../components/WelcomeScreen';
import './AppLayout.css';

export default function AppLayout() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const fetchGroups = async () => {
    try {
      const res = await groupsAPI.list();
      setGroups(res.data.groups);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setShowAdmin(false);
  };

  const handleGroupCreated = (newGroup) => {
    setGroups(prev => [...prev, newGroup]);
    setSelectedGroup(newGroup);
  };

  const handleGroupDeleted = (groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    if (selectedGroup?.id === groupId) setSelectedGroup(null);
  };

  const handleGroupUpdated = (updatedGroup) => {
    setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
    if (selectedGroup?.id === updatedGroup.id) setSelectedGroup(updatedGroup);
  };

  return (
    <div className="app-layout">
      <Sidebar
        groups={groups}
        selectedGroup={selectedGroup}
        onSelectGroup={handleGroupSelect}
        onAdminPanel={() => { setShowAdmin(true); setSelectedGroup(null); }}
        showAdmin={showAdmin}
        loadingGroups={loadingGroups}
        onRefreshGroups={fetchGroups}
      />
      <main className="app-main">
        {showAdmin ? (
          <AdminPanel
            groups={groups}
            onGroupCreated={handleGroupCreated}
            onGroupDeleted={handleGroupDeleted}
            onGroupUpdated={handleGroupUpdated}
            onRefreshGroups={fetchGroups}
          />
        ) : selectedGroup ? (
          <ChatWindow
            key={selectedGroup.id}
            group={selectedGroup}
            onGroupUpdated={handleGroupUpdated}
          />
        ) : (
          <WelcomeScreen
            groups={groups}
            onSelectGroup={handleGroupSelect}
            onOpenAdmin={() => setShowAdmin(true)}
          />
        )}
      </main>
    </div>
  );
}
