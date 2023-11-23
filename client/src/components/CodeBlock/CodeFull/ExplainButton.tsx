import { AnimatePresence, motion } from 'framer-motion';
import { Trans } from 'react-i18next';
import React, { memo, useContext } from 'react';
import { Clipboard, Feather, Info, Sparkle } from '../../../icons';
import { findElementInCurrentTab } from '../../../utils/domUtils';
import { ChatContext } from '../../../context/chatContext';
import { DeviceContext } from '../../../context/deviceContext';
import { copyToClipboard } from '../../../utils';
import { ParsedQueryTypeEnum } from '../../../types/general';

type Props = {
  popupPosition: {
    top: number;
    left: number;
  } | null;
  setPopupPosition: (p: null) => void;
  selectedLinesLength: number;
  currentSelection:
    | [[number, number], [number, number]]
    | [[number, number]]
    | [];
  closePopup?: () => void;
  relativePath: string;
};

const ExplainButton = ({
  popupPosition,
  setPopupPosition,
  selectedLinesLength,
  currentSelection,
  closePopup,
  relativePath,
}: Props) => {
  const {
    setSubmittedQuery,
    setChatOpen,
    setSelectedLines,
    setConversation,
    setThreadId,
    setIsHistoryTab,
  } = useContext(ChatContext.Setters);
  const { isSelfServe } = useContext(DeviceContext);

  return (
    <AnimatePresence>
      {popupPosition && currentSelection?.length === 2 && (
        <motion.div
          className="fixed z-[120]"
          style={popupPosition}
          initial={{ opacity: 0, transform: 'translateY(1rem)' }}
          animate={{ transform: 'translateY(0rem)', opacity: 1 }}
          exit={{ opacity: 0, transform: 'translateY(1rem)' }}
        >
          <div className="bg-bg-base border border-bg-border rounded-md shadow-high flex overflow-hidden select-none">
            {selectedLinesLength > 1000 ? (
              <button
                className="h-8 flex items-center justify-center gap-1 px-2 caption text-label-muted"
                disabled
              >
                <div className="w-4 h-4">
                  <Info raw />
                </div>
                <Trans>Select less code</Trans>
              </button>
            ) : (
              <>
                {isSelfServe && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopupPosition(null);
                      const url = new URL(window.location.href);
                      url.searchParams.set(
                        'scrollToLine',
                        `${currentSelection[0][0]}_${currentSelection[1][0]}`,
                      );
                      copyToClipboard(url.toString());
                      closePopup?.();
                    }}
                    className="h-8 flex items-center justify-center gap-1 px-2 hover:bg-bg-base-hover border-r border-bg-border caption text-label-title"
                  >
                    <div className="w-4 h-4">
                      <Clipboard raw />
                    </div>
                    <Trans>Copy link</Trans>
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatOpen(true);
                    setPopupPosition(null);
                    setIsHistoryTab(false);
                    setThreadId('');
                    setConversation([]);
                    setSelectedLines([
                      currentSelection[0][0],
                      currentSelection[1][0],
                    ]);
                    closePopup?.();
                    setTimeout(
                      () => findElementInCurrentTab('.ProseMirror')?.focus(),
                      300,
                    );
                  }}
                  className="h-8 flex items-center justify-center gap-1 px-2 hover:bg-bg-base-hover border-r border-bg-border caption text-label-title"
                >
                  <div className="w-4 h-4">
                    <Feather raw />
                  </div>
                  <Trans>Ask bloop</Trans>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConversation([]);
                    setThreadId('');
                    setSelectedLines([
                      currentSelection[0][0],
                      currentSelection[1][0],
                    ]);
                    setIsHistoryTab(false);
                    const v = `#explain_${relativePath}:${
                      currentSelection[0][0]
                    }-${currentSelection[1][0]}-${Date.now()}`;
                    setSubmittedQuery({
                      plain: v,
                      parsed: [{ type: ParsedQueryTypeEnum.TEXT, text: v }],
                    });
                    setChatOpen(true);
                    setPopupPosition(null);
                    closePopup?.();
                  }}
                  className="h-8 flex items-center justify-center gap-1 px-2 hover:bg-bg-base-hover caption text-label-title"
                >
                  <div className="w-4 h-4">
                    <Sparkle raw />
                  </div>
                  <Trans>Explain</Trans>
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(ExplainButton);
