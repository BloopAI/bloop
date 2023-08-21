import React, { memo } from 'react';
import * as Sentry from '@sentry/react';
import { StudioTabType } from '../../types/general';
import ErrorFallback from '../../components/ErrorFallback';
import PageTemplate from '../../components/PageTemplate';

const ContentContainer = ({ tab }: { tab: StudioTabType }) => {
  return (
    <PageTemplate renderPage="studio">
      <div>code studio</div>
    </PageTemplate>
  );
};

export default memo(
  Sentry.withErrorBoundary(ContentContainer, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
