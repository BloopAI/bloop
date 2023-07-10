import React, { PropsWithChildren, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import NavBar from '../NavBar';
import StatusBar from '../StatusBar';
import Chat from '../Chat';
import ErrorFallback from '../ErrorFallback';
import Subheader from './Subheader';

type Props = {
  withSearchBar: boolean;
};

const PageTemplate = ({
  children,
  withSearchBar,
}: PropsWithChildren<Props>) => {
  const mainContainerStyle = useMemo(
    () => ({
      height: `calc(100vh - ${withSearchBar ? '9.5rem' : '6rem'})`,
    }),
    [withSearchBar],
  );

  return (
    <div className="text-label-title">
      <NavBar />
      <div className="mt-8" />
      {withSearchBar && <Subheader />}
      <div
        className="flex mb-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        {children}
        {withSearchBar && <Chat />}
      </div>
      <StatusBar />
    </div>
  );
};
export default Sentry.withErrorBoundary(PageTemplate, {
  fallback: (props) => <ErrorFallback {...props} />,
});
