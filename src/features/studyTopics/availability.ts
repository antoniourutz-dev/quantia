import { useSyncExternalStore } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { curriculumKeyCandidates } from './studyTopicsApi';

/** Whether the active curriculum has a study syllabus (shared by the shell and the study sub-nav). */
let available = false;
const listeners = new Set<() => void>();

export const setStudyTopicsAvailable = (value: boolean) => {
  if (value === available) return;
  available = value;
  listeners.forEach((listener) => listener());
};

export const useStudyTopicsAvailable = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => available,
    () => false,
  );

export const fetchStudyTopicsAvailable = async (curriculum: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from('study_topics')
    .select('id', { count: 'exact', head: true })
    .in('curriculum_key', curriculumKeyCandidates(curriculum));
  if (error) return false;
  return (count ?? 0) > 0;
};
