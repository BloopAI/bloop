import React, { memo } from 'react';
import * as Sentry from '@sentry/react';
import { StudioTabType } from '../../types/general';
import ErrorFallback from '../../components/ErrorFallback';

const ContentContainer = ({ tab }: { tab: StudioTabType }) => {
  return <div>code studio</div>;
};

export default memo(
  Sentry.withErrorBoundary(ContentContainer, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
