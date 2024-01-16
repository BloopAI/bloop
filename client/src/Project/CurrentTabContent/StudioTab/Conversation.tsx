import React, {
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChatMessageServer } from '../../../types/general';
import { ProjectContext } from '../../../context/projectContext';
import ScrollToBottom from '../../../components/ScrollToBottom';
import { StudioContext, StudiosContext } from '../../../context/studiosContext';
import Input from './Input';
import ScrollableContent from './ScrollableContent';
import DeprecatedClientModal from './DeprecatedClientModal';

type Props = {
  side: 'left' | 'right';
  tabKey: string;
};

const Conversation = ({ side, tabKey }: Props) => {
  const { project } = useContext(ProjectContext.Current);
  const { studios } = useContext(StudiosContext);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const studioData: StudioContext | undefined = useMemo(
    () => studios[tabKey],
    [studios, tabKey],
  );

  useEffect(() => {
    setTimeout(() => {
      if (scrollableRef.current) {
        setIsScrollable(
          scrollableRef.current.scrollHeight >
            scrollableRef.current.clientHeight,
        );
      }
    }, 100);
  }, [studioData?.conversation, studioData?.hideMessagesFrom]);

  return !studioData ? null : (
    <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 overflow-auto">
      <ScrollToBottom
        className="max-w-full flex flex-col overflow-auto"
        wrapperRef={scrollableRef}
      >
        <ScrollableContent
          studioData={studioData}
          side={side}
          projectId={project?.id!}
        />
      </ScrollToBottom>
      <Input
        onStop={studioData.stopGenerating}
        submittedQuery={studioData.submittedQuery}
        isStoppable={studioData.isLoading}
        onMessageEditCancel={studioData.onMessageEditCancel}
        generationInProgress={
          (
            studioData.conversation[
              studioData.conversation.length - 1
            ] as ChatMessageServer
          )?.isLoading
        }
        hideMessagesFrom={studioData.hideMessagesFrom}
        queryIdToEdit={studioData.queryIdToEdit}
        valueToEdit={studioData.inputImperativeValue}
        setInputValue={studioData.setInputValue}
        value={studioData.inputValue}
        setConversation={studioData.setConversation}
        conversation={studioData.conversation}
        setSubmittedQuery={studioData.setSubmittedQuery}
        isInputAtBottom={isScrollable}
        projectId={project?.id || '0'}
      />
      <DeprecatedClientModal
        isOpen={studioData.isDeprecatedModalOpen}
        onClose={studioData.closeDeprecatedModal}
      />
    </div>
  );
};

export default memo(Conversation);
