import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Range, TokenInfoWrapped } from '../../../types/results';
import { getPrismLanguage, tokenizeCode } from '../../../utils/prism';
import CodeLine from '../CodeLine';
import { useDiffLines } from '../../../hooks/useDiffLines';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { getTokenInfo } from '../../../services/api';
import { mapTokenInfo } from '../../../mappers/results';
import { TabsContext } from '../../../context/tabsContext';
import { TabTypesEnum } from '../../../types/general';
import { useOnClickOutside } from '../../../hooks/useOnClickOutsideHook';
import RefsDefsPopup from '../../RefsDefsPopup';
import CodeToken from './Token';

type Props = {
  code: string;
  language: string;
  hoverableRanges?: Record<number, Range[]>;
  relativePath: string;
  repoRef: string;
  isDiff?: boolean;
  scrollToLine?: string;
  branch?: string | null;
  tokenRange?: string;
  highlights?: (
    | { lines: [number, number]; color: string; index: number }
    | undefined
  )[];
  hoveredLines?: [number, number] | null;
};

const CodeFull = ({
  code,
  isDiff,
  hoverableRanges,
  repoRef,
  relativePath,
  branch,
  language,
  scrollToLine,
  tokenRange,
  highlights,
  hoveredLines,
}: Props) => {
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [tokenInfo, setTokenInfo] = useState<TokenInfoWrapped>({
    data: { references: [], definitions: [] },
    hoverableRange: null,
    tokenRange: null,
    isLoading: false,
    lineNumber: -1,
  });
  const popupRef = useRef<HTMLDivElement>(null);
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  useOnClickOutside(popupRef, () => setPopupVisible(false));
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

  const getHoverableContent = useCallback(
    (hoverableRange: Range, tokenRange: Range, lineNumber?: number) => {
      if (hoverableRange && relativePath) {
        setTokenInfo({
          data: { references: [], definitions: [] },
          hoverableRange,
          tokenRange,
          lineNumber,
          isLoading: true,
        });
        getTokenInfo(
          relativePath,
          repoRef,
          hoverableRange.start,
          hoverableRange.end,
          branch ? branch : undefined,
        )
          .then((data) => {
            setTokenInfo({
              data: mapTokenInfo(data.data, relativePath),
              hoverableRange,
              tokenRange,
              lineNumber,
              isLoading: false,
            });
          })
          .catch(() => {
            setTokenInfo({
              data: { references: [], definitions: [] },
              hoverableRange,
              tokenRange,
              lineNumber,
              isLoading: false,
            });
          });
      }
    },
    [relativePath, branch],
  );

  useEffect(() => {
    if (tokenRange) {
      const [start, end] = tokenRange.split('_').map((l) => Number(l));
      getHoverableContent({ start, end }, { start, end });
    }
  }, [tokenRange, getHoverableContent]);

  const handleRefsDefsClick = useCallback(
    (lineNum: number, filePath: string, tokenRange: string) => {
      setTokenInfo({
        data: { references: [], definitions: [] },
        hoverableRange: null,
        tokenRange: null,
        isLoading: false,
        lineNumber: -1,
      });
      openNewTab({
        type: TabTypesEnum.FILE,
        path: filePath,
        repoRef,
        branch,
        scrollToLine: `${lineNum}_${lineNum}`,
        tokenRange,
      });
    },
    [openNewTab, repoRef, branch],
  );
  useEffect(() => {
    if (tokenInfo.tokenRange) {
      let tokenElem = findElementInCurrentTab(
        `[data-byte-range="${tokenInfo.tokenRange.start}-${tokenInfo.tokenRange.end}"]`,
      );
      if (tokenElem && tokenElem instanceof HTMLElement) {
        setPopupPosition({
          top: tokenElem.offsetTop + 10,
          ...(tokenElem.offsetLeft > tokenElem.offsetParent!.scrollWidth / 2
            ? {
                right:
                  tokenElem.offsetParent!.clientWidth -
                  (tokenElem.offsetLeft + tokenElem.offsetWidth),
              }
            : { left: tokenElem.offsetLeft }),
        });
        setPopupVisible(true);
      }
    } else {
      setPopupPosition(null);
    }
  }, [tokenInfo]);

  const renderedLines = useMemo(() => {
    return tokens.map((line, index) => {
      let highlightForLine = highlights
        ?.sort((a, b) =>
          a &&
          b &&
          a?.lines?.[1] - a?.lines?.[0] < b?.lines?.[1] - b?.lines?.[0]
            ? -1
            : 1,
        )
        .findIndex((h) => h && index >= h.lines[0] && index <= h.lines[1]);
      if (highlightForLine && highlightForLine < 0) {
        highlightForLine = undefined;
      }
      return (
        <CodeLine
          key={relativePath + '-' + index.toString()}
          lineNumber={index}
          showLineNumbers={true}
          hoverEffect
          shouldHighlight={
            (!!scrollToIndex &&
              index >= scrollToIndex[0] &&
              index <= scrollToIndex[1]) ||
            (highlights && highlightForLine !== undefined)
          }
          highlightColor={
            highlights && highlightForLine !== undefined
              ? highlights[highlightForLine]?.color
              : undefined
          }
          hoveredBackground={
            !!hoveredLines &&
            index >= hoveredLines[0] &&
            index <= hoveredLines[1]
          }
          isNewLine={
            isDiff && (line[0]?.content === '+' || line[1]?.content === '+')
          }
          isRemovedLine={
            isDiff && (line[0]?.content === '-' || line[1]?.content === '-')
          }
          lineNumbersDiff={
            isDiff ? [lineNumbersRemove[index], lineNumbersAdd[index]] : null
          }
        >
          {line.map((token, i) => (
            <CodeToken
              key={`cell-${index}-${i}`}
              lineHoverRanges={hoverableRanges?.[index] || []}
              token={token}
              getHoverableContent={getHoverableContent}
            />
          ))}
        </CodeLine>
      );
    });
  }, [
    tokens,
    highlights,
    hoveredLines,
    relativePath,
    scrollToIndex,
    isDiff,
    lineNumbersRemove,
    lineNumbersAdd,
    hoverableRanges,
    getHoverableContent,
  ]);

  return (
    <div className="relative">
      <pre className={`prism-code language-${lang} w-full h-full code-s`}>
        <code>{renderedLines}</code>
      </pre>
      {!!popupPosition && isPopupVisible && (
        <div className="absolute max-w-sm" style={popupPosition} ref={popupRef}>
          <RefsDefsPopup
            placement={popupPosition.right ? 'bottom-end' : 'bottom-start'}
            data={tokenInfo}
            onRefDefClick={handleRefsDefsClick}
            language={language}
            relativePath={relativePath}
          />
        </div>
      )}
    </div>
  );
};

export default memo(CodeFull);
