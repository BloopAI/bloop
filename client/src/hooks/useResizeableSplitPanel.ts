import { useEffect, useRef } from 'react';

const useResizeableSplitPanel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    const divider = dividerRef.current;
    const container = containerRef.current;

    const savedPanelSize = Number(localStorage.getItem('leftPanelWidth'));
    if (savedPanelSize && leftPanel && rightPanel) {
      leftPanel.style.width = `${savedPanelSize}%`;
      rightPanel.style.width = `${100 - savedPanelSize}%`;
    }

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();

      const handleMouseMove = (e: MouseEvent) => {
        if (container) {
          let newLeftPanelWidth =
            ((e.clientX - container.getBoundingClientRect().left) /
              container.clientWidth) *
            100;
          newLeftPanelWidth = Math.max(5, Math.min(newLeftPanelWidth, 95));
          if (leftPanel && rightPanel && divider) {
            leftPanel.style.width = `${newLeftPanelWidth}%`;
            rightPanel.style.width = `${100 - newLeftPanelWidth}%`;
            divider.style.left = `${newLeftPanelWidth}%`;

            localStorage.setItem('leftPanelSize', newLeftPanelWidth.toString());
          }
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
      if (leftPanel && rightPanel && divider) {
        leftPanel.style.width = '50%';
        rightPanel.style.width = '50%';
        divider.style.left = '50%';

        localStorage.setItem('leftPanelSize', '50');
      }
    };

    dividerRef.current?.addEventListener('mousedown', handleMouseDown);
    dividerRef.current?.addEventListener('dblclick', handleDoubleClick);

    return () => {
      dividerRef.current?.removeEventListener('mousedown', handleMouseDown);
      dividerRef.current?.removeEventListener('dblclick', handleDoubleClick);
    };
  }, []);

  return { leftPanelRef, rightPanelRef, dividerRef, containerRef };
};

export default useResizeableSplitPanel;
