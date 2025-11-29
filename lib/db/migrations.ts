/**
 * IndexedDB Migrations
 * 
 * Handles database version upgrades and migrations
 * Use this when changing the database schema
 */

import { logger } from '@/lib/utils/logger';

export interface Migration {
  version: number;
  name: string;
  migrate: (db: IDBDatabase, transaction: IDBTransaction) => void;
}

/**
 * List of all migrations in order
 * Each migration should only run once per version
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'Initial schema',
    migrate: () => {
      // This is handled in indexeddb.ts initDB()
      logger.log('Migration v1: Initial schema created');
    },
  },
  
  // Example future migration:
  // {
  //   version: 2,
  //   name: 'Add indexes to models store',
  //   migrate: (db, transaction) => {
  //     const modelsStore = transaction.objectStore('models');
  //     if (!modelsStore.indexNames.contains('provider')) {
  //       modelsStore.createIndex('provider', 'provider', { unique: false });
  //       logger.log('Migration v2: Added provider index to models');
  //     }
  //   },
  // },
];

/**
 * Get the latest database version
 */
export function getLatestVersion(): number {
  return Math.max(...migrations.map(m => m.version), 1);
}

/**
 * Run migrations for a specific version upgrade
 */
export function runMigrations(
  db: IDBDatabase,
  oldVersion: number,
  newVersion: number,
  transaction: IDBTransaction
): void {
  logger.log(`Running migrations from v${oldVersion} to v${newVersion}`);

  const migrationsToRun = migrations.filter(
    m => m.version > oldVersion && m.version <= newVersion
  );

  for (const migration of migrationsToRun) {
    logger.log(`Running migration v${migration.version}: ${migration.name}`);
    try {
      migration.migrate(db, transaction);
    } catch (error) {
      logger.error(`Migration v${migration.version} failed:`, error);
      throw error;
    }
  }

  logger.log('All migrations completed successfully');
}

/**
 * Check if database needs migration
 */
export async function needsMigration(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const request = indexedDB.open('haumea-db');

    request.onsuccess = () => {
      const db = request.result;
      const currentVersion = db.version;
      const latestVersion = getLatestVersion();
      db.close();
      
      resolve(currentVersion < latestVersion);
    };

    request.onerror = () => {
      logger.error('Error checking migration status');
      resolve(false);
    };
  });
}

/**
 * Clear all data and reset database (use with caution!)
 */
export async function resetDatabase(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('haumea-db');

    request.onsuccess = () => {
      logger.log('Database reset successfully');
      resolve();
    };

    request.onerror = () => {
      logger.error('Error resetting database');
      reject(new Error('Failed to reset database'));
    };

    request.onblocked = () => {
      logger.warn('Database reset blocked - close all tabs and try again');
      reject(new Error('Database reset blocked'));
    };
  });
}
