import React, { useCallback, useEffect, useState } from 'react';
import throttle from 'lodash.throttle';
import { getPlainFromStorage, savePlainToStorage } from '../services/storage';

const useResizeableWidth = (
  localStorageKey: string,
  oppositeLocalStorageKey: string,
  defaultWidth: number,
  isRightSidebar: boolean,
) => {
  const [width, setWidth] = useState(
    Number(getPlainFromStorage(localStorageKey)) || defaultWidth,
  );

  useEffect(() => {
    const handler = throttle(
      () => {
        setWidth((prev) => {
          return Math.min(
            prev,
            (window.innerWidth -
              (Number(getPlainFromStorage(oppositeLocalStorageKey)) || 360)) /
              1.5,
          );
        });
      },
      100,
      { trailing: true, leading: false },
    );
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
    };
  }, []);

  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startWidth = width;
    const startPosition = isRightSidebar ? e.pageX : e.pageX - startWidth;
    let finalWidth = startWidth;

    function onMouseMove(mouseMoveEvent: MouseEvent) {
      mouseMoveEvent.preventDefault();
      const pageX = isRightSidebar
        ? mouseMoveEvent.pageX
        : Math.min(mouseMoveEvent.pageX, window.innerWidth / 3); // Adjust pageX for left sidebar
      finalWidth = Math.min(
        Math.max(
          isRightSidebar
            ? startWidth + startPosition - pageX
            : pageX - startPosition,
          200,
        ),
        (window.innerWidth -
          (Number(getPlainFromStorage(oppositeLocalStorageKey)) || 360)) /
          1.5,
      );
      setWidth(finalWidth);
    }
    function onMouseUp(e: MouseEvent) {
      e.stopPropagation();
      savePlainToStorage(localStorageKey, finalWidth);
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseup', onMouseUp, true);
    }

    document.body.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseup', onMouseUp, true);
  };

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWidth(defaultWidth);
    savePlainToStorage(localStorageKey, defaultWidth);
  }, []);

  return { width, handleResize, handleReset };
};

export default useResizeableWidth;
