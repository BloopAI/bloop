import React, { useEffect, useMemo } from 'react';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { Range, SnippetSymbol } from '../../../types/results';
import { Token } from '../../../types/prism';
import CodeLine from './CodeLine';
import CodeToken from './CodeToken';

type HighlightMap = {
  highlight: boolean;
  token: Token;
  startHl?: boolean;
  endHl?: boolean;
};

type Line = {
  tokens: HighlightMap[];
  lineNumber: number | null;
};

type Props = {
  code: string;
  language: string;
  lineStart?: number;
  highlights?: Range[];
  showLines?: boolean;
  symbols?: SnippetSymbol[];
  onlySymbolLines?: boolean;
  removePaddings?: boolean;
  lineHoverEffect?: boolean;
  isDiff?: boolean;
  highlightColor?: string;
  onTokensLoaded?: () => void;
};

const Code = ({
  code,
  language,
  lineStart = 0,
  showLines = true,
  highlights,
  symbols,
  onlySymbolLines,
  removePaddings,
  lineHoverEffect,
  highlightColor,
  isDiff,
  onTokensLoaded,
}: Props) => {
  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );
  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

  const getSymbols = (lineNumber: number) => {
    if (symbols?.length) {
      return symbols
        .filter((symbol) => symbol.line === lineNumber)
        .map((symbol) => symbol.kind);
    }
    return [];
  };

  const hlRangesMap = useMemo(() => {
    const hl = new Set();
    highlights?.map((range) => {
      for (let i = range.start; i < range.end; i++) {
        hl.add(i);
      }
    });
    return hl;
  }, [highlights]);

  const getMap = (tokens: Token[]): HighlightMap[] => {
    const highlightMaps: HighlightMap[] = [];
    tokens.forEach((token, index) => {
      highlightMaps.push(...getToken(token));
    });

    return highlightMaps.map((item, i) => {
      if (item.highlight) {
        item.startHl = !highlightMaps[i - 1]?.highlight;
        item.endHl = !highlightMaps[i + 1]?.highlight;
      }

      return item;
    });
  };

  const getToken = (token: Token): HighlightMap[] => {
    if (!highlights) {
      return [{ highlight: false, token }];
    }
    const highlightMap: HighlightMap[] = [];

    let byteIndex = 0;
    token.content.split('').forEach((char) => {
      const pos = token.byteRange.start + byteIndex;
      const existing = highlightMap[highlightMap.length - 1];

      if (hlRangesMap.has(pos)) {
        if (!existing || !existing.highlight) {
          highlightMap.push({
            highlight: true,
            token: {
              ...token,
              content: char,
            },
          });
        } else {
          existing.token.content += char;
        }
      } else {
        if (!existing || existing.highlight) {
          highlightMap.push({
            highlight: false,
            token: {
              ...token,
              content: char,
            },
          });
        } else {
          existing.token.content += char;
        }
      }
      byteIndex += new TextEncoder().encode(char).length;
    });

    return highlightMap;
  };

  const tokensMap = useMemo((): Line[] => {
    const lines = tokens
      .map((line) => getMap(line))
      .map((l): Line => ({ tokens: l, lineNumber: null }));
    let currentLine = lineStart;
    for (let i = 0; i < lines.length; i++) {
      if (
        isDiff &&
        !lines[i].tokens[0].token.content &&
        lines[i].tokens[1].token.content === '-'
      ) {
        continue;
      }
      lines[i].lineNumber = currentLine + 1;
      currentLine++;
    }
    return lines;
  }, [tokens, lineStart, isDiff]);

  useEffect(() => {
    if (tokensMap.length && onTokensLoaded) {
      console.log('tokensMap.length', tokensMap.length);
      onTokensLoaded();
    }
  }, [tokensMap]);

  const codeLines = useMemo(
    () =>
      tokensMap.map((line, lineNumber) => (
        <CodeLine
          key={lineNumber}
          lineNumber={lineStart + lineNumber}
          lineNumberToShow={line.lineNumber}
          showLineNumbers={showLines}
          symbols={getSymbols(lineStart + lineNumber)}
          lineHidden={
            onlySymbolLines && !getSymbols(lineStart + lineNumber).length
          }
          hoverEffect={lineHoverEffect}
          highlightColor={highlightColor}
          isNewLine={
            isDiff &&
            !line.tokens[0].token.content &&
            line.tokens[1].token.content === '+'
          }
          isRemovedLine={
            isDiff &&
            !line.tokens[0].token.content &&
            line.tokens[1].token.content === '-'
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
            />
          ))}
        </CodeLine>
      )),
    [tokensMap, showLines, highlights, onlySymbolLines, highlightColor],
  );

  return (
    <div>
      <pre
        className={`prism-code language-${lang} bg-gray-900 my-0 ${
          removePaddings ? '' : 'px-2'
        } ${onlySymbolLines ? 'overflow-hidden' : ''}`}
      >
        <div>{codeLines}</div>
      </pre>
    </div>
  );
};

export default Code;
