import React, { useContext } from 'react';
import { Clipboard, GitHubLogo } from '../../../../icons';
import Button from '../../../Button';
import { useGitHubAuth } from '../../../../hooks/useGitHubAuth';
import { DeviceContext } from '../../../../context/deviceContext';
import { UIContext } from '../../../../context/uiContext';

type Props = {
  setGitHubAuth: (b: boolean) => void;
  setGitHubConnected: (b: boolean) => void;
  githubAuth: boolean;
};

const GithubStatus = ({
  setGitHubAuth,
  setGitHubConnected,
  githubAuth,
}: Props) => {
  const { openLink } = useContext(DeviceContext);
  const { settingsSection, isSettingsOpen } = useContext(UIContext);

  const { code, loginUrl, handleClick, handleCopy, codeCopied, buttonClicked } =
    useGitHubAuth(() => {
      setGitHubAuth(false);
      setGitHubConnected(true);
    }, !githubAuth || !isSettingsOpen || settingsSection !== 1);

  return (
    <div className="border border-gray-800 shadow-light rounded-4 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3 callout items-center">
          <GitHubLogo />
          Connect a GitHub account to sync your code to bloop
        </div>
        <div className="flex gap-2 flex-shrink-0 items-center">
          {githubAuth ? (
            code ? (
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
            )
          ) : null}
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              handleClick();
              openLink(loginUrl);
            }}
            disabled={buttonClicked || !loginUrl}
          >
            {buttonClicked ? 'Waiting for auth' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GithubStatus;
