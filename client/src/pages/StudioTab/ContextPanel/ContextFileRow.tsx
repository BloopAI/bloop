import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  RepoType,
  StudioContextFile,
  StudioRightPanelDataType,
  StudioRightPanelType,
} from '../../../types/general';
import FileIcon from '../../../components/FileIcon';
import LinesBadge from '../LinesBadge';
import TokensUsageBadge from '../TokensUsageBadge';
import Button from '../../../components/Button';
import { EyeCut, Eye, TrashCanFilled, PlusSignInBubble } from '../../../icons';
import Tooltip from '../../../components/Tooltip';
import RelatedFilesDropdown from '../RelatedFilesDropdown';

type Props = StudioContextFile & {
  contextFiles: StudioContextFile[];
  setRightPanel: Dispatch<SetStateAction<StudioRightPanelDataType>>;
  repoFull?: RepoType;
  tokens: number;
  onFileHide: (
    path: string,
    repo: string,
    branch: string | null,
    hide: boolean,
  ) => void;
  onFileRemove: (
    f:
      | { path: string; repo: string; branch: string | null }
      | StudioContextFile[],
  ) => void;
  onFileAdded: (
    repoRef: string,
    branch: string | null,
    filePath: string,
    ranges?: { start: number; end: number }[],
  ) => void;
  displayName: string;
  isPreviewing: boolean;
};

const ContextFileRow = ({
  path,
  tokens,
  ranges,
  repo,
  branch,
  hidden,
  contextFiles,
  setRightPanel,
  repoFull,
  onFileRemove,
  onFileHide,
  onFileAdded,
  displayName,
  isPreviewing,
}: Props) => {
  const { t } = useTranslation();

  const mappedRanges = useMemo((): [number, number][] => {
    return ranges.map((r) => [r.start, r.end - 1]);
  }, [ranges]);

  const handleClick = useCallback(() => {
    if (repoFull) {
      setRightPanel({
        type: StudioRightPanelType.FILE,
        data: {
          filePath: path,
          branch,
          repo: repoFull,
          initialRanges: mappedRanges,
        },
      });
    }
  }, [path, branch, repoFull, mappedRanges]);

  return (
    <div
      className="w-full overflow-x-auto border-b border-bg-base bg-bg-sub group cursor-pointer flex-shrink-0 select-none"
      onClick={handleClick}
    >
      <div className={`max-w-full flex gap-3 items-center py-3 px-8`}>
        <div className="rounded bg-bg-base">
          <FileIcon filename={path} noMargin />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <p
            className={`body-s-strong text-label-title ellipsis ${
              hidden ? 'opacity-30' : ''
            }`}
          >
            <Tooltip text={path} placement={'bottom-start'} delay={500}>
              {displayName}
            </Tooltip>
          </p>
          <LinesBadge ranges={mappedRanges} isShort />
          {/*<RelatedFilesBadge*/}
          {/*  selectedFiles={contextFiles}*/}
          {/*  onFileAdded={handleRelatedFileAdded}*/}
          {/*  onFileRemove={handleRelatedFileRemoved}*/}
          {/*  repoRef={repo}*/}
          {/*  filePath={path}*/}
          {/*  branch={branch}*/}
          {/*/>*/}
        </div>
        <div className="w-16 flex items-center flex-shrink-0">
          <TokensUsageBadge tokens={tokens} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {repoFull && !isPreviewing && (
            <RelatedFilesDropdown
              selectedFiles={contextFiles}
              onFileAdded={onFileAdded}
              onFileRemove={onFileRemove}
              filePath={path}
              branch={branch}
              repoRef={repo}
              dropdownPlacement="bottom"
            >
              <Button
                variant="tertiary"
                size="tiny"
                id="dropdownDefault"
                data-dropdown-toggle="dropdown"
                className={'flex-shrink-0'}
                onlyIcon
                title={t('Add related files')}
              >
                <PlusSignInBubble
                  raw
                  sizeClassName="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-focus:opacity-100"
                />
              </Button>
            </RelatedFilesDropdown>
          )}
        </div>
        {!isPreviewing && (
          <>
            <Button
              variant="tertiary"
              size="tiny"
              onlyIcon
              title={hidden ? t('Show file') : t('Hide file')}
              className={
                'opacity-50 group-hover:opacity-100 group-focus:opacity-100'
              }
              onClick={(e) => {
                e.stopPropagation();
                onFileHide(path, repo, branch, !hidden);
              }}
            >
              {hidden ? (
                <EyeCut raw sizeClassName="w-3.5 h-3.5" />
              ) : (
                <Eye raw sizeClassName="w-3.5 h-3.5" />
              )}
            </Button>
            <Button
              variant="tertiary"
              size="tiny"
              onlyIcon
              title={t('Remove file')}
              className={
                'opacity-50 group-hover:opacity-100 group-focus:opacity-100'
              }
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove({ path, repo, branch });
              }}
            >
              <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(ContextFileRow);
