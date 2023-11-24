import React, { memo, PropsWithChildren, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import Chat from '../Chat';
import ErrorFallback from '../../../components/ErrorFallback';
import LeftSidebar from '../LeftSidebar';

type Props = {};

const PageTemplate = ({ children }: PropsWithChildren<Props>) => {
  const mainContainerStyle = useMemo(
    () => ({
      height: `calc(100vh - 9.5rem)`,
    }),
    [],
  );

  return (
    <div className="text-label-title">
      <div
        className="flex mb-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        <LeftSidebar />
        {children}
        <Chat />
      </div>
    </div>
  );
};
export default memo(
  Sentry.withErrorBoundary(PageTemplate, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
