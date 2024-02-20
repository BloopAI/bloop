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
import { CommandBarContext } from '../../../context/commandBarContext';
import {
  CommandBarItemCustomType,
  CommandBarSectionType,
  CommandBarStepEnum,
  RepoProvider,
} from '../../../types/general';
import { getRepos } from '../../../services/api';
import { mapReposBySections } from '../../../utils/mappers';
import Header from '../../Header';
import Body from '../../Body';
import Footer from '../../Footer';
import RepoItem from '../items/RepoItem';
import TutorialBody from '../../Tutorial/TutorialBody';
import TutorialTooltip from '../../Tutorial/TutorialTooltip';
import { tutorialSteps } from '../../../consts/tutorialSteps';
import { UIContext } from '../../../context/uiContext';
import ActionsDropdown from './ActionsDropdown';

type Props = {
  shouldShowTutorial?: boolean;
};

const PrivateReposStep = ({ shouldShowTutorial }: Props) => {
  const { t } = useTranslation();
  const [sections, setSections] = useState<CommandBarSectionType[]>([]);
  const [sectionsToShow, setSectionsToShow] = useState<CommandBarSectionType[]>(
    [],
  );
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const { setOnBoardingState } = useContext(UIContext.Onboarding);
  const [inputValue, setInputValue] = useState('');
  const [tutorialStep, setTutorialStep] = useState(2);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const refetchRepos = useCallback(async () => {
    const data = await getRepos();
    const mapped = mapReposBySections(
      data.list.filter((r) => r.provider !== RepoProvider.Local),
    ).map((o) => ({
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
      itemsOffset: o.offset,
      label: o.org,
      key: o.org,
    }));
    setSections(mapped);
  }, []);

  useEffect(() => {
    if (!inputValue) {
      setSectionsToShow(sections);
      return;
    }
    const newSectionsToShow: CommandBarSectionType[] = [];
    sections.forEach((s) => {
      const items = (s.items as CommandBarItemCustomType[]).filter((item) => {
        return item.componentProps.repo.shortName
          ?.toLowerCase()
          .includes(inputValue?.toLowerCase());
      });

      if (items.length) {
        newSectionsToShow.push({
          ...s,
          items,
        });
      }
    });
    setSectionsToShow(newSectionsToShow);
  }, [sections, inputValue]);

  useEffect(() => {
    refetchRepos();
  }, []);

  const breadcrumbs = useMemo(() => {
    return [t('Add private repository')];
  }, [t]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.MANAGE_REPOS });
  }, []);

  return (
    <div className="flex flex-col h-[28.875rem] w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={t('Search private repos...')}
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
              hint={t(tutorialSteps[tutorialStep].hint[0])}
            />
          }
          wrapperClassName="absolute top-[8.5rem] left-0 right-0"
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
      />
    </div>
  );
};

export default memo(PrivateReposStep);
