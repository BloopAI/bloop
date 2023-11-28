import { TFunction } from 'i18next';
import {
  GlobeIcon,
  HardDriveIcon,
  MagazineIcon,
  RepositoryIcon,
} from '../icons';
import { INITIAL } from '../consts/commandBar';
import { CommandBarStepEnum } from '../types/general';

export const getContextItems = (t: TFunction<'translation', undefined>) => {
  return [
    {
      label: t('Private repositories'),
      Icon: RepositoryIcon,
      id: CommandBarStepEnum.PRIVATE_REPOS,
      key: 'private',
      parent: { id: INITIAL, label: '' },
      shortcut: ['cmd', 'P'],
      footerHint: t('Any repository from your private GitHub account'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
    {
      label: t('Public repositories'),
      Icon: GlobeIcon,
      id: CommandBarStepEnum.PUBLIC_REPOS,
      key: 'public',
      parent: { id: INITIAL, label: '' },
      shortcut: ['cmd', 'shift', 'P'],
      footerHint: t('Any public repository hosted on GitHub'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
    {
      label: t('Local repositories'),
      Icon: HardDriveIcon,
      id: CommandBarStepEnum.LOCAL_REPOS,
      key: 'local',
      parent: { id: INITIAL, label: '' },
      shortcut: ['cmd', 'shift', 'O'],
      footerHint: t('Add a repository from your local machine'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
    {
      label: t('Documentation'),
      Icon: MagazineIcon,
      id: CommandBarStepEnum.DOCS,
      key: 'docs',
      parent: { id: INITIAL, label: '' },
      shortcut: ['cmd', 'D'],
      footerHint: t('Add library documentation'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
  ];
};

export const getProjectItems = (t: TFunction<'translation', undefined>) => {
  return [
    {
      label: 'Default project',
      Icon: MagazineIcon,
      id: 'default_project',
      key: 'default',
      parent: { id: INITIAL, label: '' },
      shortcut: ['cmd', '1'],
      footerHint: 'Open Default project',
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
  ];
};
