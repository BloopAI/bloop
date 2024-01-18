import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import ScrollToBottom from '../../../../components/ScrollToBottom';
import { StudioContext } from '../../../../context/studiosContext';
import { TOKEN_LIMIT } from '../../../../consts/codeStudio';
import { BranchIcon, WarningSignIcon } from '../../../../icons';
import SpinLoaderContainer from '../../../../components/Loaders/SpinnerLoader';
import { StudioConversationMessageAuthor } from '../../../../types/general';
import { getTemplates } from '../../../../services/api';
import { StudioTemplateType } from '../../../../types/api';
import { checkEventKeys } from '../../../../utils/keyboardUtils';
import { useTemplateShortcut } from '../../../../consts/shortcuts';
import useKeyboardNavigation from '../../../../hooks/useKeyboardNavigation';
import { UIContext } from '../../../../context/uiContext';
import KeyHintButton from '../../../../components/Button/KeyHintButton';
import GeneratedDiff from './GeneratedDiff';
import ConversationInput from './Input';
import StarterMessage from './StarterMessage';

type Props = {
  side: 'left' | 'right';
  tabKey: string;
  studioData: StudioContext;
  isActiveTab: boolean;
  requestsLeft: number;
};

const generateShortcut = ['cmd', 'entr'];
const stopShortcut = ['Esc'];
const noShortcut: string[] = [];

