import {
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
import { splitPath } from '../../utils';
import Footer from '../Footer';
import Body from '../Body';
import Header from '../Header';
import RepoItem from './items/RepoItem';

type Props = {};

const LocalRepos = ({}: Props) => {
  const { t } = useTranslation();
  const [isAddMode, setIsAddMode] = useState(false);
  const [chosenFolder, setChosenFolder] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const { homeDir, chooseFolder } = useContext(DeviceContext);
  const { setChosenStep, setFocusedItem } = useContext(
    CommandBarContext.Handlers,
  );

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
    setIsAddMode(true);
    await handleChooseFolder();
  }, []);

  useEffect(() => {
    if (chosenFolder) {
      scanLocalRepos(chosenFolder)
        .then((data) => {
          const mainFolder = splitPath(chosenFolder).pop() || '';

          if (data.list.length === 1) {
            syncRepo(data.list[0].ref);
            refetchRepos();
            setIsAddMode(false);
            return;
          }

          // setRepos(
          //   data.list
          //     .map((r: RepoType) => {
          //       const pathParts = splitPath(r.ref);
          //       const folder = `/${pathParts
          //         .slice(pathParts.indexOf(mainFolder), pathParts.length - 1)
          //         .join('/')}`;
          //       return {
          //         ...r,
          //         folderName: folder,
          //         shortName: pathParts[pathParts.length - 1],
          //         alreadySynced: !!repositories?.find(
          //           (repo) => repo.ref === r.ref,
          //         ),
          //       };
          //     })
          //     .sort((a: RepoUi, b: RepoUi) => a.folderName > b.folderName),
          // );
        })
        .finally(() => setLoading(false));
    }
  }, [chosenFolder]);

  const addItem = useMemo(() => {
    return {
      itemsOffset: 0,
      items: [
        {
          label: 'Add local repository',
          Icon: PlusSignIcon,
          footerHint: t('Add a repository from your local machine'),
          footerBtns: [
            {
              label: t('Select folder'),
              shortcut: ['entr'],
              action: enterAddMode,
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
    const arr = [t('Local repositories')];
    if (isAddMode) {
      arr.push(t('Add local repository'));
    }
    return arr;
  }, [t, isAddMode]);

  const handleBack = useCallback(() => {
    if (isAddMode) {
      setIsAddMode(false);
    } else {
      setChosenStep({ id: CommandBarStepEnum.INITIAL });
    }
  }, [isAddMode]);

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
          label: t('Indexed local repositories'),
          items: mapped,
        },
      ]);
    });
  }, []);

  useEffect(() => {
    refetchRepos();
  }, []);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header breadcrumbs={breadcrumbs} handleBack={handleBack} />
      {isAddMode ? null : <Body sections={sections} />}
      <Footer />
    </div>
  );
};

export default memo(LocalRepos);
