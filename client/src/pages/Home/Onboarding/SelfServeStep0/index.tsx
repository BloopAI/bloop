import React, { useCallback, useEffect, useState } from 'react';
import DialogText from '../DialogText';
import Button from '../../../../components/Button';
import { GitHubLogo } from '../../../../icons';
import { getRepos, githubWebLogin } from '../../../../services/api';

type Props = {
  handleNext: (e?: any, skipOne?: boolean) => void;
};

const SelfServeStep0 = ({ handleNext }: Props) => {
  const [loginUrl, setLoginUrl] = useState('');
  const [buttonClicked, setButtonClicked] = useState(false);

  useEffect(() => {
    githubWebLogin().then((resp) => {
      setLoginUrl(resp.oauth_url);
    });
  }, []);

  useEffect(() => {
    console.log('buttonClicked', buttonClicked);
    if (buttonClicked) {
      let intervalId: number;
      intervalId = setInterval(() => {
        getRepos().then((resp) => {
          console.log(resp);
          handleNext();
        });
      }, 1000);
      setTimeout(() => {
        clearInterval(intervalId);
      }, 10 * 60 * 1000);

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }
  }, [buttonClicked]);

  return (
    <>
      <DialogText
        title="Sign In"
        description="Use GitHub to Sign In to your account"
      />
      <Button variant="primary" disabled={!loginUrl}>
        <a
          href={loginUrl}
          onClick={() => setButtonClicked(true)}
          target="_blank"
          rel="noreferrer noopener"
          className="w-full flex items-center gap-2 justify-center"
        >
          <GitHubLogo /> Sign in with GitHub
        </a>
      </Button>
    </>
  );
};

export default SelfServeStep0;
