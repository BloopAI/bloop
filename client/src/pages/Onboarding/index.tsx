import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { UIContext } from '../../context/uiContext';
import { DeviceContext } from '../../context/deviceContext';
import NavBar from '../../components/NavBar';
import {
  getJsonFromStorage,
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  saveJsonToStorage,
  savePlainToStorage,
  SESSION_ID_KEY,
  USER_DATA_FORM,
} from '../../services/storage';
import { getConfig, getRepos, saveUserData } from '../../services/api';
import SeparateOnboardingStep from '../../components/SeparateOnboardingStep';
import StatusBar from '../../components/StatusBar';
import UserForm from './UserForm';
import FeaturesStep from './FeaturesStep';
import SelfServeStep from './SelfServeStep';

let onboardingFinished = false;

export type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError: string | null;
};

const Onboarding = ({ activeTab }: { activeTab: string }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>({
    firstName: '',
    lastName: '',
    email: '',
    emailError: null,
    ...getJsonFromStorage(USER_DATA_FORM),
  });
  const [shouldShowPopup, setShouldShowPopup] = useState(false);
  const { shouldShowWelcome, setShouldShowWelcome } = useContext(
    UIContext.Onboarding,
  );
  const { isGithubConnected } = useContext(UIContext.GitHubConnected);
  const { isSelfServe, os, setEnvConfig, envConfig } =
    useContext(DeviceContext);
  const [isJustUpdated, setJustUpdated] = useState(false);

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
      getConfig()
        .then((d) => {
          setEnvConfig(d);
          if (!d.user_login) {
            setJustUpdated(d.credentials_upgrade);
            setShouldShowWelcome(true);
          } else {
            closeOnboarding();
          }
        })
        .catch(() => {
          setShouldShowWelcome(true);
        });
    }
  }, []);

  useEffect(() => {
    let intervalId: number;
    let timerId: number;
    if (isGithubConnected && !envConfig.github_user?.login) {
      intervalId = window.setInterval(() => {
        getConfig().then((resp) => {
          setEnvConfig((prev) =>
            JSON.stringify(prev) === JSON.stringify(resp) ? prev : resp,
          );
        });
      }, 500);
      timerId = window.setTimeout(() => {
        clearInterval(intervalId);
      }, 30000);
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timerId);
    };
  }, [isGithubConnected, envConfig.github_user]);

  const onSubmit = useCallback(() => {
    saveUserData({
      email: form.email,
      first_name: form.firstName,
      last_name: form.lastName,
      unique_id: envConfig.tracking_id || '',
    });
    saveJsonToStorage(USER_DATA_FORM, form);
    closeOnboarding();
    setTimeout(() => setShouldShowPopup(true), 1000);
  }, [form, envConfig.tracking_id]);

  return shouldShowWelcome ? (
    isSelfServe ? (
      <div className="text-label-title">
        <NavBar isSkeleton activeTab={activeTab} />
        <div
          className={`flex justify-center items-start mt-8 w-screen overflow-auto relative h-[calc(100vh-4rem)]`}
        >
          <div className="fixed top-0 bottom-0 left-0 right-0 mt-8 mb-16 bg-bg-base z-80">
            <div className="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center overflow-auto">
              <div className="flex flex-col items-center max-w-md2 w-full">
                <div className="bg-bg-base border border-bg-border rounded-lg shadow-high p-6 flex flex-col flex-1 gap-8 w-full max-w-md2 relative max-h-[calc(100vh-12rem)]">
                  <SelfServeStep />
                </div>
              </div>
            </div>
          </div>
        </div>
        <StatusBar />
      </div>
    ) : (
      <div className="fixed top-0 bottom-0 left-0 right-0 z-100 bg-bg-sub select-none">
        {os.type === 'Darwin' && <NavBar isSkeleton activeTab={activeTab} />}
        <img
          src="/light.png"
          alt=""
          className="fixed -top-68 lg:-top-80 xl:-top-96 w-[90vw] lg:w-[80vw] xl:w-[69vw] right-0 pointer-events-none opacity-[0.16] z-50"
        />
        <div className="flex h-full justify-center mt-8">
          <div className="w-full lg:w-1/2 h-full flex justify-center">
            <div
              className={`w-[512px] h-full flex flex-col items-center justify-center px-13 gap-6`}
            >
              <UserForm form={form} setForm={setForm} onContinue={onSubmit} />
            </div>
          </div>
          <div
            className={`w-1/2 h-full hidden lg:flex justify-center items-center border-l border-bg-border relative 
        before:absolute before:top-0 before:bottom-0 before:left-0 before:right-0 before:bg-[url('/grainy-pattern.png')] 
        before:bg-repeat before:mix-blend-soft-light before:opacity-[0.14]`}
          >
            <div className="w-[585px]">
              <img className="onboarding-chats-img" alt={t('chats in bloop')} />
            </div>
          </div>
        </div>
      </div>
    )
  ) : (
    <SeparateOnboardingStep
      isVisible={shouldShowPopup}
      onClose={() => setShouldShowPopup(false)}
    >
      <FeaturesStep handleNext={() => setShouldShowPopup(false)} />
    </SeparateOnboardingStep>
  );
};

export default memo(Onboarding);
