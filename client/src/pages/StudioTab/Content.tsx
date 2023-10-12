import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import { Trans } from 'react-i18next';
import ErrorFallback from '../../components/ErrorFallback';
import PageTemplate from '../../components/PageTemplate';
import {
  RepoType,
  StudioContextDoc,
  StudioContextFile,
  StudioLeftPanelDataType,
  StudioLeftPanelType,
  StudioTabType,
} from '../../types/general';
import { patchCodeStudio } from '../../services/api';
import {
  CodeStudioType,
  DocShortType,
  HistoryConversationTurn,
} from '../../types/api';
import useResizeableSplitPanel from '../../hooks/useResizeableSplitPanel';
import { TOKEN_LIMIT } from '../../consts/codeStudio';
import { Info } from '../../icons';
import { getPlainFromStorage, STUDIO_GUIDE_DONE } from '../../services/storage';
import { UIContext } from '../../context/uiContext';
import ContextPanel from './ContextPanel';
import HistoryPanel from './HistoryPanel';
import TemplatesPanel from './TemplatesPanel';
import AddContextModal from './AddContextModal';
import RightPanel from './RightPanel';
import FilePanel from './FilePanel';
import AddDocsModal from './AddDocsModal';
import DocPanel from './DocPanel';

type Props = {
  tab: StudioTabType;
  isActive: boolean;
  currentContext: CodeStudioType['context'];
  currentDocContext: CodeStudioType['doc_context'];
  currentMessages: CodeStudioType['messages'];
  currentTokenCounts: CodeStudioType['token_counts'];
  refetchCodeStudio: (keyToUpdate?: keyof CodeStudioType) => Promise<void>;
};

