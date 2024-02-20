import React, {
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
import TutorialTooltip from '../../Tutorial/TutorialTooltip';
import TutorialBody from '../../Tutorial/TutorialBody';
import { tutorialSteps } from '../../../consts/tutorialSteps';
import { UIContext } from '../../../context/uiContext';
import ActionsDropdown from './ActionsDropdown';

type Props = {
  shouldShowTutorial?: boolean;
};

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

const ManageRepos = ({ shouldShowTutorial }: Props) => {
  const { t } = useTranslation();
  const { project } = useContext(ProjectContext.Current);
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const { setOnBoardingState } = useContext(UIContext.Onboarding);
  const [sections, setSections] = useState<CommandBarSectionType[]>([]);
  const [sectionsToShow, setSectionsToShow] = useState<CommandBarSectionType[]>(
    [],
  );
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [filter, setFilter] = useState<Filter>(Filter.All);
  const [repoType, setRepoType] = useState<Provider>(Provider.All);
  const [inputValue, setInputValue] = useState('');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState('');

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
          componentProps: {
            repo: r,
            refetchRepos,
            onSync: () => {
              setSelectedRepo(r.shortName);
              setTutorialStep(3);
            },
            onDone: () => {
              setTutorialStep(4);
            },
            onAddToProject: () => {
              setOnBoardingState((prev) => ({
                ...prev,
                isCommandBarTutorialFinished: true,
              }));
              setTutorialStep(5);
            },
          },
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
            ?.toLowerCase()
            .includes(inputValue?.toLowerCase())
        : item.label?.toLowerCase().includes(inputValue?.toLowerCase());
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
        });
      }
    });
    setSectionsToShow(newSectionsToShow);
  }, [sections, filter, inputValue, project?.repos, repoType]);

  useEffect(() => {
    refetchRepos();
  }, []);

  useEffect(() => {
    // if user started with non-private repo
    if (shouldShowTutorial && tutorialStep === 0 && sections.length > 1) {
      const firstRepo = (sections[1].items[0] as CommandBarItemCustomType)
        .componentProps.repo;
      setTutorialStep(firstRepo.isSyncing ? 3 : 4);
      setSelectedRepo(firstRepo.shortName);
    }
  }, [sections, tutorialStep, shouldShowTutorial]);

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
    <div className="flex flex-col h-[28.875rem] w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[t('Manage repositories')]}
        value={inputValue}
        onChange={handleInputChange}
        handleBack={handleBack}
        placeholder={t('')}
        disableKeyNav={isDropdownVisible}
      />
      {shouldShowTutorial && tutorialStep < 5 ? (
        <TutorialTooltip
          content={
            <TutorialBody
              stepNumber={tutorialStep + 1}
              title={t(tutorialSteps[tutorialStep].title)}
              description={t(tutorialSteps[tutorialStep].description, {
                repoName: selectedRepo,
              })}
              hint={
                tutorialStep > 0
                  ? t(tutorialSteps[tutorialStep].hint[0])
                  : t(tutorialSteps[tutorialStep].hint[0]) +
                    t(tutorialSteps[0].hint[1]) +
                    '.'
              }
            />
          }
          wrapperClassName="absolute top-[7.5rem] left-0 right-0"
        >
          <div className="" />
        </TutorialTooltip>
      ) : null}
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
