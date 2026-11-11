import Dexie, { type Table } from 'dexie';
import type {
  ActiveSession,
  AttemptRecord,
  Profile,
  ReviewLogRecord,
  SessionRecord,
  StoredCard,
} from './schema';

export const DB_NAME = 'chessmemory-ai';

/**
 * Database locale (IndexedDB tramite Dexie).
 * Gli esercizi non sono salvati qui: fanno parte del bundle dell'app.
 */
export class ChessMemoryDB extends Dexie {
  profile!: Table<Profile, string>;
  cards!: Table<StoredCard, string>;
  attempts!: Table<AttemptRecord, number>;
  reviewLogs!: Table<ReviewLogRecord, number>;
  sessions!: Table<SessionRecord, string>;
  activeSession!: Table<ActiveSession, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      cards: 'conceptId, due, state',
      attempts: '++id, conceptId, exerciseId, sessionId, answeredAt, activity',
      reviewLogs: '++id, conceptId, reviewedAt',
      sessions: 'id, finishedAt',
      activeSession: 'id',
    });
  }
}

export const db = new ChessMemoryDB();
