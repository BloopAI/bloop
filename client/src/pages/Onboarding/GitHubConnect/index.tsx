import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Chronometer,
  Clipboard,
  GitHubLogoBig,
} from '../../../icons';
import { useGitHubAuth } from '../../../hooks/useGitHubAuth';
import Button from '../../../components/Button';
import TextField from '../../../components/TextField';
import LanguageSelector from '../../../components/LanguageSelector';
import StepsLine from './StepsLine';

const GitHubConnect = ({ goBack }: { goBack: () => void }) => {
  const {
    code,
    handleCopy,
    codeCopied,
    tokenExpireIn,
    authenticationFailed,
    generateNewCode,
    buttonClicked,
    handleClick,
  } = useGitHubAuth(goBack);
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-col items-center gap-4 relative">
        <div className="absolute -top-24 left-0 right-0 flex justify-between items-center">
          <Button variant="tertiary" onClick={goBack}>
            <ArrowLeft /> <Trans>Back</Trans>
          </Button>
          <LanguageSelector />
        </div>
        <div className="w-11 h-11">
          <GitHubLogoBig />
        </div>
        <p className="body-s text-center text-label-base">
          <Trans>
            After launching the GitHub login window, you’ll need to perform the
            following steps:
          </Trans>
        </p>
      </div>
      <div className="flex flex-col gap-6 relative w-full">
        <div className="absolute -left-5 -top-3.5">
          <StepsLine />
        </div>
        <div className="w-full flex flex-col gap-1">
          <p className="body-m text-label-title ml-4">
            <Trans>Enter the device code</Trans>
          </p>
          <div className="bg-bg-shade rounded-lg p-4 flex flex-col gap-2">
            {authenticationFailed ? (
              <Button size="small" onClick={generateNewCode}>
                <Trans>Generate new code</Trans>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="bg-bg-base-hover rounded-4 text-center flex-1 py-1 body-m text-label-title">
                  {code || '...'}
                </div>
                <Button variant="secondary" size="small" onClick={handleCopy}>
                  <Clipboard />
                  <Trans>{codeCopied ? 'Copied' : 'Copy'}</Trans>
                </Button>
              </div>
            )}
            <div className="flex justify-center">
              <TextField
                value={
                  authenticationFailed
                    ? t('Code has expired')
                    : t(`Code expires in {{tokenExpireIn}}`, { tokenExpireIn })
                }
                icon={<Chronometer raw />}
                className={`caption ${
                  authenticationFailed ? 'text-bg-danger' : 'text-label-base'
                }`}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="body-m text-label-title ml-4">
            <Trans>Authorise bloop</Trans>
          </p>
          <p className="body-s text-label-base ml-4">
            <Trans>
              Note: GitHub OAuth login doesn&apos;t support granular repo or
              organisation level access. The token has a wide scope, but only
              repos you explicitly choose will be synced, and your account
              credentials are always stored locally.
            </Trans>
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button disabled={buttonClicked} onClick={handleClick}>
            <Trans>
              {buttonClicked
                ? 'Waiting for authentication...'
                : authenticationFailed
                ? 'Relaunch GitHub auth'
                : 'Launch GitHub Login'}
            </Trans>
          </Button>
          <p className="text-center caption text-label-base">
            <Trans>or visit: </Trans>
            <span className="text-label-link select-auto">
              github.com/login/device
            </span>
          </p>
        </div>
      </div>
    </>
  );
};

export default GitHubConnect;
