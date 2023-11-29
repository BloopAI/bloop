import { TFunction } from 'i18next';
import {
  GlobeIcon,
  HardDriveIcon,
  MagazineIcon,
  RepositoryIcon,
} from '../icons';
import { INITIAL } from '../consts/commandBar';
import { CommandBarStepEnum } from '../types/general';
import { ProjectShortType } from '../types/api';

export const getContextItems = (t: TFunction<'translation', undefined>) => {
  return [
    {
      label: t('Private repositories'),
      Icon: RepositoryIcon,
      id: CommandBarStepEnum.PRIVATE_REPOS,
      key: 'private',
      shortcut: ['cmd', 'P'],
      footerHint: t('Any repository from your private GitHub account'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
    {
      label: t('Public repositories'),
      Icon: GlobeIcon,
      id: CommandBarStepEnum.PUBLIC_REPOS,
      key: 'public',
      shortcut: ['cmd', 'shift', 'P'],
      footerHint: t('Any public repository hosted on GitHub'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
    {
      label: t('Local repositories'),
      Icon: HardDriveIcon,
      id: CommandBarStepEnum.LOCAL_REPOS,
      key: 'local',
      shortcut: ['cmd', 'shift', 'O'],
      footerHint: t('Add a repository from your local machine'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
    {
      label: t('Documentation'),
      Icon: MagazineIcon,
      id: CommandBarStepEnum.DOCS,
      key: 'docs',
      shortcut: ['cmd', 'D'],
      footerHint: t('Add library documentation'),
      footerBtns: [{ label: t('Manage'), shortcut: ['entr'] }],
    },
  ];
};
