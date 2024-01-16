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
import {
  AddFileToStudioDataType,
  CommandBarItemGeneralType,
  CommandBarSectionType,
  CommandBarStepEnum,
  TabTypesEnum,
} from '../../types/general';
import { CodeStudioIcon, PlusSignIcon } from '../../icons';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { CommandBarContext } from '../../context/commandBarContext';
import { ProjectContext } from '../../context/projectContext';
import { TabsContext } from '../../context/tabsContext';
import { postCodeStudio } from '../../services/api';

type Props = AddFileToStudioDataType & {};

const AddFileToStudio = ({ path, repoRef, branch }: Props) => {
  const { t } = useTranslation();
  const { setChosenStep } = useContext(CommandBarContext.Handlers);
  const { project, refreshCurrentProjectStudios } = useContext(
    ProjectContext.Current,
  );
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [inputValue, setInputValue] = useState('');
  const [sectionsToShow, setSectionsToShow] = useState<CommandBarSectionType[]>(
    [],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const handleNewCodeStudio = useCallback(async () => {
    if (project?.id) {
      const newId = await postCodeStudio(project.id);
      refreshCurrentProjectStudios();
      openNewTab({
        type: TabTypesEnum.FILE,
        studioId: newId,
        path,
        repoRef,
        branch,
      });
    }
  }, [project?.id, path, repoRef, branch]);

  const initialSections = useMemo(() => {
    return [
      {
        items: [
          {
            label: t('New studio conversation'),
            Icon: PlusSignIcon,
            id: 'new_code_studio',
            key: 'new_code_studio',
            onClick: handleNewCodeStudio,
            closeOnClick: true,
            footerHint: '',
            footerBtns: [{ label: t('Create new'), shortcut: ['entr'] }],
          },
        ],
        itemsOffset: 0,
        key: 'new-items',
      },
      {
        items: (project?.studios || []).map((s) => ({
          label: s.name,
          Icon: CodeStudioIcon,
          id: s.id,
          key: s.id,
          onClick: () =>
            openNewTab({
              type: TabTypesEnum.FILE,
              studioId: s.id,
              path,
              repoRef,
              branch,
            }),
          closeOnClick: true,
          // footerHint: t('{{count}} context files used', {
          //   count: s.token_counts?.per_file.filter((f) => !!f).length,
          // }),
          footerHint: '',
          footerBtns: [{ label: t('Add to existing'), shortcut: ['entr'] }],
        })),
        label: t('Existing studio conversations'),
        itemsOffset: 1,
        key: 'studio-items',
      },
    ];
  }, [
    t,
    project?.studios,
    handleNewCodeStudio,
    openNewTab,
    path,
    repoRef,
    branch,
  ]);

  useEffect(() => {
    if (!inputValue) {
      setSectionsToShow(initialSections);
      return;
    }
    const newSectionsToShow: CommandBarSectionType[] = [];
    initialSections.forEach((s) => {
      const items = (s.items as CommandBarItemGeneralType[]).filter((item) => {
        return item.label.toLowerCase().includes(inputValue.toLowerCase());
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
  }, [initialSections, inputValue]);

  const breadcrumbs = useMemo(() => {
    return [t('Add file to studio')];
  }, []);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        value={inputValue}
        onChange={handleChange}
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        placeholder={t('Search studio conversations...')}
      />
      <Body sections={sectionsToShow} />
      <Footer />
    </div>
  );
};

export default memo(AddFileToStudio);
