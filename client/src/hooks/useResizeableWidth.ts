import { useEffect, useRef } from 'react';

const useResizeableWidth = (
  isLeftSidebar: boolean,
  localStorageKey: string,
  defaultWidth: number,
  maxWidth: number,
  minWidth = 5,
) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const divider = dividerRef.current;

    const savedPanelSize = Number(localStorage.getItem(localStorageKey));
    if (panel) {
      panel.style.width = `${savedPanelSize || defaultWidth}%`;
    }

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();

      const handleMouseMove = (e: MouseEvent) => {
        if (panel && divider) {
          const containerWidth =
            panel.parentElement?.getBoundingClientRect().width ||
            window.innerWidth;
          let newPanelWidth =
            ((isLeftSidebar ? e.clientX : containerWidth - e.clientX) /
              containerWidth) *
            100;
          newPanelWidth = Math.max(minWidth, Math.min(newPanelWidth, maxWidth));
          panel.style.width = `${newPanelWidth}%`;

          localStorage.setItem(localStorageKey, newPanelWidth.toString());
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleDoubleClick = () => {
      if (panel) {
        panel.style.width = `${defaultWidth}%`;

        localStorage.setItem(localStorageKey, defaultWidth.toString());
      }
    };

    dividerRef.current?.addEventListener('mousedown', handleMouseDown);
    dividerRef.current?.addEventListener('dblclick', handleDoubleClick);

    return () => {
      dividerRef.current?.removeEventListener('mousedown', handleMouseDown);
      dividerRef.current?.removeEventListener('dblclick', handleDoubleClick);
    };
  }, []);

  return { panelRef, dividerRef };
};

export default useResizeableWidth;
