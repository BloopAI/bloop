import { Dispatch, memo, SetStateAction } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import { ArrowLeft } from '../../../icons';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
};

const TemplatesPanel = ({ setLeftPanel }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col w-full">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5">
        <div className="flex items-center gap-3">
          <Button
            size="small"
            variant="tertiary"
            onlyIcon
            title={t('Back')}
            onClick={() => setLeftPanel({ type: StudioLeftPanelType.CONTEXT })}
          >
            <ArrowLeft />
          </Button>
          <p className="body-s text-label-title">
            <Trans>My templates</Trans>
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(TemplatesPanel);
