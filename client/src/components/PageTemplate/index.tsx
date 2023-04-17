import React, { useCallback, useContext, useEffect, useState } from 'react';
import NavBar from '../NavBar';
import StatusBar from '../StatusBar';
import { DeviceContext } from '../../context/deviceContext';
import { AnalyticsContext } from '../../context/analyticsContext';
import { UIContext } from '../../context/uiContext';
import { STEP_KEY } from '../../pages/Onboarding/RemoteServicesStep';
import GithubConnectStep from '../../pages/Onboarding/GithubConnectStep';
import SeparateOnboardingStep from '../SeparateOnboardingStep';
import {
  IS_ANALYTICS_ALLOWED_KEY,
  savePlainToStorage,
} from '../../services/storage';
import Button from '../Button';

type Props = {
  children: React.ReactNode;
};

const mainContainerStyle = { height: 'calc(100vh - 8rem)' };
const PageTemplate = ({ children }: Props) => {
  const { isSelfServe } = useContext(DeviceContext);
  const { isAnalyticsAllowed, setIsAnalyticsAllowed } =
    useContext(AnalyticsContext);
  const {
    isGithubConnected,
    setOnBoardingState,
    isGithubChecked,
    shouldShowWelcome,
  } = useContext(UIContext);
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (
      isGithubChecked &&
      !isGithubConnected &&
      isAnalyticsAllowed &&
      !isSelfServe &&
      !shouldShowWelcome
    ) {
      setModalOpen(true);
    }
  }, [isGithubChecked]);

  const saveOptIn = useCallback((optIn: boolean) => {
    savePlainToStorage(IS_ANALYTICS_ALLOWED_KEY, optIn ? 'true' : 'false');
    setOnBoardingState((prev) => ({
      ...prev,
      [STEP_KEY]: { hasOptedIn: optIn },
    }));
    setIsAnalyticsAllowed(optIn);
  }, []);

  return (
    <div className="text-gray-200">
      <SeparateOnboardingStep isVisible={isModalOpen} top={'5rem'}>
        <GithubConnectStep
          handleNext={() => {
            setModalOpen(false);
            saveOptIn(true);
          }}
          description="We detected an issue with your GitHub credentials, please re-authenticate with GitHub again to enable remote services. Remote services are required to use natural language search. Opting out will disable natural language search."
          secondaryCTA={
            <Button
              onClick={() => {
                setModalOpen(false);
                saveOptIn(false);
              }}
              variant="secondary"
            >
              Opt-Out of Remote Services
            </Button>
          }
        />
      </SeparateOnboardingStep>
      <NavBar userSigned />
      <div
        className="flex my-16 w-screen overflow-hidden relative z-10"
        style={mainContainerStyle}
      >
        {children}
      </div>
      <StatusBar />
    </div>
  );
};
export default PageTemplate;
