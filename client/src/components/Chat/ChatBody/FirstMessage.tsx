import React, {
  Dispatch,
  memo,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { TutorialQuestionType } from '../../../types/api';
import { getTutorialQuestions } from '../../../services/api';

type Props = {
  repoName: string;
  repoRef: string;
  isEmptyConversation: boolean;
  setInputValue: Dispatch<SetStateAction<string>>;
};

const FirstMessage = ({
  repoName,
  setInputValue,
  repoRef,
  isEmptyConversation,
}: Props) => {
  useTranslation();
  const [tutorials, setTutorials] = useState<TutorialQuestionType[]>([]);
  // const [isTutorialHidden, setIsTutorialHidden] = useState(
  //   !isEmptyConversation,
  // );

  useEffect(() => {
    getTutorialQuestions(repoRef).then((resp) => setTutorials(resp.questions));
  }, []);

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-chat-bg-shade">
      <div className="w-6 h-6 rounded-full bg-chat-bg-border flex-shrink-0 flex items-center justify-center mt-0.5">
        <img src="/bloopHeadMascot.png" alt="mascot" className="w-4.5 h-4.5" />
      </div>
      <div className="flex flex-col gap-2">
        <p className="body-s text-label-title">
          <Trans>Hi, I&apos;m bloop.</Trans>{' '}
          <Trans values={{ repoName: repoName.replace(/^github\.com\//, '') }}>
            What would you like to know about{' '}
            <span className="font-bold">#repo</span>?
          </Trans>
        </p>
        {isEmptyConversation && !!tutorials.length && (
          <p className="body-s text-label-title">
            <Trans>
              Below are a few questions you can ask me to get started:
            </Trans>
          </p>
        )}
        {isEmptyConversation && !!tutorials.length && (
          <div className="flex flex-wrap gap-2">
            {tutorials.map((t, i) => (
              <button
                key={i}
                className="px-3 py-1 rounded-full border border-chat-bg-divider bg-chat-bg-sub flex-shrink-0 caption text-label-base"
                onClick={() => {
                  // setIsTutorialHidden(true);
                  setInputValue(t.question);
                }}
              >
                {t.tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(FirstMessage);
