import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../../components/Button';
import { CommandBarContext } from '../../../../context/commandBarContext';
import { CommandBarStepEnum } from '../../../../types/general';
import { useEnterKey } from '../../../../hooks/useEnterKey';

type Props = {
  studioId: string;
  index: string;
  focusedIndex: string;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
};

const AddContextFile = ({
  studioId,
  index,
  focusedIndex,
  isLeftSidebarFocused,
  isCommandBarVisible,
}: Props) => {
  useTranslation();
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );

  const onAddFile = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.SEARCH_FILES, data: { studioId } });
    setIsVisible(true);
  }, [studioId]);

  useEnterKey(
    onAddFile,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  return (
    <div
      className={`pb-2 pr-4 pl-10.5 ${
        focusedIndex === index ? 'bg-bg-sub-hover' : ''
      }`}
      data-node-index={index}
    >
      <div className="flex flex-col items-center p-4 gap-4 rounded-md border border-dashed border-bg-border">
        <p className="select-none body-mini text-label-base">
          <Trans>Studio conversation require at least one context file.</Trans>
        </p>
        <Button variant="secondary" size="mini" onClick={onAddFile}>
          <Trans>Add file</Trans>
        </Button>
      </div>
    </div>
  );
};

export default memo(AddContextFile);
