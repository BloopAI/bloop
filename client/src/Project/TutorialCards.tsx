import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ChatBubblesIcon,
  CodeLineWithSparkleIcon,
  FileWithSparksIcon,
  RefIcon,
} from '../icons';
import MultiKeyHint from '../components/KeyboardHint/MultiKey';
import { explainFileShortcut, newChatTabShortcut } from '../consts/shortcuts';
import Button from '../components/Button';
import { TabsContext } from '../context/tabsContext';
import { TabTypesEnum } from '../types/general';
import { CommandBarContext } from '../context/commandBarContext';
import { UIContext } from '../context/uiContext';

type Props = {};

const cards = [
  {
    Icon: ChatBubblesIcon,
    title: 'Ask your first question',
    description: (
      <>
        Create a new conversation with bloop by hitting{' '}
        <MultiKeyHint shortcut={newChatTabShortcut} variant="outlined" /> on
        your keyboard or by pressing the <MultiKeyHint shortcut={['+']} /> in
        the header bar.
      </>
    ),
    btnTitle: 'New conversation',
  },
  {
    Icon: FileWithSparksIcon,
    title: 'Explain a file',
    description: (
      <>
        To begin, open a file from the sidebar on the left. Once you have a file
        open, you can ask bloop to quickly explain it by hitting{' '}
        <MultiKeyHint shortcut={explainFileShortcut} variant="outlined" /> on{' '}
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        your keyboard or by selecting "Explain file" from the{' '}
        <MultiKeyHint shortcut={['⋯']} /> popup menu.
      </>
    ),
    btnTitle: 'Explain current file',
  },
  {
    Icon: CodeLineWithSparkleIcon,
    title: 'Explain code',
    description: (
      <>
        Use your cursor to select any piece of code within a file and ask bloop{' '}
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        to explain it by pressing "Explain" in the floating toolbar.
      </>
    ),
  },
  {
    Icon: RefIcon,
    title: 'Navigate your codebase',
    description:
      'Click on an identifier and jump to its references and definition in a heart beat.',
  },
];

const TutorialCards = ({}: Props) => {
  useTranslation();
  const [step, setStep] = useState(0);
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { tabItems } = useContext(CommandBarContext.FocusedTab);
  const { onBoardingState, setOnBoardingState } = useContext(
    UIContext.Onboarding,
  );
  const [isManualControl, setIsManualControl] = useState(false);

  const onSkip = useCallback(() => {
    setOnBoardingState({
      isChatOpened: true,
      isFileExplained: true,
      isCodeExplained: true,
      isCodeNavigated: true,
      isCommandBarTutorialFinished: true,
    });
  }, []);

  useEffect(() => {
    if (!isManualControl) {
      if (step === 0 && onBoardingState.isChatOpened) {
        setStep(1);
      } else if (step === 1 && onBoardingState.isFileExplained) {
        setStep(2);
      } else if (step === 2 && onBoardingState.isCodeExplained) {
        setStep(3);
      } else if (step === 3 && onBoardingState.isCodeNavigated) {
        onSkip();
      }
    }
  }, [onBoardingState, step, onSkip, isManualControl]);

  const handleNext = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const handleBack = useCallback((i: number) => {
    setStep(i);
    setIsManualControl(true);
  }, []);

  const { Icon, title, description, btnTitle } = useMemo(() => {
    return cards[step];
  }, [step]);

  const explainCurrentFile = useMemo(() => {
    return tabItems.find((i) => i.key === 'explain_file')?.onClick;
  }, [tabItems]);

  const onBtnClick = useCallback(
    (e: React.MouseEvent) => {
      if (btnTitle === 'New conversation') {
        openNewTab({ type: TabTypesEnum.CHAT });
        handleNext();
      } else if (btnTitle === 'Explain current file' && explainCurrentFile) {
        explainCurrentFile(e);
        handleNext();
      }
    },
    [btnTitle, handleNext, explainCurrentFile],
  );

  return (
    <div className="absolute right-0 bottom-0 px-8 py-8 w-full max-w-[26rem] select-none">
      <div className="flex flex-col gap-4 p-4 rounded-md border border-bg-border bg-bg-base shadow-high">
        <div className="flex flex-col gap-1.5 items-end w-full">
          <div className="flex items-start gap-3 w-full">
            {/*// @ts-ignore*/}
            <Icon sizeClassName="w-4 h-4" className="text-label-muted" />
            <p className="flex-1 text-label-title body-s-b">
              <Trans>{title}</Trans>
            </p>
            <div className="flex gap-1 items-start">
              {cards.map((c, i) => (
                <button
                  className={`w-1.5 h-1.5 rounded-full ${
                    step === i ? 'bg-label-link' : 'bg-label-faint'
                  }`}
                  onClick={() => handleBack(i)}
                  key={i}
                />
              ))}
            </div>
          </div>
          <p className="pl-7 leading-5 body-s text-label-base">
            <Trans>{description}</Trans>
          </p>
        </div>
        <div className="pl-7 flex justify-between items-start gap-1">
          {!!btnTitle ? (
            <Button
              variant="brand-default"
              size="mini"
              onClick={onBtnClick}
              disabled={step === 1 && !explainCurrentFile}
            >
              <Trans>{btnTitle}</Trans>
            </Button>
          ) : (
            <span />
          )}
          {step < cards.length - 1 ? (
            <div className="flex items-center gap-3">
              <button className="body-mini text-label-faint" onClick={onSkip}>
                <Trans>Skip</Trans>
              </button>
              <Button variant="secondary" size="mini" onClick={handleNext}>
                <Trans>Next</Trans>
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="mini" onClick={onSkip}>
              <Trans>Dismiss tutorial</Trans>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(TutorialCards);
