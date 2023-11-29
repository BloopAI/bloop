import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectContext } from '../../context/projectContext';
import { MagazineIcon } from '../../icons';
import { CommandBarContext } from '../../context/commandBarContext';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { getContextItems } from '../items';
import {
  CommandBarItemGeneralType,
  CommandBarSectionType,
} from '../../types/general';

type Props = {};

const InitialCommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const { setIsVisible } = useContext(CommandBarContext.General);
  const { projects } = useContext(ProjectContext.All);
  const { setCurrentProjectId, project } = useContext(ProjectContext.Current);
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    setIsVisible(false);
  }, []);

  const initialSections = useMemo(() => {
    const contextItems: CommandBarItemGeneralType[] = getContextItems(t);
    const projectItems: CommandBarItemGeneralType[] = projects.map((p, i) => ({
      label: p.name,
      Icon: MagazineIcon,
      id: `project-${p.id}`,
      key: p.id,
      shortcut: i < 9 ? ['cmd', (i + 1).toString()] : undefined,
      onClick: () => switchProject(p.id),
      footerHint:
        project?.id === p.id
          ? t('Manage project')
          : t(`Switch to`) + ' ' + p.name,
      footerBtns:
        project?.id === p.id
          ? [{ label: t('Manage'), shortcut: ['entr'], action: () => {} }]
          : [
              {
                label: t('Open'),
                shortcut: ['entr'],
                action: () => switchProject(p.id),
              },
            ],
    }));
    return [
      { items: contextItems, itemsOffset: 0, label: t('Manage context') },
      {
        items: projectItems,
        itemsOffset: contextItems.length,
        label: t('Recent projects'),
      },
    ];
  }, [t, projects, project]);

  const sectionsToShow = useMemo(() => {
    if (!inputValue) {
      return initialSections;
    }
    const newSections: CommandBarSectionType[] = [];
    initialSections.forEach((s) => {
      const newItems = s.items.filter((i) =>
        i.label.toLowerCase().startsWith(inputValue.toLowerCase()),
      );
      if (newItems.length) {
        newSections.push({ ...s, items: newItems });
      }
    });
    return newSections;
  }, [inputValue, initialSections]);

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={[project?.name || 'Default project']}
        value={inputValue}
        onChange={handleInputChange}
      />
      {!!sectionsToShow.length && <Body sections={sectionsToShow} />}
      <Footer />
    </div>
  );
};

export default memo(InitialCommandBar);
