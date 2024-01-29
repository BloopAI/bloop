import { useCallback, useRef, useState } from 'react';

export const useArrowNavigation = () => {
  const [focusedIndex, setFocusedIndex] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const handleArrowKey = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ref.current) {
      e.preventDefault();
      e.stopPropagation();
      // eslint-disable-next-line no-undef
      const nodes: NodeListOf<HTMLElement> =
        ref.current.querySelectorAll('[data-node-index]');
      setFocusedIndex((prev) => {
        const prevIndex = Array.from(nodes).findIndex(
          (n) => n.dataset.nodeIndex === prev,
        );
        if (prevIndex > -1) {
          const newIndex =
            e.key === 'ArrowDown'
              ? prevIndex < nodes.length - 1
                ? prevIndex + 1
                : 0
              : prevIndex > 0
              ? prevIndex - 1
              : nodes.length - 1;
          return nodes[newIndex]?.dataset?.nodeIndex || '';
        }
        return nodes[0]?.dataset?.nodeIndex || '';
      });
    }
  }, []);

  return {
    focusedIndex,
    setFocusedIndex,
    handleArrowKey,
    navContainerRef: ref,
  };
};
