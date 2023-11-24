import React, { memo, useCallback, useContext, useEffect } from 'react';
import { UIContext } from '../context/uiContext';
import { DeviceContext } from '../context/deviceContext';
import {
  getPlainFromStorage,
  ONBOARDING_DONE_KEY,
  REFRESH_TOKEN_KEY,
  savePlainToStorage,
} from '../services/storage';
import { getConfig, refreshToken } from '../services/api';
import { EnvContext } from '../context/envContext';
import SelfServe from './SelfServe';
import Desktop from './Desktop';

export type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError: string | null;
};

const Onboarding = () => {
  const { shouldShowWelcome, setShouldShowWelcome } = useContext(
    UIContext.Onboarding,
  );
  const { isSelfServe } = useContext(DeviceContext);
  const { setEnvConfig, envConfig } = useContext(EnvContext);

  const closeOnboarding = useCallback(() => {
    setShouldShowWelcome(false);
    savePlainToStorage(ONBOARDING_DONE_KEY, 'true');
  }, []);

  useEffect(() => {
    if (isSelfServe) {
      let token: string | null = null;
      if (location.hash) {
        const params = new URLSearchParams('?' + location.hash.slice(1));
        token = params.get('refresh_token');
        if (token) {
          savePlainToStorage(REFRESH_TOKEN_KEY, token);
        }
      }
      const storedToken = getPlainFromStorage(REFRESH_TOKEN_KEY);
      token = token || storedToken;
      if (token) {
        refreshToken(token)
          .then(() => {
            closeOnboarding();
          })
          .catch(() => {
            setShouldShowWelcome(true);
          });
      } else {
        setShouldShowWelcome(true);
      }
    } else {
      getConfig().then((d) => {
        setEnvConfig(d);
      });
    }
  }, []);

  useEffect(() => {
    if (!isSelfServe) {
      if (!envConfig.user_login) {
        setShouldShowWelcome(true);
      } else {
        closeOnboarding();
      }
    }
  }, [envConfig]);

  return shouldShowWelcome ? (
    isSelfServe ? (
      <SelfServe />
    ) : (
      <Desktop closeOnboarding={closeOnboarding} />
    )
  ) : null;
};

export default memo(Onboarding);
