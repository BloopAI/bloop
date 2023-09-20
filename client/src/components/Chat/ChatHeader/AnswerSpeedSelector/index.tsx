import React, {
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
  MouseEvent,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Tippy from '@tippyjs/react';
import { useOnClickOutside } from '../../../../hooks/useOnClickOutsideHook';
import { ChevronDown, Run, Walk } from '../../../../icons';
import ChipButton from '../../ChipButton';
import { UIContext } from '../../../../context/uiContext';
import SelectionItem from './SelectionItem';

type Props = {};

const AnswerSpeedSelector = ({}: Props) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const { preferredAnswerSpeed, setPreferredAnswerSpeed } = useContext(
    UIContext.AnswerSpeed,
  );
  const ref = useRef(null);
  useOnClickOutside(ref, () => {
    setIsVisible(false);
  });

  const onChangeToNormal = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setPreferredAnswerSpeed('normal');
    setIsVisible(false);
  }, []);

  const onChangeToFast = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setPreferredAnswerSpeed('fast');
    setIsVisible(false);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Tippy
        placement="bottom-end"
        interactive
        appendTo="parent"
        visible={isVisible}
        render={() =>
          !isVisible ? null : (
            <div
              id="dropdown"
              className={`rounded-md overflow-hidden bg-chat-bg-base border border-chat-bg-border shadow-high w-[27rem] flex flex-col`}
            >
              <div className="bg-chat-bg-shade border-b border-chat-bg-border p-3 caption-strong">
                <Trans>Answer speed</Trans>
              </div>
              <div className="p-2 flex flex-col gap-0.5 bg-chat-bg-sub">
                <SelectionItem
                  isSelected={preferredAnswerSpeed === 'normal'}
                  description={t(
                    'GPT-4 based, code blocks, includes code links',
                  )}
                  title={t('Normal')}
                  icon={<Walk />}
                  onClick={onChangeToNormal}
                />
                <SelectionItem
                  isSelected={preferredAnswerSpeed === 'fast'}
                  description={t(
                    'GPT-3.5 based, no code blocks, includes code links',
                  )}
                  title={t('Fast')}
                  icon={<Run />}
                  onClick={onChangeToFast}
                />
              </div>
            </div>
          )
        }
      >
        <span onClick={() => setIsVisible((prev) => !prev)}>
          <ChipButton>
            {preferredAnswerSpeed === 'fast' ? (
              <Run raw sizeClassName="w-4 h-4" />
            ) : (
              <Walk raw sizeClassName="w-4 h-4" />
            )}
            <ChevronDown
              raw
              sizeClassName="w-4 h-4"
              className={`transform ${
                !isVisible ? '' : 'rotate-180'
              } transition-all duration-150 ease-in-out`}
            />
          </ChipButton>
        </span>
      </Tippy>
    </div>
  );
};

export default memo(AnswerSpeedSelector);
