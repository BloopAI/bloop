import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { ChatBubblesIcon, CodeStudioIcon, PlusSignIcon } from '../../../icons';
import Button from '../../../components/Button';
import Dropdown from '../../../components/Dropdown';

type Props = {};

const AddTabButton = ({}: Props) => {
  const { t } = useTranslation();
  return (
    <Dropdown
      dropdownItems={
        <div>
          <div className="flex flex-col p-1 items-start border-y border-bg-border">
            <SectionItem
              icon={
                <ChatBubblesIcon
                  sizeClassName="w-4 h-4"
                  className="text-brand-default"
                />
              }
              label={t('New Chat')}
              shortcut={['option', 'N']}
              onClick={() => {}}
            />
            <SectionItem
              icon={
                <CodeStudioIcon
                  sizeClassName="w-4 h-4"
                  className="text-brand-studio"
                />
              }
              label={t('New Code Studio')}
              shortcut={['option', 'shift', 'N']}
              onClick={() => {}}
            />
          </div>
        </div>
      }
      size="small"
      dropdownPlacement="bottom-end"
    >
      <Button variant="tertiary" size="small" onlyIcon title={t('Add tab')}>
        <PlusSignIcon sizeClassName="w-4 h-4" />
      </Button>
    </Dropdown>
  );
};

export default memo(AddTabButton);
