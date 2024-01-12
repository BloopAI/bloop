import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  CommandBarItemCustomType,
  CommandBarItemGeneralType,
  CommandBarItemType,
  CommandBarSectionType,
  CommandBarStepEnum,
  RepoProvider,
  SyncStatus,
} from '../../../types/general';
import { PlusSignIcon } from '../../../icons';
import Header from '../../Header';
import Body from '../../Body';
import Footer from '../../Footer';
import { getIndexedRepos } from '../../../services/api';
import { mapReposBySections } from '../../../utils/mappers';
import { ProjectContext } from '../../../context/projectContext';
import { CommandBarContext } from '../../../context/commandBarContext';
import RepoItem from '../items/RepoItem';
import ActionsDropdown from './ActionsDropdown';

type Props = {};

export enum Filter {
  All = 'All',
  Indexed = 'Indexed',
  Indexing = 'Indexing',
  InThisProject = 'In this project',
}

export enum Provider {
  All = 'All',
  GitHub = 'GitHub',
  Local = 'Local',
}

const ManageRepos = ({}: Props) => {
  const { t } = useTranslation();
  const { project } = useContext(ProjectContext.Current);
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const [sections, setSections] = useState<CommandBarSectionType[]>([]);
  const [sectionsToShow, setSectionsToShow] = useState<CommandBarSectionType[]>(
    [],
  );
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [repoType, setRepoType] = useState<Provider>(Provider.All);
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const addItem = useMemo(() => {
    return {
      itemsOffset: 0,
      key: 'add',
      items: [
        {
          label: t('Add new repository'),
          Icon: PlusSignIcon,
          id: CommandBarStepEnum.ADD_NEW_REPO,
          shortcut: ['cmd', 'A'],
          footerHint: '',
          footerBtns: [
            {
              label: t('Add'),
              shortcut: ['entr'],
            },
          ],
          key: 'add',
        },
      ],
    };
  }, []);

  const refetchRepos = useCallback(() => {
    getIndexedRepos().then((data) => {
      const mapped = mapReposBySections(data.list).map((o) => ({
        items: o.items.map((r) => ({
          Component: RepoItem,
          componentProps: { repo: r, refetchRepos },
          key: r.ref,
        })),
        itemsOffset: o.offset + 1,
        label: o.org === 'Local' ? t('Local') : o.org,
        key: o.org,
      }));
      setSections([addItem, ...mapped]);
    });
  }, []);

  useEffect(() => {
    if (filter === Filter.All && !inputValue && repoType === Provider.All) {
      setSectionsToShow(sections);
      return;
    }
    const newSectionsToShow: CommandBarSectionType[] = [];
    const filterByStatus = (item: CommandBarItemType) => {
      if ('componentProps' in item) {
        switch (filter) {
          case Filter.Indexing:
            return [
              SyncStatus.Syncing,
              SyncStatus.Indexing,
              SyncStatus.Queued,
            ].includes(item.componentProps.repo.sync_status);
          case Filter.Indexed:
            return item.componentProps.repo.sync_status === SyncStatus.Done;
          case Filter.InThisProject:
            return !!project?.repos.find(
              (r) => r.repo.ref === item.componentProps.repo.ref,
            );
          default:
            return true;
        }
      }
      return false;
    };

    const filterByProvider = (item: CommandBarItemType) => {
      if ('componentProps' in item) {
        switch (repoType) {
          case Provider.GitHub:
            return item.componentProps.repo.provider === RepoProvider.GitHub;
          case Provider.Local:
            return item.componentProps.repo.provider === RepoProvider.Local;
          default:
            return true;
        }
      }
      return false;
    };

    const filterByName = (
      item: CommandBarItemGeneralType | CommandBarItemCustomType,
    ) => {
      return 'componentProps' in item
        ? item.componentProps.repo.shortName
            .toLowerCase()
            .includes(inputValue.toLowerCase())
        : item.label.toLowerCase().includes(inputValue.toLowerCase());
    };

    sections.forEach((s) => {
      const items = s.items.filter(
        (item) =>
          filterByProvider(item) && filterByStatus(item) && filterByName(item),
      );

      if (items.length) {
        newSectionsToShow.push({
          ...s,
          items,
          itemsOffset: newSectionsToShow[newSectionsToShow.length - 1]
            ? newSectionsToShow[newSectionsToShow.length - 1].itemsOffset +
              newSectionsToShow[newSectionsToShow.length - 1].items.length
            : 0,
        });
      }
    });
    setSectionsToShow(newSectionsToShow);
  }, [sections, filter, inputValue, project?.repos, repoType]);

  useEffect(() => {
    refetchRepos();
  }, []);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const actionsDropdownProps = useMemo(() => {
    return {
      repoType,
      setRepoType,
      filter,
      setFilter,
    };
  }, [repoType, filter]);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[t('Manage repositories')]}
        value={inputValue}
        onChange={handleInputChange}
        handleBack={handleBack}
        placeholder={t('')}
        disableKeyNav={isDropdownVisible}
      />
      {sectionsToShow.length ? (
        <Body sections={sectionsToShow} disableKeyNav={isDropdownVisible} />
      ) : (
        <div className="flex-1 items-center justify-center text-label-muted text-center py-2">
          <Trans>No repositories found...</Trans>
        </div>
      )}
      <Footer
        onDropdownVisibilityChange={setIsDropdownVisible}
        ActionsDropdown={ActionsDropdown}
        actionsDropdownProps={actionsDropdownProps}
      />
    </div>
  );
};

export default memo(ManageRepos);
