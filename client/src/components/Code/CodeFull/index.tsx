import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Range } from '../../../types/results';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import CodeLine from '../CodeLine';
import CodeToken from '../CodeToken';
import { useDiffLines } from '../../../hooks/useDiffLines';
import { findElementInCurrentTab } from '../../../utils/domUtils';

type Props = {
  code: string;
  language: string;
  hoverableRanges?: Record<number, Range[]>;
  relativePath: string;
  repoPath: string;
  repoName: string;
  isDiff?: boolean;
  scrollToLine?: string;
};

const CodeFull = ({
  code,
  isDiff,
  hoverableRanges,
  repoName,
  repoPath,
  relativePath,
  language,
  scrollToLine,
}: Props) => {
  const firstRender = useRef(true);
  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );
  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

  const { lineNumbersAdd, lineNumbersRemove } = useDiffLines(tokens);

  const scrollToIndex = useMemo(() => {
    return scrollToLine?.split('_').map((s) => Number(s)) as
      | [number, number]
      | undefined;
  }, [scrollToLine]);

  useEffect(() => {
    if (scrollToIndex) {
      let scrollToItem = scrollToIndex[0];
      // eslint-disable-next-line no-undef
      let align: ScrollLogicalPosition = 'center';
      let multiline = scrollToIndex[1] && scrollToIndex[0] !== scrollToIndex[1];
      if (multiline && scrollToIndex[1] - scrollToIndex[0] < 8) {
        scrollToItem =
          scrollToIndex[0] +
          Math.floor((scrollToIndex[1] - scrollToIndex[0]) / 2);
      } else if (multiline) {
        align = 'start';
      }
      scrollToItem = Math.max(0, Math.min(scrollToItem, tokens.length - 1));
      let line = findElementInCurrentTab(
        `[data-line-number="${scrollToItem}"]`,
      );
      line?.scrollIntoView({
        behavior: firstRender.current ? 'auto' : 'smooth',
        block: align,
      });
    }
  }, [scrollToIndex, tokens.length]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, []);

  return (
    <div>
      <pre className={`prism-code language-${lang} w-full h-full code-s`}>
        <code>
          {tokens.map((line, index) => {
            return (
              <CodeLine
                key={relativePath + '-' + index.toString()}
                lineNumber={index}
                showLineNumbers={true}
                hoverEffect
                shouldHighlight={
                  !!scrollToIndex &&
                  index >= scrollToIndex[0] &&
                  index <= scrollToIndex[1]
                }
                isNewLine={
                  isDiff &&
                  (line[0]?.content === '+' || line[1]?.content === '+')
                }
                isRemovedLine={
                  isDiff &&
                  (line[0]?.content === '-' || line[1]?.content === '-')
                }
                lineNumbersDiff={
                  isDiff
                    ? [lineNumbersRemove[index], lineNumbersAdd[index]]
                    : null
                }
              >
                {line.map((token, i) => (
                  <CodeToken
                    key={`cell-${index}-${i}`}
                    // lineHoverRanges={hoverableRanges?.[index] || []}
                    token={token}
                    // getHoverableContent={getHoverableContent}
                  />
                ))}
              </CodeLine>
            );
          })}
        </code>
      </pre>
    </div>
  );
};

export default memo(CodeFull);
