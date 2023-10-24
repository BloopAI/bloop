import React, { FormEvent, useCallback, useState } from 'react';
import axios from 'axios';
import { Trans, useTranslation } from 'react-i18next';
import DialogText from '../../../../components/SeparateOnboardingStep/DialogText';
import Button from '../../../../components/Button';
import { ArrowRight, Globe2 } from '../../../../icons';
import GoBackButton from '../GoBackButton';
import TextInput from '../../../../components/TextInput';
import { syncRepo } from '../../../../services/api';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e: any) => void;
  disableSkip?: boolean;
};

const PublicGithubReposStep = ({
  handleNext,
  handleBack,
  disableSkip,
}: Props) => {
  const { t } = useTranslation();
  const [newRepoValue, setNewRepoValue] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const [errorVerifying, setErrorVerifying] = useState(false);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      syncRepo(`github.com/${newRepoValue}`);
      handleNext();
    },
    [newRepoValue],
  );

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  const handleVerifyRepo = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setVerifying(true);
      let cleanRef = newRepoValue
        .replace('https://', '')
        .replace('github.com/', '')
        .replace(/\.git$/, '')
        .replace(/"$/, '')
        .replace(/^"/, '')
        .replace(/\/$/, '');
      if (newRepoValue.startsWith('git@github.com:')) {
        cleanRef = newRepoValue.slice(15).replace(/\.git$/, '');
      }
      setNewRepoValue(cleanRef);
      axios(`https://api.github.com/repos/${cleanRef}`)
        .then((resp) => {
          if (resp?.data?.visibility === 'public') {
            setVerified(true);
            syncRepo(`github.com/${cleanRef}`);
            handleNext();
          } else {
            setErrorVerifying(true);
          }
        })
        .catch((err) => {
          console.log(err);
          setErrorVerifying(true);
        })
        .finally(() => {
          setVerifying(false);
        });
    },
    [newRepoValue],
  );

  return (
    <>
      <DialogText
        title={t('Public repository')}
        description={t(
          'Paste a link to any public repository you would like to index.',
        )}
      />
      <div className="flex flex-col overflow-auto">
        <div className="flex flex-col gap-3">
          <form className="flex gap-2" onSubmit={handleVerifyRepo}>
            <TextInput
              value={newRepoValue}
              autoFocus
              name="new-repo"
              onChange={(e) => {
                setErrorVerifying(false);
                setVerified(false);
                setNewRepoValue(e.target.value);
              }}
              success={isVerified}
              variant="filled"
              placeholder={t('Repository url...')}
              error={
                errorVerifying
                  ? t(
                      "This is not a public repository / We couldn't find this repository",
                    )
                  : undefined
              }
              startIcon={
                isVerified ? (
                  <div className="text-label-title h-5 w-5">
                    <Globe2 raw />
                  </div>
                ) : undefined
              }
            />
          </form>
        </div>
        <div className="flex flex-col gap-4 mt-8">
          <Button
            type="submit"
            variant="primary"
            onClick={isVerified ? handleSubmit : handleVerifyRepo}
            disabled={errorVerifying || isVerifying || !newRepoValue}
          >
            <Trans>
              {isVerifying ? 'Verifying access...' : 'Sync repository'}
            </Trans>
          </Button>
          {!disableSkip ? (
            <Button variant="secondary" onClick={handleSkip}>
              <Trans>Skip this step</Trans>
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </div>
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
    </>
  );
};

export default PublicGithubReposStep;
