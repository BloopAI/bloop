import React, { useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Collapsed, Expanded } from '../../icons';
import Tabs from '../../components/Tabs';
import SkeletonItem from '../../components/SkeletonItem';
import { UIContext } from '../../context/uiContext';

type Props = {
  resultsNumber: number;
  showCollapseControls?: boolean;
  collapsed?: boolean;
  loading?: boolean;
};

const PageHeader = ({
  resultsNumber,
  showCollapseControls,
  loading,
}: Props) => {
  const { t } = useTranslation();
  const { symbolsCollapsed, setSymbolsCollapsed } = useContext(
    UIContext.Symbols,
  );
  return (
    <div className="w-full flex justify-between items-center mb-5 select-none">
      <div>
        {loading ? (
          <div className="h-6 w-24 mb-2">
            <SkeletonItem />
          </div>
        ) : (
          <h4 className="text-label-title">
            <Trans>{resultsNumber ? 'Results' : 'No results'}</Trans>
          </h4>
        )}
        {loading ? (
          <div className="h-4 w-48">
            <SkeletonItem />
          </div>
        ) : (
          <p className="body-s text-label-muted">
            {t('Showing # result', { count: resultsNumber })}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        {showCollapseControls ? (
          <span>
            <Tabs
              tabs={[{ iconLeft: <Expanded /> }, { iconLeft: <Collapsed /> }]}
              activeTab={symbolsCollapsed ? 1 : 0}
              onTabChange={(t) => {
                setSymbolsCollapsed(t === 1);
              }}
              size="small"
              variant="button"
            />
          </span>
        ) : (
          ''
        )}
      </div>
    </div>
  );
};

export default PageHeader;
