import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, ContentItem, Relationship, Dimension, System, SystemMember, OrgNode, OrgData, DimensionField } from '../types';
import { api, setCurrentSystemId } from '../api';

// ── Org path helper ───────────────────────────────────────────────────────────
function findOrgPath(nodes: OrgNode[], id: string, path: OrgNode[] = []): OrgNode[] | null {
  for (const n of nodes) {
    const cur = [...path, n];
    if (n.id === id) return cur;
    const found = findOrgPath(n.children, id, cur);
    if (found) return found;
  }
  return null;
}

interface AppData {
  dimensions: Dimension[];
  items: ContentItem[];
  relationships: Relationship[];
}

interface ModalAddRelationshipState {
  dimensionId: string;
}

interface AppContextValue {
  appData: AppData;
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  focusedItemId: string | null;
  setFocusedItemId: (id: string | null) => void;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  // Systems
  systems: System[];
  currentSystem: System | null;
  switchSystem: (system: System) => Promise<void>;
  addSystem: (name: string, description?: string) => Promise<System>;
  updateSystem: (id: string, updates: { name?: string; description?: string }) => Promise<void>;
  deleteSystem: (id: string) => Promise<void>;
  loadSystemMembers: (systemId: string) => Promise<SystemMember[]>;
  setSystemMemberRole: (systemId: string, userId: string, role: string) => Promise<void>;
  removeSystemMember: (systemId: string, userId: string) => Promise<void>;
  // Org data
  orgData: OrgData;
  getOrgNodePath: (nodeId: string) => OrgNode[];
  assignOrgNode: (itemId: string, nodeId: string | null) => Promise<void>;
  // Data
  addItem: (item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ContentItem>;
  updateItem: (id: string, updates: Partial<ContentItem>) => Promise<void>;
  addRelationship: (item1Id: string, item2Id: string) => Promise<void>;
  removeRelationship: (id: string) => Promise<void>;
  updateDimension: (id: string, updates: Partial<Dimension>) => Promise<void>;
  addDimension: (dim: Omit<Dimension, 'id'>) => Promise<void>;
  addUser: (user: { username: string; password: string; role: string }) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: { username?: string; password?: string; role?: string }) => Promise<void>;
  loadUsers: () => Promise<User[]>;
  getRelatedItems: (itemId: string) => Map<string, ContentItem[]>;
  siteTitle: string;
  // Dimension fields
  getDimensionFields: (dimensionId: string) => Promise<DimensionField[]>;
  createDimensionField: (f: { dimensionId: string; fieldName: string; fieldType: string; sortOrder?: number }) => Promise<DimensionField>;
  updateDimensionField: (id: string, updates: { fieldName?: string; fieldType?: string; sortOrder?: number }) => Promise<DimensionField>;
  deleteDimensionField: (id: string, dimensionId: string) => Promise<void>;
  getItemFieldValues: (itemId: string) => Promise<Record<string, string>>;
  saveItemFieldValues: (itemId: string, values: Record<string, string>) => Promise<void>;
  // Modal state
  modalSearch: boolean;
  setModalSearch: (v: boolean) => void;
  modalContentDetail: boolean;
  setModalContentDetail: (v: boolean) => void;
  modalAddContent: boolean;
  setModalAddContent: (v: boolean) => void;
  modalAddRelationship: ModalAddRelationshipState | null;
  setModalAddRelationship: (v: ModalAddRelationshipState | null) => void;
  adminPanel: boolean;
  setAdminPanel: (v: boolean) => void;
  modalChat: boolean;
  setModalChat: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

async function fetchSystemData(): Promise<{ appData: AppData; orgData: OrgData }> {
  const [dimensions, items, relationships, orgData] = await Promise.all([
    api.getDimensions(),
    api.getItems(),
    api.getRelationships(),
    api.getOrg(),
  ]);
  return {
    appData: {
      dimensions: dimensions as Dimension[],
      items: items as ContentItem[],
      relationships: relationships as Relationship[],
    },
    orgData: orgData as OrgData,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [appData, setAppData] = useState<AppData>({ dimensions: [], items: [], relationships: [] });
  const [orgData, setOrgData] = useState<OrgData>({ labels: [], tree: [] });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>('chg-459');
  const [systems, setSystems] = useState<System[]>([]);
  const [currentSystem, setCurrentSystem] = useState<System | null>(null);
  const [dimFieldsCache, setDimFieldsCache] = useState<Map<string, DimensionField[]>>(new Map());

  // Modal state
  const [modalSearch, setModalSearch] = useState(false);
  const [modalContentDetail, setModalContentDetail] = useState(false);
  const [modalAddContent, setModalAddContent] = useState(false);
  const [modalAddRelationship, setModalAddRelationship] = useState<ModalAddRelationshipState | null>(null);
  const [adminPanel, setAdminPanel] = useState(false);
  const [modalChat, setModalChat] = useState(false);

  const siteTitle = currentSystem?.name ?? 'CMDB360';

  const loadSystems = useCallback(async (): Promise<System[]> => {
    const result = await api.getSystems() as System[];
    setSystems(result);
    return result;
  }, []);

  const initAfterLogin = useCallback(async () => {
    const sysList = await loadSystems();
    if (sysList.length > 0) {
      const sys = sysList[0];
      setCurrentSystem(sys);
      setCurrentSystemId(sys.id);
      const { appData: data, orgData: org } = await fetchSystemData();
      setAppData(data);
      setOrgData(org);
    }
  }, [loadSystems]);

  useEffect(() => {
    const token = localStorage.getItem('cmdb360_token');
    const storedUser = localStorage.getItem('cmdb360_user');
    const storedSystemId = localStorage.getItem('cmdb360_system');

    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        setCurrentUser(user);
        loadSystems().then(sysList => {
          if (sysList.length === 0) { setLoading(false); return; }
          const sys = sysList.find(s => s.id === storedSystemId) ?? sysList[0];
          setCurrentSystem(sys);
          setCurrentSystemId(sys.id);
          return fetchSystemData();
        }).then(result => {
          if (result) { setAppData(result.appData); setOrgData(result.orgData); }
          setLoading(false);
        }).catch(() => {
          localStorage.removeItem('cmdb360_token');
          localStorage.removeItem('cmdb360_user');
          setCurrentUser(null);
          setLoading(false);
        });
      } catch {
        localStorage.removeItem('cmdb360_token');
        localStorage.removeItem('cmdb360_user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [loadSystems]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await api.login(username, password) as { token: string; user: User };
      localStorage.setItem('cmdb360_token', result.token);
      localStorage.setItem('cmdb360_user', JSON.stringify(result.user));
      setCurrentUser(result.user);
      await initAfterLogin();
      return true;
    } catch {
      return false;
    }
  }, [initAfterLogin]);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    localStorage.removeItem('cmdb360_token');
    localStorage.removeItem('cmdb360_user');
    localStorage.removeItem('cmdb360_system');
    setCurrentSystemId(null);
    setCurrentUser(null);
    setCurrentSystem(null);
    setSystems([]);
    setAppData({ dimensions: [], items: [], relationships: [] });
  }, []);

