import React, { useContext } from 'react';
import { Clipboard, DoorRight, GitHubLogo } from '../../../../icons';
import Button from '../../../Button';
import { useGitHubAuth } from '../../../../hooks/useGitHubAuth';
import { DeviceContext } from '../../../../context/deviceContext';
import { UIContext } from '../../../../context/uiContext';
import { SettingSections } from '../../index';
import { AnalyticsContext } from '../../../../context/analyticsContext';

type Props = {
  setGitHubAuth: (b: boolean) => void;
  setGitHubConnected: (b: boolean) => void;
  githubAuth: boolean;
  isConnected: boolean;
  onLogout: () => void;
};

const GithubStatus = ({
  setGitHubAuth,
  setGitHubConnected,
  isConnected,
  onLogout,
}: Props) => {
  const { openLink } = useContext(DeviceContext);
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);
  const { settingsSection, isSettingsOpen } = useContext(UIContext);

  const { code, loginUrl, handleClick, handleCopy, codeCopied, buttonClicked } =
    useGitHubAuth(() => {
      setGitHubAuth(false);
      setGitHubConnected(true);
    }, !isSettingsOpen || settingsSection !== SettingSections.REPOSITORIES || isConnected);

  return (
    <div className="border border-gray-800 shadow-light rounded-4 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3 callout items-center">
          <GitHubLogo />
          {isConnected
            ? 'Currently logged in'
            : 'Connect a GitHub account to sync your code to bloop'}
        </div>
        {isConnected ? (
          isAnalyticsAllowed ? null : (
            <Button variant="tertiary" size="small" onClick={onLogout}>
              Logout GitHub <DoorRight />
            </Button>
          )
        ) : (
          <div className="flex gap-2 flex-shrink-0 items-center">
            {code ? (
              <span className="tracking-[0.15em] flex-shrink-0 flex items-center">
                {code}
                <Button
                  onlyIcon
                  variant="tertiary"
                  size="small"
                  onClick={handleCopy}
                  title={
                    codeCopied ? 'Copied to clipboard' : 'Copy to clipboard'
                  }
                >
                  <Clipboard />
                </Button>
              </span>
            ) : (
              <span>Loading...</span>
            )}
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                openLink(loginUrl);
                handleClick();
              }}
              disabled={buttonClicked || !loginUrl}
            >
              {buttonClicked ? 'Waiting for auth' : 'Connect'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GithubStatus;
