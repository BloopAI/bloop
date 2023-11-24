import React, { memo, useCallback, useContext, useMemo } from 'react';
import { TabTypesEnum } from '../../../../types/general';
import { CodeIcon } from '../../../../icons';
import { TabsContext } from '../../../../context/tabsContext';
import { getPrismLanguage, tokenizeCode } from '../../../../utils/prism';
import { HighlightMap, Range, TokensLine } from '../../../../types/results';
import { Token } from '../../../../types/prism';
import CodeToken from '../../../../components/Code/CodeToken';

type Props = {
  path: string;
  repoRef: string;
  lineStart: number;
  lineEnd: number;
  code: string;
  language: string;
  highlights: Range[];
};

const noOp = () => {};

const CodeLine = ({
  path,
  repoRef,
  lineStart,
  lineEnd,
  code,
  language,
  highlights,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);

  const onClick = useCallback(() => {
    openNewTab({
      type: TabTypesEnum.FILE,
      path,
      repoRef,
      scrollToLine: `${lineStart}_${lineEnd}`,
    });
  }, [path, lineEnd, lineStart, repoRef, openNewTab]);

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
      lines[i].lineNumber = currentLine + 1;
      currentLine++;
    }
    return lines;
  }, [tokens, lineStart]);

  const lineToRender = useMemo(() => {
    const ltr = tokensMap.find((l) => !!l.tokens.find((t) => t.highlight));
    const firstHighlightIndex = ltr?.tokens.findIndex((t) => t.highlight) || 0;
    if (ltr) {
      ltr.tokens = ltr.tokens.slice(Math.max(firstHighlightIndex - 2, 0));
    }
    return ltr;
  }, [tokensMap]);

  return (
    <li
      className="flex px-4 h-7 items-center gap-3 text-label-base whitespace-nowrap cursor-pointer"
      onClick={onClick}
    >
      <CodeIcon sizeClassName="w-3.5 h-3.5" />
      <p className={`code-mini prism-code language-${lang} ellipsis`}>
        {(lineToRender || tokensMap[0]).tokens.map((token, index) => (
          <CodeToken
            key={index}
            token={token.token}
            highlight={token.highlight}
            startHl={token.startHl}
            endHl={token.endHl}
            onClick={noOp}
          />
        ))}
      </p>
    </li>
  );
};

export default memo(CodeLine);
