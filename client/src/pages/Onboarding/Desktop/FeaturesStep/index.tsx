import React, { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../../components/Button';
import { ChatBubble, PointClick, CodeStudioIcon } from '../../../../icons';
import DialogText from '../../../../components/SeparateOnboardingStep/DialogText';
import GoBackButton from '../../../HomeTab/AddRepos/GoBackButton';
import Feature from './Feature';

type Props = {
  handleNext: (e?: any) => void;
  handleBack?: (e?: any) => void;
};

const FeaturesStep = ({ handleNext, handleBack }: Props) => {
  const { t } = useTranslation();
  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  return (
    <>
      <DialogText
        title={t('Welcome to bloop')}
        description={t('Unlock the value of your existing code, using AI')}
      />
      <div className="flex flex-col gap-4">
        <Feature
          icon={<ChatBubble />}
          title={t('Search code in natural language')}
          description={t(
            'Ask questions about your codebases in natural language, just like you’d speak to ChatGPT. Get started by syncing a repo, then open the repo and start chatting.',
          )}
        />
        <Feature
          icon={<CodeStudioIcon />}
          title={t('Generate code using AI')}
          description={t(
            'Code studio helps you write scripts, create unit tests, debug issues or generate anything else you can think of using AI! Sync a repo, then create a code studio project.',
          )}
        />
        <div className="flex flex-col gap-4 mt-4">
          <Button type="submit" variant="primary" onClick={handleSubmit}>
            <Trans>Got it</Trans>
          </Button>
        </div>
      </div>
      {handleBack ? <GoBackButton handleBack={handleBack} /> : null}
    </>
  );
};

export default FeaturesStep;
