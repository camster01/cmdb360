import { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../api';
import { OrgNode } from '../types';
import OrgPage from './OrgPage';

// ── Row model ─────────────────────────────────────────────────────────────────

type RowStatus = 'pending' | 'saving' | 'saved' | 'error';

interface StockRow {
  localId: string;
  serial: string;
  description: string;
  orderNumber: string;
  note: string;
  status: RowStatus;
  errorMsg: string;
}

let rowCounter = 0;
function makeRow(description = '', orderNumber = ''): StockRow {
  return {
    localId: `row-${++rowCounter}`,
    serial: '',
    description,
    orderNumber,
    note: '',
    status: 'pending',
    errorMsg: '',
  };
}

// ── Cell input ────────────────────────────────────────────────────────────────

function Cell({
  value, onChange, placeholder, onTabFromLast, readOnly, className = '', inputRef,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  onTabFromLast?: () => void; readOnly?: boolean; className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      readOnly={readOnly}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={e => {
        if (e.key === 'Tab' && !e.shiftKey && onTabFromLast) {
          e.preventDefault();
          onTabFromLast();
        }
      }}
      className={`w-full px-2 py-1.5 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-400 bg-transparent
        ${readOnly ? 'text-gray-400 cursor-default' : 'text-gray-800'}
        ${className}`}
    />
  );
}

// ── Status indicator ──────────────────────────────────────────────────────────

function RowStatusIcon({ status, errorMsg }: { status: RowStatus; errorMsg: string }) {
  if (status === 'saving') return (
    <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
  );
  if (status === 'saved') return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-green-500">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  );
  if (status === 'error') return (
    <span title={errorMsg}>
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    </span>
  );
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StockEntryPage({ onClose }: { onClose: () => void }) {
  const { appData, getOrgNodePath } = useApp();

  const [selectedOrgNodeId, setSelectedOrgNodeId] = useState<string | null>(null);
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const [selectedDimId, setSelectedDimId] = useState('');
  const [defaultDesc, setDefaultDesc] = useState('');
  const [defaultOrder, setDefaultOrder] = useState('');
  const [rows, setRows] = useState<StockRow[]>([makeRow(), makeRow(), makeRow()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const firstSerialRef = useRef<HTMLInputElement | null>(null);

  const orgPath = selectedOrgNodeId ? getOrgNodePath(selectedOrgNodeId) : [];
  const visibleDimensions = [...appData.dimensions].filter(d => d.visible).sort((a, b) => a.slot - b.slot);
  const readyCount = rows.filter(r => r.serial.trim() && r.status !== 'saved').length;

  // ── Row ops ─────────────────────────────────────────────────────────────────

  const updateRow = useCallback((localId: string, field: keyof StockRow, value: string) => {
    setRows(prev => prev.map(r =>
      r.localId === localId ? { ...r, [field]: value, status: r.status === 'error' ? 'pending' : r.status } : r
    ));
  }, []);

  const addRow = useCallback(() => {
    setRows(prev => [...prev, makeRow(defaultDesc, defaultOrder)]);
  }, [defaultDesc, defaultOrder]);

  const removeRow = useCallback((localId: string) => {
    setRows(prev => prev.filter(r => r.localId !== localId));
  }, []);

  const handleTabFromLast = useCallback(() => {
    addRow();
    // Focus will land on the new row's first input via autoFocus effect
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('input[data-stock-serial]');
      const last = inputs[inputs.length - 1];
      last?.focus();
    }, 30);
  }, [addRow]);

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedOrgNodeId) { setSaveError('Select an org location first.'); return; }
    if (!selectedDimId) { setSaveError('Select a dimension type first.'); return; }
    const toSave = rows.filter(r => r.serial.trim() && r.status !== 'saved');
    if (toSave.length === 0) { setSaveError('Enter at least one serial number.'); return; }
    setSaveError('');
    setSaving(true);

    setRows(prev => prev.map(r =>
      r.serial.trim() && r.status !== 'saved' ? { ...r, status: 'saving' } : r
    ));

    await Promise.all(toSave.map(async row => {
      try {
        await api.createItem({
          dimensionId: selectedDimId,
          code: row.serial.trim(),
          description: row.description.trim() || row.serial.trim(),
          details: row.note.trim() || null,
          org_node_id: selectedOrgNodeId,
          order_number: row.orderNumber.trim() || null,
        });
        setRows(prev => prev.map(r =>
          r.localId === row.localId ? { ...r, status: 'saved', errorMsg: '' } : r
        ));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save';
        setRows(prev => prev.map(r =>
          r.localId === row.localId ? { ...r, status: 'error', errorMsg: msg } : r
        ));
      }
    }));

    setSaving(false);
  };

  const clearSaved = () => {
    setRows(prev => {
      const remaining = prev.filter(r => r.status !== 'saved');
      return remaining.length > 0 ? remaining : [makeRow(defaultDesc, defaultOrder)];
    });
  };

  const savedCount = rows.filter(r => r.status === 'saved').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-blue-900 text-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-300 flex-shrink-0">
            <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 15.49 0 12.36 0c-1.73 0-3.25.79-4.29 2.01L12 6H4L2.01 16H22zM12 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-7 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
          </svg>
          <span className="font-semibold text-lg">Stock Entry</span>
          {orgPath.length > 0 && (
            <span className="text-blue-300 text-sm flex items-center gap-1">
              —
              {orgPath.map((n, i) => (
                <span key={n.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-blue-500">›</span>}
                  <span>{n.name}</span>
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {savedCount > 0 && (
            <button
              onClick={clearSaved}
              className="text-xs text-blue-300 hover:text-white px-3 py-1.5 rounded border border-blue-700 hover:bg-blue-800 transition-colors"
            >
              Clear {savedCount} saved
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || readyCount === 0}
            className="text-xs bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:text-green-600 text-white px-4 py-1.5 rounded font-semibold transition-colors flex items-center gap-1.5"
          >
            {saving ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
                </svg>
                Save {readyCount} {readyCount === 1 ? 'Entry' : 'Entries'}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-1.5 rounded transition-colors"
          >← Back</button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-5 space-y-5">

          {/* Save status bar */}
          {(savedCount > 0 || errorCount > 0 || saveError) && (
            <div className={`px-4 py-2.5 rounded-lg text-sm flex items-center gap-3
              ${errorCount > 0 ? 'bg-red-50 border border-red-200 text-red-700'
                : saveError ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                : 'bg-green-50 border border-green-200 text-green-700'}`}>
              {saveError ? (
                <><svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>{saveError}</>
              ) : (
                <>
                  {savedCount > 0 && <span>✓ {savedCount} {savedCount === 1 ? 'entry' : 'entries'} saved</span>}
                  {errorCount > 0 && <span className="text-red-600">✗ {errorCount} failed — check red rows</span>}
                </>
              )}
              <button onClick={() => setSaveError('')} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {/* ── Setup: Location + Dimension + Defaults ─────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">1. Setup</h2>
            <div className="grid grid-cols-2 gap-4">

              {/* Org Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Org Location <span className="text-red-400">*</span>
                </label>
                {orgPath.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-wrap flex-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-500 flex-shrink-0">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      {orgPath.map((n, i) => (
                        <span key={n.id} className="flex items-center gap-1">
                          {i > 0 && <span className="text-blue-300 text-xs">›</span>}
                          <span className={`text-xs ${i === orgPath.length - 1 ? 'font-semibold text-blue-800' : 'text-blue-600'}`}>{n.name}</span>
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowOrgPicker(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1.5 border border-blue-300 rounded-lg hover:bg-blue-50 whitespace-nowrap flex-shrink-0"
                    >Change</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowOrgPicker(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    Select Location…
                  </button>
                )}
              </div>

              {/* Dimension */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Dimension Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedDimId}
                  onChange={e => {
                    setSelectedDimId(e.target.value);
                    const dim = visibleDimensions.find(d => d.id === e.target.value);
                    if (dim && !defaultDesc) setDefaultDesc(dim.name);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">— Select type —</option>
                  {visibleDimensions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Default description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Default Description
                  <span className="text-gray-400 font-normal ml-1">(auto-fills new rows)</span>
                </label>
                <input
                  type="text"
                  value={defaultDesc}
                  onChange={e => setDefaultDesc(e.target.value)}
                  placeholder="e.g. Dell Latitude 5420"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Default order # */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Default Order #
                  <span className="text-gray-400 font-normal ml-1">(auto-fills new rows)</span>
                </label>
                <input
                  type="text"
                  value={defaultOrder}
                  onChange={e => setDefaultOrder(e.target.value)}
                  placeholder="e.g. PO-2025-0042"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ── Grid ───────────────────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">2. Entries</h2>
              <span className="text-xs text-gray-400">
                {rows.filter(r => r.serial.trim()).length} of {rows.length} rows have serial numbers
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8 px-3 py-2 text-left text-xs font-semibold text-gray-400">#</th>
                    <th className="w-5 px-2 py-2 text-xs font-semibold text-gray-400"></th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">
                      Serial # <span className="text-red-400">*</span>
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                    <th className="w-36 px-2 py-2 text-left text-xs font-semibold text-gray-500">Order #</th>
                    <th className="w-48 px-2 py-2 text-left text-xs font-semibold text-gray-500">Note</th>
                    <th className="w-8 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const isSaved = row.status === 'saved';
                    const isError = row.status === 'error';
                    return (
                      <tr
                        key={row.localId}
                        className={`border-b border-gray-100 transition-colors
                          ${isSaved ? 'bg-green-50' : isError ? 'bg-red-50' : 'hover:bg-blue-50/30'}`}
                      >
                        {/* Row number */}
                        <td className="px-3 py-0.5 text-xs text-gray-300 select-none">{idx + 1}</td>

                        {/* Status */}
                        <td className="px-2 py-0.5 text-center">
                          <RowStatusIcon status={row.status} errorMsg={row.errorMsg} />
                        </td>

                        {/* Serial # */}
                        <td className={`py-0.5 border-l border-gray-100 ${isError ? 'border-l-2 border-l-red-400' : ''}`}>
                          <Cell
                            inputRef={idx === 0 ? firstSerialRef : undefined}
                            value={row.serial}
                            onChange={v => updateRow(row.localId, 'serial', v)}
                            placeholder="SN-XXXXX"
                            readOnly={isSaved}
                          />
                        </td>

                        {/* Description */}
                        <td className="py-0.5 border-l border-gray-100">
                          <Cell
                            value={row.description}
                            onChange={v => updateRow(row.localId, 'description', v)}
                            placeholder={defaultDesc || 'Description'}
                            readOnly={isSaved}
                          />
                        </td>

                        {/* Order # */}
                        <td className="py-0.5 border-l border-gray-100">
                          <Cell
                            value={row.orderNumber}
                            onChange={v => updateRow(row.localId, 'orderNumber', v)}
                            placeholder={defaultOrder || 'PO-XXXX'}
                            readOnly={isSaved}
                          />
                        </td>

                        {/* Note — Tab from last field adds new row */}
                        <td className="py-0.5 border-l border-gray-100">
                          <Cell
                            value={row.note}
                            onChange={v => updateRow(row.localId, 'note', v)}
                            placeholder="Optional note"
                            readOnly={isSaved}
                            onTabFromLast={idx === rows.length - 1 ? handleTabFromLast : undefined}
                          />
                        </td>

                        {/* Delete */}
                        <td className="px-2 py-0.5 text-center">
                          {!isSaved && (
                            <button
                              onClick={() => removeRow(row.localId)}
                              className="text-gray-300 hover:text-red-400 transition-colors"
                              title="Remove row"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add Row
              </button>
              <span className="text-xs text-gray-400">Tab from last cell to add a row</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Org picker overlay */}
    {showOrgPicker && (
      <OrgPage
        onClose={() => setShowOrgPicker(false)}
        pickerMode={{
          selectedId: selectedOrgNodeId,
          onPick: (node: OrgNode) => {
            setSelectedOrgNodeId(node.id);
            setShowOrgPicker(false);
          },
        }}
      />
    )}
    </>
  );
}
