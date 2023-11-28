import { TFunction } from 'i18next';
import {
  GlobeIcon,
  HardDriveIcon,
  MagazineIcon,
  RepositoryIcon,
} from '../icons';
import {
  DOCUMENTATION,
  INITIAL,
  LOCAL_REPOS,
  PRIVATE_REPOS,
  PUBLIC_REPOS,
} from '../consts/commandBar';
import {
  CommandBarActiveStepType,
  CommandBarStepEnum,
  CommandBarStepType,
} from '../types/general';
import { getRepos, syncRepo } from '../services/api';
import { mapGitHubRepos } from '../utils/mappers';

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

export const getActiveStepContent = async (
  t: TFunction<'translation', undefined>,
  activeStep: CommandBarStepType,
): Promise<CommandBarActiveStepType> => {
  const keys: string[] = [];
  let current: CommandBarStepType | undefined = activeStep;

  while (current) {
    if (current.id) {
      keys.unshift(current.id);
    }
    current = current.parent;
  }

  const myObject = {
    initial: async (getContent: boolean) => {
      if (getContent) {
        const contextItems = getContextItems(t);
        return {
          parents: [],
          onBack: () => {},
          sections: [
            { items: contextItems, itemsOffset: 0, label: t('Manage context') },
            {
              items: getProjectItems(t),
              itemsOffset: contextItems.length,
              label: t('Recent projects'),
            },
          ],
        };
      } else {
        return {
          [PRIVATE_REPOS]: async (getContent: boolean) => {
            if (getContent) {
              const repos = await getRepos();
              return {
                parents: ['initial'],
                onBack: () => {},
                sections: mapGitHubRepos(repos.list).map((o, i, array) => ({
                  items: o.items.map((r) => ({
                    label: r.shortName,
                    Icon: RepositoryIcon,
                    onClick: () => {},
                    footerHint: `Open ${r.shortName}`,
                    iconContainerClassName: r.alreadySynced
                      ? 'bg-bg-contrast text-label-contrast'
                      : 'bg-bg-border',
                    footerBtns: r.alreadySynced
                      ? [
                          { label: t('Re-sync'), shortcut: ['cmd', 'R'] },
                          { label: t('Add to project'), shortcut: ['entr'] },
                        ]
                      : r.isSyncing
                      ? [{ label: t('Stop indexing'), shortcut: ['entr'] }]
                      : [
                          {
                            label: t('Start indexing'),
                            shortcut: ['entr'],
                            action: () => syncRepo(r.ref),
                          },
                        ],
                  })),
                  itemsOffset: o.offset,
                  label: o.org,
                })),
              };
            }
            return {
              bloop: () => {
                return {
                  parents: ['initial', 'private_repos'],
                  onBack: () => {},
                  sections: [
                    {
                      items: [
                        {
                          label: 'bloop',
                          Icon: MagazineIcon,
                          onClick: () => {},
                          shortcut: ['cmd', '1'],
                          footerHint: 'Open bloop',
                          footerBtns: [
                            { label: t('Open'), shortcut: ['entr'] },
                          ],
                        },
                      ],
                      itemsOffset: 0,
                      label: 'Bloop',
                    },
                  ],
                };
              },
            };
          },
          [PUBLIC_REPOS]: async (getContent: boolean) => {
            if (getContent) {
              return {
                parents: ['initial'],
                onBack: () => {},
                sections: [
                  {
                    items: [
                      {
                        label: 'knex',
                        Icon: MagazineIcon,
                        onClick: () => {},
                        shortcut: ['cmd', '1'],
                        footerHint: 'Open knex',
                        footerBtns: [{ label: t('Open'), shortcut: ['entr'] }],
                      },
                    ],
                    itemsOffset: 0,
                    label: 'KnexJS',
                  },
                ],
              };
            }
            return {
              bloop: async () => {
                return {
                  parents: ['initial', 'private_repos'],
                  onBack: () => {},
                  sections: [
                    {
                      items: [
                        {
                          label: 'bloop',
                          Icon: MagazineIcon,
                          onClick: () => {},
                          shortcut: ['cmd', '1'],
                          footerHint: 'Open bloop',
                          footerBtns: [
                            { label: t('Open'), shortcut: ['entr'] },
                          ],
                        },
                      ],
                      itemsOffset: 0,
                      label: 'Bloop',
                    },
                  ],
                };
              },
            };
          },
        };
      }
    },
  };

  let result = myObject;
  for (let i = 0; i < keys.length; i++) {
    if (result && typeof result === 'object' && keys[i] in result) {
      // @ts-ignore
      result = await result[keys[i]](i === keys.length - 1);
    }
  }

  // @ts-ignore
  return result as CommandBarActiveStepType;
};
