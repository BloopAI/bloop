import * as Sentry from '@sentry/react';
import { HomeTabType } from '../../types/general';
import { TabUiContextProvider } from '../../context/providers/TabUiContextProvider';
import ErrorFallback from '../../components/ErrorFallback';
import Home from './Content';

type Props = {
  isActive: boolean;
  isTransitioning: boolean;
  tab: HomeTabType;
};

function HomeTab({ isActive, tab, isTransitioning }: Props) {
  return (
    <div
      className={`${isActive ? '' : 'hidden'} ${
        isTransitioning ? 'opacity-70' : 'opacity-100'
      }`}
      data-active={isActive ? 'true' : 'false'}
    >
      <TabUiContextProvider tab={tab}>
        <Home randomKey={isActive ? Date.now() : ''} />
      </TabUiContextProvider>
    </div>
  );
}

export default Sentry.withErrorBoundary(HomeTab, {
  fallback: (props) => <ErrorFallback {...props} />,
});
