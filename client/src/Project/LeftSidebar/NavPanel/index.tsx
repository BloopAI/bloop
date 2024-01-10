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
import { TabTypesEnum } from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { UIContext } from '../../../context/uiContext';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import RepoNav from './Repo';
import ConversationsNav from './Conversations';

type Props = {};

const NavPanel = ({}: Props) => {
  const [expanded, setExpanded] = useState(-1);
  const { project } = useContext(ProjectContext.Current);
  const { focusedPanel } = useContext(TabsContext.All);
  const { tab: leftTab } = useContext(TabsContext.CurrentLeft);
  const { tab: rightTab } = useContext(TabsContext.CurrentRight);
  const { indexingStatus } = useContext(RepositoriesContext);
  const { isLeftSidebarFocused } = useContext(UIContext.Focus);
  const ref = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [focusedIndexFull, setFocusedIndexFull] = useState('');

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
        setExpanded(repoIndex + (!!project?.conversations.length ? 1 : 0));
      }
    }
  }, [currentlyFocusedTab]);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (ref.current) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const nodes = ref.current.querySelectorAll('[data-node-index]');
        setFocusedIndex((prev) => {
          const newInd =
            e.key === 'ArrowDown'
              ? prev < nodes.length - 1
                ? prev + 1
                : 0
              : prev > 0
              ? prev - 1
              : nodes.length - 1;
          setFocusedIndexFull(
            (nodes[newInd] as HTMLElement)?.dataset?.nodeIndex || '',
          );
          return newInd;
        });
      }
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent, !isLeftSidebarFocused);

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto" ref={ref}>
      {!!project?.conversations.length && (
        <ConversationsNav
          setExpanded={setExpanded}
          isExpanded={expanded === 0}
          focusedIndex={focusedIndexFull}
          index={0}
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
          i={i + (!!project?.conversations.length ? 1 : 0)}
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
          focusedIndex={focusedIndexFull}
          index={
            i +
            (project?.conversations.length
              ? expanded === 0
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
