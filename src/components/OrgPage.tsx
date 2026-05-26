import { useState, useEffect, useCallback, useRef } from 'react';
import { utils, writeFile } from 'xlsx';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { OrgNode, OrgData, ContentItem, Dimension } from '../types';

// ── Excel export helpers ──────────────────────────────────────────────────────

function collectAllItems(node: OrgNode, items: ContentItem[]): ContentItem[] {
  return [
    ...items.filter(i => i.org_node_id === node.id),
    ...node.children.flatMap(c => collectAllItems(c, items)),
  ];
}

function exportOrgToExcel(
  node: OrgNode,
  allItems: ContentItem[],
  dimensions: Dimension[],
  getPath: (id: string) => OrgNode[],
) {
  const items = collectAllItems(node, allItems);
  if (items.length === 0) return;

  const rows = items.map(item => {
    const path = item.org_node_id ? getPath(item.org_node_id) : [];
    const dim = dimensions.find(d => d.id === item.dimensionId);
    return {
      'Location':       path.map(n => n.name).join(' › '),
      'Dimension':      dim?.name ?? '',
      'Serial # / Code': item.code,
      'Description':    item.description,
      'Order #':        item.order_number ?? '',
      'Note':           item.details ?? '',
      'Created':        new Date(item.createdAt).toLocaleDateString(),
    };
  });

  const ws = utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key as keyof typeof r] ?? '').length)) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Items');
  writeFile(wb, `${node.name.replace(/[^a-z0-9]/gi, '_')}-items.xlsx`);
}

// ── Tree state helpers ────────────────────────────────────────────────────────

function updateNode(tree: OrgNode[], id: string, patch: Partial<OrgNode>): OrgNode[] {
  return tree.map(n =>
    n.id === id ? { ...n, ...patch } : { ...n, children: updateNode(n.children, id, patch) }
  );
}

function insertChild(tree: OrgNode[], parentId: string | null, node: OrgNode): OrgNode[] {
  if (parentId === null) return [...tree, node];
  return tree.map(n =>
    n.id === parentId
      ? { ...n, children: [...n.children, node] }
      : { ...n, children: insertChild(n.children, parentId, node) }
  );
}

function removeNode(tree: OrgNode[], id: string): OrgNode[] {
  return tree
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: removeNode(n.children, id) }));
}

function countDescendants(node: OrgNode): number {
  return node.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

// ── Depth icons ───────────────────────────────────────────────────────────────
const DEPTH_COLOURS = [
  'text-blue-800', 'text-blue-600', 'text-blue-400', 'text-blue-300',
  'text-indigo-400', 'text-purple-400', 'text-pink-400',
];
const depthColour = (d: number) => DEPTH_COLOURS[Math.min(d, DEPTH_COLOURS.length - 1)];

function NodeIcon({ depth }: { depth: number }) {
  const cls = `w-4 h-4 flex-shrink-0 ${depthColour(depth)}`;
  if (depth === 0) return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  );
  if (depth === 1) return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
      <path d="M1 11l11-9 11 9v11h-7v-7H8v7H1z"/>
    </svg>
  );
  if (depth === 2) return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
      <path d="M17 11H7V9h10v2zm2-7H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3.5 h-3.5 flex-shrink-0 ${depthColour(depth)}`}>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  );
}

