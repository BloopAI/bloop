import React, { useCallback, useContext } from 'react';
import { Reorder, motion } from 'framer-motion';
import {
  CloseSign,
  GitHubLogo,
  HardDrive,
  CodeStudioColored,
} from '../../icons';
import { TabsContext } from '../../context/tabsContext';
import { RepoSource } from '../../types';
import { UITabType } from '../../types/general';

type Props = {
  tabKey: string;
  name: string;
  source?: RepoSource;
  activeTab: string;
  item: UITabType;
};

const initialStyle = { backgroundColor: 'rgb(var(--bg-base))' };
const activeStyle = { backgroundColor: 'rgb(var(--bg-shade))' };

const Tab = ({ tabKey, name, source, activeTab, item }: Props) => {
  const { setActiveTab, handleRemoveTab } = useContext(TabsContext);
  const onPointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setActiveTab(tabKey);
    },
    [tabKey],
  );
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleRemoveTab(tabKey);
    },
    [tabKey],
  );
  return (
    <Reorder.Item
      value={item}
      id={item.key}
      className={`border-r pl-4 pr-3 h-full border-bg-border group flex items-center justify-center gap-2 ${
        activeTab === tabKey
          ? 'bg-bg-shade text-label-title'
          : 'bg-bg-base text-label-base'
      } cursor-pointer max-w-12`}
      onPointerDown={onPointerDown}
      animate={activeTab === tabKey ? activeStyle : initialStyle}
    >
      <motion.div
        layout="position"
        className="flex items-center justify-center gap-2 ellipsis"
      >
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
          <span className="ellipsis body-m">
            {name.split('/').slice(-1)[0]}
          </span>
        </div>
        <button
          onClick={handleClose}
          className={`w-5 h-5 flex items-center justify-center text-label-base hover:text-label-title 
          ${
            activeTab !== tabKey ? 'opacity-0 group-hover:opacity-100' : ''
          } relative top-px`}
        >
          <CloseSign sizeClassName="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </Reorder.Item>
  );
};

export default Tab;
