import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import FileIcon from '../../FileIcon';
import Code from '../Code';
import { ResultClick, Snippet } from '../../../types/results';
import Button from '../../Button';
import BreadcrumbsPath from '../../BreadcrumbsPath';
import { DeviceContext } from '../../../context/deviceContext';
import { FileTreeFileType } from '../../../types';
import FileMenu from '../../FileMenu';

type Props = {
  snippets: Snippet[];
  language: string;
  filePath: string;
  branch: string;
  repoName: string;
  repoPath: string;
  collapsed?: boolean;
  onClick?: ResultClick;
  hideDropdown?: boolean;
  hideMatchCounter?: boolean;
};

const PREVIEW_NUM = 3;

const countHighlights = (snippets: Snippet[]) => {
  return snippets.reduce((acc: number, item) => {
    return acc + (item.highlights?.length || 0);
  }, 0);
};

const CodeBlockSearch = ({
  snippets,
  language,
  filePath,
  collapsed,
  onClick,
  repoName,
  repoPath,
  hideDropdown,
  hideMatchCounter,
}: Props) => {
  const { t } = useTranslation();
  const [isExpanded, setExpanded] = useState(false);
  const { os, openFolderInExplorer, openLink } = useContext(DeviceContext);

  const handleMouseUp = useCallback(
    (startLine?: number, endLine?: number) => {
      if (!document.getSelection()?.toString()) {
        onClick?.(
          repoName,
          filePath,
          startLine !== undefined && endLine !== undefined
            ? [startLine, endLine]
            : undefined,
        );
      }
    },
    [onClick],
  );

  const totalMatches = useMemo(() => {
    return countHighlights(snippets);
  }, [snippets]);

  const hiddenMatches = useMemo(() => {
    if (snippets.length > PREVIEW_NUM) {
      return countHighlights(snippets.slice(PREVIEW_NUM));
    }
    return 0;
  }, [snippets]);

  return (
    <div className="w-full border border-bg-border rounded-4">
      <div className="w-full flex justify-between rounded-tl-4 rounded-tr-4 bg-bg-shade px-3 h-13 border-b border-bg-border gap-2">
        <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full">
          <FileIcon filename={filePath} />
          <BreadcrumbsPath
            path={filePath}
            repo={repoName}
            onClick={(path, type) =>
              type === FileTreeFileType.FILE ? handleMouseUp() : {}
            }
          />
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          {!hideMatchCounter ? (
            <span className="body-s text-label-title">
              <Trans count={totalMatches}># match</Trans>
            </span>
          ) : (
            ''
          )}
          {!hideDropdown && !repoPath.startsWith('github') && (
            <FileMenu repoPath={'local/' + repoPath} relativePath={filePath} />
          )}
        </div>
      </div>

      <div
        className={`bg-bg-sub text-label-muted text-xs border-bg-border ${
          collapsed ? 'py-2' : 'py-4'
        } ${onClick ? 'cursor-pointer' : ''} w-full overflow-auto`}
      >
        <div>
          {(isExpanded ? snippets : snippets.slice(0, PREVIEW_NUM)).map(
            (snippet, index) => (
              <span
                key={index}
                onMouseUp={() =>
                  handleMouseUp(
                    snippet.lineStart,
                    snippet.lineStart !== undefined
                      ? snippet.lineStart + snippet.code.split('\n').length
                      : undefined,
                  )
                }
              >
                <Code
                  lineStart={snippet.lineStart}
                  code={snippet.code}
                  language={language}
                  highlights={snippet.highlights}
                  symbols={snippet.symbols}
                  onlySymbolLines={collapsed}
                />
                {index !== snippets.length - 1 ? (
                  collapsed ? (
                    <span className="w-full border-t border-bg-border block my-2" />
                  ) : (
                    <pre className={`bg-bg-sub my-0 px-2`}>
                      <table>
                        <tbody>
                          <tr className="token-line">
                            <td
                              className={`${
                                snippet.symbols?.length ? 'w-5' : 'w-0 px-1'
                              }  text-center`}
                            />
                            <td className="text-label-muted min-w-6 text-right text-l select-none">
                              ..
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </pre>
                  )
                ) : (
                  ''
                )}
              </span>
            ),
          )}
        </div>
        {snippets.length > PREVIEW_NUM && (
          <div
            className={`${
              isExpanded ? 'mt-2' : 'mt-[-38px] pt-6'
            } mb-1 relative flex justify-center align-center bg-gradient-to-b from-transparent via-bg-sub/90 to-bg-sub`}
          >
            <Button
              variant="secondary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
            >
              {isExpanded
                ? t('Show less')
                : t(`Show # more match`, { count: hiddenMatches })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
export default CodeBlockSearch;
