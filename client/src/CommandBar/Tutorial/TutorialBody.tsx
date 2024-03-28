import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { UIContext } from '../../context/uiContext';

type Props = {
  stepNumber: number;
  title: string;
  description: string;
  hint?: string;
};

const TutorialBody = ({ stepNumber, title, hint, description }: Props) => {
  useTranslation();
  const { setOnBoardingState } = useContext(UIContext.Onboarding);

  const onSkip = useCallback(() => {
    setOnBoardingState({
      isCommandBarTutorialFinished: true,
      isCodeNavigated: true,
      isCodeExplained: true,
      isChatOpened: true,
      isFileExplained: true,
    });
  }, []);

  return (
    <span
      className={`inline-flex items-center flex-shrink-0 z-60 relative`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="flex flex-col p-3 gap-4 w-max max-w-[18.625rem] rounded-md bg-bg-contrast shadow-high text-label-contrast">
        <span className="flex flex-col gap-1.5 items-end select-none">
          <span className="flex gap-3 items-center w-full">
            <span className="w-5 h-5 rounded flex items-center justify-center bg-bg-base code-tiny-b text-label-title">
              {stepNumber}
            </span>
            <p className="text-label-contrast body-s-b flex-1">{title}</p>
            <button
              className="body-mini text-label-contrast/60"
              onClick={onSkip}
            >
              <Trans>Skip</Trans>
            </button>
          </span>
          <span className="pl-8 flex flex-col">
            <span className="body-s">{description}</span>
            {!!hint && (
              <>
                <br />
                <span className="body-s-b">{hint}</span>
              </>
            )}
          </span>
        </span>
      </span>
      <span className="relative -left-px z-10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="8"
          height="16"
          viewBox="0 0 8 16"
          fill="none"
        >
          <path
            d="M7.31833 6.50518C8.21336 7.30076 8.21336 8.69924 7.31833 9.49482L2.54292e-07 16L9.53674e-07 -3.93402e-07L7.31833 6.50518Z"
            className="fill-bg-contrast"
          />
        </svg>
      </span>
    </span>
  );
};

export default memo(TutorialBody);
