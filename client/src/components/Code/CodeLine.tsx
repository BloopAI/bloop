import React, {
  ReactNode,
  useRef,
  memo,
  useMemo,
  CSSProperties,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { markNode, unmark } from '../../utils/textSearch';
import { CODE_LINE_HEIGHT } from '../../consts/code';

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
  isSelectionDisabled?: boolean;
  setCurrentlySelectingRange?: (range: [number, number] | null) => void;
  handleAddRange?: () => void;
  fileLinesNum?: number;
  isEditingRanges?: boolean;
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
  isSelectionDisabled,
  setCurrentlySelectingRange,
  handleAddRange,
  fileLinesNum,
  isEditingRanges,
}: Props) => {
  const [isDragging, setIsDragging] = useState(false);
  const codeRef = useRef<HTMLTableCellElement>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && ref.current) {
        const deltaY = e.clientY - ref.current.getBoundingClientRect().top;
        setCurrentlySelectingRange?.([
          Math.max(
            Math.min(
              lineNumber,
              lineNumber + Math.ceil(deltaY / CODE_LINE_HEIGHT) - 1,
            ),
            0,
          ),
          Math.min(
            Math.max(
              lineNumber,
              lineNumber + Math.ceil(deltaY / CODE_LINE_HEIGHT) - 1,
            ),
            (fileLinesNum || 0) - 1,
          ),
        ]);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleAddRange?.();
    };
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, lineNumber, fileLinesNum]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isSelectionDisabled && isEditingRanges) {
        setIsDragging(true);
      }
    },
    [isSelectionDisabled, isEditingRanges],
  );

  return (
    <div
      className={`flex w-full flex-1 transition-all duration-150 ease-in-bounce group ${
        isNewLine ? 'bg-bg-success/30' : isRemovedLine ? 'bg-bg-danger/30' : ''
      } ${hoveredBackground ? 'bg-bg-base-hover' : ''} ${
        isEditingRanges
          ? isSelectionDisabled
            ? 'cursor-row-resize'
            : 'cursor-ns-resize'
          : ''
      }`}
      data-line-number={lineNumber}
      style={styleCombined}
      onMouseDown={handleMouseDown}
      ref={ref}
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
