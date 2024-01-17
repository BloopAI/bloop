import React, { memo, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { UIContext } from '../context/uiContext';
import Header from '../components/Header';
import useKeyboardNavigation from '../hooks/useKeyboardNavigation';
import { ProjectSettingSections } from '../types/general';
import SectionsNav from '../components/SectionsNav';
import { CodeStudioIcon, ShapesIcon } from '../icons';
import General from './General';
import Templates from './Templates';

type Props = {};

const ProjectSettings = ({}: Props) => {
  const { t } = useTranslation();
  const {
    isProjectSettingsOpen,
    setProjectSettingsOpen,
    projectSettingsSection,
    setProjectSettingsSection,
  } = useContext(UIContext.ProjectSettings);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setProjectSettingsOpen(false);
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent, !isProjectSettingsOpen);

  return isProjectSettingsOpen ? (
    <div className="fixed top-0 bottom-0 left-0 right-0 bg-bg-sub select-none z-40">
      <Header type="project-settings" />
      <div className="mx-auto my-8 px-3 flex max-w-6xl items-start justify-start w-full gap-13">
        <SectionsNav<ProjectSettingSections>
          activeItem={projectSettingsSection}
          sections={[
            {
              title: t('Project'),
              Icon: ShapesIcon,
              items: [
                {
                  type: ProjectSettingSections.GENERAL,
                  onClick: setProjectSettingsSection,
                  label: t('General'),
                },
              ],
            },
            {
              title: t('Studio'),
              Icon: CodeStudioIcon,
              items: [
                {
                  type: ProjectSettingSections.TEMPLATES,
                  onClick: setProjectSettingsSection,
                  label: t('Templates'),
                },
              ],
            },
          ]}
        />
        {projectSettingsSection === ProjectSettingSections.GENERAL ? (
          <General />
        ) : projectSettingsSection === ProjectSettingSections.TEMPLATES ? (
          <Templates />
        ) : null}
        <div className="w-56 flex-1 hidden lg:block" />
      </div>
    </div>
  ) : null;
};

export default memo(ProjectSettings);
