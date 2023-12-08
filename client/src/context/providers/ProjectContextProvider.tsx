import {
  memo,
  PropsWithChildren,
  useCallback,
  useContext,
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
import { UIContext } from '../uiContext';

type Props = {};

const ProjectContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const { t } = useTranslation();
  const { isGithubConnected } = useContext(UIContext.GitHubConnected);
  const [currentProjectId, setCurrentProjectId] = useState(
    getPlainFromStorage(PROJECT_KEY) || '',
  );
  const [project, setProject] = useState<ProjectFullType | null>(null);
  const [projects, setProjects] = useState<ProjectShortType[]>([]);
  const [isReposLoaded, setIsReposLoaded] = useState(false);
  const [isRegexSearchEnabled, setIsRegexSearchEnabled] = useState(false);

  const refreshCurrentProjectRepos = useCallback(async () => {
    getProjectRepos(currentProjectId).then((r) => {
      setProject((prev) => (prev ? { ...prev, repos: r } : null));
      setIsReposLoaded(true);
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
    if (currentProjectId && isGithubConnected) {
      savePlainToStorage(PROJECT_KEY, currentProjectId);
      refreshCurrentProject();
    }
  }, [currentProjectId, refreshCurrentProject, isGithubConnected]);

  const refreshAllProjects = useCallback(() => {
    getAllProjects().then((p) => {
      setProjects(p);
      if (!currentProjectId && p[0]) {
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
    if (isGithubConnected) {
      refreshAllProjects();
    }
  }, [isGithubConnected]);

  const currentValue = useMemo(
    () => ({
      project,
      isReposLoaded,
      setCurrentProjectId,
      refreshCurrentProjectRepos,
      refreshCurrentProject,
    }),
    [project, isReposLoaded],
  );

  const allValue = useMemo(
    () => ({
      projects,
      refreshAllProjects,
    }),
    [projects, refreshAllProjects],
  );

  const regexValue = useMemo(
    () => ({
      isRegexSearchEnabled,
      setIsRegexSearchEnabled,
    }),
    [isRegexSearchEnabled],
  );

  return (
    <ProjectContext.Current.Provider value={currentValue}>
      <ProjectContext.All.Provider value={allValue}>
        <ProjectContext.RegexSearch.Provider value={regexValue}>
          {children}
        </ProjectContext.RegexSearch.Provider>
      </ProjectContext.All.Provider>
    </ProjectContext.Current.Provider>
  );
};

export default memo(ProjectContextProvider);