  const switchSystem = useCallback(async (system: System): Promise<void> => {
    setCurrentSystem(system);
    setCurrentSystemId(system.id);
    localStorage.setItem('cmdb360_system', system.id);
    setFocusedItemId(null);
    const { appData: data, orgData: org } = await fetchSystemData();
    setAppData(data);
    setOrgData(org);
  }, []);

  const addSystem = useCallback(async (name: string, description?: string): Promise<System> => {
    const sys = await api.createSystem({ name, description }) as System;
    setSystems(prev => [...prev, sys]);
    return sys;
  }, []);

  const updateSystem = useCallback(async (id: string, updates: { name?: string; description?: string }): Promise<void> => {
    const updated = await api.updateSystem(id, updates) as System;
    setSystems(prev => prev.map(s => s.id === id ? updated : s));
    if (currentSystem?.id === id) setCurrentSystem(updated);
  }, [currentSystem]);

  const deleteSystem = useCallback(async (id: string): Promise<void> => {
    await api.deleteSystem(id);
    setSystems(prev => prev.filter(s => s.id !== id));
  }, []);

  const loadSystemMembers = useCallback(async (systemId: string): Promise<SystemMember[]> => {
    return api.getSystemMembers(systemId) as Promise<SystemMember[]>;
  }, []);

