import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { GitHubLogo } from '../../../icons';
import { githubWebLogin } from '../../../services/api';

const SelfServeStep = () => {
  const { t } = useTranslation();
  const [loginUrl, setLoginUrl] = useState('');
  const location = useLocation();

  useEffect(() => {
    githubWebLogin(
      encodeURIComponent(
        encodeURIComponent(
          `${location.pathname}${location.search}${location.hash}`,
        ),
      ),
    ).then((resp) => {
      setLoginUrl(resp.oauth_url);
    });
  }, []);

  return (
    <>
      <DialogText
        title={t`Sign In`}
        description={t`Use GitHub to sign in to your account`}
      />
      <a href={loginUrl} className="w-full flex flex-col">
        <Button variant="primary" disabled={!loginUrl}>
          <GitHubLogo /> <Trans>Sign in with GitHub</Trans>
        </Button>
      </a>
    </>
  );
};

export default SelfServeStep;
