import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import FoldButton from '../CodeFull/FoldButton';
import Tooltip from '../../Tooltip';
import SymbolIcon from '../../CodeSymbolIcon';
import { SymbolType } from '../../../types/results';
import { Commit } from '../../../types';
import { markNode, unmark } from '../../../utils/textSearch';
import { propsAreShallowEqual } from '../../../utils';

type Props = {
  lineNumber: number;
  lineNumberToShow?: number | null;
  children: ReactNode;
  showLineNumbers?: boolean;
  lineFoldable?: boolean;
  handleFold?: (state: boolean, line: number) => void;
  lineHidden?: boolean;
  symbols?: SymbolType[];
  hoverEffect?: boolean;
  blame?: boolean;
  blameLine?: {
    start: boolean;
    commit?: Commit;
  };
  stylesGenerated?: any;
  shouldHighlight?: boolean;
  isNewLine?: boolean;
  isRemovedLine?: boolean;
  searchTerm?: string;
  onMouseSelectStart?: (lineNum: number, charNum: number) => void;
  onMouseSelectEnd?: (lineNum: number, charNum: number) => void;
  highlightColor?: string | null;
  leftHighlight?: boolean;
  removePaddings?: boolean;
};

const CodeLine = ({
  lineNumber,
  showLineNumbers,
  children,
  lineFoldable,
  handleFold,
  lineHidden,
  blameLine,
  symbols,
  hoverEffect,
  stylesGenerated,
  shouldHighlight,
  searchTerm,
  onMouseSelectStart,
  onMouseSelectEnd,
  highlightColor,
  isNewLine,
  isRemovedLine,
  lineNumberToShow = lineNumber + 1,
  leftHighlight,
  removePaddings,
}: Props) => {
  const codeRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (codeRef.current && searchTerm) {
      markNode(codeRef.current, new RegExp(searchTerm, 'gi'));
    }
    return () => {
      if (codeRef.current) {
        unmark(codeRef.current);
      }
    };
  }, [searchTerm]);

  const blameStyle = useMemo(() => {
    if (blameLine?.start) {
      return '';
    } else if (blameLine?.start === false) {
      return 'p-0 pb-1 align-top';
    }
    return '';
  }, [blameLine?.start]);

  const style = useMemo(
    () => ({
      lineHeight: lineHidden ? '0' : '',
      borderLeft: `3px solid ${
        leftHighlight || shouldHighlight
          ? highlightColor || '#EAB408'
          : 'transparent'
      }`,
      ...stylesGenerated,
    }),
    [
      lineHidden,
      stylesGenerated,
      highlightColor,
      leftHighlight,
      shouldHighlight,
    ],
  );
  const [actualLineNumber] = useState(lineNumber);

  const getCharIndex = useCallback((e: React.MouseEvent) => {
    const cell = codeRef.current;
    if (!cell) {
      return 0;
    }
    const text = cell.innerText;
    const cellRect = cell.getBoundingClientRect();
    const mouseX = e.clientX;
    const relativeX = mouseX - cellRect?.left;

    const font = window.getComputedStyle(cell).font;

    const temp = document.createElement('pre');
    temp.style.font = font;
    temp.style.paddingLeft = '0.5rem';
    temp.style.position = 'fixed';
    temp.style.left = '0';
    temp.style.top = '80px';

    text.split('').forEach((char) => {
      const el = document.createElement('span');
      el.innerText = char;
      temp.appendChild(el);
    });
    document.body.appendChild(temp);

    const range = document.createRange();
    range.setStart(temp, 0);
    range.setEnd(temp, temp.childNodes.length - 1);
    const rects = Array.from(temp.childNodes).map((c) =>
      (c as Element).getBoundingClientRect(),
    );

    let index = 0;
    for (let i = 0; i < rects.length; i++) {
      if (relativeX >= rects[i].left && relativeX < rects[i].right) {
        index = relativeX - rects[i].left > rects[i].width / 2 ? i + 1 : i;
        break;
      }
    }
    if (relativeX > rects[rects.length - 1].left) {
      index = rects.length - 1;
    }
    document.body.removeChild(temp);
    return index;
  }, []);

  return (
    <div
      className={`flex transition-all duration-150 ease-in-bounce group hover:bg-transparent ${
        lineHidden ? 'opacity-0' : ''
      } ${
        blameLine?.start && lineNumber !== 0 ? ' border-t border-bg-border' : ''
      }`}
      data-line-number={lineNumber}
      style={style}
      onMouseDown={(e) => {
        const index = getCharIndex(e);

        onMouseSelectStart?.(lineNumber, index);
      }}
      onMouseUp={(e) => {
        const index = getCharIndex(e);
        onMouseSelectEnd?.(lineNumber, index);
      }}
    >
      {symbols?.length ? (
        <div
          className={`peer text-center text-purple ${lineHidden ? 'p-0' : ''}`}
        >
          <span className="flex flex-row gap-1">
            {symbols.length > 1 ? (
              <Tooltip
                text={
                  <div>
                    {symbols.map((symbol, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <SymbolIcon type={symbol} />
                        <span className="caption text-label-title py-1">
                          {symbol.charAt(0).toUpperCase()}
                          {symbol.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                }
                placement="top"
              >
                <SymbolIcon type="multiple" />
              </Tooltip>
            ) : (
              <Tooltip text={symbols[0]} placement="top">
                <SymbolIcon type={symbols[0]} />
              </Tooltip>
            )}
          </span>
        </div>
      ) : (
        <div
          className={`${
            showLineNumbers && !removePaddings ? 'px-1' : ''
          } text-center ${lineHidden ? 'p-0' : ''} ${
            isRemovedLine
              ? 'bg-bg-danger/30'
              : isNewLine
              ? 'bg-bg-success/30'
              : ''
          }`}
        />
      )}
      {showLineNumbers && (
        <div
          data-line={lineNumberToShow}
          className={`min-w-[27px] text-right select-none pr-0 leading-5 ${blameStyle} ${
            lineHidden ? 'p-0' : ''
          } ${hoverEffect ? 'group-hover:text-label-base' : ''}
           ${
             lineHidden || !lineNumberToShow
               ? ''
               : 'before:content-[attr(data-line)]'
           } ${
            isRemovedLine
              ? 'bg-bg-danger/30 text-label-base'
              : isNewLine
              ? 'bg-bg-success/30 text-label-base'
              : 'text-label-muted'
          }`}
        />
      )}
      <div
        className={`text-label-muted ${lineHidden ? 'p-0' : ''} ${blameStyle}`}
      >
        {lineFoldable && (
          <FoldButton
            onClick={(folded: boolean) => {
              if (handleFold) {
                handleFold(!folded, actualLineNumber);
              }
            }}
          />
        )}
      </div>
      <div
        className={`${showLineNumbers ? 'pl-2' : ''} ${
          lineHidden ? 'p-0' : ''
        }`}
        ref={codeRef}
        style={
          isNewLine
            ? { backgroundColor: 'rgba(var(--bg-success), 0.3)' }
            : isRemovedLine
            ? { backgroundColor: 'rgba(var(--bg-danger), 0.3)' }
            : {}
        }
      >
        {children}
      </div>
    </div>
  );
};
export default memo(CodeLine, propsAreShallowEqual);
