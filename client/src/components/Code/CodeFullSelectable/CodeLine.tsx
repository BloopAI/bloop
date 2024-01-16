import React, {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  memo,
  useState,
} from 'react';
import { markNode, unmark } from '../../../utils/textSearch';
import { CODE_LINE_HEIGHT } from '../../../consts/code';

type Props = {
  lineNumber: number;
  children: ReactNode;
  stylesGenerated?: any;
  searchTerm?: string;
  isSelectionDisabled: boolean;
  setCurrentlySelectingRange: (range: [number, number] | null) => void;
  handleAddRange: () => void;
  fileLinesNum: number;
  shouldHighlight?: boolean;
};

const CodeLine = ({
  lineNumber,
  children,
  stylesGenerated,
  searchTerm,
  isSelectionDisabled,
  setCurrentlySelectingRange,
  handleAddRange,
  fileLinesNum,
  shouldHighlight,
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

  const style = useMemo(
    () => ({
      borderLeft: `3px solid ${
        shouldHighlight ? 'rgb(var(--yellow))' : 'transparent'
      }`,
      ...stylesGenerated,
    }),
    [stylesGenerated, shouldHighlight],
  );
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && ref.current) {
        const deltaY = e.clientY - ref.current.getBoundingClientRect().top;
        setCurrentlySelectingRange([
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
            fileLinesNum - 1,
          ),
        ]);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleAddRange();
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
  return (
    <div
      className={`flex transition-all duration-150 ease-in-bounce group ${
        isSelectionDisabled ? 'cursor-row-resize' : 'cursor-ns-resize'
      } relative z-0`}
      data-line-number={lineNumber}
      style={style}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!isSelectionDisabled) {
          setIsDragging(true);
        }
      }}
      ref={ref}
    >
      <div
        data-line={lineNumber + 1}
        className={`min-w-[27px] text-right select-none pr-0 leading-5 group-hover:text-label-base text-label-muted before:content-[attr(data-line)] `}
      />
      <div className={`pl-2 flex-1`} ref={codeRef}>
        {children}
      </div>
    </div>
  );
};
export default memo(CodeLine);
