import React, {
  ChangeEvent,
  FormEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import KeyboardChip from '../KeyboardChip';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import {
  getIndexedDocs,
  searchDocSections,
  verifyDocsUrl,
} from '../../../services/api';
import Button from '../../../components/Button';
import LiteLoaderContainer from '../../../components/Loaders/LiteLoader';
import { Magazine, Paper, WarningSign } from '../../../icons';
import {
  CodeStudioType,
  DocSectionType,
  DocShortType,
} from '../../../types/api';
import StepItem from '../AddContextModal/StepItem';
import { DeviceContext } from '../../../context/deviceContext';
import CommandIndicator from './CommandIndicator';
import PagesWithPreview from './PagesWithPreview';
import IndexedDocsList from './IndexedDocsList';

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (
    docProvider: DocShortType,
    url: string,
    absoluteUrl: string,
    title: string,
    selectedSection?: string,
  ) => void;
  refetchCodeStudio: (keyToUpdate?: keyof CodeStudioType) => Promise<void>;
};

const AddDocsModal = ({
  isVisible,
  onClose,
  onSubmit,
  refetchCodeStudio,
}: Props) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<DocShortType | null>(
    null,
  );
  const [isIndexing, setIndexing] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [docsUrl, setDocsUrl] = useState('');
  const [currentlyIndexingUrl, setCurrentlyIndexingUrl] = useState('');
  const [indexedDocs, setIndexedDocs] = useState<DocShortType[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<DocShortType[]>([]);
  const [filteredSections, setFilteredSections] = useState<DocSectionType[]>(
    [],
  );
  const { apiUrl } = useContext(DeviceContext);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (step === 0) {
          onClose();
        } else {
          setStep((prev) => prev - 1);
        }
      }
    },
    [step],
  );
  useKeyboardNavigation(handleKeyEvent);

  const refreshIndexedDocs = useCallback(() => {
    getIndexedDocs().then((resp) => {
      setIndexedDocs(resp.filter((d) => d.name));
      setFilteredDocs(resp.filter((d) => d.name));
    });
  }, []);

  useEffect(() => {
    if (isVisible) {
      refreshIndexedDocs();
    }
  }, [isVisible, refreshIndexedDocs]);

  useEffect(() => {
    if (!isVisible) {
      setStep(0);
      setSelectedProvider(null);
      setDocsUrl('');
      setVerifyError(false);
    }
  }, [isVisible]);

  const handleDocUrlChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setDocsUrl(newValue);
      if (step === 0) {
        setFilteredDocs(
          indexedDocs.filter(
            (d) =>
              d.name?.toLowerCase().includes(newValue.toLowerCase()) ||
              d.url?.toLowerCase().startsWith(newValue.toLowerCase()),
          ),
        );
      } else if (selectedProvider) {
        searchDocSections(selectedProvider.id, newValue).then((resp) => {
          setFilteredSections(resp);
        });
      }
    },
    [indexedDocs, step, selectedProvider?.id],
  );

  const syncDocProvider = useCallback(
    (urlOrId: string, isResync?: boolean) => {
      setIndexing(true);
      if (isResync) {
        setCurrentlyIndexingUrl(
          indexedDocs.find((d) => d.id === urlOrId)?.url || '',
        );
      }
      const eventSource = new EventSource(
        `${apiUrl.replace('https:', '')}/docs/${
          isResync ? `${urlOrId}/resync` : `sync?url=${urlOrId}`
        }`,
      );
      eventSource.onerror = (err) => {
        console.log(err);
        eventSource.close(); //otherwise the doc will be indexed twice
        setIndexing(false);
        setDocsUrl('');
        setCurrentlyIndexingUrl('');
        refreshIndexedDocs();
      };
      eventSource.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.Ok.Done) {
          eventSource.close();
          setIndexing(false);
          setDocsUrl('');
          setCurrentlyIndexingUrl('');
          refreshIndexedDocs();
          return;
        } else if (data.Ok.Update?.url) {
          setCurrentlyIndexingUrl(data.Ok.Update.url);
        }
      };
    },
    [indexedDocs],
  );

  const handleUrlSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!docsUrl || step !== 0) {
        return;
      }
      setVerifying(true);
      verifyDocsUrl(docsUrl.trim())
        .then(() => {
          setVerifying(false);
          setVerifyError(false);
          syncDocProvider(docsUrl.trim());
        })
        .catch(() => {
          setVerifying(false);
          setVerifyError(true);
        });
    },
    [docsUrl, refreshIndexedDocs, syncDocProvider, step],
  );

  const handleLibrarySubmit = useCallback((docProvider: DocShortType) => {
    setSelectedProvider(docProvider);
    setDocsUrl('');
    setStep(1);
  }, []);

  const handleDocSubmit = useCallback(
    (
      docProvider: DocShortType,
      url: string,
      absoluteUrl: string,
      title: string,
      selectedSection?: string,
    ) => {
      onSubmit(docProvider, url, absoluteUrl, title, selectedSection);
      onClose();
    },
    [onClose, onSubmit],
  );

  const handleSelectPage = useCallback(
    (url: string, absoluteUrl: string, title: string) => {
      if (selectedProvider) {
        onSubmit(selectedProvider, url, absoluteUrl, title);
        onClose();
      }
    },
    [selectedProvider],
  );

  return (
    <SeparateOnboardingStep
      isVisible={isVisible}
      onClose={onClose}
      noWrapper
      noBg
    >
      {step === 0 && (
        <div
          className={`mb-3 mx-auto relative z-10 rounded-full ${
            verifyError || isIndexing ? 'opacity-100 shadow-float' : 'opacity-0'
          } max-w-[38.75rem] select-none`}
        >
          <div className="text-center caption flex gap-1.5 items-center py-2 px-2.5 rounded-full bg-bg-shade ellipsis">
            {verifyError ? (
              <>
                <WarningSign
                  raw
                  sizeClassName="w-4 h-4"
                  className="text-warning-300"
                />
                <p className=" text-warning-300">
                  <Trans>
                    We couldn&apos;t find any docs at that link. Try again or
                    make sure the link is correct!
                  </Trans>
                </p>
              </>
            ) : isIndexing ? (
              <>
                <LiteLoaderContainer sizeClassName="w-4 h-4" />
                <p className="text-label-title ellipsis">
                  {currentlyIndexingUrl ? (
                    <Trans
                      values={{
                        url: currentlyIndexingUrl
                          .slice(7)
                          .split('/')
                          .filter((i) => !!i)
                          .join(' > '),
                      }}
                    >
                      Indexing{' '}
                      <span className="text-label-link ellipsis">#</span>
                    </Trans>
                  ) : (
                    <Trans values={{ url: docsUrl }}>
                      Indexing <span className="text-label-link">#</span>. This
                      process can take a couple of minutes.
                    </Trans>
                  )}
                </p>
              </>
            ) : null}
          </div>
        </div>
      )}
      <div
        className={`flex flex-col overflow-auto shadow-float ${
          step === 0 ? 'w-[38.75rem]' : 'w-[80vw] max-w-[57.75rem]'
        } relative flex-1 bg-bg-shade rounded-md border border-bg-border`}
      >
        <div className="flex items-center gap-0.5 py-3 px-4">
          <StepItem text={t('Add docs')} />
          {!!selectedProvider && (
            <StepItem
              text={selectedProvider.name}
              icon={<Magazine raw sizeClassName="w-3.5 h-3.5" />}
              onClick={() => {
                setSelectedProvider(null);
                setDocsUrl('');
                setStep(0);
              }}
            />
          )}
          <StepItem
            text={t(step === 0 ? 'Select library' : 'Select page')}
            icon={
              <span className="inline-block w-3.5 h-3.5">
                {step === 0 ? <Magazine raw /> : <Paper raw />}
              </span>
            }
          />
        </div>
        <form
          onSubmit={handleUrlSubmit}
          className="flex gap-3 items-center w-full border-b border-bg-border-hover h-13 px-4"
        >
          <input
            type="search"
            autoComplete="off"
            autoCorrect="off"
            className="flex-1 w-full bg-transparent outline-none focus:outline-0 body-m placeholder:text-label-muted"
            value={docsUrl}
            onChange={handleDocUrlChange}
            placeholder={
              step === 0
                ? t('Search docs or paste a URL to index')
                : t('Search pages')
            }
            autoFocus
            key={step}
            disabled={isIndexing}
          />
          {!!docsUrl && step === 0 && (
            <Button
              size="small"
              type="submit"
              disabled={isVerifying || isIndexing}
            >
              {isVerifying && <LiteLoaderContainer />}
              <Trans>
                {isVerifying
                  ? 'Verifying link...'
                  : isIndexing
                  ? 'Indexing...'
                  : 'Index'}
              </Trans>
              {!isVerifying && !isIndexing && (
                <KeyboardChip type="entr" variant="primary" />
              )}
            </Button>
          )}
        </form>
        <div
          className={`flex ${
            step === 0 ? 'max-h-72' : 'h-99'
          } overflow-auto px-1 py-3 flex-col`}
        >
          {step === 0 ? (
            <IndexedDocsList
              refetchDocs={refreshIndexedDocs}
              filteredDocs={filteredDocs}
              handleLibrarySubmit={handleLibrarySubmit}
              syncDocProvider={syncDocProvider}
              refetchCodeStudio={refetchCodeStudio}
            />
          ) : selectedProvider ? (
            <PagesWithPreview
              docId={selectedProvider!.id}
              handleSelectPage={handleSelectPage}
              handleDocSubmit={handleDocSubmit}
              filteredSections={filteredSections}
              search={docsUrl}
              selectedProvider={selectedProvider}
            />
          ) : null}
        </div>
        <div className="flex justify-between items-center gap-1 py-3 px-4 border-t border-bg-border bg-bg-base select-none cursor-default">
          <div className="flex items-center gap-3">
            <CommandIndicator label={t('Close')} keyboardKeys={['Esc']} />
            <div className="h-3.5 w-px bg-bg-border flex-shrink-0" />
            <CommandIndicator
              label={t('Select')}
              keyboardKeys={['cmd', 'entr']}
            />
            {step === 0 && (
              <>
                <CommandIndicator
                  label={t('Remove')}
                  keyboardKeys={['cmd', 'D']}
                />
                <CommandIndicator
                  label={t('Resync')}
                  keyboardKeys={['cmd', 'R']}
                />
              </>
            )}
          </div>
          <CommandIndicator label={t('Navigate')} keyboardKeys={['↑', '↓']} />
        </div>
      </div>
    </SeparateOnboardingStep>
  );
};

export default memo(AddDocsModal);
