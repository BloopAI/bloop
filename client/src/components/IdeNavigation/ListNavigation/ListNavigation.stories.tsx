import React from 'react';
import {
  Branch,
  GitHubLogo,
  List,
  Person,
  Repository,
  TuneControls,
  Version,
} from '../../../icons';
import ListNavigation from './index';
import '../../../index.css';

export default {
  title: 'components/ListNavigation',
  component: ListNavigation,
};

export const BranchNavigation = () => {
  const [selectedBranch, setSelectedBranch] = React.useState(0);
  return (
    <div className="p-5 bg-gray-900 w-[384px]">
      <ListNavigation
        items={[
          { title: 'main' },
          { title: 'dev/index' },
          { title: 'test/secondary' },
        ]}
        icon={<Branch />}
        title={'Branch'}
        dense
        setSelected={setSelectedBranch}
        selected={selectedBranch}
      />
    </div>
  );
};

export const VersionNavigation = () => {
  const [selectedVersion, setSelectedVersion] = React.useState(0);
  return (
    <div className="p-5 bg-gray-900 w-[384px]">
      <ListNavigation
        items={[{ title: '2.1.1' }, { title: '2.1.2' }, { title: '2.1.3' }]}
        icon={<Version />}
        title={'Version'}
        dense
        setSelected={setSelectedVersion}
        selected={selectedVersion}
      />
    </div>
  );
};

export const DefaultNavigation = () => {
  const [selected, setSelected] = React.useState(0);
  return (
    <div className="bg-gray-900 w-[384px]">
      <ListNavigation
        title=""
        items={[
          { title: 'All', icon: <List /> },
          { title: 'Local repos', icon: <Repository /> },
          { title: 'GitHub repos', icon: <GitHubLogo /> },
        ]}
        setSelected={setSelected}
        selected={selected}
      />
    </div>
  );
};

export const LightNavigation = () => {
  const [selected, setSelected] = React.useState(0);
  return (
    <div className="bg-gray-800 w-[384px]">
      <ListNavigation
        title=""
        items={[
          { title: 'General', icon: <Person /> },
          { title: 'Preferences', icon: <TuneControls /> },
          { title: 'Repositories', icon: <Repository /> },
        ]}
        setSelected={setSelected}
        selected={selected}
        variant="light"
      />
    </div>
  );
};
