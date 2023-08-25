import { Dispatch, memo, SetStateAction, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import { ArrowLeft } from '../../../icons';
import { StudioTemplateType } from '../../../types/api';
import TemplateCard from './TemplateCard';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
};

const TemplatesPanel = ({ setLeftPanel }: Props) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<StudioTemplateType[]>([]);

  useEffect(() => {
    Promise.resolve([
      {
        name: 'Unit testing',
        body: 'Write an unit test for the ReadFileFromRepo function, make sure to handle different operating systems',
      },
      { name: 'Check code', body: 'Please check this code for any errors.' },
      { name: 'My template', body: 'This is my awesome template' },
    ]).then(setTemplates);
  }, []);

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
      <div className="p-8 flex flex-col gap-3">
        {templates.map((t, i) => (
          <TemplateCard key={i} {...t} />
        ))}
      </div>
    </div>
  );
};

export default memo(TemplatesPanel);
