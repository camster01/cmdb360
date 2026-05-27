import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useApp } from '../../context/AppContext';
import OrgPage from '../OrgPage';
import type { OrgNode, DimensionField } from '../../types';

export default function ContentDetailModal() {
  const { appData, currentUser, focusedItemId, updateItem, setModalContentDetail,
          getOrgNodePath, assignOrgNode,
          getDimensionFields, getItemFieldValues, saveItemFieldValues } = useApp();
  const focusedItem = appData.items.find(i => i.id === focusedItemId) ?? null;
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'contributor';

  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [urls, setUrls] = useState<Array<{ label: string; url: string }>>([]);
  const [saved, setSaved] = useState(false);
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  // Custom fields
  const [dimFields, setDimFields] = useState<DimensionField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldsLoading, setFieldsLoading] = useState(false);

  useEffect(() => {
    if (focusedItem) {
      setCode(focusedItem.code);
      setDescription(focusedItem.description);
      setDetails(focusedItem.details ?? '');
      setUrls(focusedItem.urls ?? []);
    }
  }, [focusedItem]);

  // Load dimension fields + item field values when item changes
  useEffect(() => {
    if (!focusedItem) return;
    setFieldsLoading(true);
    Promise.all([
      getDimensionFields(focusedItem.dimensionId),
      getItemFieldValues(focusedItem.id),
    ]).then(([fields, values]) => {
      setDimFields(fields);
      setFieldValues(values);
    }).catch(() => {
      // Non-fatal — fields section just won't show
    }).finally(() => setFieldsLoading(false));
  }, [focusedItem?.id, focusedItem?.dimensionId]);

  if (!focusedItem) return null;

  const dimName = appData.dimensions.find(d => d.id === focusedItem.dimensionId)?.name ?? '';

  const handleSave = async () => {
    if (!focusedItemId) return;
    try {
      await updateItem(focusedItemId, { code, description, details, urls });
      if (dimFields.length > 0) {
        await saveItemFieldValues(focusedItemId, fieldValues);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Silently ignore — user can try again
    }
  };

  const addUrl = () => setUrls(prev => [...prev, { label: '', url: '' }]);
  const removeUrl = (idx: number) => setUrls(prev => prev.filter((_, i) => i !== idx));
  const updateUrl = (idx: number, field: 'label' | 'url', value: string) => {
    setUrls(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  };

  const setFieldValue = (fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  return (
    <>
    <Modal
      title={canEdit ? 'Edit Entry Details' : 'Entry Details'}
      onClose={() => setModalContentDetail(false)}
      width="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Org Location — top of modal */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-600">Location</label>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowOrgPicker(true)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded transition-colors"
                >
                  {focusedItem?.org_node_id ? 'Change' : 'Assign'}
                </button>
                {focusedItem?.org_node_id && (
                  <button
                    onClick={() => focusedItemId && assignOrgNode(focusedItemId, null)}
                    className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 border border-red-200 rounded hover:bg-red-50 transition-colors"
                    title="Clear org assignment"
                  >Clear</button>
                )}
              </div>
            )}
          </div>
          {focusedItem?.org_node_id ? (
            (() => {
              const path = getOrgNodePath(focusedItem.org_node_id);
              return path.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-blue-500 flex-shrink-0">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  {path.map((n, i) => (
                    <span key={n.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-blue-300 text-xs">›</span>}
                      <span className={`text-xs ${i === path.length - 1 ? 'font-semibold text-blue-800' : 'text-blue-600'}`}>
                        {n.name}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-gray-400 text-xs italic">Location not found in current org</div>
              );
            })()
          ) : (
            <div className="text-gray-400 text-xs italic">Not assigned to any org location</div>
          )}
        </div>

        {/* Dimension badge */}
        <div className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
            {dimName}
          </span>
          <span className="text-gray-400 text-xs">
            Updated: {new Date(focusedItem.updatedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Code */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Entry ID</label>
          {canEdit ? (
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm">{code}</div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
          {canEdit ? (
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm">{description}</div>
          )}
        </div>

        {/* Details */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Details</label>
          {canEdit ? (
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 resize-y"
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm min-h-[5rem] whitespace-pre-wrap">
              {details || <span className="text-gray-400 italic">No details</span>}
            </div>
          )}
        </div>

        {/* Custom dimension fields */}
        {!fieldsLoading && dimFields.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Properties</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {dimFields.map(field => {
                const val = fieldValues[field.id] ?? '';
                const isTextarea = field.fieldType === 'textarea';
                const isFullWidth = isTextarea || field.fieldName === 'Comments';
                return (
                  <div key={field.id} className={isFullWidth ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{field.fieldName}</label>
                    {canEdit ? (
                      isTextarea ? (
                        <textarea
                          value={val}
                          onChange={e => setFieldValue(field.id, e.target.value)}
                          rows={3}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500 resize-y"
                        />
                      ) : (
                        <input
                          type={field.fieldType === 'date' ? 'date' : 'text'}
                          value={val}
                          onChange={e => setFieldValue(field.id, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                        />
                      )
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm min-h-[2rem] whitespace-pre-wrap">
                        {val || <span className="text-gray-400 italic">—</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* URLs */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-600">Links / URLs</label>
            {canEdit && (
              <button
                onClick={addUrl}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded transition-colors"
              >
                + Add Link
              </button>
            )}
          </div>
          {urls.length === 0 ? (
            <div className="text-gray-400 text-xs italic">No links</div>
          ) : (
            <div className="space-y-2">
              {urls.map((u, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  {canEdit ? (
                    <>
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
                    </>
                  ) : (
                    <a
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {u.label || u.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {canEdit && (
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setModalContentDetail(false)}
              className="text-sm px-4 py-1.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="text-sm px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </Modal>

    {/* Org picker overlay — sits above the modal (z-[60]) */}
    {showOrgPicker && focusedItemId && (
      <OrgPage
        onClose={() => setShowOrgPicker(false)}
        pickerMode={{
          selectedId: focusedItem?.org_node_id ?? null,
          onPick: async (node: OrgNode) => {
            await assignOrgNode(focusedItemId, node.id);
            setShowOrgPicker(false);
          },
        }}
      />
    )}
    </>
  );
}
