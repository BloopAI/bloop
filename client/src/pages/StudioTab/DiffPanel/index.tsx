import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  DiffHunkType,
  DiffPanelType,
  StudioLeftPanelDataType,
  StudioLeftPanelType,
} from '../../../types/general';
import { File } from '../../../types/api';
import { search } from '../../../services/api';
import { buildRepoQuery, getFileExtensionForLang } from '../../../utils';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import FileIcon from '../../../components/FileIcon';
import Button from '../../../components/Button';
import OverflowTracker from '../../../components/OverflowTracker';
import BreadcrumbsPath from '../../../components/BreadcrumbsPath';
import { Branch } from '../../../icons';
import CodeFull from '../../../components/CodeBlock/CodeFull';

type Props = DiffPanelType['data'] & {
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
};

const HEADER_HEIGHT = 32;
const SUBHEADER_HEIGHT = 46;
const FOOTER_HEIGHT = 64;
const VERTICAL_PADDINGS = 32;
const HORIZONTAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 41;

const DiffPanel = ({ hunks, setLeftPanel, branch, filePath, repo }: Props) => {
  useTranslation();
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    search(
      buildRepoQuery(
        repo.ref.startsWith('github.com/') ? repo.ref : repo.name,
        filePath,
        branch,
      ),
    ).then((resp) => {
      if (resp?.data?.[0]?.kind === 'file') {
        setFile(resp?.data?.[0]?.data);
      }
    });
  }, [filePath, branch, repo]);

  const onBack = useCallback(() => {
    setLeftPanel({ type: StudioLeftPanelType.CONTEXT });
  }, [setLeftPanel]);

  const code = useMemo(() => {
    if (file?.contents && hunks) {
      const result: string[] = [];
      const fileLines = file?.contents.split('\n');

      let prevStart: number;
      (JSON.parse(JSON.stringify(hunks)) as DiffHunkType[])
        .sort((a, b) => b.line_start - a.line_start)
        .forEach((h, i, arr) => {
          const patchLines = h.patch.split('\n').slice(0, -1);
          let patchOffset = 0;
          patchLines.forEach((l) => {
            if (l.startsWith('+')) {
              patchOffset++;
            } else if (l.startsWith('-')) {
              patchOffset--;
            }
          });
          if (
            h.line_start - 1 + (patchLines.length - 1 - patchOffset) <
            fileLines.length
          ) {
            result.push(
              ...fileLines
                .slice(
                  h.line_start - 1 + (patchLines.length - 1 - patchOffset),
                  prevStart,
                )
                .reverse(),
            );
          }
          result.push(...patchLines.reverse());
          prevStart = h.line_start - 1;
          if (i === arr.length - 1 && h.line_start > 0) {
            result.push(...fileLines.slice(0, h.line_start - 1).reverse());
          }
        });

      return result.reverse().join('\n');
    }
  }, [file?.contents, hunks]);

  useEffect(() => {
    if (code && hunks) {
      setTimeout(() => {
        const firstLine = (
          JSON.parse(JSON.stringify(hunks)) as DiffHunkType[]
        ).sort((a, b) => a.line_start - b.line_start)[0].line_start;
        if (firstLine) {
          const line = findElementInCurrentTab(
            `[data-line-number="${firstLine}"]`,
          );
          line?.scrollIntoView({
            behavior: 'auto',
            block: 'start',
          });
        }
      }, 500);
    }
  }, [hunks, code]);

  return (
    <div className="flex flex-col w-full flex-1 overflow-auto relative">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-auto">
          <div className="flex items-center p-1 rounded border border-bg-border bg-bg-base">
            <FileIcon filename={filePath || ''} noMargin />
          </div>
          <p className="body-s-strong text-label-title">
            {filePath.split('/').pop()}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button size="small" variant="secondary" onClick={onBack}>
            <Trans>Back</Trans>
          </Button>
        </div>
      </div>
      <div className="flex px-8 py-2 items-center gap-2 border-b border-bg-border bg-bg-sub text-label-base overflow-x-auto flex-shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden">
          <FileIcon filename={getFileExtensionForLang(repo.most_common_lang)} />
          <OverflowTracker className="auto-fade-horizontal">
            <BreadcrumbsPath
              path={`${repo.name.replace(/^github\.com\//, '')}/${filePath}`}
              repo={repo.ref}
              nonInteractive
              allowOverflow
            />
          </OverflowTracker>
          {!!branch && (
            <>
              <Branch sizeClassName="w-4 h-4" />
              <span className="caption ellipsis">
                {branch.replace(/^origin\//, '')}
              </span>
            </>
          )}
        </div>
      </div>
      <div className={`py-4 px-4 overflow-auto flex flex-col`}>
        {!!code && file && (
          <CodeFull
            isDiff
            code={code}
            language={file.lang}
            relativePath={filePath}
            repoPath={repo.ref}
            repoName={repo.name}
            containerHeight={
              window.innerHeight -
              HEADER_HEIGHT -
              SUBHEADER_HEIGHT -
              FOOTER_HEIGHT -
              VERTICAL_PADDINGS -
              BREADCRUMBS_HEIGHT
            }
            containerWidth={window.innerWidth / 2 - HORIZONTAL_PADDINGS}
          />
        )}
      </div>
    </div>
  );
};

export default memo(DiffPanel);
