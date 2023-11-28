import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  CommandBarSectionType,
  CommandBarStepEnum,
  RepoProvider,
} from '../types/general';
import { CommandBarContext } from '../context/commandBarContext';
import { getIndexedRepos, syncRepo } from '../services/api';
import { PlusSignIcon } from '../icons';
import Header from './Header';
import Body from './Body';
import Footer from './Footer';
import RepoItem from './RepoItem';

type Props = {};

const PublicRepos = ({}: Props) => {
  const { t } = useTranslation();
  const [isAddMode, setIsAddMode] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const { setChosenStep, setFocusedItem } = useContext(
    CommandBarContext.Handlers,
  );

  const enterAddMode = useCallback(() => {
    setFocusedItem({
      footerHint: t('Paste a link to any public repository hosted on GitHub'),
      footerBtns: [{ label: t('Start indexing'), shortcut: ['entr'] }],
    });
    setIsAddMode(true);
  }, []);

  const addItem = useMemo(() => {
    return {
      itemsOffset: 0,
      items: [
        {
          label: 'Add public repository',
          Icon: PlusSignIcon,
          footerHint: t('Add any public repository hosted on GitHub'),
          footerBtns: [
            {
              label: t('Add'),
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
    const arr = [t('Public repositories')];
    if (isAddMode) {
      arr.push(t('Add public repository'));
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
        .filter((r) => r.provider !== RepoProvider.Local)
        .map((r) => ({
          Component: RepoItem,
          componentProps: { repo: { ...r, shortName: r.ref.split('/').pop() } },
          key: r.ref,
        }));
      setSections([
        addItem,
        {
          itemsOffset: 1,
          label: t('Indexed GitHub repositories'),
          items: mapped,
        },
      ]);
    });
  }, []);

  useEffect(() => {
    refetchRepos();
  }, []);

  const handleAddSubmit = useCallback((inputValue: string) => {
    setFocusedItem({
      footerHint: t('Verifying access...'),
    });
    let cleanRef = inputValue
      .replace('https://', '')
      .replace('github.com/', '')
      .replace(/\.git$/, '')
      .replace(/"$/, '')
      .replace(/^"/, '')
      .replace(/\/$/, '');
    if (inputValue.startsWith('git@github.com:')) {
      cleanRef = inputValue.slice(15).replace(/\.git$/, '');
    }
    axios(`https://api.github.com/repos/${cleanRef}`)
      .then((resp) => {
        if (resp?.data?.visibility === 'public') {
          syncRepo(`github.com/${cleanRef}`);
          setIsAddMode(false);
          refetchRepos();
        } else {
          setFocusedItem({
            footerHint: t(
              "This is not a public repository / We couldn't find this repository",
            ),
          });
        }
      })
      .catch((err) => {
        console.log(err);
        setFocusedItem({
          footerHint: t(
            "This is not a public repository / We couldn't find this repository",
          ),
        });
      });
  }, []);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        customSubmitHandler={isAddMode ? handleAddSubmit : undefined}
      />
      {isAddMode ? null : <Body sections={sections} />}
      <Footer />
    </div>
  );
};

export default memo(PublicRepos);
