import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CloseSign, Sparkles } from '../../../icons';
import Button from '../../../components/Button';
import CodeFull from '../../../components/CodeBlock/CodeFull';
import { FullResult } from '../../../types/results';
import { FullResultModeEnum } from '../../../types/general';
import ModalOrSidebar from '../../../components/ModalOrSidebar';
import { ChatContext } from '../../../context/chatContext';
import { UIContext } from '../../../context/uiContext';
import ModeToggle from './ModeToggle';
import Subheader from './Subheader';

type Props = {
  result: FullResult | null;
  onResultClosed: () => void;
  mode: FullResultModeEnum;
  setMode: (n: FullResultModeEnum) => void;
};

const ResultModal = ({ result, onResultClosed, mode, setMode }: Props) => {
  const { t } = useTranslation();
  const { setSubmittedQuery, setChatOpen, setConversation, setThreadId } =
    useContext(ChatContext.Setters);
  const { setRightPanelOpen } = useContext(UIContext.RightPanel);

  useEffect(() => {
    const action =
      !!result && mode === FullResultModeEnum.MODAL ? 'add' : 'remove';
    document.body.classList[action]('overflow-hidden');
  }, [result, mode]);

  // By tracking if animation is between sidebar and modal, rather than entry and exit, we can vary the transition
  const [isModalSidebarTransition, setIsModalSidebarTransition] =
    useState(false);
  const setModeAndTransition = (newMode: FullResultModeEnum) => {
    setIsModalSidebarTransition(true);
    setMode(newMode);
  };

  const metadata = useMemo(
    () => ({
      lexicalBlocks: [],
      hoverableRanges: result?.hoverableRanges || [],
    }),
    [result?.hoverableRanges],
  );

  const handleExplain = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.stopPropagation();
      if (!result) {
        return;
      }
      setConversation([]);
      setThreadId('');
      const endLine = result.code.split(/\n(?!$)/g).length - 1;
      setRightPanelOpen(false);
      setSubmittedQuery(
        `#explain_${result.relativePath}:0-${endLine}-${Date.now()}`,
      );
      setChatOpen(true);
      onResultClosed();
    },
    [result?.code, result?.relativePath],
  );

  return (
    <ModalOrSidebar
      isModalSidebarTransition={isModalSidebarTransition}
      setIsModalSidebarTransition={setIsModalSidebarTransition}
      isSidebar={mode === FullResultModeEnum.SIDEBAR}
      shouldShow={!!result}
      onClose={onResultClosed}
      containerClassName="w-[60vw]"
      filtersOverlay={mode === FullResultModeEnum.SIDEBAR}
    >
      <div className="flex justify-between items-center p-3 bg-bg-base border-b border-bg-border shadow-low select-none">
        {!!result && (
          <ModeToggle
            repoName={result.repoName}
            relativePath={result.relativePath}
            mode={mode}
            setModeAndTransition={setModeAndTransition}
          />
        )}
        <div className="flex gap-2">
          <Button onClick={handleExplain}>
            <Sparkles raw sizeClassName="w-3.5 h-3.5" />
            <Trans>Explain</Trans>
          </Button>
          <Button
            onlyIcon
            variant="tertiary"
            onClick={onResultClosed}
            title={t('Close')}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
      <div className="w-full flex flex-col overflow-y-auto">
        {!!result && (
          <Subheader
            relativePath={result.relativePath}
            repoName={result.repoName}
            repoPath={result.repoPath}
            onResultClosed={onResultClosed}
          />
        )}
        <div
          className={`flex px-2 pt-4 bg-bg-sub overflow-y-auto code-modal-container`}
        >
          {!!result && (
            <CodeFull
              code={result.code}
              language={result.language}
              relativePath={result.relativePath}
              repoPath={result.repoPath}
              repoName={result.repoName}
              metadata={metadata}
              containerWidth={window.innerWidth * 0.6 - 30}
              containerHeight={window.innerHeight - 16.6 * 16}
              closePopup={onResultClosed}
            />
          )}
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default memo(ResultModal);
