export type UserRole = 'admin' | 'contributor' | 'viewer';

export interface System {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface SystemMember {
  id: string;
  username: string;
  globalRole: string;
  systemRole: string | null;
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export interface Dimension {
  id: string;
  name: string;
  subtitle?: string;
  slot: number; // 0-3=left col top-to-bottom, 4=top-center, 5-8=right col top-to-bottom
  visible: boolean;
}

export interface ContentItem {
  id: string;
  dimensionId: string;
  code: string;
  description: string;
  details?: string;
  urls?: Array<{ label: string; url: string }>;
  org_node_id?: string | null;
  order_number?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  item1Id: string;
  item2Id: string;
}

export interface AppData {
  dimensions: Dimension[];
  items: ContentItem[];
  relationships: Relationship[];
}

// ── Org hierarchy (unlimited depth) ──────────────────────────────────────────

export interface OrgNode {
  id: string;
  parent_id: string | null;
  name: string;
  description?: string | null;
  children_label?: string | null;  // overrides global level label for this node's children
  sort_order: number;
  children: OrgNode[];
}

export interface OrgData {
  labels: string[];   // labels[0] = top-level name, labels[1] = first child level, etc.
  tree: OrgNode[];
}
