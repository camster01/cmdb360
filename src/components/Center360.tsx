import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function Center360() {
  const {
    appData,
    currentUser,
    focusedItemId,
    setFocusedItemId,
    setModalSearch,
    setModalContentDetail,
    setModalAddContent,
    setModalChat,
    siteTitle,
    getOrgNodePath,
  } = useApp();

  const focusedItem = appData.items.find(i => i.id === focusedItemId) ?? null;
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'contributor';
  const orgPath = focusedItem?.org_node_id ? getOrgNodePath(focusedItem.org_node_id) : [];

  const [selectedDimId, setSelectedDimId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // Default dimension to "Computer" on first load if nothing is selected yet
  useEffect(() => {
    if (appData.dimensions.length === 0 || selectedDimId) return;
    const computerDim = appData.dimensions.find(d => d.name === 'Computer' && d.visible);
    if (computerDim) setSelectedDimId(computerDim.id);
  }, [appData.dimensions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusedItem) {
      setSelectedDimId(focusedItem.dimensionId);
      setSelectedItemId(focusedItem.id);
    }
  }, [focusedItem]);

  const itemsInDim = appData.items.filter(i => i.dimensionId === selectedDimId);
  const sortedDimensions = [...appData.dimensions].sort((a, b) => a.slot - b.slot).filter(d => d.visible);

  const handleDimChange = (dimId: string) => {
    setSelectedDimId(dimId);
    setSelectedItemId('');
  };

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    if (itemId) setFocusedItemId(itemId);
  };

  return (
    <div className="relative flex flex-col h-full items-center justify-between pt-0 pb-8 overflow-hidden">

      {/* Background SVG — 4 separated arrows scaled to fill the column */}
      <svg
        viewBox="0 0 210 210"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: '12%', bottom: '30%', left: 0, right: 0, width: '100%', height: '58%', opacity: 0.18, pointerEvents: 'none' }}
      >
        {/* Arc 1: 15° → 75° (30° gaps) */}
        <path d="M 129 15 A 93 93 0 0 1 195 81" stroke="#2dd4bf" strokeWidth="14" strokeLinecap="butt"/>
        <polygon points="-14,-14 22,0 -14,14" fill="#2dd4bf" transform="translate(195 81) rotate(75)"/>
        {/* Arc 2: 105° → 165° */}
        <path d="M 195 129 A 93 93 0 0 1 129 195" stroke="#0d9488" strokeWidth="14" strokeLinecap="butt"/>
        <polygon points="-14,-14 22,0 -14,14" fill="#0d9488" transform="translate(129 195) rotate(165)"/>
        {/* Arc 3: 195° → 255° */}
        <path d="M 81 195 A 93 93 0 0 1 15 129" stroke="#2dd4bf" strokeWidth="14" strokeLinecap="butt"/>
        <polygon points="-14,-14 22,0 -14,14" fill="#2dd4bf" transform="translate(15 129) rotate(255)"/>
        {/* Arc 4: 285° → 345° */}
        <path d="M 15 81 A 93 93 0 0 1 81 15" stroke="#0d9488" strokeWidth="14" strokeLinecap="butt"/>
        <polygon points="-14,-14 22,0 -14,14" fill="#0d9488" transform="translate(81 15) rotate(345)"/>
      </svg>

      {/* Title */}
      <div className="relative z-10 flex items-center gap-2 flex-shrink-0">
        <div className="text-blue-700 font-bold text-lg text-center leading-tight">{siteTitle}</div>
        <button
          onClick={() => setModalChat(true)}
          disabled={false}
          className="flex flex-col items-center justify-center gap-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full flex-shrink-0 transition-colors" style={{ width: '72px', height: '48px' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          <span className="text-white leading-tight text-center" style={{ fontSize: '11px', lineHeight: '1.2' }}>CMDB360<br/>Chatbot</span>
        </button>
      </div>

      {/* Navigation Controls + Org breadcrumb grouped together in the centre */}
      <div className="relative z-10 w-full max-w-xs flex-shrink-0 -mt-20">
        {/* Org location breadcrumb */}
        {orgPath.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap justify-center px-2 mb-2 py-1 bg-white/70 rounded-lg border border-blue-100">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-500 flex-shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {orgPath.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300 text-xs">›</span>}
                <span className={`text-xs ${i === orgPath.length - 1 ? 'font-semibold text-blue-700' : 'text-blue-500'}`}>
                  {n.name}
                </span>
              </span>
            ))}
          </div>
        )}
      <div className="space-y-2">
        <div className="text-blue-600 font-semibold text-xs text-center mb-1">Select Focus Content...</div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 w-20 text-right flex-shrink-0">Dimension</label>
          <select
            value={selectedDimId}
            onChange={e => handleDimChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="">-- Select --</option>
            {sortedDimensions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 w-20 text-right flex-shrink-0">Entry ID</label>
          <select
            value={selectedItemId}
            onChange={e => handleItemChange(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 bg-white"
            disabled={!selectedDimId}
          >
            <option value="">-- Select --</option>
            {itemsInDim.map(item => (
              <option key={item.id} value={item.id}>{item.code}</option>
            ))}
          </select>
        </div>

        {focusedItem && (
          <div className="text-xs text-gray-800 leading-relaxed text-center px-2">
            {focusedItem.description}
          </div>
        )}

        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="text-blue-600 font-semibold text-xs">...or Search for Content</span>
          <button
            onClick={() => setModalSearch(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded transition-colors"
          >
            Search
          </button>
        </div>
      </div>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 w-full max-w-xs space-y-1.5 flex-shrink-0">
        <button
          onClick={() => focusedItemId && setModalContentDetail(true)}
          disabled={!focusedItemId}
          className="w-full border border-blue-600 text-blue-700 bg-white/80 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed text-xs font-semibold py-1.5 px-3 rounded transition-colors"
        >
          {canEdit ? 'View/Edit Entry Details' : 'View Entry Details'}
        </button>

        {canEdit && (
          <button
            onClick={() => setModalAddContent(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors"
          >
            Add New Entry
          </button>
        )}

      </div>

    </div>
  );
}
