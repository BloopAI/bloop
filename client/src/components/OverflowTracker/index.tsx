import {
  ComponentProps,
  memo,
  RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

const edges = [
  { position: 'top', insetStyles: { left: 0, top: 0, right: 0 } },
  { position: 'right', insetStyles: { right: 0, top: 0, bottom: 0 } },
  { position: 'bottom', insetStyles: { left: 0, bottom: 0, right: 0 } },
  { position: 'left', insetStyles: { left: 0, top: 0, bottom: 0 } },
];

const OverflowTracker = ({
  children,
  attrRef,
  ...otherProps
}: {
  attrRef?: RefObject<HTMLElement>;
} & ComponentProps<'div'>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const edgesRef = useRef<Map<string, HTMLDivElement> | null>(null);

  const getMap = useCallback(() => {
    if (!edgesRef.current) {
      // Initialize the Map on first usage.
      edgesRef.current = new Map();
    }
    return edgesRef.current;
  }, []);

  useLayoutEffect(() => {
    const attrTarget = (attrRef || wrapperRef).current;
    const wrapper = wrapperRef.current;
    const edges = edgesRef.current;

    if (!wrapper || !edges || !attrTarget) return;

    const resizeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const attr = `data-overflow-${entry.target.getAttribute(
            'data-overflow-tracker',
          )}`;
          if (entry.intersectionRatio > 0) {
            attrTarget.removeAttribute(attr);
          } else {
            attrTarget.setAttribute(attr, '');
          }
        }
      },
      {
        root: wrapper,
        // Since the edge element <div /> has no area (width or height is always 0)
        // we need to set the rootMargin to 1px to make sure
        // that intersection changes are always detected
        rootMargin: '1px',
      },
    );

    // Observe edge trackers
    const edgeElements = Array.from(edges.values());
    edgeElements.forEach((edgeTracker) => resizeObserver.observe(edgeTracker));
    // Clean up the observer when the component unmounts
    return () => {
      edgeElements.forEach((edgeTracker) =>
        resizeObserver.unobserve(edgeTracker),
      );
      resizeObserver.disconnect();
    };
  }, [attrRef]);

  const renderedEdges = useMemo(() => {
    return edges.map(({ position, insetStyles }) => (
      <div
        key={position}
        data-overflow-tracker={position}
        style={insetStyles}
        className="absolute"
        ref={(node) => {
          const map = getMap();
          if (node) {
            map.set(position, node);
          } else {
            map.delete(position);
          }
        }}
      />
    ));
  }, [edges, getMap]);

  return (
    <div ref={wrapperRef} {...otherProps}>
      <div className="flex">
        <div className="inline-block relative">
          {children}
          {renderedEdges}
        </div>
      </div>
    </div>
  );
};

export default memo(OverflowTracker);
