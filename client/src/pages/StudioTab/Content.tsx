import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { Trans } from 'react-i18next';
import ErrorFallback from '../../components/ErrorFallback';
import PageTemplate from '../../components/PageTemplate';
import {
  RepoType,
  StudioContextFile,
  StudioLeftPanelDataType,
  StudioLeftPanelType,
  StudioRightPanelDataType,
  StudioRightPanelType,
  StudioTabType,
} from '../../types/general';
import { getCodeStudio, patchCodeStudio } from '../../services/api';
import { CodeStudioType, HistoryConversationTurn } from '../../types/api';
import useResizeableSplitPanel from '../../hooks/useResizeableSplitPanel';
import { TOKEN_LIMIT } from '../../consts/codeStudio';
import { Info } from '../../icons';
import ContextPanel from './ContextPanel';
import HistoryPanel from './HistoryPanel';
import TemplatesPanel from './TemplatesPanel';
import AddContextModal from './AddContextModal';
import RightPanel from './RightPanel';
import FilePanel from './FilePanel';

const emptyCodeStudio: CodeStudioType = {
  messages: [],
  context: [],
  token_counts: { total: 0, per_file: [], messages: 0 },
  name: '',
  id: '',
  modified_at: '',
};

const ContentContainer = ({
  tab,
  isActive,
}: {
  tab: StudioTabType;
  isActive: boolean;
}) => {
  const [leftPanel, setLeftPanel] = useState<StudioLeftPanelDataType>({
    type: StudioLeftPanelType.CONTEXT,
    data: null,
  });
  const [rightPanel, setRightPanel] = useState<StudioRightPanelDataType>({
    type: StudioRightPanelType.CONVERSATION,
    data: null,
  });
  const [isAddContextOpen, setAddContextOpen] = useState(false);
  const [currentState, setCurrentState] =
    useState<CodeStudioType>(emptyCodeStudio);
  const [previewingState, setPreviewingState] = useState<null | CodeStudioType>(
    null,
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const { leftPanelRef, rightPanelRef, dividerRef, containerRef } =
    useResizeableSplitPanel();

  const refetchCodeStudio = useCallback(
    async (keyToUpdate?: keyof CodeStudioType) => {
      if (tab.key) {
        const resp = await getCodeStudio(tab.key);
        setCurrentState((prev) => {
          if (JSON.stringify(resp) === JSON.stringify(prev)) {
            return prev;
          }
          if (keyToUpdate) {
            return { ...prev, [keyToUpdate]: resp[keyToUpdate] };
          }
          return resp;
        });
      }
    },
    [tab.key],
  );

  useEffect(() => {
    if (isActive) {
      refetchCodeStudio();
    }
  }, [refetchCodeStudio, isActive]);

  const handleAddContextClose = useCallback(() => setAddContextOpen(false), []);
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
            ...currentState.context,
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
    [tab.key, currentState.context],
  );

  const onFileSelected = useCallback(
    (repo: RepoType, branch: string | null, filePath: string) => {
      setRightPanel({
        type: StudioRightPanelType.FILE,
        data: { repo, branch, filePath },
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
      const patchedFile = currentState.context.find(
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
        const newContext = currentState.context
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
    [tab.key, currentState.context],
  );

  const onFileHide = useCallback(
    (
      filePath: string,
      repo_ref: string,
      branch: string | null,
      hide: boolean,
    ) => {
      const patchedFile = currentState.context.find(
        (f) =>
          f.path === filePath && f.repo === repo_ref && f.branch === branch,
      );
      if (tab.key && patchedFile) {
        patchedFile.hidden = hide;
        const newContext = currentState.context
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
    [tab.key, currentState.context],
  );

  const onFileRemove = useCallback(
    (
      f:
        | { path: string; repo: string; branch: string | null }
        | StudioContextFile[],
    ) => {
      const files = Array.isArray(f) ? f : [f];
      let newContext: StudioContextFile[] = JSON.parse(
        JSON.stringify(currentState.context),
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
    [tab.key, currentState.context],
  );

  const handlePreview = useCallback(
    (state?: HistoryConversationTurn, closeHistory?: boolean) => {
      setPreviewingState(state || null);
      if (state) {
        setRightPanel({ type: StudioRightPanelType.CONVERSATION, data: null });
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
    return isHistoryOpen && previewingState ? previewingState : currentState;
  }, [isHistoryOpen, previewingState, currentState]);

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
              isHistoryOpen ? 'w-[calc(100%-13rem)]' : 'w-full'
            }`}
            ref={containerRef}
          >
            <div
              className="w-1/2 flex-shrink-0 flex-grow-0 flex flex-col"
              ref={leftPanelRef}
            >
              {leftPanel.type === StudioLeftPanelType.CONTEXT ? (
                <ContextPanel
                  setRightPanel={setRightPanel}
                  setAddContextOpen={setAddContextOpen}
                  studioId={tab.key}
                  contextFiles={stateToShow.context}
                  tokensPerFile={stateToShow.token_counts?.per_file || []}
                  onFileRemove={onFileRemove}
                  onFileHide={onFileHide}
                  onFileAdded={onFileAdded}
                  isPreviewing={!!previewingState}
                  isActiveTab={isActive}
                />
              ) : leftPanel.type === StudioLeftPanelType.TEMPLATES ? (
                <TemplatesPanel setLeftPanel={setLeftPanel} />
              ) : null}
              <AddContextModal
                isVisible={isAddContextOpen}
                onClose={handleAddContextClose}
                onSubmit={onFileSelected}
                contextFiles={stateToShow.context}
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
              {rightPanel.type === StudioRightPanelType.CONVERSATION ? (
                <RightPanel
                  setLeftPanel={setLeftPanel}
                  studioId={tab.key}
                  messages={stateToShow.messages}
                  refetchCodeStudio={refetchCodeStudio}
                  tokensTotal={stateToShow.token_counts?.total}
                  setIsHistoryOpen={setIsHistoryOpen}
                  isPreviewing={!!previewingState}
                  handleRestore={handleRestore}
                  hasContextError={stateToShow.token_counts?.per_file?.includes(
                    null,
                  )}
                  isActiveTab={isActive}
                />
              ) : rightPanel.type === StudioRightPanelType.FILE ? (
                <FilePanel
                  {...rightPanel.data}
                  setRightPanel={setRightPanel}
                  onFileRangesChanged={onFileRangesChanged}
                  isActiveTab={isActive}
                />
              ) : null}
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
