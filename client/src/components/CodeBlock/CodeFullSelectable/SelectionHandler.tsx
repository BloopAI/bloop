import React, { useState, useRef, useEffect, memo } from 'react';
import { CODE_LINE_HEIGHT } from '../../../consts/code';

type Props = {
  initialRange: [number, number];
  updateRange: (i: number, range: [number, number]) => void;
  i: number;
  deleteRange: (i: number) => void;
};

const SelectionHandler = ({
  initialRange,
  updateRange,
  i,
  deleteRange,
}: Props) => {
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [range, setRange] = useState(initialRange);
  const [position, setPosition] = useState(0);
  const startHandlerRef = useRef<HTMLDivElement>(null);
  const endHandlerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRange(initialRange);
  }, [initialRange]);

  const handleMouseDownStart = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStart(true);
  };
  const handleMouseDownEnd = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnd(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingStart && startHandlerRef.current) {
        const deltaY =
          e.clientY - startHandlerRef.current.getBoundingClientRect().top;
        const newRange: [number, number] = [
          Math.min(
            Math.max(range[0] + Math.round(deltaY / CODE_LINE_HEIGHT), 0),
            range[1] + 1,
          ),
          range[1],
        ];
        setRange(newRange);
        setPosition(position + deltaY);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingStart(false);
      if (range[0] > range[1]) {
        deleteRange(i);
      } else {
        updateRange(i, range);
      }
    };
    if (isDraggingStart) {
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
  }, [isDraggingStart, i, range]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingEnd && endHandlerRef.current) {
        const deltaY =
          e.clientY - endHandlerRef.current.getBoundingClientRect().top;
        const newRange: [number, number] = [
          range[0],
          Math.max(
            range[1] + Math.round(deltaY / CODE_LINE_HEIGHT),
            range[0] - 1,
          ),
        ];
        setRange(newRange);
        setPosition(position + deltaY);
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingEnd(false);
      if (range[0] > range[1]) {
        deleteRange(i);
      } else {
        updateRange(i, range);
      }
    };
    if (isDraggingEnd) {
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
  }, [isDraggingEnd, i, range]);

  return (
    <>
      <div
        ref={startHandlerRef}
        className={`absolute -left-0.5 w-5 h-1 bg-bg-main rounded-tl rounded-tr cursor-row-resize z-10`}
        style={{
          top: `${range[0] * CODE_LINE_HEIGHT - 2}px`,
        }}
        onMouseDown={handleMouseDownStart}
      />
      <div
        ref={endHandlerRef}
        className={`absolute -left-0.5 w-5 h-1 bg-bg-main rounded-bl rounded-br cursor-row-resize z-10`}
        style={{
          top: `${range[1] * CODE_LINE_HEIGHT + CODE_LINE_HEIGHT}px`,
        }}
        onMouseDown={handleMouseDownEnd}
      />
    </>
  );
};

export default memo(SelectionHandler);
