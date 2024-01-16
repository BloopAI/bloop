import { memo, useContext, useEffect, useMemo, useState } from 'react';
import { ProjectContext } from '../../../context/projectContext';
import { TabTypesEnum } from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import RepoNav from './Repo';
import ConversationsNav from './Conversations';
import StudiosNav from './Studios';

type Props = {
  focusedIndex: string;
};

const NavPanel = ({ focusedIndex }: Props) => {
  const [expanded, setExpanded] = useState(-1);
  const { project } = useContext(ProjectContext.Current);
  const { focusedPanel } = useContext(TabsContext.All);
  const { tab: leftTab } = useContext(TabsContext.CurrentLeft);
  const { tab: rightTab } = useContext(TabsContext.CurrentRight);
  const { indexingStatus } = useContext(RepositoriesContext);

  const currentlyFocusedTab = useMemo(() => {
    const focusedTab = focusedPanel === 'left' ? leftTab : rightTab;
    if (focusedTab?.type === TabTypesEnum.FILE) {
      return focusedTab;
    }
    return null;
  }, [focusedPanel, leftTab, rightTab]);

  useEffect(() => {
    if (project?.repos.length === 1) {
      setExpanded(
        Number(!!project?.conversations.length) +
          Number(!!project?.studios.length),
      );
    }
  }, [project?.repos]);

  useEffect(() => {
    if (currentlyFocusedTab?.repoRef) {
      const repoIndex = project?.repos.findIndex(
        (r) => r.repo.ref === currentlyFocusedTab.repoRef,
      );
      if (repoIndex !== undefined && repoIndex > -1) {
        setExpanded(
          repoIndex +
            Number(!!project?.conversations.length) +
            Number(!!project?.studios.length),
        );
      }
    }
  }, [currentlyFocusedTab]);

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      {!!project?.studios.length && (
        <StudiosNav
          setExpanded={setExpanded}
          isExpanded={expanded === 0}
          focusedIndex={focusedIndex}
          index={`studios-0`}
        />
      )}
      {!!project?.conversations.length && (
        <ConversationsNav
          setExpanded={setExpanded}
          isExpanded={expanded === (project?.studios.length ? 1 : 0)}
          focusedIndex={focusedIndex}
          index={`conv-1`}
        />
      )}
      {project?.repos.map((r, i) => (
        <RepoNav
          projectId={project?.id}
          key={r.repo.ref}
          setExpanded={setExpanded}
          isExpanded={
            expanded ===
            i +
              Number(!!project?.conversations.length) +
              Number(!!project?.studios.length)
          }
          i={
            i +
            Number(!!project?.conversations.length) +
            Number(!!project?.studios.length)
          }
          repoRef={r.repo.ref}
          branch={r.branch}
          lastIndex={r.repo.last_index}
          allBranches={r.repo.branches}
          indexingData={indexingStatus[r.repo.ref]}
          indexedBranches={r.repo.branch_filter?.select || []}
          currentPath={
            currentlyFocusedTab?.repoRef === r.repo.ref
              ? currentlyFocusedTab?.path
              : undefined
          }
          focusedIndex={focusedIndex}
          index={
            i +
            (project?.studios.length
              ? expanded === 0
                ? project?.studios.length + 1
                : 1
              : 0) +
            (project?.conversations.length
              ? expanded === (project?.studios.length ? 1 : 0)
                ? project?.conversations.length + 1
                : 1
              : 0)
          }
        />
      ))}
    </div>
  );
};

export default memo(NavPanel);
