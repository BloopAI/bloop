import React, { useMemo } from 'react';
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
  prevPartEnd?: number | null;
  nextPartStart?: number | null;
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
  prevPartEnd,
  nextPartStart,
}: Props) => {
  const start = useMemo(
    () =>
      startLine !== null
        ? Math.max(
            startLine -
              1 -
              (!prevPartEnd
                ? 5
                : Math.max(Math.min(startLine - 1 - prevPartEnd - 5, 5), 0)),
            0,
          )
        : null,
    [startLine, prevPartEnd],
  );
  const end = useMemo(
    () =>
      endLine !== null
        ? Math.max(
            1,
            endLine -
              1 +
              (!nextPartStart
                ? 5
                : Math.max(Math.min(nextPartStart - endLine - 1, 5), 0)),
          )
        : null,
    [endLine, nextPartStart],
  );
  const slicedTokensMap = useMemo(() => {
    if (start !== null && end !== null) {
      return tokensMap.slice(start, end);
    }
    return undefined;
  }, [tokensMap, start, end]);

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
        {slicedTokensMap?.length && start !== null && (
          <CodeContainer
            lineStart={start}
            tokensMap={slicedTokensMap}
            lang={lang || 'plaintext'}
            highlightColor={`rgba(${colors[i % colors.length].join(', ')}, 1)`}
            highlightLines={[startLine - 1, endLine - 1]}
          />
        )}
      </div>
      {!isLast && (!end || !nextPartStart || end < nextPartStart - 5) ? (
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
