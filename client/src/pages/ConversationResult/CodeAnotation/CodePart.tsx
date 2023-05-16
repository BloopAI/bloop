import React, { useEffect, useMemo, useState } from 'react';
import { FileResponse } from '../../../types/api';
import LiteLoader from '../../../components/Loaders/LiteLoader';
import CodeContainer from '../../../components/CodeBlock/Code/CodeContainer';
import { TokensLine } from '../../../types/results';
import { colors } from './index';

type Props = {
  filePath: string;
  startLine: number;
  endLine: number;
  i: number;
  isLast: boolean;
  onResultClick: (path: string, lineNum?: number[]) => void;
  lang?: string;
  tokensMap: TokensLine[];
};

const CodePart = ({
  filePath,
  startLine,
  endLine,
  i,
  isLast,
  onResultClick,
  lang,
  tokensMap,
}: Props) => {
  const slicedTokensMap = useMemo(() => {
    if (startLine !== null && endLine !== null) {
      return tokensMap.slice(Math.max(startLine - 1, 0), Math.max(1, endLine));
    }
    return undefined;
  }, [tokensMap, startLine, endLine]);

  return (
    <div
      id={`code-${i}`}
      data-last={isLast.toString()}
      style={{ scrollMarginTop: 80 }}
    >
      {!slicedTokensMap?.length && (
        <div className="flex flex-col items-center py-8">
          <LiteLoader sizeClassName="w-7 h-7" />
          <p className="body-s text-label-base">Loading code line ranges...</p>
        </div>
      )}
      <div
        className={`${
          !slicedTokensMap?.length ? 'opacity-0' : 'opacity-100'
        } cursor-pointer`}
        onClick={(e) => {
          if (slicedTokensMap?.length) {
            e.stopPropagation();
            onResultClick(filePath, [Math.max(startLine - 1, 0), endLine - 1]);
          }
        }}
      >
        {slicedTokensMap?.length && (
          <CodeContainer
            lineStart={startLine - 1}
            tokensMap={slicedTokensMap}
            lang={lang || 'plaintext'}
            highlightColor={`rgba(${colors[i % colors.length].join(', ')}, 1)`}
          />
        )}
      </div>
      {!isLast ? (
        <pre className={`bg-bg-sub my-0 px-2`}>
          <table>
            <tbody>
              <tr className="token-line">
                <td className={`w-0 px-1 text-center`} />
                <td className="text-label-muted min-w-6 text-right	text-l select-none">
                  ..
                </td>
              </tr>
            </tbody>
          </table>
        </pre>
      ) : (
        ''
      )}
    </div>
  );
};

export default CodePart;
