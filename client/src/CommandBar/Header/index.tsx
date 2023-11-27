import { ChangeEvent, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CommandBarStepType } from '../../types/general';
import Tooltip from '../../components/Tooltip';
import ChipItem from './ChipItem';

type Props = {
  activeStep: CommandBarStepType;
  handleBack: () => void;
};

const CommandBarHeader = ({ activeStep, handleBack }: Props) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const breadcrumbs = useMemo(() => {
    const parentLabels: string[] = [activeStep.label];
    let current: CommandBarStepType | undefined = activeStep.parent;

    while (current) {
      if (current.label) {
        parentLabels.unshift(current.label);
      }
      current = current.parent;
    }

    return parentLabels;
  }, [activeStep]);

  return (
    <div className="w-full flex flex-col p-4 items-start gap-4 border-b border-bg-border">
      <div className="flex gap-1 items-center w-full select-none">
        {activeStep.parent ? (
          <>
            <Tooltip text={t('Back')} placement={'top'}>
              <button
                className="w-5 flex gap-1 items-center justify-center rounded border border-bg-border code-mini text-label-base ellipsis"
                onClick={handleBack}
              >
                ←
              </button>
            </Tooltip>
            {breadcrumbs.map((b) => (
              <ChipItem key={b} text={b} />
            ))}
          </>
        ) : (
          <ChipItem text="Default project" />
        )}
      </div>
      <input
        value={value}
        onChange={handleChange}
        placeholder={t('Search projects or commands...')}
        type="search"
        autoComplete="off"
        autoCorrect="off"
        className="w-full bg-transparent outline-none focus:outline-0 body-base placeholder:text-label-muted"
        autoFocus
      />
    </div>
  );
};

export default memo(CommandBarHeader);
