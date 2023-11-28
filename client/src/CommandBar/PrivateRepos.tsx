import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { CommandBarContext } from '../context/commandBarContext';
import {
  CommandBarItemCustomType,
  CommandBarSectionType,
  CommandBarStepEnum,
  SyncStatus,
} from '../types/general';
import { getRepos } from '../services/api';
import { mapGitHubRepos } from '../utils/mappers';
import Dropdown from '../components/Dropdown';
import Button from '../components/Button';
import ChevronDown from '../icons/ChevronDown';
import SectionLabel from '../components/Dropdown/Section/SectionLabel';
import SectionItem from '../components/Dropdown/Section/SectionItem';
import Header from './Header';
import Body from './Body';
import Footer from './Footer';
import RepoItem from './RepoItem';

type Props = {};

const PrivateReposStep = ({}: Props) => {
  const { t } = useTranslation();
  const [sections, setSections] = useState<CommandBarSectionType[]>([]);
  const [sectionsToShow, setSectionsToShow] = useState<CommandBarSectionType[]>(
    [],
  );
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const [filter, setFilter] = useState('All');

  const refetchRepos = useCallback(async () => {
    const data = await getRepos();
    const mapped = mapGitHubRepos(data.list).map((o) => ({
      items: o.items.map((r) => ({
        Component: RepoItem,
        componentProps: { repo: r, refetchRepos },
        key: r.ref,
      })),
      itemsOffset: o.offset,
      label: o.org,
    }));
    setSections(mapped);
  }, []);

  useEffect(() => {
    if (filter === 'All') {
      setSectionsToShow(sections);
      return;
    }
    const newSectionsToShow: CommandBarSectionType[] = [];
    sections.forEach((s) => {
      const items = (s.items as CommandBarItemCustomType[]).filter((item) => {
        if (filter === 'Indexing') {
          return [
            SyncStatus.Syncing,
            SyncStatus.Indexing,
            SyncStatus.Queued,
          ].includes(item.componentProps.repo.sync_status);
        }
        if (filter === 'Indexed') {
          return item.componentProps.repo.sync_status === SyncStatus.Done;
        }
        return false;
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
  }, [sections, filter]);

  useEffect(() => {
    refetchRepos();
  }, []);

  const breadcrumbs = useMemo(() => {
    return [t('Private repositories')];
  }, [t]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const filterDropdownItems = useMemo(() => {
    return (
      <div className="">
        <div className="flex flex-col p-1 items-start">
          <SectionLabel text={t('Filter by')} />
          <SectionItem
            isSelected={filter === 'All'}
            onClick={() => setFilter('All')}
            label={t('All')}
          />
          <SectionItem
            isSelected={filter === 'Indexing'}
            onClick={() => setFilter('Indexing')}
            label={t('Indexing')}
          />
          <SectionItem
            isSelected={filter === 'Indexed'}
            onClick={() => setFilter('Indexed')}
            label={t('Indexed')}
          />
          <SectionItem
            isSelected={filter === 'In this project'}
            onClick={() => setFilter('In this project')}
            label={t('In this project')}
          />
        </div>
      </div>
    );
  }, [t, filter]);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        customRightComponent={
          <Dropdown
            dropdownItems={filterDropdownItems}
            appendTo={document.body}
          >
            <Button size="mini" variant="secondary">
              {t(filter)}
              <ChevronDown sizeClassName="w-3.5 h-3.5" />
            </Button>
          </Dropdown>
        }
      />
      <Body sections={sectionsToShow} />
      <Footer />
    </div>
  );
};

export default memo(PrivateReposStep);
