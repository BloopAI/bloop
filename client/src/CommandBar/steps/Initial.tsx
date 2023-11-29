import { memo, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectContext } from '../../context/projectContext';
import { MagazineIcon } from '../../icons';
import { CommandBarContext } from '../../context/commandBarContext';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { getContextItems } from '../items';

type Props = {};

const InitialCommandBar = ({}: Props) => {
  const { t } = useTranslation();
  const { setIsVisible } = useContext(CommandBarContext.General);
  const { projects } = useContext(ProjectContext.All);
  const { setCurrentProjectId, project } = useContext(ProjectContext.Current);

  const switchProject = useCallback((id: string) => {
    setCurrentProjectId(id);
    setIsVisible(false);
  }, []);

  const initialSections = useMemo(() => {
    const contextItems = getContextItems(t);
    const projectItems = projects.map((p, i) => ({
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

  return (
    <div className="w-full flex flex-col max-h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header breadcrumbs={['Default project']} />
      <Body sections={initialSections} />
      <Footer />
    </div>
  );
};

export default memo(InitialCommandBar);
