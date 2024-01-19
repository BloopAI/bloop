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
  AddDocToStudioDataType,
  AddFileToStudioDataType,
  CommandBarItemGeneralType,
  CommandBarSectionType,
  CommandBarStepEnum,
  TabTypesEnum,
} from '../../types/general';
import { PlusSignIcon } from '../../icons';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import { CommandBarContext } from '../../context/commandBarContext';
import { ProjectContext } from '../../context/projectContext';
import { TabsContext } from '../../context/tabsContext';
import { postCodeStudio } from '../../services/api';
import TokenUsage from '../../components/TokenUsage';
import { TOKEN_LIMIT } from '../../consts/codeStudio';

type Props = (AddFileToStudioDataType | AddDocToStudioDataType) & {};

const AddToStudio = (props: Props) => {
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
      if ('path' in props) {
        openNewTab(
          {
            type: TabTypesEnum.FILE,
            studioId: newId,
            ...props,
          },
          'left',
        );
      } else {
        openNewTab(
          {
            type: TabTypesEnum.DOC,
            studioId: newId,
            ...props,
          },
          'left',
        );
      }
      openNewTab({ type: TabTypesEnum.STUDIO, studioId: newId }, 'right');
    }
  }, [project?.id, props, openNewTab, refreshCurrentProjectStudios]);

  const handleAddToCodeStudio = useCallback(
    async (studioId: string) => {
      if (project?.id) {
        if ('path' in props) {
          openNewTab(
            {
              type: TabTypesEnum.FILE,
              studioId,
              ...props,
            },
            'left',
          );
        } else {
          openNewTab(
            {
              type: TabTypesEnum.DOC,
              studioId,
              ...props,
            },
            'left',
          );
        }
        openNewTab({ type: TabTypesEnum.STUDIO, studioId }, 'right');
      }
    },
    [project?.id, props, openNewTab],
  );

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
          Icon: () => (
            <TokenUsage
              percent={(s.token_counts.total / TOKEN_LIMIT) * 100}
              sizeClassName={'w-6 h-6'}
            />
          ),
          iconContainerClassName: 'bg-transparent',
          id: s.id,
          key: s.id,
          onClick: () => handleAddToCodeStudio(s.id),
          closeOnClick: true,
          footerHint: t('{{count}} context files used', {
            count: s.context.length,
          }),
          footerBtns: [{ label: t('Add to existing'), shortcut: ['entr'] }],
        })),
        label: t('Existing studio conversations'),
        itemsOffset: 1,
        key: 'studio-items',
      },
    ];
  }, [t, project?.studios, handleNewCodeStudio, openNewTab, props]);

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
    return [t(`Add ${'path' in props ? 'file' : 'doc'} to studio`)];
  }, [props, t]);

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

export default memo(AddToStudio);
