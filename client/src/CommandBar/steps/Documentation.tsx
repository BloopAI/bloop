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
import { CommandBarSectionType, CommandBarStepEnum } from '../../types/general';
import { CommandBarContext } from '../../context/commandBarContext';
import { getIndexedDocs, verifyDocsUrl } from '../../services/api';
import { PlusSignIcon } from '../../icons';
import { DocShortType } from '../../types/api';
import Header from '../Header';
import Body from '../Body';
import Footer from '../Footer';
import DocItem from './items/DocItem';

type Props = {};

const Documentation = ({}: Props) => {
  const { t } = useTranslation();
  const [isAddMode, setIsAddMode] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [indexedDocs, setIndexedDocs] = useState<DocShortType[]>([]);
  const [addedDoc, setAddedDoc] = useState('');
  const { setChosenStep, setFocusedItem } = useContext(
    CommandBarContext.Handlers,
  );
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const enterAddMode = useCallback(() => {
    setFocusedItem({
      footerHint: t('Paste a link to any documentation web page'),
      footerBtns: [{ label: t('Sync'), shortcut: ['entr'] }],
    });
    setIsAddMode(true);
  }, []);

  const addItem = useMemo(() => {
    return {
      itemsOffset: 0,
      key: 'add-docs',
      items: [
        {
          label: 'Add documentation',
          Icon: PlusSignIcon,
          footerHint: t('Add any library documentation'),
          footerBtns: [
            {
              label: t('Add'),
              shortcut: ['entr'],
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
    const arr = [t('Docs')];
    if (isAddMode) {
      arr.push(t('Add docs'));
    }
    return arr;
  }, [t, isAddMode]);

  const handleBack = useCallback(() => {
    if (isAddMode && (addedDoc || indexedDocs.length)) {
      setIsAddMode(false);
    } else {
      setChosenStep({ id: CommandBarStepEnum.INITIAL });
    }
  }, [isAddMode, addedDoc, indexedDocs]);

  const refetchDocs = useCallback(() => {
    getIndexedDocs().then((data) => {
      setIndexedDocs(data);
      setHasFetched(true);
    });
  }, []);

  useEffect(() => {
    const mapped = indexedDocs.map((d) => ({
      Component: DocItem,
      componentProps: { doc: d, isIndexed: !!d.id, refetchDocs },
      key: d.id,
    }));
    if (!mapped.length && hasFetched && !addedDoc) {
      enterAddMode();
    }
    if (addedDoc) {
      mapped.unshift({
        Component: DocItem,
        componentProps: {
          doc: {
            url: addedDoc,
            id: '',
            name: '',
            favicon: '',
            index_status: 'indexing',
          },
          isIndexed: false,
          refetchDocs: () => {
            refetchDocs();
            setAddedDoc('');
          },
        },
        key: addedDoc,
      });
    }
    setSections([
      addItem,
      {
        itemsOffset: 1,
        key: 'indexed-docs',
        label: t('Indexed documentation web pages'),
        items: mapped,
      },
    ]);
  }, [indexedDocs, addedDoc, hasFetched]);

  useEffect(() => {
    if (!isAddMode || !hasFetched) {
      refetchDocs();
    }
  }, [isAddMode]);

  const handleAddSubmit = useCallback((inputValue: string) => {
    setFocusedItem({
      footerHint: t('Verifying access...'),
      footerBtns: [],
    });
    setInputValue('');
    verifyDocsUrl(inputValue.trim())
      .then(() => {
        setIsAddMode(false);
        setAddedDoc(inputValue);
      })
      .catch(() => {
        setFocusedItem({
          footerHint: t(
            "We couldn't find any docs at that link. Try again or make sure the link is correct!",
          ),
          footerBtns: [],
        });
      });
  }, []);

  const sectionsToShow = useMemo(() => {
    if (!inputValue) {
      return sections;
    }
    const newSections: CommandBarSectionType[] = [];
    sections.forEach((s) => {
      const newItems = s.items.filter((i) =>
        ('label' in i ? i.label : i.componentProps.doc.name)
          .toLowerCase()
          .includes(inputValue.toLowerCase()),
      );
      if (newItems.length) {
        newSections.push({ ...s, items: newItems });
      }
    });
    return newSections;
  }, [inputValue, sections]);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
        customSubmitHandler={isAddMode ? handleAddSubmit : undefined}
        placeholder={
          isAddMode ? t('Documentation URL...') : t('Search docs...')
        }
        onChange={handleInputChange}
        value={inputValue}
      />
      {isAddMode ? (
        <div className="flex-1" />
      ) : (
        <Body sections={sectionsToShow} />
      )}
      <Footer />
    </div>
  );
};

export default memo(Documentation);
