import React, { useCallback } from 'react';
import Button from '../../../components/Button';
import { ChatBubble, PointClick, RegexIcon } from '../../../icons';
import DialogText from '../DialogText';
import GoBackButton from '../GoBackButton';
import Feature from './Feature';

type Props = {
  handleNext: (e?: any) => void;
  handleBack: (e?: any) => void;
};

const FeaturesStep = ({ handleNext, handleBack }: Props) => {
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
        title="Welcome to bloop"
        description="bloop enhances your development workflow in three key ways"
      />
      <div className="flex flex-col gap-4">
        <Feature
          icon={<ChatBubble />}
          title="Natural language search"
          description="Query your codebase in a natural conversation style, just like you’d speak to ChatGPT"
        />
        <Feature
          icon={<RegexIcon />}
          title="Regex matching"
          description="Match code, identifiers, paths and repos with regex extremely quickly, especially on large codebases"
        />
        <Feature
          icon={<PointClick />}
          title="Precise code navigation"
          description="Available in 10+ languages to help you find references and definitions"
        />
        <div className="flex flex-col gap-4 mt-4">
          <Button type="submit" variant="primary" onClick={handleSubmit}>
            Get Started
          </Button>
        </div>
      </div>
      <GoBackButton handleBack={handleBack} />
    </>
  );
};

export default FeaturesStep;
