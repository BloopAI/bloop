import { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SectionLabel from '../Dropdown/Section/SectionLabel';
import SectionItem from '../Dropdown/Section/SectionItem';
import { CogIcon, PlusSignIcon, ShapesIcon } from '../../icons';
import { ProjectContext } from '../../context/projectContext';
import { CommandBarContext } from '../../context/commandBarContext';
import {
  CommandBarStepEnum,
  ProjectSettingSections,
} from '../../types/general';
import { UIContext } from '../../context/uiContext';
import FileIcon from '../FileIcon';
import { getFileExtensionForLang } from '../../utils';

type Props = {};

const ProjectsDropdown = ({}: Props) => {
  const { t } = useTranslation();
  const { project, setCurrentProjectId } = useContext(ProjectContext.Current);
  const { projects } = useContext(ProjectContext.All);
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { setProjectSettingsSection, setProjectSettingsOpen } = useContext(
    UIContext.ProjectSettings,
  );

  const createNewProject = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.CREATE_PROJECT });
    setIsVisible(true);
  }, []);

  const openProjectSettings = useCallback(() => {
    setProjectSettingsOpen(true);
    setProjectSettingsSection(ProjectSettingSections.GENERAL);
  }, []);

  return (
    <div className="">
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionLabel text={t('Projects')} />
        {projects.map((p) => (
          <SectionItem
            key={p.id}
            isSelected={p.id === project?.id}
            onClick={() => setCurrentProjectId(p.id)}
            label={p.name}
            icon={
              p.most_common_langs?.[0] ? (
                <FileIcon
                  filename={getFileExtensionForLang(p.most_common_langs[0])}
                  noMargin
                />
              ) : (
                <ShapesIcon sizeClassName="w-4 h-4" />
              )
            }
          />
        ))}
      </div>
      <div className="flex flex-col p-1 items-start border-b border-bg-border">
        <SectionItem
          onClick={openProjectSettings}
          label={t('Project settings')}
          icon={<CogIcon sizeClassName="w-4 h-4" />}
          shortcut={['option', 'P']}
        />
      </div>
      <div className="flex flex-col p-1 items-start">
        <SectionItem
          onClick={createNewProject}
          label={t('New project')}
          icon={<PlusSignIcon sizeClassName="w-4 h-4" />}
          shortcut={['cmd', 'N']}
        />
      </div>
    </div>
  );
};

export default memo(ProjectsDropdown);
