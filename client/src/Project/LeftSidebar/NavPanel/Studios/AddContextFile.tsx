import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../../components/Button';
import { CommandBarContext } from '../../../../context/commandBarContext';
import { CommandBarStepEnum } from '../../../../types/general';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';
import PlusSign from '../../../../icons/PlusSign';

type Props = {
  studioId: string;
  index: string;
  isFull?: boolean;
};

const AddContextFile = ({ studioId, index, isFull }: Props) => {
  useTranslation();
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );

  const handleClick = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.SEARCH_FILES, data: { studioId } });
    setIsVisible(true);
  }, [studioId]);

  const {
    isFocused,
    props: { onClick, ...props },
  } = useArrowNavigationItemProps<HTMLDivElement>(index, handleClick);

  return (
    <div
      className={`${
        isFull ? 'pb-2' : isFocused ? 'text-label-title' : 'text-label-base '
      } pr-4 pl-10.5 ${isFocused ? 'bg-bg-sub-hover' : ''}`}
      {...props}
    >
      {isFull ? (
        <div className="flex flex-col items-center p-4 gap-4 rounded-md border border-dashed border-bg-border">
          <p className="select-none body-mini text-label-base">
            <Trans>
              Studio conversation require at least one context file.
            </Trans>
          </p>
          <Button variant="secondary" size="mini" onClick={onClick}>
            <Trans>Add files</Trans>
          </Button>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 cursor-pointer h-7 w-full"
          onClick={onClick}
        >
          <PlusSign sizeClassName="w-3.5 h-3.5" />
          <Trans>Add files</Trans>
        </div>
      )}
    </div>
  );
};

export default memo(AddContextFile);
