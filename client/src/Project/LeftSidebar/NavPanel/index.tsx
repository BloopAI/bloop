import { memo, useState } from 'react';
import RepoNav from './Repo';

type Props = {};

const NavPanel = ({}: Props) => {
  const [expanded, setExpanded] = useState(-1);
  return (
    <div className="flex flex-col h-full flex-1 overflow-auto">
      <RepoNav
        setExpanded={setExpanded}
        isExpanded={expanded === 0}
        i={0}
        repoName="gecko_learn"
        repoRef="local//Users/anastasiia/Projects/gecko_learn"
      />
      <RepoNav
        setExpanded={setExpanded}
        isExpanded={expanded === 1}
        i={1}
        repoName="github.com/BloopAI/bloop"
        repoRef="github.com/BloopAI/bloop"
      />
    </div>
  );
};

export default memo(NavPanel);