// ── Inline text field ─────────────────────────────────────────────────────────
function InlineInput({
  initial = '', placeholder = 'Name…', onSave, onCancel, className = '',
}: { initial?: string; placeholder?: string; onSave: (v: string) => void; onCancel: () => void; className?: string }) {
  const [val, setVal] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <span className="flex items-center gap-1">
      <input ref={ref} type="text" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className={`border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      />
      <button onClick={() => val.trim() && onSave(val.trim())}
        className="w-5 h-5 bg-green-500 hover:bg-green-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">✓</button>
      <button onClick={onCancel}
        className="w-5 h-5 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded flex items-center justify-center text-xs font-bold flex-shrink-0">✕</button>
    </span>
  );
}

// ── Picker mode type ──────────────────────────────────────────────────────────
interface PickerMode {
  onPick: (node: OrgNode) => void;
  selectedId?: string | null;
}

// ── Browse info (passed in browse mode to show assigned items) ────────────────
interface BrowseInfo {
  items: ContentItem[];
  dimensions: Dimension[];
  onSelectItem: (itemId: string) => void;
  onExport: (node: OrgNode) => void;
}

// ── Single org node row (recursive) ───────────────────────────────────────────
interface NodeRowProps {
  node: OrgNode;
  depth: number;
  labels: string[];
  canEdit: boolean;
  isAdmin: boolean;
  onAddChild: (parentId: string, name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onUpdateChildrenLabel: (id: string, label: string | null) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  pickerMode?: PickerMode;
  browseInfo?: BrowseInfo;
}

function NodeRow({ node, depth, labels, canEdit, isAdmin, onAddChild, onUpdate, onUpdateChildrenLabel, onDelete, pickerMode, browseInfo }: NodeRowProps) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [editingChildLabel, setEditingChildLabel] = useState(false);
  const isSelected = pickerMode?.selectedId === node.id;

  // Per-node override wins; fall back to global level label, then generic 'Child'
  const globalChildLabel = labels[depth + 1] ?? (labels[depth] ? `${labels[depth]} child` : 'Child');
  const childLabel = node.children_label ?? globalChildLabel;
  const hasCustomChildLabel = !!node.children_label && node.children_label !== globalChildLabel;

  const indent = depth * 20;
  const hasChildren = node.children.length > 0;
  const descendants = countDescendants(node);

  // Items directly assigned to this node
  const directItems = browseInfo ? browseInfo.items.filter(i => i.org_node_id === node.id) : [];
  const hasExpandable = hasChildren || addingChild || (browseInfo && directItems.length > 0);

  return (
    <div>
      {/* Row */}
      <div
        onClick={() => pickerMode && pickerMode.onPick(node)}
        className={`flex items-center gap-1.5 py-1 pr-3 rounded group transition-colors
          ${pickerMode ? 'cursor-pointer hover:bg-blue-100' : 'hover:bg-blue-50'}
          ${isSelected ? 'bg-blue-200 border border-blue-400' : depth === 0 && !pickerMode ? 'bg-blue-50/60 border border-blue-100 mb-0.5' : ''}`}
        style={{ paddingLeft: `${indent + 6}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 transition-transform
            ${hasExpandable ? 'text-gray-400 hover:text-blue-600' : 'opacity-0 pointer-events-none'}`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}>
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>

        <NodeIcon depth={depth} />

        {editing ? (
          <InlineInput
            initial={node.name}
            onSave={v => { onUpdate(node.id, v); setEditing(false); }}
            onCancel={() => setEditing(false)}
            className="w-48"
          />
        ) : (
          <>
            <span className={`text-sm flex-1 truncate ${depth === 0 ? 'font-semibold text-blue-900' : 'text-gray-800'}`}>
              {node.name}
            </span>
            {/* Custom children-label badge (always visible when set) */}
            {hasCustomChildLabel && !canEdit && (
              <span className="text-xs text-indigo-400 italic mr-1 flex-shrink-0">({childLabel}s)</span>
            )}
            {/* Item count badge + export button (browse mode) */}
            {browseInfo && (() => {
              const totalCount = collectAllItems(node, browseInfo.items).length;
              if (totalCount === 0) return null;
              return (
                <span className="flex items-center gap-1 flex-shrink-0 mr-1">
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                    {totalCount}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); browseInfo.onExport(node); }}
                    title={`Export all ${totalCount} ${totalCount === 1 ? 'entry' : 'entries'} under ${node.name} to Excel`}
                    className="text-gray-400 hover:text-green-600 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                  </button>
                </span>
              );
            })()}
            {descendants > 0 && (
              <span className="text-xs text-gray-300 flex-shrink-0 mr-1">{descendants}</span>
            )}
            {/* Picker mode: show "Select" button on hover */}
            {pickerMode && (
              <span className="hidden group-hover:flex items-center flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded font-medium
                  ${isSelected ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`}>
                  {isSelected ? '✓ Selected' : 'Select'}
                </span>
              </span>
            )}
            {canEdit && !pickerMode && (
              <span className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                {/* Add-child button: split into [+ label] and [✏ rename label] */}
                {editingChildLabel ? (
                  <InlineInput
                    initial={node.children_label ?? globalChildLabel}
                    placeholder="Children type…"
                    onSave={v => { onUpdateChildrenLabel(node.id, v.trim() || null); setEditingChildLabel(false); }}
                    onCancel={() => setEditingChildLabel(false)}
                    className="w-28"
                  />
                ) : (
                  <span className="flex items-center flex-shrink-0">
                    <button
                      onClick={() => { setAddingChild(true); setOpen(true); }}
                      className={`text-xs px-1.5 py-0.5 border rounded-l whitespace-nowrap
                        ${hasCustomChildLabel
                          ? 'text-indigo-600 hover:text-indigo-800 border-indigo-300 hover:bg-indigo-50'
                          : 'text-blue-600 hover:text-blue-800 border-blue-300 hover:bg-blue-50'}`}
                    >+ {childLabel}</button>
                    <button
                      onClick={() => setEditingChildLabel(true)}
                      title={hasCustomChildLabel ? `Custom type: "${childLabel}" — click to rename or clear` : 'Set custom children type name'}
                      className={`text-xs px-1 py-0.5 border border-l-0 rounded-r leading-none
                        ${hasCustomChildLabel
                          ? 'text-indigo-400 hover:text-indigo-700 border-indigo-300 hover:bg-indigo-50'
                          : 'text-gray-300 hover:text-blue-500 border-blue-200 hover:bg-blue-50'}`}
                    >✏</button>
                  </span>
                )}
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-50"
                >Edit</button>
                {isAdmin && (
                  <button
                    onClick={() => onDelete(node.id, node.name)}
                    className="text-xs text-red-500 hover:text-red-700 px-1.5 py-0.5 border border-red-200 rounded hover:bg-red-50"
                  >Delete</button>
                )}
              </span>
            )}
          </>
        )}
      </div>

      {/* Children + add form */}
      {open && (
        <div>
          {/* Vertical guide line */}
          <div style={{ marginLeft: `${indent + 14}px`, borderLeft: '2px solid #dbeafe', paddingLeft: '6px' }}>
            {node.children.map(child => (
              <NodeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                labels={labels}
                canEdit={canEdit}
                isAdmin={isAdmin}
                onAddChild={onAddChild}
                onUpdate={onUpdate}
                onUpdateChildrenLabel={onUpdateChildrenLabel}
                onDelete={onDelete}
                pickerMode={pickerMode}
                browseInfo={browseInfo}
              />
            ))}

            {addingChild && (
              <div className="flex items-center gap-1.5 py-1 pr-3" style={{ paddingLeft: '6px' }}>
                <div className="w-4 h-4 flex-shrink-0" />
                <NodeIcon depth={depth + 1} />
                <InlineInput
                  placeholder={`${childLabel} name…`}
                  onSave={v => { onAddChild(node.id, v); setAddingChild(false); }}
                  onCancel={() => setAddingChild(false)}
                  className="w-48"
                />
              </div>
            )}

            {/* ── Browse mode: item cards assigned directly to this node ── */}
            {browseInfo && directItems.length > 0 && (
              <div className="mt-1 mb-2">
                <div className="text-xs text-gray-400 font-medium mb-1 pl-1 flex items-center gap-1">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-400">
                    <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.49 0 12.36 0c-1.73 0-3.25.79-4.29 2.01L12 6H4L2.01 16H22z M12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-7 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
                  </svg>
                  {directItems.length} entr{directItems.length === 1 ? 'y' : 'ies'} at this location
                </div>
                <div className="space-y-1">
                  {directItems.map(item => {
                    const dim = browseInfo.dimensions.find(d => d.id === item.dimensionId);
                    return (
                      <button
                        key={item.id}
                        onClick={() => browseInfo.onSelectItem(item.id)}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 bg-white border border-blue-100 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group/item shadow-sm"
                      >
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0 whitespace-nowrap">
                          {dim?.name ?? '—'}
                        </span>
                        <span className="text-xs font-mono text-gray-600 flex-shrink-0">{item.code}</span>
                        <span className="text-xs text-gray-500 truncate flex-1">{item.description}</span>
                        <span className="text-xs text-blue-400 flex-shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity ml-1">
                          → focus
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Level labels editor ───────────────────────────────────────────────────────
function LevelLabelsEditor({
  labels, onChange,
}: { labels: string[]; onChange: (labels: string[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const setLabel = (idx: number, val: string) => {
    const next = [...labels];
    next[idx] = val;
    onChange(next);
    setEditIdx(null);
  };

  const addLevel = () => {
    onChange([...labels, `Level ${labels.length + 1}`]);
    setEditIdx(labels.length); // immediately edit the new one
  };

  const removeLevel = (idx: number) => {
    if (labels.length <= 1) return;
    const next = labels.filter((_, i) => i !== idx);
    onChange(next);
    if (editIdx !== null && editIdx >= next.length) setEditIdx(null);
  };

  return (
    <div className="flex items-center flex-wrap gap-1.5 mb-5 p-3 bg-white border border-blue-100 rounded-lg">
      <span className="text-xs font-semibold text-gray-500 mr-1">Level names:</span>
      {labels.map((lbl, idx) => (
        <span key={idx} className="flex items-center gap-0.5">
          {idx > 0 && <span className="text-gray-300 text-xs mx-0.5">→</span>}
          {editIdx === idx ? (
            <InlineInput
              initial={lbl}
              onSave={v => setLabel(idx, v)}
              onCancel={() => setEditIdx(null)}
              className="w-28"
            />
          ) : (
            <span className="flex items-center gap-0.5 group">
              <button
                onClick={() => setEditIdx(idx)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors
                  ${depthColour(idx)} border-current bg-white hover:bg-blue-50 font-medium`}
              >
                {lbl}
              </button>
              {labels.length > 1 && (
                <button
                  onClick={() => removeLevel(idx)}
                  title="Remove level"
                  className="w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-red-400 text-gray-500 hover:text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                >×</button>
              )}
            </span>
          )}
        </span>
      ))}
      <button
        onClick={addLevel}
        className="text-xs px-2 py-0.5 border border-dashed border-blue-300 text-blue-500 rounded hover:bg-blue-50 ml-1"
      >+ level</button>
    </div>
  );
}

// ── Main OrgPage ──────────────────────────────────────────────────────────────
export default function OrgPage({
  onClose,
  pickerMode,
}: {
  onClose: () => void;
  pickerMode?: PickerMode;
}) {
  const { currentUser, currentSystem, appData, setFocusedItemId, getOrgNodePath } = useApp();
  // In picker mode, disable editing regardless of role
  const canEdit = !pickerMode && (currentUser?.role === 'admin' || currentUser?.role === 'contributor');
  const isAdmin = !pickerMode && currentUser?.role === 'admin';

  // Browse mode: show items at each node. Default = true for viewers, false for editors.
  const [browseMode, setBrowseMode] = useState(!canEdit);

  const [orgData, setOrgData] = useState<OrgData>({ labels: ['Site', 'Building', 'Area'], tree: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingRoot, setAddingRoot] = useState(false);
  const [labelsDirty, setLabelsDirty] = useState(false);
  const [labelsSaving, setLabelsSaving] = useState(false);

  // Build browseInfo when in browse mode
  const handleExport = useCallback((node: OrgNode) => {
    exportOrgToExcel(node, appData.items, appData.dimensions, getOrgNodePath);
  }, [appData.items, appData.dimensions, getOrgNodePath]);

  const browseInfo: BrowseInfo | undefined = browseMode && !pickerMode ? {
    items: appData.items,
    dimensions: appData.dimensions,
    onSelectItem: (itemId: string) => {
      setFocusedItemId(itemId);
      onClose();
    },
    onExport: handleExport,
  } : undefined;

  const topLabel = orgData.labels[0] ?? 'Node';

  // Load
  const loadOrg = useCallback(async () => {
    if (!currentSystem) return;
    try {
      const data = await api.getOrg() as OrgData;
      setOrgData(data);
    } catch {
      setError('Failed to load org structure.');
    } finally {
      setLoading(false);
    }
  }, [currentSystem]);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  // Label changes (local until saved)
  const handleLabelsChange = (labels: string[]) => {
    setOrgData(prev => ({ ...prev, labels }));
    setLabelsDirty(true);
  };

  const handleSaveLabels = async () => {
    setLabelsSaving(true);
    try {
      await api.saveOrgLabels(orgData.labels);
      setLabelsDirty(false);
    } catch { setError('Failed to save labels.'); }
    finally { setLabelsSaving(false); }
  };

  // Node ops
  const handleAddNode = async (parentId: string | null, name: string) => {
    try {
      const node = await api.createOrgNode({ parent_id: parentId, name }) as OrgNode & { parent_id: string | null };
      const newNode: OrgNode = { ...node, children: [] };
      setOrgData(prev => ({ ...prev, tree: insertChild(prev.tree, parentId, newNode) }));
    } catch { setError('Failed to add node.'); }
  };

  const handleUpdateNode = async (id: string, name: string) => {
    try {
      await api.updateOrgNode(id, { name });
      setOrgData(prev => ({ ...prev, tree: updateNode(prev.tree, id, { name }) }));
    } catch { setError('Failed to update node.'); }
  };

  const handleUpdateChildrenLabel = async (id: string, children_label: string | null) => {
    try {
      await api.updateOrgNode(id, { children_label });
      setOrgData(prev => ({ ...prev, tree: updateNode(prev.tree, id, { children_label }) }));
    } catch { setError('Failed to update children label.'); }
  };

  const handleDeleteNode = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its children?`)) return;
    try {
      await api.deleteOrgNode(id);
      setOrgData(prev => ({ ...prev, tree: removeNode(prev.tree, id) }));
    } catch { setError('Failed to delete node.'); }
  };

  return (
    <div className={`fixed inset-0 flex flex-col bg-white ${pickerMode ? 'z-[60]' : 'z-50'}`}>
      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-300 flex-shrink-0">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span className="font-semibold text-lg">
            {pickerMode ? 'Select Org Location' : 'Organisation Structure'}
          </span>
          {currentSystem && <span className="text-blue-300 text-sm">— {currentSystem.name}</span>}
          {pickerMode && (
            <span className="text-blue-300 text-sm italic">Click a node to assign it</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Browse / Edit toggle (only for users who can edit, not in picker mode) */}
          {canEdit && !pickerMode && (
            <div className="flex rounded overflow-hidden border border-blue-700 text-xs">
              <button
                onClick={() => setBrowseMode(false)}
                className={`px-3 py-1.5 transition-colors ${!browseMode ? 'bg-blue-600 text-white' : 'text-blue-300 hover:bg-blue-800'}`}
              >✏ Edit</button>
              <button
                onClick={() => setBrowseMode(true)}
                className={`px-3 py-1.5 transition-colors ${browseMode ? 'bg-blue-600 text-white' : 'text-blue-300 hover:bg-blue-800'}`}
              >👁 Browse</button>
            </div>
          )}
          {isAdmin && labelsDirty && !browseMode && (
            <button
              onClick={handleSaveLabels}
              disabled={labelsSaving}
              className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-3 py-1.5 rounded transition-colors"
            >
              {labelsSaving ? 'Saving…' : 'Save Label Changes'}
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded transition-colors"
          >{pickerMode ? '✕ Cancel' : '← Back'}</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className={`mx-auto px-6 py-6 ${browseMode ? 'max-w-3xl' : 'max-w-2xl'}`}>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center justify-between">
              {error}
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-lg leading-none ml-3">✕</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
              <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3" />
              Loading…
            </div>
          ) : (
            <>
              {/* Level labels editor (not shown in picker mode) */}
              {isAdmin && !pickerMode && (
                <LevelLabelsEditor
                  labels={orgData.labels}
                  onChange={handleLabelsChange}
                />
              )}

              {/* Hover hint */}
              {pickerMode && orgData.tree.length > 0 && (
                <p className="text-xs text-blue-500 italic mb-3 font-medium">
                  📍 Click any node in the tree to assign this entry to that location.
                </p>
              )}
              {!pickerMode && orgData.tree.length > 0 && browseMode && (
                <p className="text-xs text-gray-400 italic mb-3">
                  Click any entry to make it the focus on the main page.
                  {canEdit && ' Switch to Edit mode to add or change nodes.'}
                </p>
              )}
              {canEdit && !pickerMode && !browseMode && orgData.tree.length > 0 && (
                <p className="text-xs text-gray-400 italic mb-3">Hover any row to edit, add children, or delete.</p>
              )}

              {/* Empty state */}
              {orgData.tree.length === 0 && !addingRoot && (
                <div className="text-center py-16 text-gray-400">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto mb-3 text-gray-200">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <p className="text-sm">No {topLabel.toLowerCase()}s yet.</p>
                  {canEdit && <p className="text-xs mt-1">Click "+ Add {topLabel}" below to get started.</p>}
                </div>
              )}

              {/* Tree */}
              <div className="space-y-0.5">
                {orgData.tree.map(node => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    labels={orgData.labels}
                    canEdit={canEdit && !browseMode}
                    isAdmin={isAdmin && !browseMode}
                    onAddChild={handleAddNode}
                    onUpdate={handleUpdateNode}
                    onUpdateChildrenLabel={handleUpdateChildrenLabel}
                    onDelete={handleDeleteNode}
                    pickerMode={pickerMode}
                    browseInfo={browseInfo}
                  />
                ))}
              </div>

              {/* Add root node (not shown in picker mode) */}
              {canEdit && !pickerMode && (
                <div className="mt-4">
                  {addingRoot ? (
                    <div className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg">
                      <NodeIcon depth={0} />
                      <InlineInput
                        placeholder={`${topLabel} name…`}
                        onSave={v => { handleAddNode(null, v); setAddingRoot(false); }}
                        onCancel={() => setAddingRoot(false)}
                        className="flex-1 max-w-xs"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingRoot(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded transition-colors"
                    >
                      <span className="text-lg leading-none font-bold">+</span>
                      Add {topLabel}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
