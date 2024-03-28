import {
  memo,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ProjectContext } from '../projectContext';
import {
  ANSWER_SPEED_KEY,
  getPlainFromStorage,
  PROJECT_KEY,
  savePlainToStorage,
} from '../../services/storage';
import {
  createProject,
  getAllProjects,
  getCodeStudios,
  getProject,
  getProjectConversations,
  getProjectDocs,
  getProjectRepos,
} from '../../services/api';
import { ProjectFullType, ProjectShortType } from '../../types/api';
import { filterOutDuplicates } from '../../utils/mappers';

type Props = {};

const ProjectContextProvider = ({ children }: PropsWithChildren<Props>) => {
  const { t } = useTranslation();
  const [currentProjectId, setCurrentProjectId] = useState(
    getPlainFromStorage(PROJECT_KEY) || '',
  );
  const [project, setProject] = useState<ProjectFullType | null>(null);
  const [projects, setProjects] = useState<ProjectShortType[]>([]);
  const [isReposLoaded, setIsReposLoaded] = useState(false);
  const [isChatsLoaded, setIsChatsLoaded] = useState(false);
  const [isStudiosLoaded, setIsStudiosLoaded] = useState(false);
  const [isDocsLoaded, setIsDocsLoaded] = useState(false);
  const [isRegexSearchEnabled, setIsRegexSearchEnabled] = useState(false);
  const [preferredAnswerSpeed, setPreferredAnswerSpeed] = useState<
    'normal' | 'fast'
  >((getPlainFromStorage(ANSWER_SPEED_KEY) as 'normal') || 'normal');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    savePlainToStorage(ANSWER_SPEED_KEY, preferredAnswerSpeed);
  }, [preferredAnswerSpeed]);

  const refreshCurrentProjectRepos = useCallback(async () => {
    getProjectRepos(currentProjectId).then((r) => {
      setProject((prev) => (prev ? { ...prev, repos: r } : null));
      setIsReposLoaded(true);
    });
    refreshCurrentProjectStudios();
  }, [currentProjectId]);
  const refreshCurrentProjectConversations = useCallback(async () => {
    getProjectConversations(currentProjectId).then((r) => {
      setProject((prev) => (prev ? { ...prev, conversations: r } : null));
      setIsChatsLoaded(true);
    });
  }, [currentProjectId]);
  const refreshCurrentProjectStudios = useCallback(async () => {
    getCodeStudios(currentProjectId).then((r) => {
      setProject((prev) =>
        prev
          ? {
              ...prev,
              // as a precaution filter out duplicated studios
              studios: filterOutDuplicates(r, 'id'),
            }
          : null,
      );
      setIsStudiosLoaded(true);
    });
  }, [currentProjectId]);
  const refreshCurrentProjectDocs = useCallback(async () => {
    getProjectDocs(currentProjectId).then((r) => {
      setProject((prev) => (prev ? { ...prev, docs: r } : null));
      setIsDocsLoaded(true);
    });
  }, [currentProjectId]);

  useEffect(() => {
    if (
      currentProjectId &&
      !isLoading &&
      location.pathname !== `/project/${currentProjectId}`
    ) {
      navigate(`/project/${currentProjectId}`);
    }
  }, [currentProjectId]);

  useEffect(() => {
    setIsReposLoaded(false);
    setIsChatsLoaded(false);
    setIsStudiosLoaded(false);
    setIsDocsLoaded(false);
  }, [currentProjectId]);

  useEffect(() => {
    if (location.pathname === '/') {
      setIsLoading(false);
      return;
    }
    if (isLoading && projects?.length) {
      const firstPart = decodeURIComponent(
        location.pathname.slice(1).split('/')[1],
      );
      const proj = projects.find((p) => p.id.toString() === firstPart);
      if (proj) {
        setCurrentProjectId(proj.id);
      }
      setIsLoading(false);
    }
  }, [projects, isLoading]);

  const refreshCurrentProject = useCallback(() => {
    if (currentProjectId) {
      getProject(currentProjectId)
        .then((p) => {
          setProject((prev) => ({
            ...prev,
            ...p,
            repos: prev?.repos || [],
            studios: prev?.studios || [],
            conversations: prev?.conversations || [],
            docs: prev?.docs || [],
          }));
          refreshCurrentProjectRepos();
          refreshCurrentProjectConversations();
          refreshCurrentProjectStudios();
          refreshCurrentProjectDocs();
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
    refreshAllProjects();
  }, []);

  const currentValue = useMemo(
    () => ({
      project,
      isReposLoaded,
      isChatsLoaded,
      isStudiosLoaded,
      isDocsLoaded,
      setCurrentProjectId,
      refreshCurrentProjectRepos,
      refreshCurrentProjectConversations,
      refreshCurrentProjectStudios,
      refreshCurrentProjectDocs,
      refreshCurrentProject,
      isLoading,
    }),
    [
      project,
      isReposLoaded,
      isChatsLoaded,
      isStudiosLoaded,
      isDocsLoaded,
      refreshCurrentProjectRepos,
      refreshCurrentProjectConversations,
      refreshCurrentProjectStudios,
      refreshCurrentProjectDocs,
      refreshCurrentProject,
      isLoading,
    ],
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

  const answerSpeedValue = useMemo(
    () => ({
      preferredAnswerSpeed,
      setPreferredAnswerSpeed,
    }),
    [preferredAnswerSpeed],
  );

  return (
    <ProjectContext.Current.Provider value={currentValue}>
      <ProjectContext.All.Provider value={allValue}>
        <ProjectContext.RegexSearch.Provider value={regexValue}>
          <ProjectContext.AnswerSpeed.Provider value={answerSpeedValue}>
            {children}
          </ProjectContext.AnswerSpeed.Provider>
        </ProjectContext.RegexSearch.Provider>
      </ProjectContext.All.Provider>
    </ProjectContext.Current.Provider>
  );
};

export default memo(ProjectContextProvider);
