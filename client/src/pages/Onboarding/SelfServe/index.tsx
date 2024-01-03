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
    null
  );
};

export default memo(SelfServe);