const Conversation = ({
  side,
  studioData,
  isActiveTab,
  requestsLeft,
}: Props) => {
  const { t } = useTranslation();
  const scrollableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [templates, setTemplates] = useState<StudioTemplateType[]>([]);
  const [isDropdownShown, setIsDropdownShown] = useState(false);
  const { setIsUpgradeRequiredPopupOpen } = useContext(
    UIContext.UpgradeRequiredPopup,
  );
  const templatesRef = useRef<HTMLButtonElement | null>(null);

  const refetchTemplates = useCallback(() => {
    getTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    refetchTemplates();
  }, []);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      if (scrollableRef.current) {
        setIsScrollable(
          scrollableRef.current.scrollHeight >
            scrollableRef.current.clientHeight,
        );
      }
    }, 100);
  }, [studioData?.conversation]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (checkEventKeys(e, generateShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        if (
          studioData.inputValue &&
          studioData.tokenCount < TOKEN_LIMIT &&
          // !hasContextError &&
          requestsLeft
          // && !isChangeUnsaved
        ) {
          studioData.onSubmit();
        } else if (!requestsLeft) {
          setIsUpgradeRequiredPopupOpen(true);
        }
      }
      if (checkEventKeys(e, stopShortcut) && studioData.isLoading) {
        e.preventDefault();
        e.stopPropagation();
        studioData.handleCancel();
      }
      if (checkEventKeys(e, useTemplateShortcut)) {
        templatesRef.current?.parentElement?.click();
      }
    },
    [
      studioData.inputValue,
      studioData.tokenCount,
      studioData.onSubmit,
      studioData.isLoading,
      studioData.handleCancel,
      requestsLeft,
    ],
  );
  useKeyboardNavigation(handleKeyEvent, !isActiveTab || isDropdownShown);

  const hasCodeBlock = useMemo(() => {
    return studioData.conversation.some(
      (m) =>
        m.author === StudioConversationMessageAuthor.ASSISTANT &&
        m.message.includes('```'),
    );
  }, [studioData.conversation]);

  const isDiffForLocalRepo = useMemo(() => {
    return studioData.diff?.chunks.find((c) => c.repo.startsWith('local//'));
  }, [studioData.diff]);

  return !studioData ? null : (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-auto">
      <ScrollToBottom
        className="max-w-full flex flex-col overflow-auto"
        wrapperRef={scrollableRef}
      >
        <StarterMessage />
        {studioData.conversation.map((m, i) => (
          <ConversationInput
            key={i}
            author={m.author}
            message={m.error || m.message}
            onMessageChange={studioData.onMessageChange}
            onMessageRemoved={studioData.onMessageRemoved}
            i={i}
            isTokenLimitExceeded={studioData.tokenCount > TOKEN_LIMIT}
            isLast={i === studioData.conversation.length - 1}
            side={side}
            templates={templates}
            setIsDropdownShown={setIsDropdownShown}
          />
        ))}
        {!!studioData.diff && (
          <GeneratedDiff
            diff={studioData.diff}
            onDiffRemoved={studioData.onDiffRemoved}
            onDiffChanged={studioData.onDiffChanged}
            applyError={studioData.isDiffApplyError}
          />
        )}
        {(studioData.isDiffApplied ||
          studioData.waitingForDiff ||
          studioData.isDiffGenFailed) && (
          <div
            className={`w-full flex items-center rounded-6 justify-center gap-1 py-2 ${
              studioData.isDiffGenFailed
                ? 'bg-bg-danger/12 text-bg-danger'
                : 'bg-bg-main/12 text-label-link'
            } caption`}
          >
            {studioData.isDiffGenFailed ? (
              <WarningSignIcon raw sizeClassName="w-3.5 h-3.5" />
            ) : studioData.waitingForDiff ? (
              <SpinLoaderContainer sizeClassName="w-3.5 h-3.5" />
            ) : (
              <BranchIcon raw sizeClassName="w-3.5 h-3.5" />
            )}
            <Trans>
              {studioData.isDiffGenFailed
                ? 'Diff generation failed'
                : studioData.waitingForDiff
                ? 'Generating diff...'
                : 'The diff has been applied locally.'}
            </Trans>
          </div>
        )}
        {!studioData.isLoading &&
          // !studioData.isPreviewing &&
          !studioData.waitingForDiff &&
          !studioData.diff &&
          !(
            studioData.conversation[studioData.conversation.length - 1]
              ?.author === StudioConversationMessageAuthor.USER
          ) && (
            <ConversationInput
              key={'new'}
              author={studioData.inputAuthor}
              message={studioData.inputValue}
              onMessageChange={studioData.onMessageChange}
              inputRef={inputRef}
              isTokenLimitExceeded={studioData.tokenCount > TOKEN_LIMIT}
              isLast
              side={side}
              templates={templates}
              setIsDropdownShown={setIsDropdownShown}
              templatesRef={templatesRef}
            />
          )}
      </ScrollToBottom>
      <div
        className={`flex items-start justify-between flex-shrink-0 w-full p-4 gap-4 border-t border-bg-border shadow-medium ${
          isScrollable ? 'bg-bg-base border-x rounded-tl-md rounded-tr-md' : ''
        }`}
      >
        <div className="flex gap-2 items-center select-none">
          <KeyHintButton
            text={t('Clear conversation')}
            shortcut={noShortcut}
            onClick={studioData.clearConversation}
          />
        </div>
        <div className="flex gap-2 items-center select-none">
          {studioData.isLoading ? (
            <KeyHintButton
              text={t('Stop generating')}
              shortcut={stopShortcut}
              onClick={studioData.handleCancel}
            />
          ) : (
            <>
              {(hasCodeBlock || studioData.diff) &&
                (studioData.isDiffApplied ? null : !studioData.diff ? (
                  <KeyHintButton
                    text={t(
                      studioData.waitingForDiff
                        ? 'Cancel diff generation'
                        : 'Apply changes',
                    )}
                    shortcut={noShortcut}
                    onClick={
                      studioData.waitingForDiff
                        ? studioData.handleCancelDiff
                        : studioData.handleApplyChanges
                    }
                  />
                ) : (
                  <>
                    <KeyHintButton
                      text={t(isDiffForLocalRepo ? 'Cancel' : 'Close')}
                      shortcut={noShortcut}
                      onClick={() => studioData.setDiff(null)}
                    />
                    {isDiffForLocalRepo && (
                      <KeyHintButton
                        text={'Confirm'}
                        shortcut={noShortcut}
                        onClick={studioData.handleConfirmDiff}
                      />
                    )}
                  </>
                ))}
              {!studioData.diff && (
                <KeyHintButton
                  text={t('Generate')}
                  shortcut={generateShortcut}
                  onClick={studioData.onSubmit}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(Conversation);
