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
  onMouseSelectStart?: (lineNum: number) => void;
  onMouseSelectEnd?: (lineNum: number) => void;
  isSelected: boolean;
  setCurrentlySelectingLine: (line: number) => void;
};

const CodeLine = ({
  lineNumber,
  children,
  stylesGenerated,
  searchTerm,
  onMouseSelectStart,
  onMouseSelectEnd,
  isSelected,
  setCurrentlySelectingLine,
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
      borderLeft: `3px solid transparent`,
      ...stylesGenerated,
    }),
    [stylesGenerated],
  );
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && ref.current) {
        const deltaY = e.clientY - ref.current.getBoundingClientRect().top;
        setCurrentlySelectingLine(
          lineNumber + Math.ceil(deltaY / CODE_LINE_HEIGHT) - 1,
        );
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setCurrentlySelectingLine(0);
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
  }, [isDragging, lineNumber]);
  return (
    <div
      className={`flex transition-all duration-150 ease-in-bounce group cursor-ns-resize ${
        isSelected ? 'bg-bg-main/30' : ''
      } relative z-0`}
      data-line-number={lineNumber}
      style={style}
      onMouseDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
        onMouseSelectStart?.(lineNumber);
      }}
      onMouseUp={(e) => {
        e.preventDefault();
        onMouseSelectEnd?.(lineNumber);
      }}
      ref={ref}
    >
      <div
        data-line={lineNumber + 1}
        className={`min-w-[27px] text-right select-none pr-0 leading-5 group-hover:text-label-base ${
          isSelected ? 'text-label-base' : 'text-label-muted'
        } before:content-[attr(data-line)] `}
      />
      <div className={`pl-2`} ref={codeRef}>
        {children}
      </div>
    </div>
  );
};
export default memo(CodeLine);
