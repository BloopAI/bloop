import React, {
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import DialogText from '../DialogText';
import Button from '../../../components/Button';
import { ArrowRight, Chronometer, Clipboard, GitHubLogo } from '../../../icons';
import { useGitHubAuth } from '../../../hooks/useGitHubAuth';
import GoBackButton from '../GoBackButton';
import TextField from '../../../components/TextField';
import { AnalyticsContext } from '../../../context/analyticsContext';

type Props = {
  handleNext: (e?: any, skipOne?: boolean) => void;
  handleBack?: (e: any) => void;
  forceAnalyticsAllowed?: boolean;
  description?: string;
  secondaryCTA?: ReactElement;
};

const GithubConnectStep = ({
  handleNext,
  handleBack,
  forceAnalyticsAllowed,
  description,
  secondaryCTA,
}: Props) => {
  const {
    code,
    codeCopied,
    authenticationFailed,
    buttonClicked,
    handleClick,
    handleCopy,
    tokenExpireIn,
    generateNewCode,
  } = useGitHubAuth(handleNext);
  const { isAnalyticsAllowed } = useContext(AnalyticsContext);

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
        <Button variant="primary" onClick={generateNewCode}>
          Generate new code
        </Button>
      );
    }
    if (showRelaunch && !authenticationFailed) {
      return (
        <Button
          variant="secondary"
          onClick={() => {
            handleClick();
            callRelaunch();
          }}
        >
          Relaunch GitHub authentication
        </Button>
      );
    }
    if (buttonClicked) {
      return (
        <Button variant="secondary" disabled>
          Waiting for authentication...
        </Button>
      );
    }

    return (
      <Button variant="primary" onClick={handleClick} disabled={!code}>
        <GitHubLogo /> Connect GitHub
      </Button>
    );
  };

  return (
    <>
      <DialogText
        title="GitHub Login"
        description={
          description ||
          (isAnalyticsAllowed || forceAnalyticsAllowed
            ? 'You must be logged into a GitHub account to access remote services. You will also be able to index repos hosted in your GitHub account or GitHub organisations. Enter the code below, when prompted by GitHub.'
            : `You must log in to sync your GitHub repositories with bloop. GitHub credentials are stored locally and are never sent to our servers. Enter the code below, when prompted by GitHub.`)
        }
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
        {buttonClicked && (
          <p className="-mt-2 text-center caption text-gray-400">
            Or use:{' '}
            <span className="text-primary-300" onClick={handleClick}>
              github.com/login/device
            </span>
          </p>
        )}
        {!(isAnalyticsAllowed || forceAnalyticsAllowed) || secondaryCTA ? (
          <>
            <div className="flex items-center">
              <span className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 mx-3">or</span>
              <span className="flex-1 h-px bg-gray-800" />
            </div>
            {secondaryCTA || (
              <Button variant="secondary" onClick={handleSkip}>
                Setup later <ArrowRight />
              </Button>
            )}
          </>
        ) : null}
      </div>
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
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

export default GithubConnectStep;
