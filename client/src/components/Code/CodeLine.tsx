import React, {
  ReactNode,
  useRef,
  memo,
  useMemo,
  CSSProperties,
  useEffect,
} from 'react';
import { markNode, unmark } from '../../utils/textSearch';

type Props = {
  lineNumber: number;
  lineNumberToShow?: number | null;
  lineNumbersDiff?: [number | null, number | null] | null;
  children: ReactNode;
  showLineNumbers?: boolean;
  hoverEffect?: boolean;
  isNewLine?: boolean;
  isRemovedLine?: boolean;
  shouldHighlight?: boolean;
  hoveredBackground?: boolean;
  highlightColor?: string | null;
  style?: CSSProperties;
  searchTerm?: string;
};

const CodeLine = ({
  lineNumber,
  showLineNumbers,
  children,
  hoverEffect,
  isNewLine,
  isRemovedLine,
  lineNumberToShow = lineNumber + 1,
  lineNumbersDiff,
  shouldHighlight,
  highlightColor,
  hoveredBackground,
  style,
  searchTerm,
}: Props) => {
  const codeRef = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (codeRef.current && searchTerm) {
      markNode(
        codeRef.current,
        new RegExp(
          searchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'),
          'gi',
        ),
      );
    }
    return () => {
      if (codeRef.current) {
        unmark(codeRef.current);
      }
    };
  }, [searchTerm]);

  const styleCombined = useMemo(
    () => ({
      ...style,
      borderLeft: `3px solid ${
        shouldHighlight ? highlightColor || 'rgb(var(--yellow))' : 'transparent'
      }`,
    }),
    [shouldHighlight, highlightColor, style],
  );

  return (
    <div
      className={`flex w-full flex-1 transition-all duration-150 ease-in-bounce group ${
        isNewLine ? 'bg-bg-success/30' : isRemovedLine ? 'bg-bg-danger/30' : ''
      } ${hoveredBackground ? 'bg-bg-base-hover' : ''}`}
      data-line-number={lineNumber}
      style={styleCombined}
    >
      {showLineNumbers &&
        (lineNumbersDiff ? (
          lineNumbersDiff.map((ln, i) => (
            <div
              key={i}
              data-line={ln}
              className={`min-w-[27px] text-right select-none pr-0 leading-5 ${
                hoverEffect ? 'group-hover:text-label-base' : ''
              } before:content-[attr(data-line)] ${
                isRemovedLine
                  ? 'text-label-base'
                  : isNewLine
                  ? 'text-label-base'
                  : 'text-label-muted'
              }`}
            />
          ))
        ) : (
          <div
            data-line={lineNumberToShow}
            className={`min-w-[27px] text-right select-none pr-0 leading-5 ${
              hoverEffect ? 'group-hover:text-label-base' : ''
            }
           ${!lineNumberToShow ? '' : 'before:content-[attr(data-line)]'} ${
             isRemovedLine
               ? 'text-label-base'
               : isNewLine
               ? 'text-label-base'
               : 'text-label-muted'
           }`}
          />
        ))}
      <div className={`${showLineNumbers ? 'pl-2' : ''} flex-1`} ref={codeRef}>
        {children}
      </div>
    </div>
  );
};

export default memo(CodeLine);
