
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface InventoryDB extends DBSchema {
  items: {
    key: string;
    value: {
      id: string;
      nameAr: string;
      quantity: number;
      minQuantity: number;
      category: string;
      unit?: string;
      capacity?: number;
      capacityUnit?: string;
      lastUpdated: Date;
    };
    indexes: { 'by-category': string };
  };
  transactions: {
    key: string;
    value: {
      id: string;
      date: Date;
      department: string;
      items: Array<{
        itemId: string;
        quantity: number;
        unit?: string;
        capacity?: number;
        capacityUnit?: string;
        notes?: string;
      }>;
      type: 'in' | 'out';
    };
    indexes: { 'by-date': Date; 'by-department': string };
  };
  users: {
    key: string;
    value: {
      id: string;
      username: string;
      password: string;
      role: 'admin' | 'user';
      lastLogin: Date;
    };
  };
}

let db: IDBPDatabase<InventoryDB>;

export const departments = [
  "الصالة",
  "الأرز والمشكلات",
  "الشاورما",
  "المقبلات",
  "القلابة",
  "الكنافة",
  "المشاوي",
  "البرست",
  "الفاهيتا + البرجر",
  "البيتزا",
  "الشيبس"
] as const;

export const units = [
  "كيلو",
  "جرام",
  "كرتون",
  "علبة",
  "دبة",
  "قارورة",
  "شدة",
  "باكت",
  "حبة",
  "جالون",
  "درزن",
  "كيس",
  "قالب",
  "طبق"
] as const;

export const capacityUnits = [
  "مل",
  "حبة",
  "جرام",
  "كيلو",
  "علبة",
  "قارورة",
  "قالب",
  "كيس",
  "درزن",
  "شدة"
] as const;

export async function initDB() {
  db = await openDB<InventoryDB>('inventory-db', 1, {
    upgrade(db) {
      // Items store
      const itemStore = db.createObjectStore('items', { keyPath: 'id' });
      itemStore.createIndex('by-category', 'category');

      // Transactions store
      const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionStore.createIndex('by-date', 'date');
      transactionStore.createIndex('by-department', 'department');

      // Users store
      db.createObjectStore('users', { keyPath: 'id' });

      // Add default admin user
      const defaultAdmin = {
        id: crypto.randomUUID(),
        username: 'admin',
        password: 'admin123', // In a real app, this should be hashed
        role: 'admin' as const,
        lastLogin: new Date()
      };
      
      db.add('users', defaultAdmin);
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
