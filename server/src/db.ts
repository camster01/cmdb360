import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cmdb360',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(20) PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin','contributor','viewer')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS systems (
      id VARCHAR(20) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description VARCHAR(500),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_system_roles (
      user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE,
      system_id VARCHAR(20) REFERENCES systems(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('contributor','viewer')),
      PRIMARY KEY (user_id, system_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dimensions (
      id VARCHAR(20) PRIMARY KEY,
      system_id VARCHAR(20) REFERENCES systems(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      subtitle VARCHAR(200),
      slot INTEGER NOT NULL,
      visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS subtitle VARCHAR(200)`);
  await pool.query(`ALTER TABLE dimensions ADD COLUMN IF NOT EXISTS system_id VARCHAR(20) REFERENCES systems(id) ON DELETE CASCADE`);

  // Unlimited-depth org hierarchy using self-referencing tree
  await pool.query(`
    CREATE TABLE IF NOT EXISTS org_nodes (
      id VARCHAR(20) PRIMARY KEY,
      system_id VARCHAR(20) REFERENCES systems(id) ON DELETE CASCADE,
      parent_id VARCHAR(20) REFERENCES org_nodes(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Per-node children label override
  await pool.query(`ALTER TABLE org_nodes ADD COLUMN IF NOT EXISTS children_label VARCHAR(200)`);

  // Org assignment on content items
  await pool.query(`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS org_node_id VARCHAR(20) REFERENCES org_nodes(id) ON DELETE SET NULL`);

  // Purchase / order number for stock tracking
  await pool.query(`ALTER TABLE content_items ADD COLUMN IF NOT EXISTS order_number VARCHAR(200)`);

  // Per-system level labels stored as a JSON array
  await pool.query(`
    CREATE TABLE IF NOT EXISTS org_config (
      system_id VARCHAR(20) PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
      level_labels JSONB DEFAULT '["Site","Building","Area"]'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_items (
      id VARCHAR(20) PRIMARY KEY,
      dimension_id VARCHAR(20) REFERENCES dimensions(id) ON DELETE CASCADE,
      code VARCHAR(100) NOT NULL,
      description TEXT,
      details TEXT,
      urls JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS relationships (
      id VARCHAR(20) PRIMARY KEY,
      item1_id VARCHAR(20) REFERENCES content_items(id) ON DELETE CASCADE,
      item2_id VARCHAR(20) REFERENCES content_items(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unique_pair UNIQUE (item1_id, item2_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Migration: create default system from existing site_title
  await pool.query(`
    INSERT INTO systems (id, name, description)
    SELECT 'sys-default',
      COALESCE((SELECT value FROM app_settings WHERE key = 'site_title'), 'Default System'),
      'Default system'
    WHERE NOT EXISTS (SELECT 1 FROM systems WHERE id = 'sys-default')
  `);

  // Assign orphaned dimensions to default system
  await pool.query(`UPDATE dimensions SET system_id = 'sys-default' WHERE system_id IS NULL`);

  // Add existing non-admin users to default system
  await pool.query(`
    INSERT INTO user_system_roles (user_id, system_id, role)
    SELECT id, 'sys-default', role FROM users WHERE role != 'admin'
    ON CONFLICT DO NOTHING
  `);

  const userCount = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(userCount.rows[0].count) === 0) {
    await seedData();
  }

  console.log('Database initialized');
}

async function seedData(): Promise<void> {
  const adminHash = await bcrypt.hash('admin123', 10);
  const contribHash = await bcrypt.hash('contrib123', 10);
  const viewerHash = await bcrypt.hash('view123', 10);

  await pool.query(`
    INSERT INTO users (id, username, password_hash, role) VALUES
      ('user-admin',    'admin',       $1, 'admin'),
      ('user-contrib',  'contributor', $2, 'contributor'),
      ('user-viewer',   'viewer',      $3, 'viewer')
    ON CONFLICT DO NOTHING
  `, [adminHash, contribHash, viewerHash]);

  await pool.query(`
    INSERT INTO systems (id, name, description) VALUES
      ('sys-default', 'D365 ERP Knowledgebase', 'Default ERP knowledge system')
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO user_system_roles (user_id, system_id, role) VALUES
      ('user-contrib', 'sys-default', 'contributor'),
      ('user-viewer',  'sys-default', 'viewer')
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO dimensions (id, system_id, name, subtitle, slot) VALUES
      ('dim-bp',  'sys-default', 'Business Processes',  NULL,               0),
      ('dim-up',  'sys-default', 'Unit Processes',       'system component', 1),
      ('dim-req', 'sys-default', 'Requirements',         NULL,               2),
      ('dim-tm',  'sys-default', 'Training Materials',   NULL,               3),
      ('dim-sc',  'sys-default', 'System Changes',       NULL,               4),
      ('dim-to',  'sys-default', 'Tests: Other',         'UAT, etc',         5),
      ('dim-oq',  'sys-default', 'Tests: OQ Validation', NULL,               6),
      ('dim-sp',  'sys-default', 'Security Profiles',    NULL,               7),
      ('dim-de',  'sys-default', 'Data Elements',        NULL,               8)
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO content_items (id, dimension_id, code, description, details, urls, created_at, updated_at) VALUES
      ('chg-459',   'dim-sc', 'CHG 459',     'Customer PO must be updated real time on customer statements.',
        'This change request addresses the need for real-time synchronization of customer purchase orders with customer statements.',
        '[{"label":"Change Request Doc","url":"https://example.com/chg-459"}]',
        '2024-01-15T10:00:00Z','2024-03-20T14:30:00Z'),
      ('chg-inct',  'dim-sc', 'INCT0864274', 'Prod Order issue with exp dt fix',
        'Production order expiration date was not being calculated correctly.',
        '[]','2024-02-01T09:00:00Z','2024-02-15T11:00:00Z'),
      ('bp-wh5',    'dim-bp', 'WH5',          'Pick, Pack and Ship Finished Goods',
        'End-to-end process for picking finished goods from warehouse, packing for shipment, and shipping to customers.',
        '[]','2024-01-10T08:00:00Z','2024-01-10T08:00:00Z'),
      ('bp-wh7',    'dim-bp', 'WH7',          'Shipment of semifinished goods',
        'Process for shipping semifinished goods between production facilities.',
        '[]','2024-01-10T08:00:00Z','2024-01-10T08:00:00Z'),
      ('up-001',    'dim-up', 'UP-839-001',   'Invoice approval workflow',
        'Defines the workflow steps for approving invoices in the system.',
        '[]','2024-01-12T10:00:00Z','2024-01-12T10:00:00Z'),
      ('up-002',    'dim-up', 'UP-839-002',   'Invoice approval page',
        'The UI page where approvers review and approve/reject invoices.',
        '[]','2024-01-12T10:00:00Z','2024-01-12T10:00:00Z'),
      ('up-003',    'dim-up', 'UP-839-003',   'JPM Bank Interface Set Up',
        'Configuration and setup for the JPMorgan Chase bank interface integration.',
        '[]','2024-01-12T10:00:00Z','2024-01-12T10:00:00Z'),
      ('up-008',    'dim-up', 'UP-839-008',   'Billing Invoice',
        'Unit process for generating and managing billing invoices.',
        '[]','2024-01-12T10:00:00Z','2024-01-12T10:00:00Z'),
      ('req-cas75', 'dim-req','CAS-URS-75',   'Release To Warehouse and Re-Schedule',
        'Requirement for the system to allow releasing orders to warehouse and rescheduling production orders.',
        '[]','2024-01-08T09:00:00Z','2024-01-08T09:00:00Z'),
      ('tm-d365',   'dim-tm', 'D365_TM_01',   'How to login to D365',
        'Step-by-step training guide for logging into Microsoft Dynamics 365.',
        '[{"label":"Training Video","url":"https://example.com/training/d365-login"}]',
        '2024-01-20T10:00:00Z','2024-01-20T10:00:00Z'),
      ('to-uat1',   'dim-to', 'UAT_1',         'E2E1',
        'End-to-end user acceptance test scenario 1.',
        '[]','2024-02-05T10:00:00Z','2024-02-05T10:00:00Z'),
      ('oq-0144',   'dim-oq', 'OQ_0144',       'OQ script test',
        'Operational qualification test script for validating system functionality.',
        '[]','2024-02-10T10:00:00Z','2024-02-10T10:00:00Z'),
      ('sp-kin026', 'dim-sp', 'KIN026',        'Production supervisor',
        'Security profile defining permissions for the production supervisor role.',
        '[]','2024-01-05T10:00:00Z','2024-01-05T10:00:00Z'),
      ('de-dt004',  'dim-de', 'DT_004',        'Product Order Number',
        'Data element definition for the product order number field used across the system.',
        '[]','2024-01-05T10:00:00Z','2024-01-05T10:00:00Z')
    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO relationships (id, item1_id, item2_id) VALUES
      ('rel-001','chg-459','bp-wh5'),
      ('rel-002','chg-459','bp-wh7'),
      ('rel-003','chg-459','up-001'),
      ('rel-004','chg-459','up-002'),
      ('rel-005','chg-459','up-003'),
      ('rel-006','chg-459','up-008'),
      ('rel-007','chg-459','req-cas75'),
      ('rel-008','chg-459','tm-d365'),
      ('rel-009','chg-459','to-uat1'),
      ('rel-010','chg-459','oq-0144'),
      ('rel-011','chg-459','sp-kin026'),
      ('rel-012','chg-459','de-dt004'),
      ('rel-013','chg-459','chg-inct')
    ON CONFLICT DO NOTHING
  `);

  console.log('Database seeded');
}
