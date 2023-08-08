import { useState } from 'react';
import ReportBugModal from '../ReportBugModal';

type Props = {
  error: Error;
  componentStack: string | null;
  eventId: string | null;
  resetError(): void;
};

const ErrorFallback = ({ error, componentStack, resetError }: Props) => {
  const [shouldShow, setShouldShow] = useState(true);
  return (
    <ReportBugModal
      errorBoundaryMessage={error.message + ' ' + componentStack}
      handleSubmit={() => {
        resetError();
        setShouldShow(false);
      }}
      forceShow={shouldShow}
    />
  );
};
export default ErrorFallback;
