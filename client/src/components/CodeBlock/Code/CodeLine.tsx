import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import { format } from 'timeago.js';
import FoldButton from '../CodeFull/FoldButton';
import Tooltip from '../../Tooltip';
import SymbolIcon from '../../CodeSymbolIcon';
import { SymbolType } from '../../../types/results';
import { Commit } from '../../../types';
import TooltipCommit from '../../TooltipCommit';
import { markNode, unmark } from '../../../utils/textSearch';
import { propsAreShallowEqual } from '../../../utils';

type Props = {
  lineNumber: number;
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
  searchTerm?: string;
  onMouseSelectStart?: (lineNum: number, charNum: number) => void;
  onMouseSelectEnd?: (lineNum: number, charNum: number) => void;
};

const CodeLine = ({
  lineNumber,
  showLineNumbers,
  children,
  lineFoldable,
  handleFold,
  lineHidden,
  blame,
  blameLine,
  symbols,
  hoverEffect,
  stylesGenerated,
  shouldHighlight,
  searchTerm,
  onMouseSelectStart,
  onMouseSelectEnd,
}: Props) => {
  const [isHighlighted, setHighlighted] = useState(false);
  const codeRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (shouldHighlight) {
      setHighlighted(true);
      setTimeout(() => setHighlighted(false), 2000);
    }
  }, [shouldHighlight]);

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

  const renderBlameLine = useMemo(() => {
    if (blame) {
      if (blameLine?.commit && blameLine?.start) {
        return (
          <div className="p-0 pt-1 pl-2">
            <span className="flex flex-row items-center gap-2">
              <TooltipCommit
                position={'left'}
                image={blameLine.commit.image!}
                name={blameLine.commit.author}
                message={blameLine.commit.message}
                date={blameLine.commit.datetime}
                showOnClick
              >
                <img
                  className="w-5 rounded-xl cursor-pointer select-none"
                  src="/avatar.png"
                  alt=""
                />
              </TooltipCommit>
              <span className="text-gray-500 caption">
                {format(blameLine.commit.datetime)}
              </span>
            </span>
          </div>
        );
      }
    }
    return <div className={`p-0 ${blameStyle}`}></div>;
  }, [blame, blameLine]);

  const style = useMemo(
    () => ({ lineHeight: lineHidden ? '0' : '', ...stylesGenerated }),
    [lineHidden, stylesGenerated],
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
        blameLine?.start && lineNumber !== 0 ? ' border-t border-gray-700' : ''
      }`}
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
      {renderBlameLine}
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
                        <span className="caption text-gray-200 py-1">
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
        <div className={`px-1 text-center ${lineHidden ? 'p-0' : ''}`} />
      )}
      {showLineNumbers && (
        <div
          data-line={lineNumber + 1}
          className={`text-gray-500 min-w-6 text-right select-none pr-0 leading-5 ${blameStyle} ${
            lineHidden ? 'p-0' : ''
          } ${hoverEffect ? 'group-hover:text-gray-300' : ''}
           ${lineHidden ? '' : 'before:content-[attr(data-line)]'}
          `}
        ></div>
      )}
      <div className={`text-gray-500 ${lineHidden ? 'p-0' : ''} ${blameStyle}`}>
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
        className={`pl-2 ${lineHidden ? 'p-0' : ''} ${
          isHighlighted ? 'animate-flash-highlight rounded-4 pr-2' : ''
        }`}
        ref={codeRef}
      >
        {children}
      </div>
      <div>
        <br />
      </div>
    </div>
  );
};
export default memo(CodeLine, propsAreShallowEqual);
