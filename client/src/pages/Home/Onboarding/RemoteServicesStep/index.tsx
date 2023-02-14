import React, { ChangeEvent, useCallback, useContext, useState } from 'react';
import Button from '../../../../components/Button';
import DialogText from '../DialogText';
import GoBackButton from '../GoBackButton';
import { AnalyticsContext } from '../../../../context/analyticsContext';
import {
  IS_ANALYTICS_ALLOWED_KEY,
  savePlainToStorage,
} from '../../../../services/storage';
import PrivacyCard from './PrivacyCard';

type Props = {
  handleNext: (e?: any) => void;
  handleBack: (e?: any) => void;
};

const RemoteServicesStep = ({ handleNext, handleBack }: Props) => {
  const [hasOptedIn, setHasOptedIn] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const { setIsAnalyticsAllowed } = useContext(AnalyticsContext);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (!hasOptedIn && !showConfirm) {
        setShowConfirm(true);
      } else {
        handleNext();
        savePlainToStorage(
          IS_ANALYTICS_ALLOWED_KEY,
          hasOptedIn ? 'true' : 'false',
        );
        setIsAnalyticsAllowed(hasOptedIn);
      }
    },
    [hasOptedIn, showConfirm],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setHasOptedIn(e.target.value === 'opt-in');
  }, []);

  return (
    <>
      <DialogText
        title={showConfirm ? 'Are you sure?' : 'Remote services'}
        description={
          showConfirm
            ? 'Opting-out of remote services will disable natural language search.'
            : 'Natural language search requires an internet connection and shares code snippets with bloop and OpenAI during search. By continuing you agree to the terms and privacy policy.'
        }
      />
      <div className="flex flex-col gap-4">
        {showConfirm ? null : (
          <>
            <PrivacyCard
              title="Opt-in to remote services"
              onChange={handleChange}
              name="remoteServices"
              value="opt-in"
              checked={hasOptedIn}
              description="Natural language, regex matching and precise code navigation will be available. Telemetry will be enabled."
            />
            <PrivacyCard
              title="Opt-out of remote services"
              onChange={handleChange}
              name="remoteServices"
              value="opt-out"
              checked={!hasOptedIn}
              description="Regex matching and precise code navigation will be available. Telemetry will be disabled."
            />
          </>
        )}
        <div className={`flex flex-col gap-4 ${showConfirm ? '' : 'mt-4'}`}>
          <Button type="submit" variant="primary" onClick={handleSubmit}>
            {showConfirm ? "I'm sure" : 'Confirm'}
          </Button>
          {showConfirm && (
            <Button
              variant="tertiary"
              onClick={() => {
                setShowConfirm(false);
              }}
            >
              Change selection
            </Button>
          )}
        </div>
      </div>
      <GoBackButton handleBack={handleBack} />
    </>
  );
};

export default RemoteServicesStep;
