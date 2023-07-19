import React, { useState } from 'react';
import { Trans } from 'react-i18next';
import BreadcrumbsPath from '../BreadcrumbsPath';
import Code from '../CodeBlock/Code';
import { ChevronRightFilled, Def, Ref } from '../../icons';
import { RefDefDataItem } from '../../types/api';
import { TokenInfoType } from '../../types/results';
import { TypeMap } from './index';

type Props = {
  file: string;
  repoName: string;
  data: RefDefDataItem[];
  onRefDefClick: (
    lineNum: number,
    filePath: string,
    type: TokenInfoType,
    tokenName: string,
    tokenRange: string,
  ) => void;
  language: string;
  kind: TokenInfoType;
  relativePath: string;
};

const RefDefItem = ({
  file,
  repoName,
  data,
  onRefDefClick,
  language,
  kind,
  relativePath,
}: Props) => {
  const [isOpen, setOpen] = useState(true);
  return (
    <div className="[&:not(:last-child)]:border-b border-bg-border" key={file}>
      <div
        className={`px-3 py-1.5 flex items-center gap-1 cursor-pointer w-full ${
          isOpen ? 'text-label-title' : 'text-label-muted'
        }`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div
          className={`w-3.5 h-3.5 flex-shrink-0 ${
            isOpen ? 'transform rotate-90' : ''
          } transition-all duration-200`}
        >
          <ChevronRightFilled sizeClassName="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 overflow-hidden">
          {file === relativePath ? (
            <p className="select-none text-left body-s">
              <Trans>In this file</Trans>
            </p>
          ) : (
            <BreadcrumbsPath
              path={file}
              repo={repoName}
              activeStyle="secondary"
            />
          )}
        </div>
        <p className="select-none caption-strong">{data.length}</p>
      </div>
      <div
        style={{
          maxHeight: isOpen ? 32 * data.length : 0,
          animationDuration: data.length * 0.01 + 's',
        }}
        className="transition-all ease-linear overflow-hidden"
      >
        {data.map((line, i) => (
          <div
            key={i}
            className="py-1.5 px-[30px] code-s flex gap-1 items-center cursor-pointer overflow-auto"
            onClick={() =>
              onRefDefClick(
                line.snippet.line_range.start,
                file,
                line.kind,
                line.snippet.data.slice(
                  line.snippet.highlights?.[0]?.start,
                  line.snippet.highlights?.[0]?.end,
                ),
                `${line.range.start?.byte}_${line.range.end?.byte}`,
              )
            }
          >
            <div className={`text-label-muted w-3.5 h-3.5`}>
              {kind === TypeMap.DEF ? (
                <Def sizeClassName="w-3.5 h-3.5" raw />
              ) : (
                <Ref sizeClassName="w-3.5 h-3.5" raw />
              )}
            </div>
            <Code
              code={line.snippet.data}
              lineStart={line.snippet.line_range.start}
              highlights={line.snippet.highlights}
              language={language}
              removePaddings
              lineHoverEffect
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default RefDefItem;
