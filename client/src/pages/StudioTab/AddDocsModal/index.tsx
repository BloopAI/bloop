import React, {
  ChangeEvent,
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import KeyboardChip from '../KeyboardChip';
import { useArrowKeyNavigation } from '../../../hooks/useArrowNavigationHook';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import {
  getIndexedDocs,
  indexDocsUrl,
  searchIndexedDocs,
  verifyDocsUrl,
} from '../../../services/api';
import Button from '../../../components/Button';
import LiteLoaderContainer from '../../../components/Loaders/LiteLoader';
import { Magazine, Paper, RepositoryFilled, WarningSign } from '../../../icons';
import { DocShortType } from '../../../types/api';
import StepItem from '../AddContextModal/StepItem';
import IndexedDocRow from './IndexedDocRow';

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (id: string, name: string, url: string) => void;
};

const AddDocsModal = ({ isVisible, onClose, onSubmit }: Props) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<DocShortType | null>(
    null,
  );
  const [isIndexing, setIndexing] = useState(false);
  const [isVerifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [docsUrl, setDocsUrl] = useState('');
  const [indexedDocs, setIndexedDocs] = useState<DocShortType[]>([]);
  const [indexedPages, setIndexedPages] = useState<DocShortType[]>([]);
  const containerRef = useArrowKeyNavigation();

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  const refreshIndexedDocs = useCallback(() => {
    getIndexedDocs().then((resp) => {
      setIndexedDocs(resp);
    });
  }, []);

  useEffect(() => {
    if (selectedProvider) {
      searchIndexedDocs(selectedProvider.id, docsUrl).then((resp) => {
        console.log(resp);
        setIndexedPages(resp);
      });
    }
  }, [selectedProvider, docsUrl]);

  useEffect(() => {
    if (isVisible) {
      refreshIndexedDocs();
    }
  }, [isVisible, refreshIndexedDocs]);

  const handleDocUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDocsUrl(e.target.value);
  }, []);

  const handleUrlSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setVerifying(true);
      verifyDocsUrl(docsUrl)
        .then(() => {
          setVerifying(false);
          setVerifyError(false);
          setIndexing(true);
          indexDocsUrl(docsUrl).finally(() => {
            setIndexing(false);
            setDocsUrl('');
            refreshIndexedDocs();
          });
        })
        .catch(() => {
          setVerifying(false);
          setVerifyError(true);
        });
    },
    [docsUrl, refreshIndexedDocs],
  );

  const handleLibrarySubmit = useCallback(
    (docProvider: DocShortType) => {
      setSelectedProvider(docProvider);
      setDocsUrl('');
      setStep(1);
    },
    [onClose, onSubmit],
  );

  const handleDocSubmit = useCallback(
    (id: string, name: string, url: string) => {
      onSubmit(id, name, url);
      onClose();
    },
    [onClose, onSubmit],
  );

  return (
    <SeparateOnboardingStep
      isVisible={isVisible}
      onClose={onClose}
      noWrapper
      noBg
    >
      <div
        className={`mb-3 mx-auto ${
          verifyError || isIndexing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="text-center caption flex gap-1.5 items-center py-2 px-2.5 rounded-full bg-bg-shade">
          {verifyError ? (
            <>
              <WarningSign
                raw
                sizeClassName="w-4 h-4"
                className="text-warning-300"
              />
              <p className=" text-warning-300">
                <Trans>
                  We couldn&apos;t find any docs at that link. Try again or make
                  sure the link is correct!
                </Trans>
              </p>
            </>
          ) : (
            <>
              <LiteLoaderContainer sizeClassName="w-4 h-4" />
              <p className="text-label-title">
                <Trans values={{ url: docsUrl }}>
                  Indexing <span className="text-label-link">#</span>. This
                  process takes about 1 minute.
                </Trans>
              </p>
            </>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex flex-col w-[38.75rem] relative flex-1 bg-bg-shade rounded-md border border-bg-border overflow-auto "
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
            placeholder={step === 0 ? 'Docs URL' : 'Search page'}
            autoFocus
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
                <KeyboardChip type="cmd" variant="primary" />
              )}
            </Button>
          )}
        </form>
        <div className="flex max-h-72 overflow-auto px-1 py-3 flex-col items-start gap-1">
          {step === 0 ? (
            indexedDocs.map((d) => {
              return (
                <IndexedDocRow
                  key={d.id}
                  doc={d}
                  onSubmit={handleLibrarySubmit}
                />
              );
            })
          ) : (
            <div>step 1</div>
          )}
        </div>
        <div className="flex justify-between items-center gap-1 py-3 px-4 border-t border-bg-border bg-bg-base">
          <div className="flex items-center gap-1.5">
            <KeyboardChip type="Esc" />
            <span className="caption text-label-base">
              <Trans>Close</Trans>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <KeyboardChip type="↑" />
            <KeyboardChip type="↓" />
            <span className="caption text-label-base">
              <Trans>Navigate</Trans>
            </span>
          </div>
        </div>
      </div>
    </SeparateOnboardingStep>
  );
};

export default memo(AddDocsModal);
