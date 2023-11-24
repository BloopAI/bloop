import { createPortal } from 'react-dom';
import { PropsWithChildren, useEffect } from 'react';

const PortalContainer = ({ children }: PropsWithChildren<{}>) => {
  const portalContainer = document.createElement('div');

  useEffect(() => {
    document.body.appendChild(portalContainer);

    return () => {
      document.body.removeChild(portalContainer);
    };
  }, [portalContainer]);

  return createPortal(children, portalContainer);
};

export default PortalContainer;
