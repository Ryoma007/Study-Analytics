import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  content: string;
}

interface StudyState {
  sessions: StudySession[];
  addSession: (session: Omit<StudySession, 'id'>) => void;
  deleteSessions: (ids: string[]) => void;
}

// Custom storage engine using IndexedDB
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // Migration from localStorage
    const legacyData = localStorage.getItem('study_sessions');
    if (legacyData) {
      try {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed)) {
          // Wrap it in zustand's persist format
          const zustandState = JSON.stringify({
            state: { sessions: parsed },
            version: 0
          });
          await set(name, zustandState);
          localStorage.removeItem('study_sessions');
          return zustandState;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useStudyStore = create<StudyState>()(
  persist(
    (set) => ({
      sessions: [],
      addSession: (session) => {
        const id = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Date.now().toString(36) + Math.random().toString(36).substring(2);
        const newSession = { ...session, id };
        set((state) => ({ sessions: [newSession, ...state.sessions] }));
      },
      deleteSessions: (ids) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => !ids.includes(s.id)),
        }));
      },
    }),
    {
      name: 'study_sessions_storage',
      storage: createJSONStorage(() => idbStorage),
    }
  )
);
