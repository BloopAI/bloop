import React, { memo, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FileIcon, RangeIcon } from '../../../icons';
import KeyboardHint from '../../KeyboardHint';

type Props = {
  currentSelection: [number, number][];
  setCurrentSelection: (s: [number, number][]) => void;
};

const SelectionHint = ({ currentSelection, setCurrentSelection }: Props) => {
  useTranslation();

  const clearSelection = useCallback(() => {
    setCurrentSelection([]);
  }, []);

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 rounded-full flex h-8 items-center gap-2 p-2 pr-2.5 border border-bg-border bg-bg-base shadow-float body-mini text-label-title flex-shrink-0 w-fit z-20">
      {!currentSelection.length ? (
        <FileIcon sizeClassName="w-4.5 h-4.5" />
      ) : (
        <RangeIcon sizeClassName="w-4.5 h-4.5" />
      )}
      <p className="pointer-events-none select-none cursor-default">
        {!currentSelection.length ? (
          <Trans>The whole file will be used as context.</Trans>
        ) : (
          <Trans>Selected ranges will be used as context.</Trans>
        )}
      </p>
      {currentSelection?.length > 1 && (
        <div className="pointer-events-none select-none cursor-default flex gap-1 items-center">
          <Trans>
            <KeyboardHint shortcut="↑" />
            <KeyboardHint shortcut="↓" /> to navigate.
          </Trans>
        </div>
      )}
      {!!currentSelection.length && (
        <>
          <div className="w-px h-2.5 bg-bg-border flex-shrink-0" />
          <button
            type="button"
            className="body-mini-b text-label-muted"
            onClick={clearSelection}
          >
            <Trans>Clear ranges</Trans>
          </button>
        </>
      )}
    </div>
  );
};

export default memo(SelectionHint);
