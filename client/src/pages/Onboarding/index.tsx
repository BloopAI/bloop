import React, { useCallback, useContext, useEffect, useState } from 'react';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import NavBar from '../../components/NavBar';
import {
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  savePlainToStorage,
  SESSION_ID_KEY,
} from '../../services/storage';
import {
  getConfig,
  getRepos,
  gitHubStatus,
  saveUserData,
} from '../../services/api';
import SeparateOnboardingStep from '../../components/SeparateOnboardingStep';
import GitHubConnect from './GitHubConnect';
import UserForm from './UserForm';
import FeaturesStep from './FeaturesStep';

let onboardingFinished = false;

export type Form = {
  name: string;
  email: string;
  emailError: string | null;
};

const Onboarding = () => {
  const [form, setForm] = useState<Form>({
    name: '',
    email: '',
    emailError: null,
  });
  const [isGitHubScreen, setGitHubScreen] = useState(false);
  const [shouldShowPopup, setShouldShowPopup] = useState(false);
  const { shouldShowWelcome, setShouldShowWelcome, isGithubConnected } =
    useContext(UIContext);
  const { isSelfServe, os, setEnvConfig, envConfig } =
    useContext(DeviceContext);

  const closeOnboarding = useCallback(() => {
    setShouldShowWelcome(false);
    onboardingFinished = true; // to avoid showing onboarding twice per session when using VITE_ONBOARDING=true
    savePlainToStorage(ONBOARDING_DONE_KEY, 'true');
  }, []);

  useEffect(() => {
    if (import.meta.env.ONBOARDING) {
      if (
        getPlainFromStorage(SESSION_ID_KEY) !==
        window.__APP_SESSION__.toString()
      ) {
        localStorage.removeItem(ONBOARDING_DONE_KEY);
        savePlainToStorage(SESSION_ID_KEY, window.__APP_SESSION__.toString());
        setShouldShowWelcome(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isSelfServe) {
      getRepos()
        .then(() => {
          closeOnboarding();
        })
        .catch(() => {
          setShouldShowWelcome(true);
        });
    } else {
      gitHubStatus()
        .then((d) => {
          if (d.status !== 'ok') {
            setShouldShowWelcome(true);
          } else {
            // closeOnboarding();
          }
        })
        .catch(() => {
          setShouldShowWelcome(true);
        });
    }
  }, []);

  useEffect(() => {
    getConfig().then(setEnvConfig);
  }, [isGithubConnected]);

  const onSubmit = useCallback(() => {
    saveUserData({
      email: form.email,
      first_name: form.name?.split(' ')[0],
      last_name: form.name?.split(' ')[1],
      unique_id: envConfig.tracking_id || '',
    });
    closeOnboarding();
    setTimeout(() => setShouldShowPopup(true), 1000);
  }, [form, envConfig.tracking_id]);

  return shouldShowWelcome ? (
    <div className="fixed top-0 bottom-0 left-0 right-0 z-100 bg-[#101011]">
      {os.type === 'Darwin' && <NavBar userSigned isSkeleton />}
      <img
        src="/light.png"
        alt=""
        className="fixed -top-96 left-1/3 pointer-events-none opacity-[0.16] z-50"
      />
      <div className="flex h-full justify-center mt-8">
        <div className="w-full lg:w-1/2 h-full flex justify-center lg:justify-end">
          <div
            className={`w-[512px] h-full flex flex-col items-center pt-40 px-13 ${
              isGitHubScreen ? 'gap-8' : 'gap-6'
            }`}
          >
            {!isGitHubScreen ? (
              <UserForm
                form={form}
                setForm={setForm}
                setGitHubScreen={setGitHubScreen}
                onContinue={onSubmit}
              />
            ) : (
              <GitHubConnect goBack={() => setGitHubScreen(false)} />
            )}
          </div>
        </div>
        <div
          className={`w-1/2 h-full hidden lg:flex justify-start border-l border-gray-700 relative 
        before:absolute before:top-0 before:bottom-0 before:left-0 before:right-0 before:bg-[url('/grainy-pattern.png')] 
        before:bg-repeat before:mix-blend-soft-light before:opacity-[0.14]`}
        >
          <div className="w-[585px] h-full pt-40">
            <img
              srcSet="/chatsImage-big.png 3x"
              src="/chatsImage-small.png"
              alt="chats in bloop"
            />
          </div>
        </div>
      </div>
    </div>
  ) : (
    <SeparateOnboardingStep
      isVisible={shouldShowPopup}
      onClose={() => setShouldShowPopup(false)}
    >
      <FeaturesStep handleNext={() => setShouldShowPopup(false)} />
    </SeparateOnboardingStep>
  );
};

export default Onboarding;
