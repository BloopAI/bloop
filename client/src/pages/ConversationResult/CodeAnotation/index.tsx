import React, { useCallback, useContext, useState, useEffect } from 'react';
import { FileModalContext } from '../../../context/fileModalContext';
import { repositionAnnotationsOnScroll } from '../../../utils/scrollUtils';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import AnnotatedFile from './AnnotatedFile';
import FileComment from './FileComment';

export type Comment = {
  start_line: number;
  end_line: number;
  comment: string;
  i: number;
  top?: number;
};

type Props = {
  repoName: string;
  citations: Record<string, Comment[]>;
};

export const colors = [
  [253, 201, 0],
  [14, 164, 233],
  [236, 72, 153],
  [132, 204, 23],
  [139, 92, 246],
  [20, 184, 166],
];

const CodeAnnotation = ({ repoName, citations }: Props) => {
  const { openFileModal } = useContext(FileModalContext);
  const [collapsedFiles, setCollapsedFiles] = useState<number[]>([]);
  const [fullExpandedFiles, setFullExpandedFiles] = useState<number[]>([]);

  const onResultClick = useCallback(
    (path: string, lineNumber?: number[], color?: string) => {
      openFileModal(path, lineNumber?.join('_'), color);
    },
    [repoName],
  );

  useEffect(() => {
    const scrollTop = findElementInCurrentTab(
      '#results-page-container',
    )?.scrollTop;
    if (scrollTop) {
      repositionAnnotationsOnScroll(scrollTop, citations);
    }
  }, [collapsedFiles, fullExpandedFiles]);

  return (
    <div className="flex gap-3 w-full overflow-x-hidden">
      <div className="flex flex-col gap-3 flex-1 overflow-hidden">
        {Object.keys(citations).map((filePath, index) => (
          <AnnotatedFile
            key={filePath}
            repoName={repoName}
            filePath={filePath}
            onResultClick={onResultClick}
            cites={citations[filePath]}
            index={index}
            onCollapse={() => setCollapsedFiles((prev) => [...prev, index])}
            onExpand={() =>
              setCollapsedFiles((prev) => prev.filter((fi) => fi !== index))
            }
            isCollapsed={collapsedFiles.includes(index)}
            onFullExpand={() =>
              setFullExpandedFiles((prev) => [...prev, index])
            }
            onFullCollapse={() =>
              setFullExpandedFiles((prev) => prev.filter((fi) => fi !== index))
            }
            isFullExpanded={fullExpandedFiles.includes(index)}
          />
        ))}
      </div>
      <div className="relative flex flex-col gap-3 max-w-96 w-3/5 flex-grow-0 overflow-y-auto">
        {Object.keys(citations)
          .map((filePath, index) => {
            return collapsedFiles.includes(index) ||
              !fullExpandedFiles.includes(index) ? (
              <div
                key={`comment-${citations[filePath][0].i}`}
                id={`comment-${citations[filePath][0].i}`}
                className="flex flex-col gap-3 transition-all duration-75 ease-linear z-0"
              >
                {citations[filePath].map((cite, i) => (
                  <FileComment
                    i={cite.i}
                    comment={cite.comment}
                    key={`${index}-${i}`}
                    isCollapsed={collapsedFiles.includes(index)}
                    isBoxed
                    onClick={() => {
                      setFullExpandedFiles((prev) => [...prev, index]);
                      setCollapsedFiles((prev) =>
                        prev.filter((fi) => fi !== index),
                      );
                    }}
                  />
                ))}
              </div>
            ) : (
              citations[filePath].map((cite, i) => (
                <FileComment
                  i={cite.i}
                  comment={cite.comment}
                  key={`${index}-${i}`}
                  onClick={() => {
                    setFullExpandedFiles((prev) => [...prev, index]);
                    setCollapsedFiles((prev) =>
                      prev.filter((fi) => fi !== index),
                    );
                  }}
                />
              ))
            );
          })
          .flat()}
      </div>
    </div>
  );
};

export default CodeAnnotation;
