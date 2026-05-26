import { useState } from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';

export default function AddContentModal() {
  const { appData, addItem, setFocusedItemId, setModalAddContent } = useApp();
  const [dimensionId, setDimensionId] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [urls, setUrls] = useState<Array<{ label: string; url: string }>>([]);
  const [error, setError] = useState('');

  const addUrl = () => setUrls(prev => [...prev, { label: '', url: '' }]);
  const removeUrl = (idx: number) => setUrls(prev => prev.filter((_, i) => i !== idx));
  const updateUrl = (idx: number, field: 'label' | 'url', value: string) =>
    setUrls(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  const [submitting, setSubmitting] = useState(false);

  const sortedDims = [...appData.dimensions].sort((a, b) => a.slot - b.slot);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!dimensionId) { setError('Please select a dimension.'); return; }
    if (!code.trim()) { setError('Code is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const newItem = await addItem({
        dimensionId,
        code: code.trim(),
        description: description.trim(),
        details: details.trim() || undefined,
        urls: urls.filter(u => u.url.trim()),
      });
      setFocusedItemId(newItem.id);
      setModalAddContent(false);
    } catch {
      setError('Failed to create entry. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Add New Entry" onClose={() => setModalAddContent(false)}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Dimension *</label>
          <select
            value={dimensionId}
            onChange={e => { setDimensionId(e.target.value); setError(''); }}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Select Dimension --</option>
            {sortedDims.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Entry ID *</label>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(''); }}
            placeholder="e.g. CHG-001"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
          <input
            type="text"
            value={description}
            onChange={e => { setDescription(e.target.value); setError(''); }}
            placeholder="Short description"
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Details</label>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={3}
            placeholder="Optional detailed notes..."
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 resize-y"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-600">Links / URLs</label>
            <button
              onClick={addUrl}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded transition-colors"
            >
              + Add Link
            </button>
          </div>
          {urls.length === 0 ? (
            <div className="text-gray-400 text-xs italic">No links added</div>
          ) : (
            <div className="space-y-2">
              {urls.map((u, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={u.label}
                    onChange={e => updateUrl(idx, 'label', e.target.value)}
                    placeholder="Label"
                    className="w-32 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="url"
                    value={u.url}
                    onChange={e => updateUrl(idx, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => removeUrl(idx)}
                    className="text-red-500 hover:text-red-700 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setModalAddContent(false)}
            className="text-sm px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded transition-colors flex items-center gap-2"
          >
            {submitting && (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}
