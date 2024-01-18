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
import {
  CloseSignInCircleIcon,
  LinkChainIcon,
  MagazineIcon,
  PlusSignIcon,
  TrashCanIcon,
} from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { DocShortType } from '../../../types/api';
import {
  addDocToProject,
  cancelDocIndexing,
  deleteDocProvider,
  getDocById,
  removeDocFromProject,
  resyncDoc,
} from '../../../services/api';
import Item from '../../Body/Item';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import Button from '../../../components/Button';
import { ProjectContext } from '../../../context/projectContext';

type Props = {
  doc: DocShortType;
  i: number;
  isFocused: boolean;
  setFocusedIndex: Dispatch<SetStateAction<number>>;
  isFirst: boolean;
  isIndexed: boolean;
  disableKeyNav?: boolean;
  refetchDocs: () => {};
};

const DocItem = ({
  doc,
  isFirst,
  setFocusedIndex,
  isFocused,
  i,
  isIndexed,
  disableKeyNav,
  refetchDocs,
}: Props) => {
  const { t } = useTranslation();
  const [docToShow, setDocToShow] = useState(doc);
  const [isIndexingFinished, setIsIndexingFinished] = useState(
    !!doc.id && doc.index_status === 'done',
  );
  const { apiUrl, openLink } = useContext(DeviceContext);
  const { project, refreshCurrentProjectDocs } = useContext(
    ProjectContext.Current,
  );
  const eventSourceRef = useRef<EventSource | null>(null);

  const refetchDoc = useCallback(() => {
    getDocById(doc.id).then((data) => {
      setDocToShow(data);
    });
  }, [doc.id]);

  const startEventSource = useCallback(() => {
    setIsIndexingFinished(false);
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/docs/${doc.id}/status`,
    );
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
  }, [doc.id]);

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

  const handleCancelSync = useCallback(async () => {
    await cancelDocIndexing(doc.id);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsIndexingFinished(true);
  }, [doc.id]);

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

  const handleResync = useCallback(async () => {
    await resyncDoc(doc.id);
    startEventSource();
  }, [doc.id]);

  const favIconComponent = useMemo(() => {
    // eslint-disable-next-line react/display-name
    return (props: { className?: string; sizeClassName?: string }) => (
      <img
        src={doc.favicon}
        alt={doc.name}
        className={`${props.sizeClassName || ''} ${props.className || ''}`}
      />
    );
  }, [doc.favicon]);

  const handleAddToProject = useCallback(() => {
    if (project?.id) {
      return addDocToProject(project.id, doc.id).finally(() => {
        refreshCurrentProjectDocs();
      });
    }
  }, [doc.id, project?.id, refreshCurrentProjectDocs]);

  const handleRemoveFromProject = useCallback(() => {
    if (project?.id) {
      return removeDocFromProject(project.id, doc.id).finally(() => {
        refreshCurrentProjectDocs();
      });
    }
  }, [doc.id, project?.id, refreshCurrentProjectDocs]);

  const isInProject = useMemo(() => {
    return project?.docs.find((d) => d.id === doc.id);
  }, [project?.docs, doc.id]);

  const focusedItemProps = useMemo(() => {
    const dropdownItems1 = [];
    if (isIndexing) {
      dropdownItems1.push({
        onClick: handleCancelSync,
        label: t('Stop indexing'),
        icon: (
          <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
            <CloseSignInCircleIcon sizeClassName="w-3.5 h-3.5" />
          </span>
        ),
        key: 'stop_indexing',
      });
    }
    if (isIndexingFinished) {
      dropdownItems1.push(
        isInProject
          ? {
              onClick: handleRemoveFromProject,
              label: t('Remove from project'),
              icon: (
                <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
                  <TrashCanIcon sizeClassName="w-3.5 h-3.5" />
                </span>
              ),
              key: 'remove_from_project',
            }
          : {
              onClick: handleAddToProject,
              label: t('Add to project'),
              icon: (
                <span className="w-6 h-6 flex items-center justify-center rounded-6 bg-bg-border">
                  <PlusSignIcon sizeClassName="w-3.5 h-3.5" />
                </span>
              ),
              key: 'add_to_project',
            },
      );
      dropdownItems1.push({
        onClick: handleResync,
        label: t('Re-sync'),
        shortcut: ['cmd', 'R'],
        key: 'resync',
      });
      dropdownItems1.push({
        onClick: handleRemove,
        label: t('Remove'),
        shortcut: ['cmd', 'D'],
        key: 'remove',
      });
    }
    const dropdownItems = [];
    if (dropdownItems1.length) {
      dropdownItems.push({ items: dropdownItems1, key: '1', itemsOffset: 0 });
    }
    return {
      dropdownItems,
    };
  }, [
    t,
    isInProject,
    handleAddToProject,
    handleRemoveFromProject,
    handleCancelSync,
    isIndexing,
    handleAddToProject,
    handleResync,
    handleRemove,
    doc,
  ]);

  return (
    <Item
      key={docToShow.id || doc.url}
      itemKey={`doc-${docToShow.id || doc.url}`}
      setFocusedIndex={setFocusedIndex}
      isFocused={isFocused}
      i={i}
      isFirst={isFirst}
      isWithCheckmark={!!isInProject}
      Icon={
        isIndexing
          ? SpinLoaderContainer
          : doc.favicon
          ? favIconComponent
          : MagazineIcon
      }
      label={docToShow.name}
      id={'doc_settings'}
      footerHint={
        isIndexing ? (
          t('Indexing...')
        ) : (
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
        )
      }
      onClick={
        isIndexing
          ? handleCancelSync
          : isInProject
          ? handleRemoveFromProject
          : handleAddToProject
      }
      iconContainerClassName={
        isIndexingFinished
          ? 'bg-bg-contrast text-label-contrast'
          : 'bg-bg-border'
      }
      footerBtns={
        isIndexingFinished
          ? [
              {
                label: isInProject
                  ? t('Remove from project')
                  : t('Add to project'),
                shortcut: ['entr'],
              },
            ]
          : [
              {
                label: t('Stop indexing'),
                shortcut: ['entr'],
              },
            ]
      }
      customRightElement={
        isIndexing ? (
          <p className="body-mini-b text-label-link">{t('Indexing...')}</p>
        ) : undefined
      }
      focusedItemProps={focusedItemProps}
      disableKeyNav={disableKeyNav}
    />
  );
};

export default memo(DocItem);
