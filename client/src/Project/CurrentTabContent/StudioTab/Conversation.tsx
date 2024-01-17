import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Trans } from 'react-i18next';
import ScrollToBottom from '../../../components/ScrollToBottom';
import { StudioContext } from '../../../context/studiosContext';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import { BranchIcon, WarningSignIcon } from '../../../icons';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import { StudioConversationMessageAuthor } from '../../../types/general';
import { getTemplates } from '../../../services/api';
import { StudioTemplateType } from '../../../types/api';
import StarterMessage from './StarterMessage';
import ConversationInput from './Input';
import GeneratedDiff from './GeneratedDiff';

type Props = {
  side: 'left' | 'right';
  tabKey: string;
  studioData: StudioContext;
  isActiveTab: boolean;
  requestsLeft: number;
};

const Conversation = ({
  side,
  studioData,
  isActiveTab,
  requestsLeft,
}: Props) => {
  // const { project } = useContext(ProjectContext.Current);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [templates, setTemplates] = useState<StudioTemplateType[]>([]);

  const refetchTemplates = useCallback(() => {
    getTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    refetchTemplates();
  }, []);
  // const [isScrollable, setIsScrollable] = useState(false);

  // useEffect(() => {
  //   setTimeout(() => {
  //     if (scrollableRef.current) {
  //       setIsScrollable(
  //         scrollableRef.current.scrollHeight >
  //           scrollableRef.current.clientHeight,
  //       );
  //     }
  //   }, 100);
  // }, [studioData?.conversation, studioData?.hideMessagesFrom]);

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
            isActiveTab={isActiveTab}
            requestsLeft={requestsLeft}
            isLoading={studioData.isLoading}
            handleCancel={studioData.handleCancel}
            templates={templates}
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
              onSubmit={studioData.onSubmit}
              isActiveTab={isActiveTab}
              requestsLeft={requestsLeft}
              isLoading={studioData.isLoading}
              handleCancel={studioData.handleCancel}
              templates={templates}
            />
          )}
      </ScrollToBottom>
    </div>
  );
};

export default memo(Conversation);
