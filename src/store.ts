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
    const newSession = { ...session, id: crypto.randomUUID() };
    setSessions((prev) => [newSession, ...prev]);
  };

  const deleteSessions = (ids: string[]) => {
    setSessions((prev) => prev.filter((s) => !ids.includes(s.id)));
  };

  return { sessions, addSession, deleteSessions };
}
