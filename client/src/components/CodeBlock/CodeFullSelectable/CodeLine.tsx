import React, { ReactNode, useEffect, useMemo, useRef, memo } from 'react';
import { markNode, unmark } from '../../../utils/textSearch';

type Props = {
  lineNumber: number;
  children: ReactNode;
  stylesGenerated?: any;
  searchTerm?: string;
  onMouseSelectStart?: (lineNum: number) => void;
  onMouseSelectEnd?: (lineNum: number) => void;
};

const CodeLine = ({
  lineNumber,
  children,
  stylesGenerated,
  searchTerm,
  onMouseSelectStart,
  onMouseSelectEnd,
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

  const style = useMemo(
    () => ({
      borderLeft: `3px solid transparent`,
      ...stylesGenerated,
    }),
    [stylesGenerated],
  );
  return (
    <div
      className={`flex transition-all duration-150 ease-in-bounce group`}
      data-line-number={lineNumber}
      style={style}
      onMouseDown={() => {
        onMouseSelectStart?.(lineNumber);
      }}
      onMouseUp={() => {
        onMouseSelectEnd?.(lineNumber);
      }}
    >
      <div
        data-line={lineNumber + 1}
        className={`min-w-[27px] text-right select-none pr-0 leading-5 group-hover:text-label-base before:content-[attr(data-line)] text-label-muted`}
      />
      <div className={`pl-2`} ref={codeRef}>
        {children}
      </div>
    </div>
  );
};
export default memo(CodeLine);
