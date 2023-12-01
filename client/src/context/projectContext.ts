import { createContext } from 'react';
import { ProjectFullType, ProjectShortType } from '../types/api';

export const ProjectContext = {
  Current: createContext<{
    project: ProjectFullType | null;
    setCurrentProjectId: (id: string) => void;
    refreshCurrentProject: () => void;
    refreshCurrentProjectRepos: () => void;
  }>({
    project: null,
    setCurrentProjectId: (id: string) => {},
    refreshCurrentProject: () => {},
    refreshCurrentProjectRepos: () => {},
  }),
  All: createContext<{
    projects: ProjectShortType[];
    refreshAllProjects: () => void;
  }>({
    projects: [],
    refreshAllProjects: () => {},
  }),
};
