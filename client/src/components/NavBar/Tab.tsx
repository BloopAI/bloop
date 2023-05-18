import React, { useContext } from 'react';
import { CloseSign, Home } from '../../icons';
import { TabsContext } from '../../context/tabsContext';

type Props = {
  tabKey: string;
  name: string;
};

const Tab = ({ tabKey, name }: Props) => {
  const { setActiveTab, activeTab, handleRemoveTab } = useContext(TabsContext);
  return (
    <div
      key={tabKey}
      onClick={() => setActiveTab(tabKey)}
      className={`px-4 border-r ${
        tabKey === 'initial' ? 'border-l h-[calc(100%-7px)]' : 'h-full'
      } border-bg-border  flex items-center justify-center gap-2 ${
        activeTab === tabKey
          ? 'bg-bg-shade text-label-title'
          : 'bg-bg-base text-label-base'
      } cursor-pointer max-w-12 relative`}
    >
      {tabKey === 'initial' ? (
        <Home sizeClassName="w-4 h-4" />
      ) : (
        <span className="ellipsis">{name.split('/').slice(-1)[0]}</span>
      )}
      {tabKey !== 'initial' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveTab(tabKey);
          }}
          className={`w-5 h-5 flex items-center justify-center text-label-base hover:text-label-title ${
            activeTab !== tabKey ? 'opacity-0' : ''
          } relative top-px`}
          disabled={activeTab !== tabKey}
        >
          <CloseSign sizeClassName="w-3.5 h-3.5" />
        </button>
      )}
      {activeTab === tabKey && (
        <span className="absolute left-0 right-0 -bottom-1 h-1 bg-bg-shade" />
      )}
    </div>
  );
};

export default Tab;
