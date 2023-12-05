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
import {
  createProject,
  getAllProjects,
  getProject,
  getProjectConversations,
  getProjectRepos,
} from '../../services/api';
import { ProjectFullType, ProjectShortType } from '../../types/api';

type Props = {};

const ProjectContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const { t } = useTranslation();
  const [currentProjectId, setCurrentProjectId] = useState(
    getPlainFromStorage(PROJECT_KEY) || '',
  );
  const [project, setProject] = useState<ProjectFullType | null>(null);
  const [projects, setProjects] = useState<ProjectShortType[]>([]);

  const refreshCurrentProjectRepos = useCallback(async () => {
    getProjectRepos(currentProjectId).then((r) => {
      setProject((prev) => (prev ? { ...prev, repos: r } : null));
    });
  }, [currentProjectId]);
  const refreshCurrentProjectConversations = useCallback(async () => {
    getProjectConversations(currentProjectId).then((r) => {
      setProject((prev) => (prev ? { ...prev, conversations: r } : null));
    });
  }, [currentProjectId]);

  const refreshCurrentProject = useCallback(() => {
    if (currentProjectId) {
      getProject(currentProjectId)
        .then((p) => {
          setProject({ ...p, repos: [], conversations: [] });
          refreshCurrentProjectRepos();
          refreshCurrentProjectConversations();
        })
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
      if (!currentProjectId) {
        setCurrentProjectId(p[0].id);
      }
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
      refreshCurrentProjectRepos,
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
