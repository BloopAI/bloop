import { memo, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommandBarItemGeneralType,
  CommandBarStepEnum,
} from '../../types/general';
import {
  MacintoshIcon,
  ThemeBlackIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
} from '../../icons';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { CommandBarContext } from '../../context/commandBarContext';
import { Theme } from '../../types';
import { UIContext } from '../../context/uiContext';

type Props = {};

const ToggleTheme = ({}: Props) => {
  const { t } = useTranslation();
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const { setTheme } = useContext(UIContext.Theme);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const initialSections = useMemo(() => {
    const themeOptions = ['light', 'dark', 'black', 'system'] as Theme[];
    const themeMap = {
      light: ThemeLightIcon,
      dark: ThemeDarkIcon,
      black: ThemeBlackIcon,
      system: MacintoshIcon,
    };
    const themeItems: CommandBarItemGeneralType[] = themeOptions.map((th) => ({
      label: t(`Use ${th} theme`),
      Icon: themeMap[th],
      id: `${th}-theme`,
      key: `${th}-theme`,
      onClick: () => setTheme(th),
      footerHint: t(`Use ${th} theme`),
      footerBtns: [
        {
          label: t('Toggle'),
          shortcut: ['entr'],
        },
      ],
    }));
    return [
      {
        items: themeItems,
        itemsOffset: 0,
        key: 'theme-commands',
      },
    ];
  }, [t]);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[t('Application theme')]}
        noInput
        handleBack={handleBack}
      />
      <Body sections={initialSections} />
      <Footer />
    </div>
  );
};

export default memo(ToggleTheme);
