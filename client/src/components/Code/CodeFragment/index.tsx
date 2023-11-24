import React, { memo, useMemo } from 'react';
import CodeLine from '../CodeLine';
import CodeToken from '../CodeToken';
import { HighlightMap, Range, TokensLine } from '../../../types/results';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import { Token } from '../../../types/prism';

type Props = {
  code: string;
  language: string;
  lineStart?: number;
  highlights?: Range[];
  showLines?: boolean;
  removePaddings?: boolean;
  lineHoverEffect?: boolean;
  isDiff?: boolean;
  canWrap?: boolean;
  highlightColor?: string;
};

const CodeFragment = ({
  code,
  language,
  lineStart = 0,
  showLines = true,
  highlights,
  removePaddings,
  lineHoverEffect,
  highlightColor,
  isDiff,
  canWrap,
}: Props) => {
  const lang = useMemo(
    () => getPrismLanguage(language) || 'plaintext',
    [language],
  );
  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);

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
    tokens.forEach((token) => {
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

  const tokensMap = useMemo((): TokensLine[] => {
    const lines = tokens
      .map((line) => getMap(line))
      .map((l): TokensLine => ({ tokens: l, lineNumber: null }));
    let currentLine = lineStart;
    for (let i = 0; i < lines.length; i++) {
      if (
        isDiff &&
        (lines[i].tokens[0]?.token.content === '-' ||
          lines[i].tokens[1]?.token.content === '-')
      ) {
        continue;
      }
      lines[i].lineNumber = currentLine + 1;
      currentLine++;
    }
    return lines;
  }, [tokens, lineStart, isDiff]);

  const lineNumbersAdd = useMemo(() => {
    let curr = lineStart;
    return tokensMap.map((line) => {
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
    return tokensMap.map((line) => {
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
          hoverEffect={lineHoverEffect}
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
              highlight={token.highlight}
              startHl={token.startHl}
              endHl={token.endHl}
              onClick={() => {}}
            />
          ))}
        </CodeLine>
      )),
    [tokensMap, showLines, highlights, highlightColor, removePaddings],
  );
  return (
    <div>
      <pre
        className={`prism-code language-${lang} text-label-base my-0 ${
          removePaddings ? '' : 'px-2'
        } ${canWrap && codeLines.length < 2 ? '!whitespace-pre-wrap' : ''}`}
      >
        <div className="flex flex-col">{codeLines}</div>
      </pre>
    </div>
  );
};

export default memo(CodeFragment);
