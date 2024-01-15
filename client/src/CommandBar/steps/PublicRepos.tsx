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
import axios from 'axios';
import { CommandBarStepEnum } from '../../types/general';
import { CommandBarContext } from '../../context/commandBarContext';
import { syncRepo } from '../../services/api';
import Header from '../Header';
import Footer from '../Footer';

type Props = {};

const PublicRepos = ({}: Props) => {
  const { t } = useTranslation();
  const { setChosenStep, setFocusedItem } = useContext(
    CommandBarContext.Handlers,
  );
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  useEffect(() => {
    setFocusedItem({
      footerHint: t('Paste a link to any public repository hosted on GitHub'),
      footerBtns: [{ label: t('Start indexing'), shortcut: ['entr'] }],
    });
  }, []);

  const breadcrumbs = useMemo(() => {
    return [t('Add public repository')];
  }, [t]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.MANAGE_REPOS });
  }, []);

  const handleAddSubmit = useCallback((inputValue: string) => {
    setFocusedItem({
      footerHint: t('Verifying access...'),
      footerBtns: [],
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
          handleBack();
        } else {
          setFocusedItem({
            footerHint: t(
              "This is not a public repository / We couldn't find this repository",
            ),
            footerBtns: [],
          });
        }
      })
      .catch((err) => {
        console.log(err);
        setFocusedItem({
          footerHint: t(
            "This is not a public repository / We couldn't find this repository",
          ),
          footerBtns: [],
        });
      });
  }, []);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        placeholder={t('Repository URL...')}
        handleBack={handleBack}
        value={inputValue}
        onChange={handleInputChange}
        customSubmitHandler={handleAddSubmit}
      />
      <div className="flex-1" />
      <Footer />
    </div>
  );
};

export default memo(PublicRepos);
