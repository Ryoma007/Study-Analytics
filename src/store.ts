import { useState, useEffect } from 'react';

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  content: string;
}

export function useStudyStore() {
  const [sessions, setSessions] = useState<StudySession[]>(() => {
    const saved = localStorage.getItem('study_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('study_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const addSession = (session: Omit<StudySession, 'id'>) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
    const newSession = { ...session, id };
    setSessions((prev) => [newSession, ...prev]);
  };

  const deleteSessions = (ids: string[]) => {
    setSessions((prev) => prev.filter((s) => !ids.includes(s.id)));
  };

  return { sessions, addSession, deleteSessions };
}
