import { memo, useContext, useMemo, useState } from 'react';
import { ProjectContext } from '../../../context/projectContext';
import { RepoProvider, TabTypesEnum } from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import RepoNav from './Repo';

type Props = {};

const NavPanel = ({}: Props) => {
  const [expanded, setExpanded] = useState(-1);
  const { project } = useContext(ProjectContext.Current);
  const { focusedPanel } = useContext(TabsContext.All);
  const { tab: leftTab } = useContext(TabsContext.CurrentLeft);
  const { tab: rightTab } = useContext(TabsContext.CurrentRight);

  const currentlyFocusedTab = useMemo(() => {
    const focusedTab = focusedPanel === 'left' ? leftTab : rightTab;
    if (focusedTab?.type === TabTypesEnum.FILE) {
      return focusedTab;
    }
    return null;
  }, [focusedPanel, leftTab, rightTab]);

  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      {project?.repos.map((r, i) => (
        <RepoNav
          projectId={project?.id}
          key={r.repo.ref}
          setExpanded={setExpanded}
          isExpanded={expanded === i}
          i={i}
          repoName={
            r.repo.provider === RepoProvider.Local ? r.repo.name : r.repo.ref
          }
          repoRef={r.repo.ref}
          branch={r.branch}
          lastIndex={r.repo.last_index}
          allBranches={r.repo.branches}
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
