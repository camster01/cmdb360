import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';
import { SystemMember } from '../../types';

export default function AdminPanel() {
  const {
    appData, currentUser, currentSystem,
    updateDimension, updateSystem, deleteSystem, switchSystem, systems,
    addUser, deleteUser, updateUser, loadUsers,
    loadSystemMembers, setSystemMemberRole, removeSystemMember,
    setAdminPanel,
  } = useApp();

  const isAdmin = currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'general' | 'dimensions' | 'users'>(
    isAdmin ? 'general' : 'dimensions'
  );

  // General tab
  const [systemName, setSystemName] = useState(currentSystem?.name ?? '');
  const [systemDesc, setSystemDesc] = useState(currentSystem?.description ?? '');
  const [generalSaved, setGeneralSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setSystemName(currentSystem?.name ?? '');
    setSystemDesc(currentSystem?.description ?? '');
  }, [currentSystem]);

  const handleSaveGeneral = async () => {
    if (!currentSystem || !systemName.trim()) return;
    await updateSystem(currentSystem.id, { name: systemName.trim(), description: systemDesc.trim() });
    setGeneralSaved(true);
    setTimeout(() => setGeneralSaved(false), 2000);
  };

  const handleDeleteSystem = async () => {
    if (!currentSystem) return;
    await deleteSystem(currentSystem.id);
    const remaining = systems.filter(s => s.id !== currentSystem.id);
    if (remaining.length > 0) await switchSystem(remaining[0]);
    setAdminPanel(false);
  };

  // Dimensions tab
  const [editingDimId, setEditingDimId] = useState<string | null>(null);
  const [dimName, setDimName] = useState('');
  const [dimSubtitle, setDimSubtitle] = useState('');
  const [dimPosition, setDimPosition] = useState<number>(1);

  const sortedDims = [...appData.dimensions].sort((a, b) => a.slot - b.slot);

  const startEditDim = (id: string) => {
    const dim = appData.dimensions.find(d => d.id === id);
    if (!dim) return;
    setEditingDimId(id);
    setDimName(dim.name);
    setDimSubtitle(dim.subtitle ?? '');
    setDimPosition(dim.slot + 1);
  };

  const saveDim = async () => {
    if (!editingDimId) return;
    const newSlot = dimPosition - 1;
    const currentDim = appData.dimensions.find(d => d.id === editingDimId);
    if (!currentDim) return;
    try {
      const occupant = appData.dimensions.find(d => d.slot === newSlot && d.id !== editingDimId);
      if (occupant) await updateDimension(occupant.id, { slot: currentDim.slot });
      await updateDimension(editingDimId, { name: dimName.trim(), subtitle: dimSubtitle.trim(), slot: newSlot });
      setEditingDimId(null);
    } catch { /* stay editable */ }
  };

  // Users tab — system members
  const [members, setMembers] = useState<SystemMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newGlobalRole, setNewGlobalRole] = useState<'contributor' | 'viewer'>('viewer');
  const [newSystemRole, setNewSystemRole] = useState<'contributor' | 'viewer'>('viewer');
  const [userError, setUserError] = useState('');

  useEffect(() => {
    if (activeTab === 'users' && currentSystem) {
      setMembersLoading(true);
      loadSystemMembers(currentSystem.id)
        .then(setMembers)
        .catch(() => setUserError('Failed to load users.'))
        .finally(() => setMembersLoading(false));
    }
  }, [activeTab, currentSystem, loadSystemMembers]);

  const refreshMembers = async () => {
    if (!currentSystem) return;
    const m = await loadSystemMembers(currentSystem.id);
    setMembers(m);
  };

  const handleAddUser = async () => {
    if (!newUsername.trim()) { setUserError('Username required.'); return; }
    if (!newPassword.trim()) { setUserError('Password required.'); return; }
    if (!currentSystem) return;
    try {
      await addUser({ username: newUsername.trim(), password: newPassword.trim(), role: newGlobalRole });
      // Find the new user and grant system access
      const users = await loadUsers();
      const newUser = users.find(u => u.username === newUsername.trim());
      if (newUser) await setSystemMemberRole(currentSystem.id, newUser.id, newSystemRole);
      setNewUsername('');
      setNewPassword('');
      setUserError('');
      await refreshMembers();
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to add user.');
    }
  };

  const handleToggleAccess = async (member: SystemMember) => {
    if (!currentSystem || member.globalRole === 'admin') return;
    if (member.systemRole) {
      await removeSystemMember(currentSystem.id, member.id);
    } else {
      await setSystemMemberRole(currentSystem.id, member.id, 'viewer');
    }
    await refreshMembers();
  };

  const handleRoleChange = async (member: SystemMember, role: string) => {
    if (!currentSystem || member.globalRole === 'admin') return;
    await setSystemMemberRole(currentSystem.id, member.id, role);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, systemRole: role } : m));
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser?.id) return;
    if (window.confirm('Delete this user entirely?')) {
      try {
        await deleteUser(id);
        await refreshMembers();
      } catch { setUserError('Failed to delete user.'); }
    }
  };

  const handleUpdateGlobalRole = async (member: SystemMember, role: string) => {
    await updateUser(member.id, { role });
    await refreshMembers();
  };

  return (
    <Modal title="Admin Panel" onClose={() => setAdminPanel(false)} width="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-0 border border-gray-300 rounded overflow-hidden mb-4">
        {isAdmin && (
          <button onClick={() => setActiveTab('general')}
            className={`flex-1 text-sm py-2 transition-colors ${activeTab === 'general' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            General
          </button>
        )}
        <button onClick={() => setActiveTab('dimensions')}
          className={`flex-1 text-sm py-2 transition-colors ${activeTab === 'dimensions' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          Dimensions
        </button>
        {isAdmin && (
          <button onClick={() => setActiveTab('users')}
            className={`flex-1 text-sm py-2 transition-colors ${activeTab === 'users' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            Users
          </button>
        )}
      </div>

      {/* General tab */}
      {activeTab === 'general' && currentSystem && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Configure this system's settings.</p>
          <div className="border border-gray-200 rounded p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">System Name</h3>
            <input type="text" value={systemName}
              onChange={e => { setSystemName(e.target.value); setGeneralSaved(false); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              placeholder="System name" />
            <h3 className="text-sm font-semibold text-gray-700">Description</h3>
            <input type="text" value={systemDesc}
              onChange={e => { setSystemDesc(e.target.value); setGeneralSaved(false); }}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Short description (optional)" />
            <button onClick={handleSaveGeneral} disabled={!systemName.trim()}
              className="text-sm px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded transition-colors">
              {generalSaved ? 'Saved!' : 'Save'}
            </button>
          </div>

          {systems.length > 1 && (
            <div className="border border-red-200 rounded p-4 space-y-2">
              <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
              <p className="text-xs text-gray-500">Deleting a system removes all its dimensions, entries, and relationships permanently.</p>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <button onClick={handleDeleteSystem}
                    className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded">
                    Yes, delete "{currentSystem.name}"
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="text-xs px-3 py-1.5 border border-red-400 text-red-600 rounded hover:bg-red-50">
                  Delete this system
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dimensions tab */}
      {activeTab === 'dimensions' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-3">
            Edit dimension names, subtitles, and positions. Positions 1–4 appear in the left column, 5–8 in the right column (top to bottom).
          </p>
          {sortedDims.map(dim => (
            <div key={dim.id} className="border border-gray-200 rounded p-3">
              {editingDimId === dim.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-10 flex-shrink-0">Name</span>
                    <input type="text" value={dimName} onChange={e => setDimName(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Dimension name" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-10 flex-shrink-0">Sub</span>
                    <input type="text" value={dimSubtitle} onChange={e => setDimSubtitle(e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Subtitle (optional)" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-10 flex-shrink-0">Pos</span>
                    <select value={dimPosition} onChange={e => setDimPosition(Number(e.target.value))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 bg-white">
                      <option value={1}>1 — Left, top</option>
                      <option value={2}>2 — Left, 2nd</option>
                      <option value={3}>3 — Left, 3rd</option>
                      <option value={4}>4 — Left, bottom</option>
                      <option value={5}>5 — Right, top</option>
                      <option value={6}>6 — Right, 2nd</option>
                      <option value={7}>7 — Right, 3rd</option>
                      <option value={8}>8 — Right, bottom</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingDimId(null)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                    <button onClick={saveDim}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className={dim.visible ? '' : 'opacity-40'}>
                    <span className="text-xs text-gray-400 mr-2">Pos {dim.slot + 1}</span>
                    <span className="text-sm font-medium">{dim.name}</span>
                    {dim.subtitle && <span className="text-xs text-gray-400 ml-2">({dim.subtitle})</span>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateDimension(dim.id, { visible: !dim.visible })}
                        title={dim.visible ? 'Hide dimension' : 'Show dimension'}
                        className={`text-xs px-2 py-0.5 border rounded transition-colors ${
                          dim.visible ? 'border-gray-300 text-gray-500 hover:bg-gray-50' : 'border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100'
                        }`}>
                        {dim.visible ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => startEditDim(dim.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-0.5 border border-blue-300 rounded hover:bg-blue-50">
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Manage who has access to <strong>{currentSystem?.name}</strong>. Global admins always have full access.
          </p>

          <div className="border border-gray-200 rounded overflow-hidden">
            {membersLoading ? (
              <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Username</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Global role</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">System access</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, idx) => (
                    <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2">
                        {member.username}
                        {member.id === currentUser?.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                      </td>
                      <td className="px-3 py-2">
                        {member.globalRole === 'admin' ? (
                          <span className="text-xs text-blue-700 font-medium">admin (global)</span>
                        ) : (
                          <select value={member.globalRole}
                            onChange={e => handleUpdateGlobalRole(member, e.target.value)}
                            disabled={member.id === currentUser?.id}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-blue-500 disabled:bg-gray-100">
                            <option value="contributor">Contributor</option>
                            <option value="viewer">viewer</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {member.globalRole === 'admin' ? (
                          <span className="text-xs text-gray-400">Full access</span>
                        ) : member.systemRole ? (
                          <select value={member.systemRole}
                            onChange={e => handleRoleChange(member, e.target.value)}
                            className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-blue-500">
                            <option value="contributor">Contributor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No access</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.globalRole !== 'admin' && (
                            <button onClick={() => handleToggleAccess(member)}
                              className={`text-xs px-2 py-0.5 border rounded transition-colors ${
                                member.systemRole
                                  ? 'border-gray-300 text-gray-500 hover:bg-gray-50'
                                  : 'border-blue-400 text-blue-600 hover:bg-blue-50'
                              }`}>
                              {member.systemRole ? 'Revoke' : 'Grant'}
                            </button>
                          )}
                          <button onClick={() => handleDeleteUser(member.id)}
                            disabled={member.id === currentUser?.id || member.globalRole === 'admin'}
                            className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Add user */}
          <div className="border border-gray-200 rounded p-3 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Add New User</h3>
            <div className="flex gap-2">
              <input type="text" value={newUsername}
                onChange={e => { setNewUsername(e.target.value); setUserError(''); }}
                placeholder="Username"
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
              <input type="password" value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setUserError(''); }}
                placeholder="Password"
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Global role</label>
                <select value={newGlobalRole} onChange={e => setNewGlobalRole(e.target.value as 'contributor' | 'viewer')}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1">Access to {currentSystem?.name}</label>
                <select value={newSystemRole} onChange={e => setNewSystemRole(e.target.value as 'contributor' | 'viewer')}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            {userError && <p className="text-red-600 text-xs">{userError}</p>}
            <button onClick={handleAddUser}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded transition-colors">
              Add User
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
