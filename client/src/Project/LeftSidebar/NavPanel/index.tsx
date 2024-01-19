import { memo, useContext, useEffect, useMemo, useState } from 'react';
import { ProjectContext } from '../../../context/projectContext';
import { TabTypesEnum } from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import RepoNav from './Repo';
import ConversationsNav from './Conversations';
import StudiosNav from './Studios';
import DocNav from './Doc';

type Props = {
  focusedIndex: string;
  setFocusedIndex: (i: string) => void;
};

const NavPanel = ({ focusedIndex, setFocusedIndex }: Props) => {
  const [expanded, setExpanded] = useState('');
  const { project } = useContext(ProjectContext.Current);
  const { focusedPanel } = useContext(TabsContext.All);
  const { tab: leftTab } = useContext(TabsContext.CurrentLeft);
  const { tab: rightTab } = useContext(TabsContext.CurrentRight);
  const { indexingStatus } = useContext(RepositoriesContext);

  const currentlyFocusedTab = useMemo(() => {
    return focusedPanel === 'left' ? leftTab : rightTab;
  }, [focusedPanel, leftTab, rightTab]);

  useEffect(() => {
    if (project?.repos.length === 1) {
      setExpanded(`repo-${project.repos[0].repo.ref}`);
    }
  }, [project?.repos]);

  useEffect(() => {
    if (
      currentlyFocusedTab?.type === TabTypesEnum.FILE &&
      currentlyFocusedTab?.repoRef
    ) {
      if (!currentlyFocusedTab.studioId) {
        setExpanded(`repo-${currentlyFocusedTab.repoRef}`);
      } else {
        setExpanded('studios');
        const { studioId, repoRef, branch, path } = currentlyFocusedTab;
        setFocusedIndex(`studios-${studioId}-${path}-${repoRef}-${branch}`);
      }
    } else if (currentlyFocusedTab?.type === TabTypesEnum.STUDIO) {
      setExpanded('studios');
      setFocusedIndex(`studios-${currentlyFocusedTab.studioId}-prompts`);
    } else if (
      currentlyFocusedTab?.type === TabTypesEnum.CHAT &&
      currentlyFocusedTab.conversationId
    ) {
      setExpanded('conversations');
      setFocusedIndex(`conversations-${currentlyFocusedTab.conversationId}`);
    } else if (currentlyFocusedTab?.type === TabTypesEnum.DOC) {
      const { studioId, docId, relativeUrl } = currentlyFocusedTab;
      if (studioId) {
        setExpanded('studios');
        setFocusedIndex(`studios-${studioId}-${docId}-${relativeUrl}`);
      } else {
        setExpanded(`doc-${docId}`);
        setFocusedIndex(`doc-${docId}-${relativeUrl}`);
      }
    }
  }, [currentlyFocusedTab]);

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      {!!project?.studios.length && (
        <StudiosNav
          setExpanded={setExpanded}
          isExpanded={expanded === 'studios'}
          focusedIndex={focusedIndex}
          index={`studios`}
        />
      )}
      {!!project?.conversations.length && (
        <ConversationsNav
          setExpanded={setExpanded}
          isExpanded={expanded === 'conversations'}
          focusedIndex={focusedIndex}
          index={`conversations`}
        />
      )}
      {project?.repos.map((r, i) => (
        <RepoNav
          projectId={project?.id}
          key={r.repo.ref}
          setExpanded={setExpanded}
          isExpanded={expanded === `repo-${r.repo.ref}`}
          repoRef={r.repo.ref}
          branch={r.branch}
          lastIndex={r.repo.last_index}
          allBranches={r.repo.branches}
          indexingData={indexingStatus[r.repo.ref]}
          indexedBranches={r.repo.branch_filter?.select || []}
          currentPath={
            currentlyFocusedTab?.type === TabTypesEnum.FILE &&
            currentlyFocusedTab?.repoRef === r.repo.ref
              ? currentlyFocusedTab?.path
              : undefined
          }
          focusedIndex={focusedIndex}
          index={`repo-${r.repo.ref}`}
        />
      ))}
      {project?.docs.map((d) => (
        <DocNav
          projectId={project?.id}
          key={d.id}
          setExpanded={setExpanded}
          isExpanded={expanded === `doc-${d.id}`}
          focusedIndex={focusedIndex}
          index={`doc-${d.id}`}
          docId={d.id}
          title={d.name}
          favicon={d.favicon}
          url={d.url}
        />
      ))}
    </div>
  );
};

export default memo(NavPanel);