const ContentContainer = ({
  tab,
  isActive,
  currentContext,
  currentDocContext,
  currentMessages,
  currentTokenCounts,
  refetchCodeStudio,
}: Props) => {
  const [leftPanel, setLeftPanel] = useState<StudioLeftPanelDataType>({
    type: StudioLeftPanelType.CONTEXT,
    data: null,
  });
  // const [rightPanel, setRightPanel] = useState<StudioRightPanelDataType>({
  //   type: StudioRightPanelType.CONVERSATION,
  //   data: null,
  // });
  const { setStudioGuideOpen } = useContext(UIContext.StudioGuide);
  const [isAddContextOpen, setAddContextOpen] = useState(false);
  const [isAddDocsOpen, setAddDocsOpen] = useState(false);
  const [previewingState, setPreviewingState] = useState<null | CodeStudioType>(
    null,
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChangeUnsaved, setIsChangeUnsaved] = useState(false);
  const { leftPanelRef, rightPanelRef, dividerRef, containerRef } =
    useResizeableSplitPanel();

  useEffect(() => {
    if (!getPlainFromStorage(STUDIO_GUIDE_DONE)) {
      setStudioGuideOpen(true);
    }
  }, []);

  const handleAddContextClose = useCallback(() => setAddContextOpen(false), []);
  const handleAddDocsClose = useCallback(() => setAddDocsOpen(false), []);
  const onFileAdded = useCallback(
    (
      repoRef: string,
      branch: string | null,
      filePath: string,
      ranges?: { start: number; end: number }[],
    ) => {
      if (tab.key) {
        patchCodeStudio(tab.key, {
          context: [
            ...currentContext,
            {
              path: filePath,
              branch,
              repo: repoRef,
              hidden: false,
              ranges: ranges || [],
            },
          ],
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, currentContext],
  );
  const onDocAdded = useCallback(
    ({
      doc_id,
      doc_source,
      doc_icon,
      doc_title,
      relative_url,
      ranges,
    }: Omit<StudioContextDoc, 'hidden'>) => {
      if (tab.key) {
        patchCodeStudio(tab.key, {
          doc_context: [
            ...currentDocContext,
            {
              doc_id,
              doc_source,
              doc_icon,
              doc_title,
              relative_url,
              ranges,
              hidden: false,
            },
          ],
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, currentDocContext],
  );

  const onFileSelected = useCallback(
    (
      repo: RepoType,
      branch: string | null,
      filePath: string,
      isMultiSelect?: boolean,
    ) => {
      if (isMultiSelect) {
        onFileAdded(repo.ref, branch, filePath);
      } else {
        setLeftPanel({
          type: StudioLeftPanelType.FILE,
          data: { repo, branch, filePath, isFileInContext: false },
        });
      }
    },
    [onFileAdded],
  );

  const onDocSelected = useCallback(
    (
      docProvider: DocShortType,
      url: string,
      title: string,
      selectedSection?: string,
    ) => {
      setLeftPanel({
        type: StudioLeftPanelType.DOCS,
        data: {
          docProvider,
          url,
          title,
          isDocInContext: false,
          selectedSection,
        },
      });
    },
    [],
  );

  const onFileRangesChanged = useCallback(
    (
      ranges: [number, number][],
      filePath: string,
      repo_ref: string,
      branch: string | null,
    ) => {
      const patchedFile = currentContext.find(
        (f) =>
          f.path === filePath && f.repo === repo_ref && f.branch === branch,
      );
      const mappedRanges = ranges.map((r) => ({
        start: r[0],
        end: r[1] + 1,
      }));
      if (!patchedFile) {
        onFileAdded(repo_ref, branch, filePath, mappedRanges);
        return;
      }
      if (tab.key && patchedFile) {
        patchedFile.ranges = mappedRanges;
        const newContext = currentContext
          .filter(
            (f) =>
              f.path !== filePath || f.repo !== repo_ref || f.branch !== branch,
          )
          .concat(patchedFile);
        patchCodeStudio(tab.key, {
          context: newContext,
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, currentContext],
  );
  const onDocSectionsChanged = useCallback(
    ({
      doc_id,
      doc_source,
      ranges,
      relative_url,
      doc_icon,
      doc_title,
    }: Omit<StudioContextDoc, 'hidden'>) => {
      const patchedDoc = currentDocContext.find(
        (f) =>
          f.doc_id === doc_id &&
          f.doc_source === doc_source &&
          f.relative_url === relative_url,
      );
      if (!patchedDoc) {
        onDocAdded({
          doc_id,
          doc_source,
          relative_url,
          ranges,
          doc_icon,
          doc_title,
        });
        return;
      }
      if (tab.key && patchedDoc) {
        patchedDoc.ranges = ranges;
        const newContext = currentDocContext
          .filter(
            (f) =>
              f.doc_id !== doc_id ||
              f.doc_source !== doc_source ||
              f.relative_url !== relative_url,
          )
          .concat(patchedDoc);
        patchCodeStudio(tab.key, {
          doc_context: newContext,
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, currentDocContext],
  );

  const onFileHide = useCallback(
    (
      filePath: string,
      repo_ref: string,
      branch: string | null,
      hide: boolean,
    ) => {
      const patchedFile = currentContext.find(
        (f) =>
          f.path === filePath && f.repo === repo_ref && f.branch === branch,
      );
      if (tab.key && patchedFile) {
        patchedFile.hidden = hide;
        const newContext = currentContext
          .filter(
            (f) =>
              f.path !== filePath || f.repo !== repo_ref || f.branch !== branch,
          )
          .concat(patchedFile);
        patchCodeStudio(tab.key, {
          context: newContext,
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, currentContext],
  );
  const onDocHide = useCallback(
    (docId: string, baseUrl: string, relativeUrl: string, hide: boolean) => {
      const patchedDoc = currentDocContext.find(
        (f) =>
          f.doc_id === docId &&
          f.doc_source === baseUrl &&
          f.relative_url === relativeUrl,
      );
      if (tab.key && patchedDoc) {
        patchedDoc.hidden = hide;
        const newContext = currentDocContext
          .filter(
            (f) =>
              f.doc_id !== docId ||
              f.doc_source !== baseUrl ||
              f.relative_url !== relativeUrl,
          )
          .concat(patchedDoc);
        patchCodeStudio(tab.key, {
          doc_context: newContext,
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, currentDocContext],
  );

  const onFileRemove = useCallback(
    (
      f:
        | { path: string; repo: string; branch: string | null }
        | StudioContextFile[],
    ) => {
      const files = Array.isArray(f) ? f : [f];
      let newContext: StudioContextFile[] = JSON.parse(
        JSON.stringify(currentContext),
      );
      files.forEach(({ path, repo, branch }) => {
        const patchedFile = newContext.findIndex(
          (f) => f.path === path && f.repo === repo && f.branch === branch,
        );
        if (tab.key && patchedFile > -1) {
          newContext = newContext.filter((f, i) => i !== patchedFile);
        }
      });
      patchCodeStudio(tab.key, {
        context: newContext,
      }).then(() => refetchCodeStudio());
    },
    [tab.key, currentContext],
  );
  const onDocRemove = useCallback(
    (docId: string, baseUrl: string, relativeUrl: string) => {
      let newContext: StudioContextDoc[] = JSON.parse(
        JSON.stringify(currentDocContext),
      );
      const patchedDoc = currentDocContext.findIndex(
        (f) =>
          f.doc_id === docId &&
          f.doc_source === baseUrl &&
          f.relative_url === relativeUrl,
      );
      if (tab.key && patchedDoc > -1) {
        newContext = newContext.filter((f, i) => i !== patchedDoc);
      }
      patchCodeStudio(tab.key, {
        doc_context: newContext,
      }).then(() => refetchCodeStudio());
    },
    [tab.key, currentDocContext],
  );

  const handlePreview = useCallback(
    (state?: HistoryConversationTurn, closeHistory?: boolean) => {
      setPreviewingState(state || null);
      if (state) {
        // setRightPanel({ type: StudioRightPanelType.CONVERSATION, data: null });
        setLeftPanel({ type: StudioLeftPanelType.CONTEXT, data: null });
      }
      if (closeHistory) {
        setIsHistoryOpen(false);
      }
    },
    [],
  );

  const handleRestore = useCallback(() => {
    if (previewingState) {
      patchCodeStudio(tab.key, {
        context: previewingState?.context,
        messages: previewingState?.messages,
      }).then(() => {
        refetchCodeStudio();
        handlePreview(undefined, true);
      });
    }
  }, [tab.key, refetchCodeStudio, previewingState]);

  useEffect(() => {
    if (!isHistoryOpen) {
      setPreviewingState(null);
    }
  }, [isHistoryOpen]);

  const stateToShow = useMemo(() => {
    return isHistoryOpen && previewingState
      ? previewingState
      : {
          context: currentContext,
          doc_context: currentDocContext,
          messages: currentMessages,
          token_counts: currentTokenCounts,
        };
  }, [
    isHistoryOpen,
    previewingState,
    currentContext,
    currentMessages,
    currentTokenCounts,
  ]);

  useEffect(() => {
    if (
      leftPanel.type !== StudioLeftPanelType.FILE &&
      leftPanel.type !== StudioLeftPanelType.DOCS
    ) {
      setIsChangeUnsaved(false);
    }
  }, [leftPanel.type, isAddDocsOpen, isAddContextOpen]);

  useEffect(() => {
    setIsChangeUnsaved(isAddDocsOpen || isAddContextOpen);
  }, [isAddDocsOpen, isAddContextOpen]);

  return (
    <PageTemplate renderPage="studio">
      <div className="w-screen flex flex-col overflow-auto">
        {stateToShow.token_counts?.total > TOKEN_LIMIT && (
          <div className="flex items-center gap-2 px-8 py-2 bg-bg-danger/12 select-none">
            <Info raw sizeClassName="w-4.5 h-4.5" className="text-bg-danger" />
            <p className="text-bg-danger caption">
              <Trans>
                Token limit exceeded. Reduce the number of context files or
                messages to enable the ability to generate.
              </Trans>
            </p>
          </div>
        )}
        <div className="flex flex-1 w-screen overflow-auto">
          {isHistoryOpen && (
            <HistoryPanel
              setIsHistoryOpen={setIsHistoryOpen}
              studioId={tab.key}
              handlePreview={handlePreview}
            />
          )}
          <div
            className={`flex flex-1 relative ${
              isHistoryOpen ? 'w-[calc(100%-15rem)]' : 'w-full'
            }`}
            ref={containerRef}
          >
            <div
              className="w-1/2 flex-shrink-0 flex-grow-0 flex flex-col"
              ref={leftPanelRef}
            >
              {leftPanel.type === StudioLeftPanelType.CONTEXT ? (
                <ContextPanel
                  setLeftPanel={setLeftPanel}
                  setAddContextOpen={setAddContextOpen}
                  setAddDocsOpen={setAddDocsOpen}
                  studioId={tab.key}
                  contextFiles={stateToShow.context}
                  contextDocs={stateToShow.doc_context}
                  tokensPerFile={stateToShow.token_counts?.per_file || []}
                  tokensPerDoc={stateToShow.token_counts?.per_doc_file || []}
                  onFileRemove={onFileRemove}
                  onFileHide={onFileHide}
                  onDocRemove={onDocRemove}
                  onDocHide={onDocHide}
                  onFileAdded={onFileAdded}
                  isPreviewing={!!previewingState}
                  isActiveTab={isActive}
                />
              ) : leftPanel.type === StudioLeftPanelType.TEMPLATES ? (
                <TemplatesPanel setLeftPanel={setLeftPanel} />
              ) : leftPanel.type === StudioLeftPanelType.FILE ? (
                <FilePanel
                  {...leftPanel.data}
                  setLeftPanel={setLeftPanel}
                  onFileRangesChanged={onFileRangesChanged}
                  isActiveTab={isActive}
                  setIsChangeUnsaved={setIsChangeUnsaved}
                />
              ) : leftPanel.type === StudioLeftPanelType.DOCS ? (
                <DocPanel
                  {...leftPanel.data}
                  setLeftPanel={setLeftPanel}
                  isActiveTab={isActive}
                  onSectionsChanged={onDocSectionsChanged}
                  setIsChangeUnsaved={setIsChangeUnsaved}
                />
              ) : null}
              <AddContextModal
                isVisible={isAddContextOpen}
                onClose={handleAddContextClose}
                onSubmit={onFileSelected}
                contextFiles={stateToShow.context}
              />
              <AddDocsModal
                isVisible={isAddDocsOpen}
                onClose={handleAddDocsClose}
                onSubmit={onDocSelected}
                refetchCodeStudio={refetchCodeStudio}
              />
            </div>
            <div
              ref={dividerRef}
              className="absolute top-0 left-1/2 transform -translate-x-1/2 w-2.5 h-full group cursor-col-resize flex-shrink-0"
            >
              <div className="mx-auto w-0.5 h-full bg-bg-border group-hover:bg-bg-main" />
            </div>
            <div
              className="w-1/2 flex-shrink-0 flex-grow-0 flex flex-col"
              ref={rightPanelRef}
            >
              <RightPanel
                setLeftPanel={setLeftPanel}
                studioId={tab.key}
                messages={stateToShow.messages}
                refetchCodeStudio={refetchCodeStudio}
                tokensTotal={stateToShow.token_counts?.total}
                setIsHistoryOpen={setIsHistoryOpen}
                isPreviewing={!!previewingState}
                handleRestore={handleRestore}
                hasContextError={
                  stateToShow.token_counts?.per_file?.includes(null) ||
                  stateToShow.token_counts?.per_doc_file?.includes(null)
                }
                isActiveTab={isActive}
                isChangeUnsaved={isChangeUnsaved}
              />
            </div>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
};

export default memo(
  Sentry.withErrorBoundary(ContentContainer, {
    fallback: (props) => <ErrorFallback {...props} />,
  }),
);
