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
import { CommandBarContext } from '../../context/commandBarContext';
import { PlusSignIcon } from '../../icons';
import {
  CommandBarSectionType,
  CommandBarStepEnum,
  RepoProvider,
} from '../../types/general';
import { getIndexedRepos, scanLocalRepos, syncRepo } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import Footer from '../Footer';
import Body from '../Body';
import Header from '../Header';
import RepoItem from './items/RepoItem';

type Props = {};

const LocalRepos = ({}: Props) => {
  const { t } = useTranslation();
  const [chosenFolder, setChosenFolder] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const { homeDir, chooseFolder } = useContext(DeviceContext);
  const { setChosenStep, setFocusedItem } = useContext(
    CommandBarContext.Handlers,
  );

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleChooseFolder = useCallback(async () => {
    let folder: string | string[] | null;
    if (chooseFolder) {
      try {
        folder = await chooseFolder({
          directory: true,
          defaultPath: homeDir,
        });
      } catch (err) {
        console.log(err);
      }
    }
    // @ts-ignore
    if (typeof folder === 'string') {
      setChosenFolder(folder);
    }
  }, [chooseFolder, homeDir]);

  const enterAddMode = useCallback(async () => {
    setFocusedItem({
      footerHint: t('Select a folder containing a git repository'),
      footerBtns: [{ label: t('Start indexing'), shortcut: ['entr'] }],
    });
    await handleChooseFolder();
  }, []);

  useEffect(() => {
    if (chosenFolder) {
      scanLocalRepos(chosenFolder).then((data) => {
        if (data.list.length === 1) {
          syncRepo(data.list[0].ref);
          refetchRepos();
          return;
        }
      });
    }
  }, [chosenFolder]);

  const addItem = useMemo(() => {
    return {
      itemsOffset: 0,
      key: 'add',
      items: [
        {
          label: t('Add local repository'),
          Icon: PlusSignIcon,
          footerHint: t('Add a repository from your local machine'),
          footerBtns: [
            {
              label: t('Select folder'),
              shortcut: ['entr'],
            },
          ],
          key: 'add',
          id: 'Add',
          onClick: enterAddMode,
        },
      ],
    };
  }, []);
  const [sections, setSections] = useState<CommandBarSectionType[]>([addItem]);

  const breadcrumbs = useMemo(() => {
    return [t('Local repositories')];
  }, [t]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const refetchRepos = useCallback(() => {
    getIndexedRepos().then((data) => {
      const mapped = data.list
        .filter((r) => r.provider === RepoProvider.Local)
        .map((r) => ({
          Component: RepoItem,
          componentProps: { repo: { ...r, shortName: r.name }, refetchRepos },
          key: r.ref,
        }));
      if (!mapped.length) {
        enterAddMode();
      }
      setSections([
        addItem,
        {
          itemsOffset: 1,
          key: 'indexed-repos',
          label: t('Indexed local repositories'),
          items: mapped,
        },
      ]);
    });
  }, []);

  useEffect(() => {
    refetchRepos();
  }, []);

  const sectionsToShow = useMemo(() => {
    if (!inputValue) {
      return sections;
    }
    const newSections: CommandBarSectionType[] = [];
    sections.forEach((s) => {
      const newItems = s.items.filter((i) =>
        ('label' in i ? i.label : i.componentProps.repo.shortName)
          .toLowerCase()
          .includes(inputValue.toLowerCase()),
      );
      if (newItems.length) {
        newSections.push({ ...s, items: newItems });
      }
    });
    return newSections;
  }, [inputValue, sections]);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        value={inputValue}
        onChange={handleInputChange}
        placeholder={t('Search local repos...')}
      />
      <Body sections={sectionsToShow} />
      <Footer />
    </div>
  );
};

export default memo(LocalRepos);
