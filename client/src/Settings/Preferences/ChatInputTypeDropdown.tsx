import { memo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../components/Dropdown/Section';
import SectionItem from '../../components/Dropdown/Section/SectionItem';
import { UIContext } from '../../context/uiContext';

type Props = {};

const ChatInputTypeDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { chatInputType, setChatInputType } = useContext(
    UIContext.ChatInputType,
  );
  return (
    <div>
      <DropdownSection borderBottom>
        <SectionItem
          label={t('Default')}
          index={'default-input'}
          isSelected={chatInputType === 'default'}
          onClick={() => setChatInputType('default')}
          description={t('Recommended: The classic input')}
        />
      </DropdownSection>
      <DropdownSection>
        <SectionItem
          label={t('Simplified')}
          index={'simple-input'}
          isSelected={chatInputType === 'simplified'}
          onClick={() => setChatInputType('simplified')}
          description={t(
            'Fallback: Use if experiencing problems with the default one',
          )}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ChatInputTypeDropdown);
