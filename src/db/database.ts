import Dexie, { type Table } from 'dexie';
import type {
  ActiveSession,
  AttemptRecord,
  MistakeRecord,
  PhotoRecord,
  Profile,
  ReviewLogRecord,
  SessionRecord,
  StoredCard,
} from './schema';
import { DEFAULT_SETTINGS } from './schema';

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
  mistakes!: Table<MistakeRecord, string>;
  photos!: Table<PhotoRecord, string>;

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
    // v2: errori delle partite, foto della scacchiera e nuove preferenze.
    this.version(2)
      .stores({
        mistakes: 'id, createdAt, card.due',
        photos: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('profile')
          .toCollection()
          .modify((profile: Profile) => {
            profile.settings = { ...DEFAULT_SETTINGS, ...profile.settings };
          });
      });
  }
}

export const db = new ChessMemoryDB();
