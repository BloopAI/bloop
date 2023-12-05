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
          key={r.ref}
          setExpanded={setExpanded}
          isExpanded={expanded === i}
          i={i}
          repoName={r.provider === RepoProvider.Local ? r.name : r.ref}
          repoRef={r.ref}
        />
      ))}
    </div>
  );
};

export default memo(NavPanel);
