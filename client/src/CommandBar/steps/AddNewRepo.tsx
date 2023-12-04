import { memo, useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import {
  CommandBarItemGeneralType,
  CommandBarStepEnum,
} from '../../types/general';
import { GlobeIcon, HardDriveIcon, RepositoryIcon } from '../../icons';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { CommandBarContext } from '../../context/commandBarContext';
import { DeviceContext } from '../../context/deviceContext';
import { scanLocalRepos, syncRepo } from '../../services/api';

type Props = {};

const AddNewRepo = ({}: Props) => {
  const { t } = useTranslation();
  const globalShortcuts = useGlobalShortcuts();
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const { homeDir, chooseFolder } = useContext(DeviceContext);
  const [chosenFolder, setChosenFolder] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.MANAGE_REPOS });
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
      scanLocalRepos(folder).then((data) => {
        if (data.list.length === 1) {
          syncRepo(data.list[0].ref);
          handleBack();
          return;
        }
      });
    }
  }, [chooseFolder, homeDir, handleBack]);

  const initialSections = useMemo(() => {
    const contextItems: CommandBarItemGeneralType[] = [
      {
        label: t('Private repository'),
        Icon: RepositoryIcon,
        id: CommandBarStepEnum.PRIVATE_REPOS,
        key: 'private',
        shortcut: globalShortcuts.openPrivateRepos.shortcut,
        footerHint: '',
        footerBtns: [{ label: t('Next'), shortcut: ['entr'] }],
      },
      {
        label: t('Public repository'),
        Icon: GlobeIcon,
        id: CommandBarStepEnum.PUBLIC_REPOS,
        key: 'public',
        shortcut: globalShortcuts.openPublicRepos.shortcut,
        footerHint: '',
        footerBtns: [{ label: t('Next'), shortcut: ['entr'] }],
      },
      {
        label: t('Local repository'),
        Icon: HardDriveIcon,
        id: CommandBarStepEnum.LOCAL_REPOS,
        onClick: handleChooseFolder,
        key: 'local',
        shortcut: globalShortcuts.openLocalRepos.shortcut,
        footerHint: '',
        footerBtns: [
          { label: t('Next'), shortcut: ['entr'], action: handleChooseFolder },
        ],
      },
    ];
    return [
      {
        items: contextItems,
        itemsOffset: 0,
        key: 'context-items',
      },
    ];
  }, [t, globalShortcuts]);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[t('Add repository')]}
        noInput
        handleBack={handleBack}
      />
      <Body sections={initialSections} />
      <Footer />
    </div>
  );
};

export default memo(AddNewRepo);
