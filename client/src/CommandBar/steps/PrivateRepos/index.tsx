import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CommandBarContext } from '../../../context/commandBarContext';
import {
  CommandBarItemCustomType,
  CommandBarSectionType,
  CommandBarStepEnum,
  RepoProvider,
  SyncStatus,
} from '../../../types/general';
import { getRepos } from '../../../services/api';
import { mapReposBySections } from '../../../utils/mappers';
import Header from '../../Header';
import Body from '../../Body';
import Footer from '../../Footer';
import RepoItem from '../items/RepoItem';
import ActionsDropdown from './ActionsDropdown';

type Props = {};

const PrivateReposStep = ({}: Props) => {
  const { t } = useTranslation();
  const [sections, setSections] = useState<CommandBarSectionType[]>([]);
  const [sectionsToShow, setSectionsToShow] = useState<CommandBarSectionType[]>(
    [],
  );
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const [inputValue, setInputValue] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const refetchRepos = useCallback(async () => {
    const data = await getRepos();
    const mapped = mapReposBySections(
      data.list.filter(
        (r) =>
          r.provider !== RepoProvider.Local &&
          r.sync_status !== SyncStatus.Done,
      ),
    ).map((o) => ({
      items: o.items.map((r) => ({
        Component: RepoItem,
        componentProps: { repo: r, refetchRepos },
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
          .toLowerCase()
          .startsWith(inputValue.toLowerCase());
      });

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
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={t('Search private repos...')}
      />
      {!!sectionsToShow.length && (
        <Body sections={sectionsToShow} disableKeyNav={isDropdownVisible} />
      )}
      <Footer
        onDropdownVisibilityChange={setIsDropdownVisible}
        ActionsDropdown={ActionsDropdown}
      />
    </div>
  );
};

export default memo(PrivateReposStep);
