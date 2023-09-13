import React, { memo, PropsWithChildren, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import Chat from '../Chat';
import ErrorFallback from '../ErrorFallback';
import { RenderPage } from '../../pages/RepoTab/Content';
import LeftSidebar from '../LeftSidebar';
import Filters from '../Filters';
import Subheader from './Subheader';
import HomeSubheader from './HomeSubheader';

type Props = {
  renderPage: RenderPage | 'studio';
};

const PageTemplate = ({ children, renderPage }: PropsWithChildren<Props>) => {
  const mainContainerStyle = useMemo(
    () => ({
      height: `calc(100vh - ${renderPage !== 'studio' ? '9.5rem' : '6rem'})`,
    }),
    [renderPage],
  );

  return (
    <div className="text-label-title">
      {renderPage !== 'home' && renderPage !== 'studio' && <Subheader />}
      {renderPage === 'home' && <HomeSubheader />}
      <div
        className="flex mb-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        {renderPage === 'full-result' && (
          <LeftSidebar renderPage={renderPage} />
        )}
        {renderPage === 'results' && <Filters />}
        {children}
        {renderPage !== 'home' && renderPage !== 'studio' && <Chat />}
      </div>
    </div>
  );
};
export default memo(
  Sentry.withErrorBoundary(PageTemplate, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
