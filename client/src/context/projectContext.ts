import { createContext, Dispatch, SetStateAction } from 'react';
import { ProjectFullType, ProjectShortType } from '../types/api';

export const ProjectContext = {
  Current: createContext<{
    project: ProjectFullType | null;
    isReposLoaded: boolean;
    isLoading: boolean;
    setCurrentProjectId: (id: string) => void;
    refreshCurrentProject: () => void;
    refreshCurrentProjectRepos: () => void;
    refreshCurrentProjectConversations: () => void;
    refreshCurrentProjectStudios: () => void;
    refreshCurrentProjectDocs: () => void;
  }>({
    project: null,
    isReposLoaded: false,
    isLoading: true,
    setCurrentProjectId: (id: string) => {},
    refreshCurrentProject: () => {},
    refreshCurrentProjectRepos: () => {},
    refreshCurrentProjectConversations: () => {},
    refreshCurrentProjectStudios: () => {},
    refreshCurrentProjectDocs: () => {},
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
