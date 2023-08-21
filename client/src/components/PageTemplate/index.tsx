import React, { memo, PropsWithChildren, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import NavBar from '../NavBar';
import StatusBar from '../StatusBar';
import Chat from '../Chat';
import ErrorFallback from '../ErrorFallback';
import { RenderPage } from '../../pages/RepoTab/Content';
import LeftSidebar from '../LeftSidebar';
import Subheader from './Subheader';

type Props = {
  renderPage: RenderPage;
};

const PageTemplate = ({ children, renderPage }: PropsWithChildren<Props>) => {
  const mainContainerStyle = useMemo(
    () => ({
      height: `calc(100vh - ${renderPage !== 'home' ? '9.5rem' : '6rem'})`,
    }),
    [renderPage],
  );

  return (
    <div className="text-label-title">
      <NavBar />
      <div className="mt-8" />
      {renderPage !== 'home' && <Subheader />}
      <div
        className="flex mb-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        {renderPage !== 'article-response' &&
          renderPage !== 'repo' &&
          renderPage !== 'home' && <LeftSidebar renderPage={renderPage} />}
        {children}
        {renderPage !== 'home' && <Chat />}
      </div>
      <StatusBar />
    </div>
  );
};
export default memo(
  Sentry.withErrorBoundary(PageTemplate, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
