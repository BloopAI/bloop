import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import {
  SplitViewIcon,
  FileWithSparksIcon,
  StudioPlusSignIcon,
  StudioCloseSignIcon,
} from '../../../icons';
import {
  addToStudioShortcut,
  openInSplitViewShortcut,
  explainFileShortcut,
  removeFromStudioShortcut,
} from '../../../consts/shortcuts';

type Props = {
  handleExplain: () => void;
  handleMoveToAnotherSide: () => void;
  handleAddToStudio: () => void;
  handleRemoveFromStudio: () => void;
  isFileInContext: boolean;
};

const ActionsDropdown = ({
  handleExplain,
  handleMoveToAnotherSide,
  handleAddToStudio,
  handleRemoveFromStudio,
  isFileInContext,
}: Props) => {
  const { t } = useTranslation();

  return (
    <div>
      <DropdownSection borderBottom>
        <SectionItem
          index="explain-file"
          label={t('Explain file')}
          onClick={handleExplain}
          shortcut={explainFileShortcut}
          icon={<FileWithSparksIcon sizeClassName="w-4 h-4" />}
        />
        {isFileInContext ? (
          <SectionItem
            index={'del-from-studio'}
            label={t('Remove from studio')}
            onClick={handleRemoveFromStudio}
            shortcut={removeFromStudioShortcut}
            icon={<StudioCloseSignIcon sizeClassName="w-4 h-4" />}
          />
        ) : (
          <SectionItem
            index={'add-to-studio'}
            label={t('Add to studio')}
            onClick={handleAddToStudio}
            shortcut={addToStudioShortcut}
            icon={<StudioPlusSignIcon sizeClassName="w-4 h-4" />}
          />
        )}
      </DropdownSection>
      <DropdownSection>
        <SectionItem
          index={'split-view'}
          label={t('Open in split view')}
          shortcut={openInSplitViewShortcut}
          onClick={handleMoveToAnotherSide}
          icon={<SplitViewIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(ActionsDropdown);
