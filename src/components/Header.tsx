import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Header({ onOrgClick, onStockClick }: { onOrgClick?: () => void; onStockClick?: () => void }) {
  const { currentUser, logout, setAdminPanel, systems, currentSystem, switchSystem, addSystem } = useApp();
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [addingSystem, setAddingSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemDesc, setNewSystemDesc] = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'contributor';

  const handleAddSystem = async () => {
    if (!newSystemName.trim()) return;
    const sys = await addSystem(newSystemName.trim(), newSystemDesc.trim() || undefined);
    await switchSystem(sys);
    setNewSystemName('');
    setNewSystemDesc('');
    setAddingSystem(false);
    setShowSystemMenu(false);
  };

  return (
    <header className="bg-blue-900 text-white px-4 py-2 flex items-center justify-between flex-shrink-0">
      {/* Left: App title + version */}
      <div className="flex items-center gap-2">
        <span className="text-white font-semibold text-lg tracking-wide">CMDB</span>
        <span className="text-blue-300 font-bold text-lg">360</span>
        <sup className="text-blue-300 text-xs">°</sup>
        <span className="text-red-500 text-xs font-semibold ml-1">V1.2.0</span>
      </div>

      {/* Center: System selector */}
      <div className="flex items-center gap-3">
        {/* System selector */}
        {currentUser && systems.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowSystemMenu(v => !v)}
              className="flex items-center gap-1.5 bg-blue-800 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded transition-colors max-w-[200px]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
              </svg>
              <span className="truncate">{currentSystem?.name ?? 'Select system'}</span>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>

            {showSystemMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 min-w-[220px]">
                <div className="py-1">
                  {systems.map(sys => (
                    <button
                      key={sys.id}
                      onClick={() => { switchSystem(sys); setShowSystemMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        sys.id === currentSystem?.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {sys.name}
                      {sys.description && (
                        <div className="text-xs text-gray-400 truncate">{sys.description}</div>
                      )}
                    </button>
                  ))}
                </div>

                {isAdmin && (
                  <div className="border-t border-gray-100">
                    {addingSystem ? (
                      <div className="p-3 space-y-2">
                        <input
                          autoFocus
                          type="text"
                          value={newSystemName}
                          onChange={e => setNewSystemName(e.target.value)}
                          placeholder="System name"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                          onKeyDown={e => e.key === 'Enter' && handleAddSystem()}
                        />
                        <input
                          type="text"
                          value={newSystemDesc}
                          onChange={e => setNewSystemDesc(e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:border-blue-500"
                          onKeyDown={e => e.key === 'Enter' && handleAddSystem()}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleAddSystem}
                            disabled={!newSystemName.trim()}
                            className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-xs py-1 rounded"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setAddingSystem(false); setNewSystemName(''); setNewSystemDesc(''); }}
                            className="flex-1 border border-gray-300 text-gray-600 text-xs py-1 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingSystem(true)}
                        className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        + Add new system
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: User info + controls */}
      <div className="flex items-center gap-3">
        {currentUser && (
          <>
            <div className="text-right">
              <div className="text-sm font-medium">{currentUser.username}</div>
              <div className="text-xs text-gray-400 capitalize">{currentUser.role}</div>
            </div>
            <button
              onClick={onOrgClick}
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
            >
              Org
            </button>
            {canEdit && (
              <button
                onClick={onStockClick}
                className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
              >
                Stock
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setAdminPanel(true)}
                className="bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
              >
                Admin
              </button>
            )}
            <button
              onClick={logout}
              className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
            >
              Logout
            </button>
          </>
        )}
      </div>

      {/* Close system menu on outside click */}
      {showSystemMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSystemMenu(false)} />
      )}
    </header>
  );
}
