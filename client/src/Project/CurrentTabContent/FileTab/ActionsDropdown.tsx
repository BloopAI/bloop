import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import { SplitViewIcon, FileWithSparksIcon } from '../../../icons';
import { openInSplitViewShortcut } from '../../../consts/commandBar';
import { explainFileShortcut } from './index';

type Props = {
  handleExplain: () => void;
  handleMoveToAnotherSide: () => void;
};

const ActionsDropdown = ({ handleExplain, handleMoveToAnotherSide }: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <DropdownSection>
        <SectionItem
          label={t('Explain file')}
          onClick={handleExplain}
          // isFocused
          shortcut={explainFileShortcut}
          icon={<FileWithSparksIcon sizeClassName="w-4 h-4" />}
        />
        <SectionItem
          label={t('Open in split view')}
          shortcut={openInSplitViewShortcut}
          onClick={handleMoveToAnotherSide}
          // isFocused
          icon={<SplitViewIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ActionsDropdown);
