import React, { memo, useCallback, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ArrowLeftIcon, ChevronDownIcon } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';
import Button from '../Button';
import Dropdown from '../Dropdown';
import { ProjectContext } from '../../context/projectContext';
import { UIContext } from '../../context/uiContext';
import ProjectsDropdown from './ProjectsDropdown';
import HeaderRightPart from './HeaderRightPart';

type Props = {
  type?: 'default' | 'settings' | 'project-settings';
};

const Header = ({ type = 'default' }: Props) => {
  const { t } = useTranslation();
  const { os } = useContext(DeviceContext);
  const { project } = useContext(ProjectContext.Current);
  const { setSettingsOpen } = useContext(UIContext.Settings);
  const { setProjectSettingsOpen } = useContext(UIContext.ProjectSettings);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setProjectSettingsOpen(false);
  }, []);

  return (
    <div
      className="w-screen h-10 flex items-center justify-between border-b border-bg-border bg-bg-base select-none"
      data-tauri-drag-region
    >
      <div className="flex h-full">
        {os.type === 'Darwin' && window.innerHeight !== screen.height ? (
          <span className="w-16" />
        ) : (
          ''
        )}
        {type === 'settings' ? (
          <div className="flex items-center gap-2 pl-4">
            <Button
              onlyIcon
              title={t('Back')}
              onClick={closeSettings}
              variant="tertiary"
              size="small"
            >
              <ArrowLeftIcon sizeClassName="w-5 h-5" />
            </Button>
            <p className="body-mini-b text-label-title">
              <Trans>Account settings</Trans>
            </p>
          </div>
        ) : type === 'project-settings' ? (
          <div className="flex items-center gap-4 pl-4">
            <Button
              onlyIcon
              title={t('Back')}
              onClick={closeSettings}
              variant="tertiary"
              size="small"
            >
              <ArrowLeftIcon sizeClassName="w-5 h-5" />
            </Button>
            <p className="body-mini-b text-label-title">
              {project?.name || 'Default project'}
            </p>
            <p className="body-s-b text-label-muted">›</p>
            <p className="body-mini-b text-label-title">
              <Trans>Project settings</Trans>
            </p>
          </div>
        ) : (
          <Dropdown
            DropdownComponent={ProjectsDropdown}
            dropdownPlacement="bottom-start"
          >
            <div className="flex px-4 items-center text-left h-10 gap-4 border-r border-bg-border hover:bg-bg-base-hover">
              <p className="flex-1 body-s-b">
                {project?.name || 'Default project'}
              </p>
              <ChevronDownIcon raw sizeClassName="w-3.5 h-3.5" />
            </div>
          </Dropdown>
        )}
      </div>
      <HeaderRightPart />
    </div>
  );
};

export default memo(Header);
