import React, { useCallback, useContext, useState } from 'react';
import { Clipboard, DoorRight, GitHubLogo } from '../../../../icons';
import Button from '../../../Button';
import { useGitHubAuth } from '../../../../hooks/useGitHubAuth';
import { UIContext } from '../../../../context/uiContext';
import { SettingSections } from '../../index';
import { AnalyticsContext } from '../../../../context/analyticsContext';
import ModalOrSidebar from '../../../ModalOrSidebar';
import ConfirmationPopup from '../../../ConfirmationPopup';
import {
  IS_ANALYTICS_ALLOWED_KEY,
  savePlainToStorage,
} from '../../../../services/storage';
import { STEP_KEY } from '../../../../pages/Onboarding/RemoteServicesStep';
import { DeviceContext } from '../../../../context/deviceContext';
import { deleteAuthCookie } from '../../../../utils';

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
  const { isAnalyticsAllowed, setIsAnalyticsAllowed } =
    useContext(AnalyticsContext);
  const {
    settingsSection,
    isSettingsOpen,
    setOnBoardingState,
    setSettingsOpen,
    setShouldShowWelcome,
    setGithubConnected,
  } = useContext(UIContext);
  const { isSelfServe } = useContext(DeviceContext);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const { code, loginUrl, handleClick, handleCopy, codeCopied, buttonClicked } =
    useGitHubAuth(() => {
      setGitHubAuth(false);
      setGitHubConnected(true);
    }, !isSettingsOpen || settingsSection !== SettingSections.REPOSITORIES || isConnected);

  const handleLogout = useCallback(() => {
    if (isSelfServe) {
      deleteAuthCookie();
      setGithubConnected(false);
      setSettingsOpen(false);
      setShouldShowWelcome(true);
      return;
    }
    if (!isAnalyticsAllowed) {
      onLogout();
    } else {
      setConfirmOpen(true);
    }
  }, [isAnalyticsAllowed, onLogout]);

  const handleConfirmLogout = useCallback(() => {
    savePlainToStorage(IS_ANALYTICS_ALLOWED_KEY, 'false');
    setOnBoardingState((prev) => ({
      ...prev,
      [STEP_KEY]: { hasOptedIn: false },
    }));
    setIsAnalyticsAllowed(false);
    onLogout();
  }, [onLogout]);

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
          <>
            <Button variant="tertiary" size="small" onClick={handleLogout}>
              Logout from GitHub <DoorRight />
            </Button>
            <ModalOrSidebar
              isSidebar={false}
              shouldShow={isConfirmOpen}
              onClose={() => setConfirmOpen(false)}
              shouldStretch={false}
            >
              <ConfirmationPopup
                title="Logging out"
                description="Logging out will automatically disable Natural Language search. bloop requires an authorised GitHub account to be connected in order to take advantage of Remote Services features."
                confirmBtnTxt="Log me out"
                cancelBtnTxt="Stay logged in"
                onConfirm={handleConfirmLogout}
                onCancel={() => setConfirmOpen(false)}
              />
            </ModalOrSidebar>
          </>
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
