import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import SectionLabel from '../Dropdown/Section/SectionLabel';
import SectionItem from '../Dropdown/Section/SectionItem';
import { CogIcon, PlusSignIcon, ShapesIcon } from '../../icons';

type Props = {};

const ProjectsDropdown = ({}: Props) => {
  const { t } = useTranslation();
  return (
    <div className="">
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionLabel text={t('Projects')} />
        <SectionItem
          isSelected
          onClick={() => {}}
          label={'Default project'}
          icon={<ShapesIcon sizeClassName="w-4 h-4" />}
        />
      </div>
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionItem
          onClick={() => {}}
          label={t('Project settings')}
          icon={<CogIcon sizeClassName="w-4 h-4" />}
          shortcut={['option', 'A']}
        />
      </div>
      <div className="flex flex-col p-1 items-start">
        <SectionItem
          onClick={() => {}}
          label={t('New project')}
          icon={<PlusSignIcon sizeClassName="w-4 h-4" />}
          shortcut={['cmd', 'N']}
        />
      </div>
    </div>
  );
};

export default memo(ProjectsDropdown);
