import Dexie, { type EntityTable } from 'dexie';

interface UserPattern {
  id: number;
  itrans: string;
  unicode: string;
  frequency: number;
  lastUsed: number;
  isCustom: boolean;
}

const db = new Dexie('SanskirtKeyboardDB') as Dexie & {
  patterns: EntityTable<UserPattern, 'id'>;
};

db.version(1).stores({
  patterns: '++id, itrans, unicode, frequency, lastUsed, isCustom'
});

export { db };
export type { UserPattern };
