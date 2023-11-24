import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CheckIcon, Clipboard, GitHubLogo } from '../../../icons';
import Tooltip from '../../../components/Tooltip';
import { UIContext } from '../../../context/uiContext';
import { DeviceContext } from '../../../context/deviceContext';
import { getConfig, githubLogin, githubLogout } from '../../../services/api';
import { copyToClipboard } from '../../../utils';
import Button from '../../../components/Button';
import { polling } from '../../../utils/requestUtils';
import { EnvContext } from '../../../context/envContext';

type Props = {
  onContinue: () => void;
};

const UserFormStep2 = ({ onContinue }: Props) => {
  const { t } = useTranslation();
  const { isGithubConnected, setGithubConnected } = useContext(
    UIContext.GitHubConnected,
  );
  const { openLink, invokeTauriCommand } = useContext(DeviceContext);
  const { setEnvConfig, envConfig } = useContext(EnvContext);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [isBtnClicked, setBtnClicked] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [isLinkShown, setLinkShown] = useState(false);
  const [isLinkCopied, setLinkCopied] = useState(false);

  const handleLogout = useCallback(() => {
    githubLogout();
    setGithubConnected(false);
  }, []);

  const onClick = useCallback(() => {
    if (isGithubConnected) {
      handleLogout();
      setBtnClicked(false);
    } else {
      if (isTimedOut) {
        setIsTimedOut(false);
        githubLogin().then((data) => {
          setLoginUrl(data.authentication_needed.url);
          openLink(data.authentication_needed.url);
        });
      } else {
        openLink(loginUrl);
      }
      setBtnClicked(true);
    }
  }, [isGithubConnected, loginUrl, openLink, isTimedOut]);

  const handleCopy = useCallback(() => {
    copyToClipboard(loginUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [loginUrl]);

  useEffect(() => {
    githubLogin().then((data) => {
      setLoginUrl(data.authentication_needed.url);
    });
  }, []);

  const checkGHAuth = useCallback(async () => {
    const d = await getConfig();
    setGithubConnected(!!d.user_login);
    setEnvConfig((prev) =>
      JSON.stringify(prev) === JSON.stringify(d) ? prev : d,
    );
    return d;
  }, []);

  useEffect(() => {
    let intervalId: number;
    let timerId: number;
    if (loginUrl && !isGithubConnected) {
      checkGHAuth();
      intervalId = polling(
        () =>
          checkGHAuth().then((d) => {
            if (!!d.user_login) {
              invokeTauriCommand('show_main_window');
              onContinue();
            }
          }),
        500,
      );
      timerId = window.setTimeout(
        () => {
          clearInterval(intervalId);
          setBtnClicked(false);
          setIsTimedOut(true);
        },
        10 * 60 * 1000,
      );
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timerId);
    };
  }, [loginUrl, isGithubConnected, checkGHAuth, onContinue]);

  useEffect(() => {
    if (loginUrl) {
      checkGHAuth();
    }
  }, [loginUrl, checkGHAuth]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div
        className={`flex items-center justify-between p-4 gap-2.5 border border-bg-border rounded-lg bg-bg-base`}
      >
        <div className="flex gap-3 items-center">
          <GitHubLogo raw sizeClassName="w-8 h-8" />
          <p className="callout text-label-title">
            {isGithubConnected ? envConfig.user_login : 'GitHub'}
          </p>
        </div>
        <Button
          size="small"
          // className={`caption text-label-title ${
          //   isGithubConnected ? 'px-3' : 'pl-3 pr-2'
          // } h-10 flex gap-1 items-center border-l border-bg-border hover:bg-bg-base-hover disabled:bg-bg-base-hover`}
          onClick={onClick}
          disabled={isBtnClicked && !isGithubConnected && !isTimedOut}
        >
          {isGithubConnected
            ? t('Disconnect')
            : isBtnClicked && !isTimedOut
            ? t('Waiting for authentication...')
            : t('Connect account')}{' '}
        </Button>
      </div>
      {!isGithubConnected && (
        <div className="text-center caption text-label-base">
          {isLinkShown ? (
            <Tooltip
              text={isLinkCopied ? t('Copied') : t('Click to copy')}
              placement={'top'}
            >
              <p
                className="text-label-link select-auto text-center break-words leading-5"
                onClick={handleCopy}
              >
                {loginUrl}
                {isLinkCopied ? (
                  <CheckIcon
                    raw
                    sizeClassName="w-4 h-4"
                    className="ml-2 relative top-2"
                  />
                ) : (
                  <Clipboard
                    raw
                    sizeClassName="w-4 h-4"
                    className="ml-2 cursor-pointer"
                  />
                )}
              </p>
            </Tooltip>
          ) : (
            <p>
              <Trans>or go to the following link</Trans>{' '}
              <button
                type="button"
                className="text-label-link"
                onClick={() => {
                  setLinkShown(true);
                  handleCopy();
                }}
              >
                <Trans>Show link</Trans>
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(UserFormStep2);
