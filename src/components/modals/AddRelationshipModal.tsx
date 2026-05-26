import { useState } from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';

export default function AddRelationshipModal() {
  const {
    appData,
    focusedItemId,
    addItem,
    addRelationship,
    getRelatedItems,
    modalAddRelationship,
    setModalAddRelationship,
  } = useApp();

  const dim = appData.dimensions.find(d => d.id === modalAddRelationship?.dimensionId);
  const focusedItem = appData.items.find(i => i.id === focusedItemId);

  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!dim || !focusedItem) return null;

  // Items in this dimension, excluding already-related ones and focused item
  const relatedMap = getRelatedItems(focusedItem.id);
  const alreadyRelatedInDim = relatedMap.get(dim.id) ?? [];
  const alreadyRelatedIds = new Set([
    focusedItem.id,
    ...alreadyRelatedInDim.map(i => i.id),
  ]);

  const availableItems = appData.items.filter(
    i => i.dimensionId === dim.id && !alreadyRelatedIds.has(i.id)
  );

  const handleSubmit = async () => {
    if (!focusedItemId || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      if (mode === 'existing') {
        if (!selectedItemId) { setError('Please select an entry.'); setSubmitting(false); return; }
        await addRelationship(focusedItemId, selectedItemId);
      } else {
        if (!newCode.trim()) { setError('Entry ID is required.'); setSubmitting(false); return; }
        if (!newDescription.trim()) { setError('Description is required.'); setSubmitting(false); return; }
        const newItem = await addItem({
          dimensionId: dim.id,
          code: newCode.trim(),
          description: newDescription.trim(),
          urls: [],
        });
        await addRelationship(focusedItemId, newItem.id);
      }
      setModalAddRelationship(null);
    } catch {
      setError('Failed to link entry. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Link Entry — ${dim.name}`}
      onClose={() => setModalAddRelationship(null)}
    >
      <div className="space-y-4">
        <div className="text-xs text-gray-500">
          Linking entry{' '}
          <span className="font-semibold text-blue-700">{focusedItem.code}</span>
          {' '}to an entry in{' '}
          <span className="font-semibold text-gray-700">{dim.name}</span>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-0 border border-gray-300 rounded overflow-hidden">
          <button
            onClick={() => { setMode('existing'); setError(''); }}
            className={`flex-1 text-xs py-1.5 transition-colors ${
              mode === 'existing'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Select Existing
          </button>
          <button
            onClick={() => { setMode('new'); setError(''); }}
            className={`flex-1 text-xs py-1.5 transition-colors ${
              mode === 'new'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Create New
          </button>
        </div>

        {mode === 'existing' ? (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Select entry from {dim.name}
            </label>
            {availableItems.length === 0 ? (
              <div className="text-gray-400 text-sm italic py-2">
                No available entries in this dimension (all are already related or none exist).
              </div>
            ) : (
              <select
                value={selectedItemId}
                onChange={e => { setSelectedItemId(e.target.value); setError(''); }}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              >
                <option value="">-- Select an item --</option>
                {availableItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.description}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Entry ID *</label>
              <input
                type="text"
                value={newCode}
                onChange={e => { setNewCode(e.target.value); setError(''); }}
                placeholder="e.g. REQ-001"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
              <input
                type="text"
                value={newDescription}
                onChange={e => { setNewDescription(e.target.value); setError(''); }}
                placeholder="Short description"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setModalAddRelationship(null)}
            className="text-sm px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={(mode === 'existing' && availableItems.length === 0) || submitting}
            className="text-sm px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded transition-colors flex items-center gap-2"
          >
            {submitting && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Link Entry
          </button>
        </div>
      </div>
    </Modal>
  );
}
