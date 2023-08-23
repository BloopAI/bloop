import React, { useContext } from 'react';
import {
  CloseSign,
  GitHubLogo,
  HardDrive,
  Home,
  CodeStudioColored,
} from '../../icons';
import { TabsContext } from '../../context/tabsContext';
import { RepoSource } from '../../types';

type Props = {
  tabKey: string;
  name: string;
  source?: RepoSource;
};

const Tab = ({ tabKey, name, source }: Props) => {
  const { setActiveTab, activeTab, handleRemoveTab } = useContext(TabsContext);
  return (
    <div
      key={tabKey}
      onClick={() => setActiveTab(tabKey)}
      className={`border-r ${
        tabKey === 'initial'
          ? 'px-3 border-l h-[calc(100%-7px)]'
          : 'pl-4 pr-3 h-full'
      } border-bg-border group flex items-center justify-center gap-2 ${
        activeTab === tabKey
          ? 'bg-bg-shade text-label-title'
          : 'bg-bg-base text-label-base'
      } cursor-pointer max-w-12`}
    >
      {tabKey === 'initial' ? (
        <Home sizeClassName="w-4 h-4" />
      ) : (
        <div className="flex items-center gap-1 ellipsis">
          <div className="w-4 h-4 flex-shrink-0">
            {source === undefined ? (
              <CodeStudioColored />
            ) : source === RepoSource.LOCAL ? (
              <HardDrive raw />
            ) : (
              <GitHubLogo raw />
            )}
          </div>
          <span className="ellipsis">{name.split('/').slice(-1)[0]}</span>
        </div>
      )}
      {tabKey !== 'initial' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveTab(tabKey);
          }}
          className={`w-5 h-5 flex items-center justify-center text-label-base hover:text-label-title 
          ${
            activeTab !== tabKey ? 'opacity-0 group-hover:opacity-100' : ''
          } relative top-px`}
        >
          <CloseSign sizeClassName="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default Tab;
