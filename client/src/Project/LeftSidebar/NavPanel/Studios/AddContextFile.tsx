import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../../components/Button';
import { CommandBarContext } from '../../../../context/commandBarContext';
import { CommandBarStepEnum } from '../../../../types/general';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';

type Props = {
  studioId: string;
  index: string;
};

const AddContextFile = ({ studioId, index }: Props) => {
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
      className={`pb-2 pr-4 pl-10.5 ${isFocused ? 'bg-bg-sub-hover' : ''}`}
      {...props}
    >
      <div className="flex flex-col items-center p-4 gap-4 rounded-md border border-dashed border-bg-border">
        <p className="select-none body-mini text-label-base">
          <Trans>Studio conversation require at least one context file.</Trans>
        </p>
        <Button variant="secondary" size="mini" onClick={onClick}>
          <Trans>Add file</Trans>
        </Button>
      </div>
    </div>
  );
};

export default memo(AddContextFile);
