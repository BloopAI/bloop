import React, { useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import { ChatBubble, PointClick, RegexIcon } from '../../../icons';
import DialogText from '../DialogText';
import GoBackButton from '../GoBackButton';
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
        description={t(
          'bloop enhances your development workflow in three key ways',
        )}
      />
      <div className="flex flex-col gap-4">
        <Feature
          icon={<ChatBubble />}
          title={t('Natural language search')}
          description={t(
            'Query your codebase in a natural conversation style, just like you’d speak to ChatGPT',
          )}
        />
        <Feature
          icon={<RegexIcon />}
          title={t('Regex matching')}
          description={t(
            'Match code, identifiers, paths and repos with regex extremely quickly, especially on large codebases',
          )}
        />
        <Feature
          icon={<PointClick />}
          title={t('Precise code navigation')}
          description={t(
            'Available in 10+ languages to help you find references and definitions',
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
