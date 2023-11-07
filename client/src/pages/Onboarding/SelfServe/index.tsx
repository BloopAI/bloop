import React, { memo, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import NavBar from '../../../components/NavBar';
import StatusBar from '../../../components/StatusBar';
import { githubLogin } from '../../../services/api';
import DialogText from '../../../components/SeparateOnboardingStep/DialogText';
import Button from '../../../components/Button';
import { GitHubLogo } from '../../../icons';

type Props = {
  activeTab: string;
};

const SelfServe = ({ activeTab }: Props) => {
  const { t } = useTranslation();
  const [loginUrl, setLoginUrl] = useState('');
  const location = useLocation();

  useEffect(() => {
    githubLogin(
      encodeURIComponent(
        encodeURIComponent(
          `${location.pathname}${location.search}${location.hash}`,
        ),
      ),
    ).then((resp) => {
      setLoginUrl(resp.authentication_needed.url);
    });
  }, []);

  return (
    <div className="text-label-title">
      <NavBar isSkeleton activeTab={activeTab} />
      <div
        className={`flex justify-center items-start mt-8 w-screen overflow-auto relative h-[calc(100vh-4rem)]`}
      >
        <div className="fixed top-0 bottom-0 left-0 right-0 mt-8 mb-16 bg-bg-base z-80">
          <div className="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center overflow-auto">
            <div className="flex flex-col items-center max-w-md2 w-full">
              <div className="bg-bg-base border border-bg-border rounded-lg shadow-high p-6 flex flex-col flex-1 gap-8 w-full max-w-md2 relative max-h-[calc(100vh-12rem)]">
                <DialogText
                  title={t`Sign In`}
                  description={t`Use GitHub to sign in to your account`}
                />
                <a href={loginUrl} className="w-full flex flex-col">
                  <Button variant="primary" disabled={!loginUrl}>
                    <GitHubLogo /> <Trans>Sign in with GitHub</Trans>
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
};

export default memo(SelfServe);
