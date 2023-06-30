import React, { useEffect, useMemo } from 'react';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import {
  HighlightMap,
  Range,
  SnippetSymbol,
  TokensLine,
} from '../../../types/results';
import { Token } from '../../../types/prism';
import CodeContainer from './CodeContainer';

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
  canWrap?: boolean;
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

  useEffect(() => {
    if (tokensMap.length && onTokensLoaded) {
      onTokensLoaded();
    }
  }, [tokensMap]);

  return (
    <CodeContainer
      lang={lang}
      tokensMap={tokensMap}
      symbols={symbols}
      onlySymbolLines={onlySymbolLines}
      highlights={highlights}
      highlightColor={highlightColor}
      lineStart={lineStart}
      showLines={showLines}
      isDiff={isDiff}
      lineHoverEffect={lineHoverEffect}
      removePaddings={removePaddings}
      canWrap={canWrap}
    />
  );
};

export default Code;
