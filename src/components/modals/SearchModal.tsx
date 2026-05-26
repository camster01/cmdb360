import { useState, useMemo } from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';

export default function SearchModal() {
  const { appData, setModalSearch, setFocusedItemId } = useApp();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return appData.items.filter(
      item =>
        item.code.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [query, appData.items]);

  const getDimName = (dimId: string) =>
    appData.dimensions.find(d => d.id === dimId)?.name ?? dimId;

  const handleSelect = (itemId: string) => {
    setFocusedItemId(itemId);
    setModalSearch(false);
  };

  return (
    <Modal title="Search for Content" onClose={() => setModalSearch(false)}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by code or description..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>

        {query.trim() && (
          <div className="border border-gray-200 rounded overflow-hidden">
            {results.length === 0 ? (
              <div className="text-gray-400 text-sm p-4 text-center">No results found</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Dimension</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Code</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((item, idx) => (
                    <tr
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={`cursor-pointer border-b border-gray-100 hover:bg-blue-50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-500">{getDimName(item.dimensionId)}</td>
                      <td className="px-3 py-2 font-medium text-blue-700">{item.code}</td>
                      <td className="px-3 py-2 text-gray-700">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!query.trim() && (
          <p className="text-gray-400 text-sm italic text-center py-4">
            Type to search across all content items
          </p>
        )}
      </div>
    </Modal>
  );
}
