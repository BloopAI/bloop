import { createContext } from 'react';
import { ProjectShortType } from '../types/api';

export const ProjectContext = {
  Current: createContext<{
    project: ProjectShortType | null;
    setCurrentProjectId: (id: string) => void;
  }>({
    project: null,
    setCurrentProjectId: (id: string) => {},
  }),
  All: createContext<{ projects: ProjectShortType[] }>({
    projects: [],
  }),
};
