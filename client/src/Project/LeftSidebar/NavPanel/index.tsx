import { memo, useContext, useState } from 'react';
import { ProjectContext } from '../../../context/projectContext';
import { RepoProvider } from '../../../types/general';
import RepoNav from './Repo';

type Props = {};

const NavPanel = ({}: Props) => {
  const [expanded, setExpanded] = useState(-1);
  const { project } = useContext(ProjectContext.Current);
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
          allBranches={r.repo.branches}
          indexedBranches={r.repo.branch_filter?.select || []}
        />
      ))}
    </div>
  );
};

export default memo(NavPanel);
