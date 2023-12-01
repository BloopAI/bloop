import { createContext } from 'react';
import { ProjectShortType } from '../types/api';

export const ProjectContext = {
  Current: createContext<{
    project: ProjectShortType | null;
    setCurrentProjectId: (id: string) => void;
    refreshCurrentProject: () => void;
  }>({
    project: null,
    setCurrentProjectId: (id: string) => {},
    refreshCurrentProject: () => {},
  }),
  All: createContext<{
    projects: ProjectShortType[];
    refreshAllProjects: () => void;
  }>({
    projects: [],
    refreshAllProjects: () => {},
  }),
};
