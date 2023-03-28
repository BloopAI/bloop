import React, { useEffect, useState } from 'react';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { GitHubLogo } from '../../../icons';
import { githubWebLogin } from '../../../services/api';

const SelfServeStep = () => {
  const [loginUrl, setLoginUrl] = useState('');

  useEffect(() => {
    githubWebLogin().then((resp) => {
      setLoginUrl(resp.oauth_url);
    });
  }, []);

  return (
    <>
      <DialogText
        title="Sign In"
        description="Use GitHub to Sign In to your account"
      />
      <a href={loginUrl} className="w-full flex flex-col">
        <Button variant="primary" disabled={!loginUrl}>
          <GitHubLogo /> Sign in with GitHub
        </Button>
      </a>
    </>
  );
};

export default SelfServeStep;
