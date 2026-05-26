import { useApp } from '../context/AppContext';
import { Dimension, ContentItem } from '../types';

interface DimensionPanelProps {
  dimension: Dimension;
  relatedItems: ContentItem[];
}

export default function DimensionPanel({ dimension, relatedItems }: DimensionPanelProps) {
  const {
    currentUser,
    focusedItemId,
    setFocusedItemId,
    setModalAddRelationship,
    appData,
    removeRelationship,
  } = useApp();

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'contributor';

  const findRelationshipId = (itemId: string): string | null => {
    const rel = appData.relationships.find(
      r => (r.item1Id === focusedItemId && r.item2Id === itemId) ||
           (r.item2Id === focusedItemId && r.item1Id === itemId)
    );
    return rel?.id ?? null;
  };

  const handleRemove = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const relId = findRelationshipId(itemId);
    if (relId && confirm('Remove this relationship?')) {
      await removeRelationship(relId);
    }
  };

  return (
    <div className="flex flex-col flex-1 border border-blue-700 rounded overflow-hidden min-h-0">
      {/* Panel Header */}
      <div className="bg-blue-800 text-white px-2 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-blue-700 rounded-sm flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold leading-none">{relatedItems.length}</span>
          </div>
          <div>
            <div className="text-xs font-semibold leading-tight">{dimension.name}</div>
            {dimension.subtitle && (
              <div className="text-blue-300 text-xs leading-tight">{dimension.subtitle}</div>
            )}
          </div>
        </div>
        {canEdit && focusedItemId && (
          <button
            onClick={() => setModalAddRelationship({ dimensionId: dimension.id })}
            title="Add relationship"
            className="w-6 h-6 bg-blue-700 hover:bg-blue-600 text-white text-base font-bold rounded flex items-center justify-center flex-shrink-0 transition-colors"
          >
            +
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        {!focusedItemId ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs p-2 italic">
            Select a focus item
          </div>
        ) : relatedItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-xs p-2 italic">
            No related items
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-2 py-1 font-semibold text-gray-600 whitespace-nowrap w-24">Relates to</th>
                <th className="text-left px-2 py-1 font-semibold text-gray-600">Descr</th>
                {canEdit && <th className="w-6"></th>}
              </tr>
            </thead>
            <tbody>
              {relatedItems.map((item, idx) => (
                <tr
                  key={item.id}
                  onClick={() => setFocusedItemId(item.id)}
                  className={`cursor-pointer border-b border-gray-100 transition-colors group
                    ${idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}
                  `}
                >
                  <td className="px-2 py-1 font-medium text-blue-700 whitespace-nowrap">{item.code}</td>
                  <td className="px-2 py-1 text-gray-700 leading-snug">{item.description}</td>
                  {canEdit && (
                    <td className="px-1 py-1 text-right">
                      <button
                        onClick={e => handleRemove(e, item.id)}
                        title="Remove relationship"
                        className="w-5 h-5 rounded bg-red-100 hover:bg-red-500 text-red-600 hover:text-white font-bold text-sm leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        −
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
