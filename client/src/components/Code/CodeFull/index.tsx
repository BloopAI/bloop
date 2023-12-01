import { memo, useEffect, useMemo, useState } from 'react';
import { Range } from '../../../types/results';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import CodeLine from '../CodeLine';
import CodeToken from '../CodeToken';
import { useDiffLines } from '../../../hooks/useDiffLines';

type Props = {
  code: string;
  language: string;
  hoverableRanges?: Record<number, Range[]>;
  relativePath: string;
  repoPath: string;
  repoName: string;
  isDiff?: boolean;
};

const CodeFull = ({
  code,
  isDiff,
  hoverableRanges,
  repoName,
  repoPath,
  relativePath,
  language,
}: Props) => {
  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );
  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

  const { lineNumbersAdd, lineNumbersRemove } = useDiffLines(tokens);

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
