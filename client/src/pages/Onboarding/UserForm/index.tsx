import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { BloopLogo, ChevronRight, GitHubLogo } from '../../../icons';
import TextInput from '../../../components/TextInput';
import { EMAIL_REGEX } from '../../../consts/validations';
import Button from '../../../components/Button';
import { UIContext } from '../../../context/uiContext';
import { DeviceContext } from '../../../context/deviceContext';
import {
  gitHubDeviceLogin,
  gitHubLogout,
  getConfig,
} from '../../../services/api';
import { Form } from '../index';
import Dropdown from '../../../components/Dropdown/Normal';
import { MenuItemType } from '../../../types/general';
import { Theme } from '../../../types';
import { themesMap } from '../../../components/Settings/Preferences';
import { copyToClipboard, previewTheme } from '../../../utils';
import LanguageSelector from '../../../components/LanguageSelector';
import Tooltip from '../../../components/Tooltip';

type Props = {
  form: Form;
  setForm: Dispatch<SetStateAction<Form>>;
  onContinue: () => void;
};

const UserForm = ({ form, setForm, onContinue }: Props) => {
  const { t } = useTranslation();
  const { isGithubConnected, setGithubConnected } = useContext(
    UIContext.GitHubConnected,
  );
  const { envConfig, openLink } = useContext(DeviceContext);
  const { theme, setTheme } = useContext(UIContext.Theme);
  const [loginUrl, setLoginUrl] = useState('');
  const [isLinkShown, setLinkShown] = useState(false);
  const [isBtnClicked, setBtnClicked] = useState(false);
  const [isLinkCopied, setLinkCopied] = useState(false);

  const handleLogout = useCallback(() => {
    gitHubLogout();
    setGithubConnected(false);
  }, []);

  useEffect(() => {
    gitHubDeviceLogin().then((data) => {
      setLoginUrl(data.authentication_needed.url);
    });
  }, []);

  const onClick = useCallback(() => {
    if (isGithubConnected) {
      handleLogout();
      setBtnClicked(false);
    } else {
      openLink(loginUrl);
      setBtnClicked(true);
    }
  }, [isGithubConnected, loginUrl, openLink]);

  const checkGHAuth = () => {
    getConfig().then((d) => {
      setGithubConnected(!!d.github_user);
      if (!!d.github_user) {
        handleNext();
      }
    });
  };

  useEffect(() => {
    if (loginUrl) {
      checkGHAuth();
      let intervalId: number;
      intervalId = window.setInterval(() => {
        checkGHAuth();
      }, 500);
      setTimeout(
        () => {
          clearInterval(intervalId);
          setBtnClicked(false);
        },
        10 * 60 * 1000,
      );

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [loginUrl]);

  useEffect(() => {
    if (loginUrl) {
      checkGHAuth();
    }
  }, [loginUrl]);

  const handleCopy = useCallback(() => {
    copyToClipboard(loginUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [loginUrl]);

  return (
    <>
      <div className="w-full flex flex-col gap-3 text-center relative">
        <div className="absolute -top-32 left-0 right-0 flex justify-end">
          <LanguageSelector />
        </div>
        <div className="flex flex-col gap-3 text-center relative">
          <div className="w-11 h-11 absolute left-1/2 -top-16 transform -translate-x-1/2">
            <BloopLogo />
          </div>
          <h4 className="text-label-title">
            <Trans>Setup bloop</Trans>
          </h4>
          <p className="text-label-muted body-s">
            <Trans>Please log into your GitHub account to complete setup</Trans>
          </p>
        </div>
      </div>
      <form
        className="flex flex-col gap-4 w-full"
        onSubmit={(e) => e.preventDefault()}
      >
        <TextInput
          value={form.firstName}
          name="firstName"
          placeholder={t('First name')}
          variant="filled"
          onChange={(e) =>
            setForm((prev) => ({ ...prev, firstName: e.target.value }))
          }
          autoFocus
        />
        <TextInput
          value={form.lastName}
          name="lastName"
          placeholder={t('Last name')}
          variant="filled"
          onChange={(e) =>
            setForm((prev) => ({ ...prev, lastName: e.target.value }))
          }
        />
        <TextInput
          value={form.email}
          variant="filled"
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              email: e.target.value,
              emailError: null,
            }))
          }
          validate={() => {
            if (form.email && !EMAIL_REGEX.test(form.email)) {
              setForm((prev) => ({
                ...prev,
                emailError: t('Email is not valid'),
              }));
            }
          }}
          error={form.emailError}
          name="email"
          placeholder={t('Email address')}
        />
        <div className="flex flex-col w-full">
          <Dropdown
            btnHint={
              <span className="text-label-title">
                <Trans>Select color theme:</Trans>
              </span>
            }
            btnClassName="w-full border-transparent"
            items={Object.entries(themesMap).map(([key, name]) => ({
              type: MenuItemType.DEFAULT,
              text: t(name),
              onClick: () => setTheme(key as Theme),
              onMouseOver: () => previewTheme(key),
            }))}
            onClose={() => previewTheme(theme)}
            selected={{
              type: MenuItemType.DEFAULT,
              text: t(themesMap[theme]),
            }}
          />
        </div>
        <div className="flex items-center pl-2.5 gap-2.5 border border-bg-border rounded-4">
          <GitHubLogo />
          <p className="callout text-label-title flex-1">
            {isGithubConnected ? envConfig.github_user?.login : 'GitHub'}
          </p>
          <button
            type="button"
            className={`caption text-label-title ${
              isGithubConnected ? 'px-3' : 'pl-3 pr-2'
            } h-10 flex gap-1 items-center border-l border-bg-border hover:bg-bg-base-hover disabled:bg-bg-base-hover`}
            onClick={onClick}
            disabled={isBtnClicked && !isGithubConnected}
          >
            {isGithubConnected
              ? t('Disconnect')
              : isBtnClicked
              ? t('Waiting for authentication...')
              : t('Connect account')}{' '}
            {!isGithubConnected && <ChevronRight />}
          </button>
        </div>
        <div className="text-center caption text-label-base">
          {isLinkShown ? (
            <Tooltip
              text={isLinkCopied ? t('Copied') : t('Click to copy')}
              placement={'top'}
            >
              <p
                className="text-label-link select-auto text-center break-words"
                onClick={handleCopy}
              >
                {loginUrl}
              </p>
            </Tooltip>
          ) : (
            <p>
              or go to the following link{' '}
              <button
                type="button"
                className="text-label-link"
                onClick={() => {
                  setLinkShown(true);
                  handleCopy();
                }}
              >
                Show link
              </button>
            </p>
          )}
        </div>
        <Button
          disabled={
            !isGithubConnected ||
            !form.firstName ||
            !form.lastName ||
            !form.email ||
            !!form.emailError
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContinue();
          }}
        >
          <Trans>Continue</Trans>
        </Button>
      </form>
      {isGithubConnected && (
        <p className="caption text-label-base text-center">
          <Trans>By continuing you accept our</Trans>
          <br />
          <button
            onClick={() => openLink('https://bloop.ai/terms')}
            className="text-label-link"
          >
            <Trans>Terms & conditions</Trans>
          </button>{' '}
          <Trans>and </Trans>
          <button
            onClick={() => openLink('https://bloop.ai/privacy')}
            className="text-label-link"
          >
            <Trans>Privacy policy</Trans>
          </button>
        </p>
      )}
    </>
  );
};

export default UserForm;
