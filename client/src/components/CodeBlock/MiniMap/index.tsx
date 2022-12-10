import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import Code from '../Code';

type Props = {
  code: string;
  language: string;
  codeVisibleHeight: number;
  codeFullHeight: number;
  codeScroll: number;
  handleScroll: (v: number) => void;
};

export const MiniMap = ({
  code,
  language,
  codeVisibleHeight,
  codeFullHeight,
  codeScroll,
  handleScroll,
}: Props) => {
  const [minimapCursor, setMinimapCursor] = useState(0);
  const [mapCodeHeight, setMapCodeHeight] = useState(0);
  const [cursorHeight, setCursorHeight] = useState(0);
  const minimapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMinimapCursor(codeScroll / (mapCodeHeight * 0.01));
  }, [codeScroll]);

  useEffect(() => {
    setMapCodeHeight(minimapRef.current?.getBoundingClientRect().height || 0);
  }, []);

  useEffect(() => {
    setCursorHeight(
      mapCodeHeight * 0.01 * (codeVisibleHeight / (codeFullHeight * 0.01)),
    );
  }, [mapCodeHeight]);

  return (
    <div
      style={{ height: `${mapCodeHeight}px` }}
      className={`w-36 fixed group`}
    >
      <div className="absolute overflow-hidden w-[27rem]">
        <div className="scale-25 origin-top-left select-none" ref={minimapRef}>
          <Code code={code} language={language} showLines={false} />
        </div>
      </div>

      <Draggable
        axis={'y'}
        bounds={'parent'}
        position={{ x: 0, y: minimapCursor }}
        onStop={(e, data) => {
          setMinimapCursor(data.y);
          handleScroll(
            codeFullHeight * 0.01 * (data.y / (mapCodeHeight * 0.01)),
          );
        }}
      >
        <div
          style={{ height: `${Math.floor(cursorHeight)}px` }}
          className={`bg-gray-600/50 w-full z-40 group-hover:visible invisible`}
        ></div>
      </Draggable>
    </div>
  );
};

export default MiniMap;
