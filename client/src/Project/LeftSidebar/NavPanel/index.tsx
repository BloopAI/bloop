import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ProjectContext } from '../../../context/projectContext';
import { SyncStatus, TabTypesEnum } from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import { DeviceContext } from '../../../context/deviceContext';
import { getIndexedRepos } from '../../../services/api';
import RepoNav from './Repo';
import ConversationsNav from './Conversations';

type Props = {};

const NavPanel = ({}: Props) => {
  const [expanded, setExpanded] = useState(-1);
  const { project, refreshCurrentProjectRepos } = useContext(
    ProjectContext.Current,
  );
  const { focusedPanel } = useContext(TabsContext.All);
  const { tab: leftTab } = useContext(TabsContext.CurrentLeft);
  const { tab: rightTab } = useContext(TabsContext.CurrentRight);
  const { apiUrl } = useContext(DeviceContext);
  const [indexingRepos, setIndexingRepos] = useState<
    Record<
      string,
      {
        status: SyncStatus;
        percentage?: string;
        branch?: string;
      }
    >
  >({});
  const eventSourceRef = useRef<EventSource | null>(null);

  const startEventSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.ev?.status_change) {
        if (data.ev?.status_change === SyncStatus.Done) {
          refreshCurrentProjectRepos();
        }
        setIndexingRepos((prev) => ({
          ...prev,
          [data.ref]: {
            ...(prev[data.ref] ? prev[data.ref] : {}),
            status: data.ev?.status_change,
          },
        }));
      }
      if (data.ev?.index_percent) {
        setIndexingRepos((prev) => ({
          ...prev,
          [data.ref]: {
            ...(prev[data.ref] ? prev[data.ref] : {}),
            percentage: data.ev?.index_percent,
            branch: data.b?.select[0],
          },
        }));
      }
    };
  }, []);

  useEffect(() => {
    startEventSource();
    getIndexedRepos().then((repos) => {
      const reposInProgress = repos.list.filter(
        (r) => r.sync_status !== SyncStatus.Done,
      );
      setIndexingRepos((prev) => {
        const newRepos = JSON.parse(JSON.stringify(prev));
        reposInProgress.forEach((r) => {
          newRepos[r.ref] = {
            ...(newRepos[r.ref] || {}),
            status: r.sync_status,
          };
        });
        return newRepos;
      });
    });
    const intervalId = window.setInterval(startEventSource, 10 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const currentlyFocusedTab = useMemo(() => {
    const focusedTab = focusedPanel === 'left' ? leftTab : rightTab;
    if (focusedTab?.type === TabTypesEnum.FILE) {
      return focusedTab;
    }
    return null;
  }, [focusedPanel, leftTab, rightTab]);

  useEffect(() => {
    if (project?.repos.length === 1) {
      setExpanded(!!project?.conversations.length ? 1 : 0);
    }
  }, [project?.repos]);

  useEffect(() => {
    if (currentlyFocusedTab?.repoRef) {
      const repoIndex = project?.repos.findIndex(
        (r) => r.repo.ref === currentlyFocusedTab.repoRef,
      );
      if (repoIndex !== undefined && repoIndex > -1) {
        setExpanded(repoIndex + (!!project?.conversations ? 1 : 0));
      }
    }
  }, [currentlyFocusedTab]);

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      {!!project?.conversations.length && (
        <ConversationsNav
          setExpanded={setExpanded}
          isExpanded={expanded === 0}
        />
      )}
      {project?.repos.map((r, i) => (
        <RepoNav
          projectId={project?.id}
          key={r.repo.ref}
          setExpanded={setExpanded}
          isExpanded={
            expanded === i + (!!project?.conversations.length ? 1 : 0)
          }
          i={i + (!!project?.conversations ? 1 : 0)}
          repoRef={r.repo.ref}
          branch={r.branch}
          lastIndex={r.repo.last_index}
          allBranches={r.repo.branches}
          indexingData={indexingRepos[r.repo.ref]}
          indexedBranches={r.repo.branch_filter?.select || []}
          currentPath={
            currentlyFocusedTab?.repoRef === r.repo.ref
              ? currentlyFocusedTab?.path
              : undefined
          }
        />
      ))}
    </div>
  );
};

export default memo(NavPanel);
