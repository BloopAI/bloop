import { memo, useCallback, useContext, MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trans } from 'react-i18next';
import { DeviceContext } from '../../../context/deviceContext';
import { CodeLineWithSparkleIcon } from '../../../icons';
import { TabTypesEnum } from '../../../types/general';
import { TabsContext } from '../../../context/tabsContext';
import Button from '../../Button';

type Props = {
  popupPosition?: {
    top: number;
    left: number;
  } | null;
  selectedLines?: [number, number];
  closePopup: () => void;
  path: string;
  repoRef: string;
  branch?: string | null;
  side: 'left' | 'right';
};

const initial = { opacity: 0, transform: 'translateY(1rem)' };
const animate = { transform: 'translateY(0rem)', opacity: 1 };
const exit = { opacity: 0, transform: 'translateY(1rem)' };

const SelectionPopup = ({
  popupPosition,
  selectedLines,
  closePopup,
  path,
  repoRef,
  branch,
  side,
}: Props) => {
  const { isSelfServe } = useContext(DeviceContext);
  const { openNewTab } = useContext(TabsContext.Handlers);

  const handleExplain = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (selectedLines) {
        openNewTab(
          {
            type: TabTypesEnum.CHAT,
            initialQuery: {
              path,
              repoRef,
              branch,
              lines: selectedLines,
            },
          },
          side === 'left' ? 'right' : 'left',
        );
      }
      closePopup();
    },
    [path, repoRef, branch, selectedLines, side, closePopup],
  );

  return (
    <AnimatePresence>
      {popupPosition && (
        <motion.div
          className="fixed z-[120]"
          style={popupPosition}
          initial={initial}
          animate={animate}
          exit={exit}
        >
          <div className="flex gap-1 items-center p-1 bg-bg-base border border-bg-border rounded-6 shadow-medium overflow-hidden select-none">
            {/*{selectedLinesLength > 1000 ? (*/}
            {/*  <button*/}
            {/*    className="h-8 flex items-center justify-center gap-1 px-2 caption text-label-muted"*/}
            {/*    disabled*/}
            {/*  >*/}
            {/*    <div className="w-4 h-4">*/}
            {/*      <InfoIcon raw />*/}
            {/*    </div>*/}
            {/*    <Trans>Select less code</Trans>*/}
            {/*  </button>*/}
            {/*) : (*/}
            {/*  <>*/}
            {/*{isSelfServe && (*/}
            {/*  <button*/}
            {/*    onClick={(e) => {*/}
            {/*      e.stopPropagation();*/}
            {/*      setPopupPosition(null);*/}
            {/*      const url = new URL(window.location.href);*/}
            {/*      url.searchParams.set(*/}
            {/*        'scrollToLine',*/}
            {/*        `${currentSelection[0][0]}_${currentSelection[1][0]}`,*/}
            {/*      );*/}
            {/*      copyToClipboard(url.toString());*/}
            {/*      closePopup?.();*/}
            {/*    }}*/}
            {/*    className="h-8 flex items-center justify-center gap-1 px-2 hover:bg-bg-base-hover border-r border-bg-border caption text-label-title"*/}
            {/*  >*/}
            {/*    <div className="w-4 h-4">*/}
            {/*      <Clipboard raw />*/}
            {/*    </div>*/}
            {/*    <Trans>Copy link</Trans>*/}
            {/*  </button>*/}
            {/*)}*/}
            <Button variant="tertiary" size="mini" onClick={handleExplain}>
              <CodeLineWithSparkleIcon sizeClassName="w-3.5 h-3.5" />
              <Trans>Explain</Trans>
            </Button>
            {/*  </>*/}
            {/*)}*/}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default memo(SelectionPopup);
