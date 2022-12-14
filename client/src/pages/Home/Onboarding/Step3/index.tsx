import React, { useCallback, useEffect, useState } from 'react';
import DialogText from '../DialogText';
import Button from '../../../../components/Button';
import {
  ArrowRight,
  Chronometer,
  Clipboard,
  GitHubLogo,
} from '../../../../icons';
import { useGitHubAuth } from '../../../../hooks/useGitHubAuth';
import GoBackButton from '../GoBackButton';
import TextField from '../../../../components/TextField';

type Props = {
  handleNext: (e?: any, skipOne?: boolean) => void;
  handleBack: (e: any) => void;
};

const Step3 = ({ handleNext, handleBack }: Props) => {
  const {
    code,
    codeCopied,
    loginUrl,
    authenticationFailed,
    buttonClicked,
    handleClick,
    handleCopy,
    tokenExpireIn,
    generateNewCode,
  } = useGitHubAuth(handleNext);

  const [showRelaunch, setShowRelaunch] = useState(false);

  const callRelaunch = () => {
    setShowRelaunch(false);
    setTimeout(() => {
      setShowRelaunch(true);
    }, 3000);
  };

  useEffect(() => {
    if (buttonClicked) {
      callRelaunch();
    }
  }, [buttonClicked]);

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext(e, true);
    },
    [],
  );

  const getButton = () => {
    if (authenticationFailed) {
      return (
        <Button
          variant="primary"
          onClick={generateNewCode}
          disabled={!loginUrl}
        >
          Generate new code
        </Button>
      );
    }
    if (showRelaunch && !authenticationFailed) {
      return (
        <a
          href={loginUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="w-full flex flex-col"
        >
          <Button
            variant="secondary"
            onClick={() => {
              handleClick();
              callRelaunch();
            }}
          >
            Relaunch GitHub authentication
          </Button>
        </a>
      );
    }
    if (buttonClicked) {
      return (
        <Button
          variant="secondary"
          disabled={!authenticationFailed}
          onClick={handleClick}
        >
          {authenticationFailed || showRelaunch
            ? 'Relaunch GitHub authentication'
            : 'Waiting for authentication...'}
        </Button>
      );
    }

    return (
      <a
        href={loginUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="w-full flex flex-col"
      >
        <Button variant="primary" onClick={handleClick} disabled={!loginUrl}>
          <GitHubLogo /> Connect GitHub
        </Button>
      </a>
    );
  };

  return (
    <>
      <DialogText
        title="GitHub repositories"
        description="You must log in to sync your GitHub repositories with bloop. GitHub credentials are stored locally and are never sent to our servers. Enter the code below, when prompted by GitHub."
      />
      <span className="subhead-l text-gray-300 justify-center items-center flex gap-1 -mt-2 h-5">
        {!authenticationFailed ? (
          <>
            {code ? (
              <span className="tracking-[0.25em]">{code}</span>
            ) : (
              'Loading...'
            )}
            {!!code && (
              <Button
                onlyIcon
                variant="tertiary"
                size="small"
                onClick={handleCopy}
                title={codeCopied ? 'Copied to clipboard' : 'Copy to clipboard'}
              >
                <Clipboard />
              </Button>
            )}
          </>
        ) : (
          <span className="text-danger-400 text-sm">This code has expired</span>
        )}
      </span>
      <div className="flex flex-col gap-4">
        {getButton()}
        <div className="flex items-center">
          <span className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 mx-3">or</span>
          <span className="flex-1 h-px bg-gray-800" />
        </div>
        <Button variant="secondary" onClick={handleSkip}>
          Setup later <ArrowRight />
        </Button>
      </div>
      <GoBackButton handleBack={handleBack} />
      {tokenExpireIn ? (
        <TextField
          value={`Code expires in ${tokenExpireIn}`}
          icon={<Chronometer raw />}
          className="mt-2 text-xs text-gray-500 absolute bottom-[-25px] left-1/2 -translate-x-1/2 transform"
        />
      ) : (
        ''
      )}
    </>
  );
};

export default Step3;
