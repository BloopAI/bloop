import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  RepoType,
  StudioRightPanelDataType,
  StudioRightPanelType,
} from '../../../types/general';
import { Branch, CursorSelection, Fire } from '../../../icons';
import FileIcon from '../../../components/FileIcon';
import { getFileTokenCount, search } from '../../../services/api';
import { buildRepoQuery, getFileExtensionForLang } from '../../../utils';
import { File } from '../../../types/api';
import CodeFullSelectable from '../../../components/CodeBlock/CodeFullSelectable';
import LinesBadge from '../LinesBadge';
import TokensUsageBadge from '../TokensUsageBadge';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import BreadcrumbsPath from '../../../components/BreadcrumbsPath';
import KeyboardChip from '../KeyboardChip';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';

type Props = {
  setRightPanel: Dispatch<SetStateAction<StudioRightPanelDataType>>;
  filePath: string;
  branch: string | null;
  repo: RepoType;
  initialRanges?: [number, number][];
  onFileRangesChanged: (
    ranges: [number, number][],
    filePath: string,
    repo_ref: string,
    branch: string | null,
  ) => void;
};

const HEADER_HEIGHT = 32;
const SUBHEADER_HEIGHT = 46;
const FOOTER_HEIGHT = 64;
const VERTICAL_PADDINGS = 32;
const HORIZONTAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 41;

const FilePanel = ({
  setRightPanel,
  filePath,
  branch,
  repo,
  initialRanges,
  onFileRangesChanged,
}: Props) => {
  useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [selectedLines, setSelectedLines] = useState<[number, number][]>(
    initialRanges || [],
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tokenCount, setTokenCount] = useState(0);

  useEffect(() => {
    setSelectedLines(initialRanges || []);
    search(
      buildRepoQuery(
        repo.ref.startsWith('github.com/') ? repo.ref : repo.name,
        filePath,
        branch,
      ),
    ).then((resp) => {
      if (resp?.data?.[0]?.kind === 'file') {
        setFile(resp?.data?.[0]?.data);
        // if (initialRanges?.[0]) {
        setTimeout(
          () => {
            const line = findElementInCurrentTab(
              `[data-line-number="${
                initialRanges?.[0] ? initialRanges[0][0] : 0
              }"]`,
            );
            line?.scrollIntoView({
              behavior: 'auto',
              block:
                !!initialRanges?.[0] &&
                initialRanges[0][0] > 1 &&
                initialRanges[0][1] - initialRanges[0][0] > 5
                  ? 'start'
                  : 'center',
            });
          },
          !initialRanges?.[0]
            ? 100
            : initialRanges[0][0] > 1000
            ? 1000
            : initialRanges[0][0] > 500
            ? 800
            : 500,
        );
        // }
      }
    });
  }, [filePath, branch, repo, initialRanges]);

  useEffect(() => {
    const mappedLines: [number, number][] = selectedLines.map((r) => [
      r[0],
      r[1] + 1,
    ]);
    getFileTokenCount(
      filePath,
      repo.ref,
      branch || undefined,
      mappedLines,
    ).then(setTokenCount);
  }, [filePath, repo.ref, branch, selectedLines]);

  const onCancel = useCallback(() => {
    setRightPanel({ type: StudioRightPanelType.CONVERSATION });
  }, [setRightPanel]);

  const onSubmit = useCallback(() => {
    onFileRangesChanged(selectedLines, filePath, repo.ref, branch);
    setRightPanel({ type: StudioRightPanelType.CONVERSATION });
  }, [
    onFileRangesChanged,
    selectedLines,
    filePath,
    repo.ref,
    branch,
    setRightPanel,
  ]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="flex flex-col w-full flex-1 overflow-auto relative">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-auto">
          <div className="flex items-center p-1 rounded border border-bg-border bg-bg-base">
            <FileIcon filename={filePath || ''} noMargin />
          </div>
          <p className="body-s-strong text-label-title ellipsis overflow-hidden">
            <BreadcrumbsPath path={filePath} repo={repo.ref} nonInteractive />
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button size="small" variant="secondary" onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button size="small" onClick={onSubmit}>
            <Trans>Submit</Trans>
            <div className="flex items-center gap-1 flex-shrink-0">
              <KeyboardChip type="cmd" variant="primary" />
              <KeyboardChip type="S" variant="primary" />
            </div>
          </Button>
        </div>
      </div>
      <div className="flex px-8 py-2 items-center gap-2 border-b border-bg-border bg-bg-sub  text-label-base">
        <div className="flex items-center gap-1.5 flex-1">
          <FileIcon filename={getFileExtensionForLang(repo.most_common_lang)} />
          <span className="caption ellipsis">
            {repo.name.replace(/^github\.com\//, '')}
          </span>
          <span className="w-0.5 h-0.5 bg-bg-border-hover rounded-full" />
          {!!branch && (
            <>
              <Branch sizeClassName="w-4 h-4" />
              <span className="caption ellipsis">
                {branch.replace(/^origin\//, '')}
              </span>
            </>
          )}
          <LinesBadge ranges={selectedLines} />
        </div>
        <div className="flex items-center gap-2">
          {/*<RelatedFilesBadge*/}
          {/*  selectedFiles={contextFiles}*/}
          {/*  onFileRemove={handleRelatedFileRemoved}*/}
          {/*  onFileAdded={handleRelatedFileAdded}*/}
          {/*  repoRef={repo.ref}*/}
          {/*  branch={branch}*/}
          {/*  filePath={filePath}*/}
          {/*/>*/}
          <TokensUsageBadge tokens={tokenCount} />
        </div>
      </div>
      <div
        className={`py-4 px-4 overflow-auto flex flex-col`}
        ref={scrollContainerRef}
      >
        {!!file && (
          <CodeFullSelectable
            code={file.contents}
            language={file.lang}
            relativePath={filePath}
            containerWidth={window.innerWidth / 2 - HORIZONTAL_PADDINGS}
            containerHeight={
              window.innerHeight -
              HEADER_HEIGHT -
              SUBHEADER_HEIGHT -
              FOOTER_HEIGHT -
              VERTICAL_PADDINGS -
              BREADCRUMBS_HEIGHT
            }
            currentSelection={selectedLines}
            setCurrentSelection={setSelectedLines}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </div>
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-full flex h-8 items-center gap-2 p-2 pr-2.5 border border-bg-border bg-bg-base shadow-float caption text-label-title flex-shrink-0 w-fit z-20">
        {!selectedLines.length ? <Fire /> : <CursorSelection />}
        <p className="pointer-events-none select-none cursor-default">
          {!selectedLines.length ? (
            <Trans>Tip: Select code to create ranges for context use.</Trans>
          ) : selectedLines.length === 1 && selectedLines[0].length === 2 ? (
            <Trans
              values={{
                start: selectedLines[0][0] + 1,
                end: selectedLines[0][1] + 1,
              }}
            >
              Only the selected lines (# - #) will be used as context.
            </Trans>
          ) : (
            <Trans>Only the selected ranges will be used as context.</Trans>
          )}
        </p>
        {!!selectedLines.length && (
          <Button
            variant="tertiary"
            size="tiny"
            onClick={() => setSelectedLines([])}
          >
            <Trans>Clear ranges</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(FilePanel);
