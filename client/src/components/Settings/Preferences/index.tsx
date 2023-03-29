import { useCallback, useState, useContext } from 'react';
import SettingsText from '../SettingsText';
import SettingsRow from '../SettingsRow';
import { AnalyticsContext } from '../../../context/analyticsContext';
import {
  IS_ANALYTICS_ALLOWED_KEY,
  savePlainToStorage,
} from '../../../services/storage';
import Button from '../../Button';
import SeparateOnboardingStep from '../../SeparateOnboardingStep';
import RemoteServicesStep, {
  STEP_KEY,
} from '../../../pages/Onboarding/RemoteServicesStep';
import { UIContext } from '../../../context/uiContext';
import GithubConnectStep from '../../../pages/Onboarding/GithubConnectStep';
import GithubReposStep from '../../../pages/Onboarding/GithubReposStep';

const Preferences = () => {
  const { isAnalyticsAllowed, setIsAnalyticsAllowed } =
    useContext(AnalyticsContext);
  const { isGithubConnected, setOnBoardingState } = useContext(UIContext);
  const [isModalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [hasOptedIn, setHasOptedIn] = useState(isAnalyticsAllowed);

  const saveOptIn = useCallback((optIn: boolean) => {
    savePlainToStorage(IS_ANALYTICS_ALLOWED_KEY, optIn ? 'true' : 'false');
    setOnBoardingState((prev) => ({
      ...prev,
      [STEP_KEY]: { hasOptedIn: optIn },
    }));
    setIsAnalyticsAllowed(optIn);
  }, []);

  return (
    <div className="w-full relative">
      <div className="mb-6">
        <h5>Preferences</h5>
      </div>
      <div>
        {/*<SettingsText*/}
        {/*  title="Theme"*/}
        {/*  subtitle="Select your interface color scheme"*/}
        {/*/>*/}
        {/*<div className="flex gap-6 my-6">*/}
        {/*  <label className="cursor-pointer">*/}
        {/*    <input*/}
        {/*      type="radio"*/}
        {/*      className="hidden"*/}
        {/*      name="theme"*/}
        {/*      value="dark"*/}
        {/*      checked={theme === 'dark'}*/}
        {/*      onChange={onThemeChange}*/}
        {/*    />*/}
        {/*    <img*/}
        {/*      src="/dark_theme.png"*/}
        {/*      className={`w-56 border-2 rounded-md ${*/}
        {/*        theme === 'dark' ? 'border-primary-400' : 'border-transparent'*/}
        {/*      } transition-colors duration-150`}*/}
        {/*      alt="dark theme"*/}
        {/*    />*/}
        {/*    <div*/}
        {/*      className={`flex items-center gap-1 body-s ${*/}
        {/*        theme === 'dark' ? 'text-gray-100' : 'text-gray-500'*/}
        {/*      } transition-colors duration-150`}*/}
        {/*    >*/}
        {/*      {theme === 'dark' && (*/}
        {/*        <span className="w-5 h-5 text-success-700">*/}
        {/*          <CheckIcon />*/}
        {/*        </span>*/}
        {/*      )}*/}
        {/*      Dark*/}
        {/*    </div>*/}
        {/*  </label>*/}
        {/*  <label className="cursor-pointer">*/}
        {/*    <input*/}
        {/*      type="radio"*/}
        {/*      className="hidden"*/}
        {/*      name="theme"*/}
        {/*      value="light"*/}
        {/*      checked={theme === 'light'}*/}
        {/*      onChange={onThemeChange}*/}
        {/*    />*/}
        {/*    <img*/}
        {/*      src="/light_theme.png"*/}
        {/*      className={`w-56 border-2 rounded-md ${*/}
        {/*        theme === 'light' ? 'border-primary-400' : 'border-transparent'*/}
        {/*      } transition-colors duration-150`}*/}
        {/*      alt="light theme"*/}
        {/*    />*/}
        {/*    <div*/}
        {/*      className={`flex items-center gap-1 body-s ${*/}
        {/*        theme === 'light' ? 'text-gray-100' : 'text-gray-500'*/}
        {/*      } transition-colors duration-150`}*/}
        {/*    >*/}
        {/*      {theme === 'light' && (*/}
        {/*        <span className="w-5 h-5 text-success-700">*/}
        {/*          <CheckIcon />*/}
        {/*        </span>*/}
        {/*      )}*/}
        {/*      Light*/}
        {/*    </div>*/}
        {/*  </label>*/}
        {/*  <label className="cursor-pointer">*/}
        {/*    <input*/}
        {/*      type="radio"*/}
        {/*      className="hidden"*/}
        {/*      name="theme"*/}
        {/*      value="system"*/}
        {/*      checked={theme === 'system'}*/}
        {/*      onChange={onThemeChange}*/}
        {/*    />*/}
        {/*    <img*/}
        {/*      src="/system_theme.png"*/}
        {/*      className={`w-56 border-2 rounded-md ${*/}
        {/*        theme === 'system' ? 'border-primary-400' : 'border-transparent'*/}
        {/*      } transition-colors duration-150`}*/}
        {/*      alt="system theme"*/}
        {/*    />*/}
        {/*    <div*/}
        {/*      className={`flex items-center gap-1 body-s ${*/}
        {/*        theme === 'system' ? 'text-gray-100' : 'text-gray-500'*/}
        {/*      } transition-colors duration-150`}*/}
        {/*    >*/}
        {/*      {theme === 'system' && (*/}
        {/*        <span className="w-5 h-5 text-success-700">*/}
        {/*          <CheckIcon />*/}
        {/*        </span>*/}
        {/*      )}*/}
        {/*      System*/}
        {/*    </div>*/}
        {/*  </label>*/}
        {/*</div>*/}
        <SettingsRow>
          <SettingsText
            title={`Remote services: ${isAnalyticsAllowed ? 'on' : 'off'}`}
            subtitle={`Natural language search is ${
              isAnalyticsAllowed ? 'enabled' : 'disabled'
            }`}
          />
          <div className="flex-1">
            <Button
              variant="secondary"
              onClick={() => {
                setModalOpen(true);
                setStep(0);
              }}
            >
              Change
            </Button>
          </div>
        </SettingsRow>
      </div>
      <SeparateOnboardingStep
        isVisible={isModalOpen}
        onClose={() => setModalOpen(false)}
      >
        {step === 0 ? (
          <RemoteServicesStep
            handleNext={() => {}}
            onSubmit={(optIn) => {
              setHasOptedIn(optIn);
              if (isGithubConnected || !optIn) {
                setModalOpen(false);
                saveOptIn(optIn);
              } else {
                setStep(1);
              }
            }}
          />
        ) : step === 1 ? (
          <GithubConnectStep
            handleNext={() => setStep(2)}
            forceAnalyticsAllowed={hasOptedIn}
          />
        ) : (
          <GithubReposStep
            handleNext={() => {
              setModalOpen(false);
              saveOptIn(hasOptedIn);
            }}
          />
        )}
      </SeparateOnboardingStep>
    </div>
  );
};

export default Preferences;
