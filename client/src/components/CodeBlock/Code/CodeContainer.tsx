import React, { useMemo } from 'react';
import { Range, SnippetSymbol, TokensLine } from '../../../types/results';
import CodeLine from './CodeLine';
import CodeToken from './CodeToken';

type Props = {
  lang: string;
  lineStart?: number;
  highlights?: Range[];
  showLines?: boolean;
  symbols?: SnippetSymbol[];
  onlySymbolLines?: boolean;
  removePaddings?: boolean;
  lineHoverEffect?: boolean;
  canWrap?: boolean;
  isDiff?: boolean;
  highlightColor?: string;
  tokensMap: TokensLine[];
  highlightLines?: [number, number];
};

const CodeContainer = ({
  lang,
  lineStart = 0,
  showLines = true,
  highlights,
  onlySymbolLines,
  removePaddings,
  lineHoverEffect,
  highlightColor,
  isDiff,
  symbols,
  tokensMap,
  highlightLines,
  canWrap,
}: Props) => {
  const lineNumbersAdd = useMemo(() => {
    let curr = lineStart;
    return tokensMap.map((line, i) => {
      if (
        line.tokens[0]?.token?.content === '-' ||
        line.tokens[1]?.token?.content === '-'
      ) {
        return null;
      } else {
        curr++;
        return curr;
      }
    });
  }, [tokensMap, lineStart]);
  const lineNumbersRemove = useMemo(() => {
    let curr = lineStart;
    return tokensMap.map((line, i) => {
      if (
        line.tokens[0]?.token?.content === '+' ||
        line.tokens[1]?.token?.content === '+'
      ) {
        return null;
      } else {
        curr++;
        return curr;
      }
    });
  }, [tokensMap, lineStart]);
  const getSymbols = (lineNumber: number) => {
    if (symbols?.length) {
      return symbols
        .filter((symbol) => symbol.line === lineNumber)
        .map((symbol) => symbol.kind);
    }
    return [];
  };

  const codeLines = useMemo(
    () =>
      tokensMap.map((line, lineNumber) => (
        <CodeLine
          key={lineNumber}
          lineNumber={lineStart + lineNumber}
          lineNumberToShow={line.lineNumber}
          lineNumbersDiff={
            isDiff
              ? [lineNumbersRemove[lineNumber], lineNumbersAdd[lineNumber]]
              : null
          }
          showLineNumbers={showLines}
          symbols={getSymbols(lineStart + lineNumber)}
          lineHidden={
            onlySymbolLines && !getSymbols(lineStart + lineNumber).length
          }
          hoverEffect={lineHoverEffect}
          highlightColor={highlightColor}
          removePaddings={removePaddings}
          leftHighlight={
            highlightLines &&
            lineStart + lineNumber >= highlightLines[0] &&
            lineStart + lineNumber <= highlightLines[1]
          }
          isNewLine={
            isDiff &&
            (line.tokens[0]?.token?.content === '+' ||
              line.tokens[1]?.token?.content === '+')
          }
          isRemovedLine={
            isDiff &&
            (line.tokens[0]?.token?.content === '-' ||
              line.tokens[1]?.token?.content === '-')
          }
        >
          {line.tokens.map((token, index) => (
            <CodeToken
              key={index}
              token={token.token}
              highlights={highlights}
              highlight={token.highlight}
              startHl={token.startHl}
              endHl={token.endHl}
              onClick={() => {}}
            />
          ))}
        </CodeLine>
      )),
    [
      tokensMap,
      showLines,
      highlights,
      onlySymbolLines,
      highlightColor,
      highlightLines,
      removePaddings,
    ],
  );

  return (
    <div>
      <pre
        className={`prism-code language-${lang} text-label-base my-0 ${
          removePaddings ? '' : 'px-2'
        } ${onlySymbolLines ? 'overflow-hidden' : ''} ${
          canWrap && codeLines.length < 2 ? '!whitespace-pre-wrap' : ''
        }`}
      >
        <div className="flex flex-col">{codeLines}</div>
      </pre>
    </div>
  );
};

export default CodeContainer;
