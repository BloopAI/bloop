import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import * as Sentry from '@sentry/react';
import ErrorFallback from '../../components/ErrorFallback';
import PageTemplate from '../../components/PageTemplate';
import {
  RepoType,
  StudioContextFile,
  StudioLeftPanelType,
  StudioPanelDataType,
  StudioTabType,
} from '../../types/general';
import { getCodeStudio, patchCodeStudio } from '../../services/api';
import { CodeStudioType, HistoryConversationTurn } from '../../types/api';
import useResizeableSplitPanel from '../../hooks/useResizeableSplitPanel';
import ContextPanel from './ContextPanel';
import HistoryPanel from './HistoryPanel';
import TemplatesPanel from './TemplatesPanel';
import FilePanel from './FilePanel';
import AddContextModal from './AddContextModal';
import RightPanel from './RightPanel';

const emptyCodeStudio: CodeStudioType = {
  messages: [],
  context: [],
  token_counts: { total: 0, per_file: [], messages: 0 },
  name: '',
  id: '',
  modified_at: '',
};

const ContentContainer = ({ tab }: { tab: StudioTabType }) => {
  const [leftPanel, setLeftPanel] = useState<StudioPanelDataType>({
    type: StudioLeftPanelType.CONTEXT,
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

  const refetchCodeStudio = useCallback(async () => {
    if (tab.key) {
      const resp = await getCodeStudio(tab.key);
      setCurrentState(resp);
    }
  }, [tab.key]);

  useEffect(() => {
    refetchCodeStudio();
  }, [refetchCodeStudio]);

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
      setLeftPanel({
        type: StudioLeftPanelType.FILE,
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
      if (closeHistory) {
        setIsHistoryOpen(false);
      }
    },
    [],
  );

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
      <div className="flex flex-1 w-screen">
        {isHistoryOpen && (
          <HistoryPanel
            setIsHistoryOpen={setIsHistoryOpen}
            studioId={tab.key}
            refetchCodeStudio={refetchCodeStudio}
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
                setLeftPanel={setLeftPanel}
                setAddContextOpen={setAddContextOpen}
                studioId={tab.key}
                contextFiles={stateToShow.context}
                tokensPerFile={stateToShow.token_counts?.per_file || []}
                onFileRemove={onFileRemove}
                onFileHide={onFileHide}
                onFileAdded={onFileAdded}
                tokensTotal={stateToShow.token_counts?.total}
              />
            ) : leftPanel.type === StudioLeftPanelType.TEMPLATES ? (
              <TemplatesPanel setLeftPanel={setLeftPanel} />
            ) : leftPanel.type === StudioLeftPanelType.FILE ? (
              <FilePanel
                {...leftPanel.data}
                setLeftPanel={setLeftPanel}
                onFileRangesChanged={onFileRangesChanged}
                tokens={
                  stateToShow.token_counts?.per_file[
                    stateToShow.token_counts?.per_file.length - 1
                  ]
                }
              />
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
            <RightPanel
              setLeftPanel={setLeftPanel}
              studioId={tab.key}
              messages={stateToShow.messages}
              refetchCodeStudio={refetchCodeStudio}
              tokensTotal={stateToShow.token_counts?.total}
              setIsHistoryOpen={setIsHistoryOpen}
            />
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
