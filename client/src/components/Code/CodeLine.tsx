import React, { ReactNode, useRef, memo, useMemo, CSSProperties } from 'react';

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
}: Props) => {
  const codeRef = useRef<HTMLTableCellElement>(null);
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
