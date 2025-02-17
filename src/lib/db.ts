
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface InventoryDB extends DBSchema {
  items: {
    key: string;
    value: {
      id: string;
      name: string;
      nameAr: string;
      quantity: number;
      minQuantity: number;
      category: string;
      lastUpdated: Date;
    };
    indexes: { 'by-category': string };
  };
  transactions: {
    key: string;
    value: {
      id: string;
      itemId: string;
      quantity: number;
      type: 'in' | 'out';
      department: string;
      date: Date;
      notes?: string;
    };
    indexes: { 'by-date': Date };
  };
}

let db: IDBPDatabase<InventoryDB>;

export async function initDB() {
  db = await openDB<InventoryDB>('inventory-db', 1, {
    upgrade(db) {
      const itemStore = db.createObjectStore('items', { keyPath: 'id' });
      itemStore.createIndex('by-category', 'category');

      const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionStore.createIndex('by-date', 'date');
    },
  });
  return db;
}

export async function getDB() {
  if (!db) {
    db = await initDB();
  }
  return db;
}
