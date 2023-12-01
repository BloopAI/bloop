import {
  memo,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectContext } from '../projectContext';
import {
  getPlainFromStorage,
  PROJECT_KEY,
  savePlainToStorage,
} from '../../services/storage';
import { createProject, getAllProjects, getProject } from '../../services/api';
import { ProjectShortType } from '../../types/api';

type Props = {};

const ProjectContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const { t } = useTranslation();
  const [currentProjectId, setCurrentProjectId] = useState(
    getPlainFromStorage(PROJECT_KEY) || '',
  );
  const [project, setProject] = useState<ProjectShortType | null>(null);
  const [projects, setProjects] = useState<ProjectShortType[]>([]);

  const refreshCurrentProject = useCallback(() => {
    if (currentProjectId) {
      getProject(currentProjectId)
        .then(setProject)
        .catch((err) => {
          console.log(err);
          setCurrentProjectId('');
        });
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectId) {
      savePlainToStorage(PROJECT_KEY, currentProjectId);
      refreshCurrentProject();
    }
  }, [currentProjectId, refreshCurrentProject]);

  const refreshAllProjects = useCallback(() => {
    getAllProjects().then((p) => {
      setProjects(p);
      if (!p.length) {
        createProject(t('Default project')).then((newId) => {
          setCurrentProjectId(newId);
          getAllProjects().then((p) => {
            setProjects(p);
          });
        });
      }
    });
  }, []);

  useEffect(() => {
    refreshAllProjects();
  }, []);

  const currentValue = useMemo(
    () => ({
      project,
      setCurrentProjectId,
      refreshCurrentProject,
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
