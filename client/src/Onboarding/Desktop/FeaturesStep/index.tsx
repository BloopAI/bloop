import React, { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import { ChatBubblesIcon, CodeStudioIcon } from '../../../icons';
import Feature from './Feature';

type Props = {
  handleNext: (e?: any) => void;
};

const FeaturesStep = ({ handleNext }: Props) => {
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
      <div>
        <h4 className="text-center select-none text-label-title">
          {t('Welcome to bloop')}
        </h4>
        <p className={`body-s-b text-label-base mt-3 text-center`}>
          {t('Unlock the value of your existing code, using AI')}
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <Feature
          icon={<ChatBubblesIcon sizeClassName="w-5 h-5" />}
          title={t('Search code in natural language')}
          description={t(
            'Ask questions about your codebases in natural language, just like you’d speak to ChatGPT. Get started by syncing a repo, then open the repo and start chatting.',
          )}
        />
        <Feature
          icon={<CodeStudioIcon sizeClassName="w-5 h-5" />}
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
    </>
  );
};

export default FeaturesStep;
