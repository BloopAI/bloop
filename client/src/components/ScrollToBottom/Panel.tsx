import React, {
  forwardRef,
  PropsWithChildren,
  useContext,
  useImperativeHandle,
} from 'react';
import InternalContext from './InternalContext';

const Panel = forwardRef(function PanelWithRef(
  { children, className }: PropsWithChildren<{ className?: string }>,
  forwardedRef,
) {
  const { setTarget, target } = useContext(InternalContext);

  useImperativeHandle(forwardedRef, () => target, [target]);

  return (
    <div
      className={`${className || ''} h-full w-full overflow-y-auto`}
      ref={setTarget}
    >
      {children}
    </div>
  );
});

export default Panel;
