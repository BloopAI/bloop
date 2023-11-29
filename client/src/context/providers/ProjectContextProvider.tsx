import {
  memo,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ProjectContext } from '../projectContext';
import {
  getPlainFromStorage,
  PROJECT_KEY,
  savePlainToStorage,
} from '../../services/storage';
import { getAllProjects, getProject } from '../../services/api';
import { ProjectShortType } from '../../types/api';

type Props = {};

const ProjectContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const [currentProjectId, setCurrentProjectId] = useState(
    getPlainFromStorage(PROJECT_KEY) || '',
  );
  const [project, setProject] = useState<ProjectShortType | null>(null);
  const [projects, setProjects] = useState<ProjectShortType[]>([]);

  useEffect(() => {
    if (currentProjectId) {
      savePlainToStorage(PROJECT_KEY, currentProjectId);
      getProject(currentProjectId).then(setProject);
    }
  }, [currentProjectId]);

  const refreshAllProjects = useCallback(() => {
    getAllProjects().then(setProjects);
  }, []);

  useEffect(() => {
    refreshAllProjects();
  }, []);

  const currentValue = useMemo(
    () => ({
      project,
      setCurrentProjectId,
    }),
    [project],
  );

  const allValue = useMemo(
    () => ({
      projects,
      refreshAllProjects,
    }),
    [projects, refreshAllProjects],
  );

  return (
    <ProjectContext.Current.Provider value={currentValue}>
      <ProjectContext.All.Provider value={allValue}>
        {children}
      </ProjectContext.All.Provider>
    </ProjectContext.Current.Provider>
  );
};

export default memo(ProjectContextProvider);