  const setSystemMemberRole = useCallback(async (systemId: string, userId: string, role: string): Promise<void> => {
    await api.setSystemMemberRole(systemId, userId, role);
  }, []);

  const removeSystemMember = useCallback(async (systemId: string, userId: string): Promise<void> => {
    await api.removeSystemMember(systemId, userId);
  }, []);

  const getOrgNodePath = useCallback((nodeId: string): OrgNode[] => {
    return findOrgPath(orgData.tree, nodeId) ?? [];
  }, [orgData.tree]);

  const assignOrgNode = useCallback(async (itemId: string, nodeId: string | null): Promise<void> => {
    const updated = await api.updateItem(itemId, { org_node_id: nodeId } as Partial<ContentItem>) as ContentItem;
    setAppData(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? updated : i) }));
  }, []);

  const addItem = useCallback(async (item: Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentItem> => {
    const newItem = await api.createItem(item) as ContentItem;
    setAppData(prev => ({ ...prev, items: [...prev.items, newItem] }));
    return newItem;
  }, []);

  const updateItem = useCallback(async (id: string, updates: Partial<ContentItem>): Promise<void> => {
    const updated = await api.updateItem(id, updates) as ContentItem;
    setAppData(prev => ({ ...prev, items: prev.items.map(i => i.id === id ? updated : i) }));
  }, []);

  const addRelationship = useCallback(async (item1Id: string, item2Id: string): Promise<void> => {
    try {
      const newRel = await api.createRelationship({ item1Id, item2Id }) as Relationship;
      setAppData(prev => ({ ...prev, relationships: [...prev.relationships, newRel] }));
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('409') || err.message.includes('already exists'))) return;
      throw err;
    }
  }, []);

  const removeRelationship = useCallback(async (id: string): Promise<void> => {
    await api.deleteRelationship(id);
    setAppData(prev => ({ ...prev, relationships: prev.relationships.filter(r => r.id !== id) }));
  }, []);

  const updateDimension = useCallback(async (id: string, updates: Partial<Dimension>): Promise<void> => {
    const updated = await api.updateDimension(id, updates) as Dimension;
    setAppData(prev => {
      if (updates.visible === false && focusedItemId) {
        const focusedItem = prev.items.find(i => i.id === focusedItemId);
        if (focusedItem?.dimensionId === id) setFocusedItemId(null);
      }
      return { ...prev, dimensions: prev.dimensions.map(d => d.id === id ? updated : d) };
    });
  }, [focusedItemId]);

  const addDimension = useCallback(async (dim: Omit<Dimension, 'id'>): Promise<void> => {
    const newDim = await api.createDimension(dim) as Dimension;
    setAppData(prev => ({ ...prev, dimensions: [...prev.dimensions, newDim] }));
  }, []);

  const addUser = useCallback(async (user: { username: string; password: string; role: string }): Promise<void> => {
    await api.createUser(user);
  }, []);

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    await api.deleteUser(id);
  }, []);

  const updateUser = useCallback(async (id: string, updates: { username?: string; password?: string; role?: string }): Promise<void> => {
    await api.updateUser(id, updates);
  }, []);

  const loadUsers = useCallback(async (): Promise<User[]> => {
    return api.getUsers() as Promise<User[]>;
  }, []);

  const getDimensionFields = useCallback(async (dimensionId: string): Promise<DimensionField[]> => {
    const cached = dimFieldsCache.get(dimensionId);
    if (cached) return cached;
    const fields = await api.getDimensionFields(dimensionId) as DimensionField[];
    setDimFieldsCache(prev => new Map(prev).set(dimensionId, fields));
    return fields;
  }, [dimFieldsCache]);

  const createDimensionField = useCallback(async (f: { dimensionId: string; fieldName: string; fieldType: string; sortOrder?: number }): Promise<DimensionField> => {
    const field = await api.createDimensionField(f) as DimensionField;
    setDimFieldsCache(prev => {
      const next = new Map(prev);
      const existing = next.get(f.dimensionId) ?? [];
      next.set(f.dimensionId, [...existing, field].sort((a, b) => a.sortOrder - b.sortOrder));
      return next;
    });
    return field;
  }, []);

  const updateDimensionField = useCallback(async (id: string, updates: { fieldName?: string; fieldType?: string; sortOrder?: number }): Promise<DimensionField> => {
    const field = await api.updateDimensionField(id, updates) as DimensionField;
    setDimFieldsCache(prev => {
      const next = new Map(prev);
      const existing = next.get(field.dimensionId);
      if (existing) {
        next.set(field.dimensionId, existing.map(f => f.id === id ? field : f).sort((a, b) => a.sortOrder - b.sortOrder));
      }
      return next;
    });
    return field;
  }, []);

  const deleteDimensionField = useCallback(async (id: string, dimensionId: string): Promise<void> => {
    await api.deleteDimensionField(id);
    setDimFieldsCache(prev => {
      const next = new Map(prev);
      const existing = next.get(dimensionId);
      if (existing) next.set(dimensionId, existing.filter(f => f.id !== id));
      return next;
    });
  }, []);

  const getItemFieldValues = useCallback(async (itemId: string): Promise<Record<string, string>> => {
    return api.getItemFieldValues(itemId) as Promise<Record<string, string>>;
  }, []);

  const saveItemFieldValues = useCallback(async (itemId: string, values: Record<string, string>): Promise<void> => {
    await api.saveItemFieldValues(itemId, values);
  }, []);

  const getRelatedItems = useCallback((itemId: string): Map<string, ContentItem[]> => {
    const result = new Map<string, ContentItem[]>();
    const rels = appData.relationships.filter(r => r.item1Id === itemId || r.item2Id === itemId);
    for (const rel of rels) {
      const otherId = rel.item1Id === itemId ? rel.item2Id : rel.item1Id;
      const other = appData.items.find(i => i.id === otherId);
      if (!other) continue;
      const existing = result.get(other.dimensionId) ?? [];
      result.set(other.dimensionId, [...existing, other]);
    }
    return result;
  }, [appData.relationships, appData.items]);

  const value: AppContextValue = {
    appData, currentUser, loading, error, focusedItemId, setFocusedItemId,
    login, logout,
    systems, currentSystem, switchSystem, addSystem, updateSystem, deleteSystem,
    loadSystemMembers, setSystemMemberRole, removeSystemMember,
    orgData, getOrgNodePath, assignOrgNode,
    addItem, updateItem, addRelationship, removeRelationship,
    updateDimension, addDimension,
    addUser, deleteUser, updateUser, loadUsers,
    getRelatedItems,
    siteTitle,
    getDimensionFields, createDimensionField, updateDimensionField, deleteDimensionField,
    getItemFieldValues, saveItemFieldValues,
    modalSearch, setModalSearch,
    modalContentDetail, setModalContentDetail,
    modalAddContent, setModalAddContent,
    modalAddRelationship, setModalAddRelationship,
    adminPanel, setAdminPanel,
    modalChat, setModalChat,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
