import {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../Header';
import { CommandBarStepEnum, TabTypesEnum } from '../../types/general';
import { CommandBarContext } from '../../context/commandBarContext';
import { getDocById, searchDocSections } from '../../services/api';
import { DocSectionType, DocShortType } from '../../types/api';
import Body from '../Body';
import { TabsContext } from '../../context/tabsContext';
import Footer from '../Footer';
import { UIContext } from '../../context/uiContext';
import { MagazineIcon } from '../../icons';
import RenderedSection from '../../Project/CurrentTabContent/DocTab/RenderedSection';

type Props = {
  studioId?: string;
  docId: string;
};

const SearchDocs = ({ studioId, docId }: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { setIsLeftSidebarFocused } = useContext(UIContext.Focus);
  const [docSections, setDocSections] = useState<DocSectionType[]>([]);
  const [fullDoc, setFullDoc] = useState<DocShortType | null>(null);
  const [focusedIndex, setFocusedIndex] = useState('');
  const searchValue = useDeferredValue(inputValue);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  useEffect(() => {
    searchDocSections(docId, searchValue || ',').then(setDocSections);
  }, [searchValue, docId]);

  useEffect(() => {
    getDocById(docId).then(setFullDoc);
  }, [docId]);

  const breadcrumbs = useMemo(() => {
    return studioId ? [t('Add doc to studio')] : [t('Search docs')];
  }, [t, studioId]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const constructSectionTitle = useCallback(
    (docTitle: string, ancestry: string[], sectionHeader: string) => {
      let title = docTitle + ' ';
      if (ancestry.length) {
        title += '/';
      }
      ancestry.forEach((h, i) => {
        title += h.replace(/#/g, '');
        if (i !== ancestry.length - 1) {
          title += '/';
        }
      });
      if (sectionHeader) {
        title += '/';
        title += sectionHeader.replace(/#/g, '');
      }
      return title;
    },
    [],
  );

  const favIconComponent = useMemo(() => {
    if (fullDoc?.favicon) {
      // eslint-disable-next-line react/display-name
      return (props: { className?: string; sizeClassName?: string }) => (
        <img
          src={fullDoc?.favicon}
          alt={fullDoc?.name}
          className={`${props.sizeClassName || ''} ${props.className || ''}`}
        />
      );
    }
    return MagazineIcon;
  }, [fullDoc?.favicon]);

  const sections = useMemo(() => {
    return [
      {
        key: 'docs',
        items: docSections.map(
          ({
            doc_title,
            header,
            ancestry,
            point_id,
            doc_id,
            relative_url,
          }) => ({
            key: `${point_id}`,
            id: `doc-section-${point_id}`,
            onClick: () => {
              openNewTab({
                type: TabTypesEnum.DOC,
                docId: doc_id,
                relativeUrl: relative_url,
                title: doc_title,
                studioId,
                favicon: fullDoc?.favicon,
                initialSections: [point_id],
              });
              setIsLeftSidebarFocused(false);
              setIsVisible(false);
              setChosenStep({ id: CommandBarStepEnum.INITIAL });
            },
            label: constructSectionTitle(doc_title, ancestry, header),
            footerHint: ``,
            footerBtns: [
              {
                label: studioId ? t('Add doc') : t('Open'),
                shortcut: ['entr'],
              },
            ],
            Icon: favIconComponent,
          }),
        ),
        itemsOffset: 0,
      },
    ];
  }, [docSections, studioId]);

  const focusedDoc = useMemo(() => {
    return docSections.find((ds) => `docs-${ds.point_id}` === focusedIndex);
  }, [docSections, focusedIndex]);

  return (
    <div className="flex flex-col h-[28.875rem] w-[50rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={studioId ? undefined : handleBack}
        placeholder={t('Search docs...')}
        value={inputValue}
        onChange={handleInputChange}
      />
      {docSections.length ? (
        <div className="flex items-start overflow-auto flex-1">
          <div className="flex-1 flex flex-col overflow-auto h-full">
            <Body sections={sections} onFocusedIndexChange={setFocusedIndex} />
          </div>
          <div className="flex-1 border-l border-bg-border h-full overflow-auto p-2">
            {!!focusedDoc && (
              <RenderedSection
                text={focusedDoc.text}
                isEditingSelection={false}
                baseUrl={focusedDoc.doc_source}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 items-center justify-center text-label-muted text-center py-2" />
      )}
      {!!docSections.length && <Footer />}
    </div>
  );
};

export default memo(SearchDocs);
