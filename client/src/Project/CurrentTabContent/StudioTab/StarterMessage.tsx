import { memo, useCallback, useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ChatBubblesIcon, CodeStudioIcon } from '../../../icons';
import { TutorialQuestionType } from '../../../types/api';
import { getTutorialQuestions } from '../../../services/api';
import { ProjectContext } from '../../../context/projectContext';

type Props = {
  isEmptyConversation: boolean;
  setInputValueImperatively: (v: string) => void;
};

const StarterMessage = ({
  isEmptyConversation,
  setInputValueImperatively,
}: Props) => {
  useTranslation();
  const [tutorials, setTutorials] = useState<TutorialQuestionType[]>([]);
  const { project } = useContext(ProjectContext.Current);

  const getDiverseTutorials = useCallback(async () => {
    if (project?.repos.length) {
      const tutorials = [];
      let tutorialsPerRepo = Math.floor(10 / project.repos.length);
      let remainingTutorials = 10;

      for (const repo of project.repos) {
        const repoTutorials = await getTutorialQuestions(repo.repo.ref);

        const tutorialsToAdd = Math.min(
          tutorialsPerRepo,
          repoTutorials.questions.length,
          remainingTutorials,
        );

        tutorials.push(...repoTutorials.questions.slice(0, tutorialsToAdd));

        remainingTutorials -= tutorialsToAdd;

        if (remainingTutorials <= 0) {
          break;
        }
      }

      setTutorials(tutorials);
    }
  }, [project?.repos]);

  useEffect(() => {
    getDiverseTutorials();
  }, [getDiverseTutorials]);

  return (
    <div className="flex items-start gap-5 rounded-md p-4">
      <div className="flex w-7 h-7 items-center justify-center rounded-full bg-brand-studio-subtle">
        <img className="bloop-head-img w-7 h-7" alt="bloop" />
      </div>
      <div className="flex flex-col gap-1 flex-1">
        <p className="body-base-b text-label-title select-none">bloop</p>
        <p className="text-label-base body-base">
          <Trans>
            Hi, I am bloop! In{' '}
            <span className="body-base-b inline-flex items-center gap-1 relative top-0.5">
              <CodeStudioIcon
                sizeClassName="w-4 h-4"
                className="text-brand-studio"
              />
              Studio mode
            </span>{' '}
            you can choose files from your codebase, write a prompt and generate
            patches, scripts and tests.
          </Trans>
        </p>
        {isEmptyConversation && !!tutorials.length && (
          <p className="text-label-base body-base mt-4">
            <Trans>Below are a few prompts to help you get started:</Trans>
          </p>
        )}
        {isEmptyConversation && !!tutorials.length && (
          <div className="pt-2 flex items-start gap-2 flex-wrap">
            {tutorials.map((t, i) => (
              <button
                key={i}
                className="h-7 rounded-full border border-bg-border px-2.5 body-s text-label-title"
                onClick={() => {
                  setInputValueImperatively(t.question);
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

export default memo(StarterMessage);
