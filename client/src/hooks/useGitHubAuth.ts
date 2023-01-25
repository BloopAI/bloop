import { useCallback, useEffect, useState } from 'react';
import { gitHubLogin, gitHubStatus } from '../services/api';
import { copyToClipboard } from '../utils';

const formatTime = (time: number) => {
  const seconds = Math.floor((time / 1000) % 60);
  return `${Math.floor((time / 1000 / 60) % 60)}:${
    seconds < 10 ? `0${seconds}` : seconds
  }`;
};

export const useGitHubAuth = (
  handleNext: () => void,
  disabled: boolean = false,
) => {
  const [buttonClicked, setButtonClicked] = useState(false);
  const [authenticationFailed, setAuthenticationFailed] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [code, setCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [tokenExpireIn, setTokenExpireIn] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [deadline] = useState(Date.now() + 10 * 60 * 1000);

  useEffect(() => {
    if (!disabled) {
      gitHubLogin().then((data) => {
        if (!data?.authentication_needed) {
          setAuthenticationFailed(true);
        }
        setLoginUrl(data.authentication_needed.url);
        setCode(data.authentication_needed.code);
      });
    }
  }, [disabled]);

  const handleCopy = useCallback(() => {
    copyToClipboard(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [code]);

  const handleClick = useCallback(() => {
    setAuthenticationFailed(false);
    setButtonClicked(true);
  }, []);

  const generateNewCode = useCallback(() => {
    gitHubLogin().then((data) => {
      setAuthenticationFailed(false);
      setLoginUrl(data.authentication_needed.url);
      setCode(data.authentication_needed.code);
    });
  }, []);

  const checkGHAuth = () => {
    gitHubStatus().then((d) => {
      if (d.status === 'ok') {
        handleNext();
      }
    });
  };

  useEffect(() => {
    if (loginUrl) {
      let intervalId: number;
      intervalId = window.setInterval(() => {
        setTimer((prevState) => prevState + 0.5);
      }, 500);
      checkGHAuth();
      setTimeout(() => {
        clearInterval(intervalId);
        setAuthenticationFailed(true);
      }, 10 * 60 * 1000);

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [loginUrl]);

  useEffect(() => {
    if (!disabled && buttonClicked) {
      checkGHAuth();
    }
  }, [loginUrl, disabled, buttonClicked, timer]);

  useEffect(() => {
    if (!disabled) {
      const time = deadline - Date.now();
      setTokenExpireIn(formatTime(time));
    }
    if (authenticationFailed) {
      setTokenExpireIn(null);
    }
  }, [disabled, authenticationFailed, timer]);

  return {
    code,
    loginUrl,
    codeCopied,
    authenticationFailed,
    buttonClicked,
    handleCopy,
    handleClick,
    tokenExpireIn,
    generateNewCode,
  };
};
