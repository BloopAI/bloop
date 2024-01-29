import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../../../../components/Tooltip';
import { RangeIcon, WarningSignIcon } from '../../../../icons';
import FileIcon from '../../../../components/FileIcon';
import { humanNumber, splitPath } from '../../../../utils';
import {
  RepoIndexingStatusType,
  StudioContextFile,
  SyncStatus,
} from '../../../../types/general';
import { repoStatusMap } from '../../../../consts/general';
import SpinLoaderContainer from '../../../../components/Loaders/SpinnerLoader';
import StudioSubItem from './StudioSubItem';

type Props = StudioContextFile & {
  studioId: string;
  index: string;
  studioName: string;
  tokens?: number | null;
  indexingData?: RepoIndexingStatusType;
};

const StudioFile = ({
  path,
  ranges,
  repo,
  branch,
  studioId,
  index,
  studioName,
  tokens,
  indexingData,
}: Props) => {
  const { t } = useTranslation();

  const isIndexing = useMemo(() => {
    if (!indexingData) {
      return false;
    }
    return [
      SyncStatus.Indexing,
      SyncStatus.Syncing,
      SyncStatus.Queued,
    ].includes(indexingData.status);
  }, [indexingData]);

  return (
    <StudioSubItem
      key={`${path}-${repo}-${branch}`}
      studioId={studioId}
      index={index}
      studioName={studioName}
      path={path}
      repoRef={repo}
      branch={branch}
      ranges={ranges}
    >
      {isIndexing && indexingData ? (
        <Tooltip
          text={`${t(repoStatusMap[indexingData.status].text)}${
            indexingData?.percentage ? ` · ${indexingData?.percentage}%` : ''
          }`}
          placement="bottom-start"
        >
          <SpinLoaderContainer
            sizeClassName="w-4 h-4"
            colorClassName="text-blue"
          />
        </Tooltip>
      ) : tokens === null ? (
        <Tooltip
          text={t('Missing source')}
          placement={'bottom-start'}
          wrapperClassName="w-4 h-4"
        >
          <WarningSignIcon sizeClassName="w-4 h-4" className="text-red" />
        </Tooltip>
      ) : (
        <FileIcon filename={path} noMargin />
      )}
      <span
        className={`flex-1 ellipsis ${
          tokens === null && !isIndexing ? 'text-red' : ''
        }`}
      >
        {splitPath(path).pop()}
      </span>
      {!!ranges.length && (
        <Tooltip
          text={
            ranges.length === 1
              ? t('Lines # - #', {
                  start: ranges[0].start + 1,
                  end: ranges[0].end ? ranges[0].end + 1 : '',
                })
              : t('# ranges', { count: ranges.length })
          }
          placement={'top'}
        >
          <RangeIcon sizeClassName="w-3.5 h-3.5" />
        </Tooltip>
      )}
      {tokens !== null && (
        <span
          className={`code-mini w-10 text-right ${
            (tokens || 0) < 18000 && (tokens || 0) > 1500
              ? 'text-yellow'
              : (tokens || 0) <= 1500
              ? 'text-green'
              : 'text-red'
          }`}
        >
          {humanNumber(tokens || 0)}
        </span>
      )}
    </StudioSubItem>
  );
};

export default memo(StudioFile);
