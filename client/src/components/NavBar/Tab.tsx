import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseSign, GitHubLogo, HardDrive, Home } from '../../icons';
import { TabsContext } from '../../context/tabsContext';
import { RepoSource } from '../../types';
import useUrlParser from '../../hooks/useUrlParser';

type Props = {
  tabKey: string;
  name: string;
  currentUrl: string;
  source: RepoSource;
};

const Tab = ({ tabKey, name, source, currentUrl }: Props) => {
  const { handleRemoveTab } = useContext(TabsContext);
  const navigateBrowser = useNavigate();
  const { repoRef } = useUrlParser();
  return (
    <div
      key={tabKey}
      onClick={() => navigateBrowser(currentUrl)}
      className={`border-r ${
        tabKey === 'initial'
          ? 'px-3 border-l h-[calc(100%-7px)]'
          : 'pl-4 pr-3 h-full'
      } border-bg-border group flex items-center justify-center gap-2 ${
        repoRef === tabKey
          ? 'bg-bg-shade text-label-title'
          : 'bg-bg-base text-label-base'
      } cursor-pointer max-w-12 relative`}
    >
      {tabKey === 'initial' ? (
        <Home sizeClassName="w-4 h-4" />
      ) : (
        <div className="flex items-center gap-1 ellipsis">
          <div className="w-4 h-4 flex-shrink-0">
            {source === RepoSource.GH ? <GitHubLogo raw /> : <HardDrive raw />}
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
            repoRef !== tabKey ? 'opacity-0 group-hover:opacity-100' : ''
          } relative top-px`}
        >
          <CloseSign sizeClassName="w-3.5 h-3.5" />
        </button>
      )}
      {repoRef === tabKey && (
        <span className="absolute left-0 right-0 -bottom-1 h-1 bg-bg-shade" />
      )}
    </div>
  );
};

export default Tab;
