import {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { LinkChainIcon, RepositoryIcon } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { getDateFnsLocale } from '../../../utils';
import { LocaleContext } from '../../../context/localeContext';
import { DocShortType } from '../../../types/api';
import { deleteDocProvider, getIndexedDocs } from '../../../services/api';
import Item from '../../Body/Item';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import Button from '../../../components/Button';

type Props = {
  doc: DocShortType;
  i: number;
  isFocused: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  isFirst: boolean;
  isIndexed: boolean;
  refetchDocs: () => {};
};

const DocItem = ({
  doc,
  isFirst,
  setFocusedIndex,
  isFocused,
  i,
  isIndexed,
  refetchDocs,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const [docToShow, setDocToShow] = useState(doc);
  const [indexingStartedAt, setIndexingStartedAt] = useState(Date.now());
  const [isIndexingFinished, setIsIndexingFinished] = useState(
    !!doc.id && doc.index_status === 'done',
  );
  const { apiUrl, openLink } = useContext(DeviceContext);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refetchDoc = useCallback(() => {
    getIndexedDocs().then((data) => {
      const newDoc = data.find((d) => d.url === doc.url);
      setDocToShow(newDoc || doc);
    });
  }, []);

  const startEventSource = useCallback(
    (isResync?: boolean) => {
      setIsIndexingFinished(false);
      setIndexingStartedAt(Date.now());
      eventSourceRef.current = new EventSource(
        `${apiUrl.replace('https:', '')}/docs/${
          isResync ? `${docToShow.id}/resync` : `sync?url=${docToShow.url}`
        }`,
      );
      setTimeout(refetchDoc, 3000);
      eventSourceRef.current.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          console.log(data);
          if (data.Ok.Done) {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            setIsIndexingFinished(true);
            refetchDoc();
            return;
          }
        } catch (err) {
          console.log(err);
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
        }
      };
      eventSourceRef.current.onerror = (err) => {
        console.log(err);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      };
    },
    [docToShow],
  );

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isIndexed && !eventSourceRef.current && !isIndexingFinished) {
      startEventSource();
    }
  }, [isIndexed]);

  const handleAddToProject = useCallback(() => {
    console.log(docToShow);
  }, [docToShow]);

  const handleCancelSync = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsIndexingFinished(true);
  }, []);

  const isIndexing = useMemo(() => {
    return !isIndexed && !isIndexingFinished;
  }, [isIndexed, isIndexingFinished]);

  const handleRemove = useCallback(() => {
    if (docToShow.id) {
      deleteDocProvider(docToShow.id).then(() => {
        refetchDocs();
      });
    } else {
      refetchDocs();
    }
  }, [docToShow.id]);

  return (
    <Item
      key={docToShow.id || doc.url}
      itemKey={`doc-${docToShow.id || doc.url}`}
      setFocusedIndex={setFocusedIndex}
      isFocused={isFocused}
      i={i}
      isFirst={isFirst}
      Icon={isIndexing ? SpinLoaderContainer : RepositoryIcon}
      label={docToShow.name}
      id={'doc_settings'}
      footerHint={
        isIndexing ? (
          t('Indexing started at') +
          ' ' +
          format(indexingStartedAt, 'MMM, dd yyyy', {
            ...(getDateFnsLocale(locale) || {}),
          })
        ) : isIndexingFinished ? (
          <span className="flex gap-1 items-center">
            {t(`Indexed`)}
            <Button
              variant="ghost"
              size="small"
              onClick={() => openLink(docToShow.url)}
            >
              <LinkChainIcon sizeClassName="w-3.5 h-3.5" />
              <Trans>Open</Trans>
            </Button>
          </span>
        ) : (
          t('Index repository')
        )
      }
      onClick={isIndexing ? handleCancelSync : handleAddToProject}
      iconContainerClassName={
        isIndexingFinished
          ? 'bg-bg-contrast text-label-contrast'
          : 'bg-bg-border'
      }
      footerBtns={
        isIndexingFinished
          ? [
              {
                label: t('Remove'),
                shortcut: ['cmd', 'D'],
                action: handleRemove,
              },
              {
                label: t('Re-sync'),
                shortcut: ['cmd', 'R'],
                action: () => startEventSource(true),
              },
              {
                label: t('Add to project'),
                shortcut: ['entr'],
                action: handleAddToProject,
              },
            ]
          : [
              {
                label: t('Stop indexing'),
                shortcut: ['entr'],
                action: handleCancelSync,
              },
            ]
      }
      customRightElement={
        isIndexing ? (
          <p className="body-mini-b text-label-link">{t('Indexing...')}</p>
        ) : undefined
      }
    />
  );
};

export default memo(DocItem);
