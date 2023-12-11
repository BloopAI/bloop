import { createContext, Dispatch, SetStateAction } from 'react';
import { ProjectFullType, ProjectShortType } from '../types/api';

export const ProjectContext = {
  Current: createContext<{
    project: ProjectFullType | null;
    isReposLoaded: boolean;
    setCurrentProjectId: (id: string) => void;
    refreshCurrentProject: () => void;
    refreshCurrentProjectRepos: () => void;
  }>({
    project: null,
    isReposLoaded: false,
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
  RegexSearch: createContext<{
    isRegexSearchEnabled: boolean;
    setIsRegexSearchEnabled: Dispatch<SetStateAction<boolean>>;
  }>({
    isRegexSearchEnabled: false,
    setIsRegexSearchEnabled: () => {},
  }),
  AnswerSpeed: createContext({
    preferredAnswerSpeed: 'normal' as 'normal' | 'fast',
    setPreferredAnswerSpeed: (s: 'normal' | 'fast') => {},
  }),
};
