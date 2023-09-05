import React, { memo, useCallback, useEffect, useState } from 'react';
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
import { CodeStudioMessageType } from '../../types/api';
import useResizeableSplitPanel from '../../hooks/useResizeableSplitPanel';
import ContextPanel from './ContextPanel';
import HistoryPanel from './HistoryPanel';
import TemplatesPanel from './TemplatesPanel';
import FilePanel from './FilePanel';
import AddContextModal from './AddContextModal';
import RightPanel from './RightPanel';

const ContentContainer = ({ tab }: { tab: StudioTabType }) => {
  const [leftPanel, setLeftPanel] = useState<StudioPanelDataType>({
    type: StudioLeftPanelType.CONTEXT,
    data: null,
  });
  const [isAddContextOpen, setAddContextOpen] = useState(false);
  const [messages, setMessages] = useState<CodeStudioMessageType[]>([]);
  const [contextFiles, setContextFiles] = useState<StudioContextFile[]>([]);
  const [tokensTotal, setTokensTotal] = useState(0);
  const [tokensPerFile, setTokensPerFile] = useState([]);
  const { leftPanelRef, rightPanelRef, dividerRef } = useResizeableSplitPanel();

  const refetchCodeStudio = useCallback(async () => {
    if (tab.key) {
      const resp = await getCodeStudio(tab.key);
      setMessages(resp.messages);
      setContextFiles(resp.context);
      setTokensTotal(resp.token_counts.total);
      setTokensPerFile(resp.token_counts.per_file);
    }
  }, [tab.key]);

  useEffect(() => {
    refetchCodeStudio();
  }, [refetchCodeStudio]);

  const handleAddContextClose = useCallback(() => setAddContextOpen(false), []);
  const onFileAdded = useCallback(
    (
      repo: RepoType,
      branch: string | null,
      filePath: string,
      skip?: boolean,
      ranges?: { start: number; end: number }[],
    ) => {
      if (tab.key) {
        patchCodeStudio(tab.key, {
          context: [
            ...contextFiles,
            {
              path: filePath,
              branch,
              repo: repo.ref,
              hidden: false,
              ranges: ranges || [],
            },
          ],
        }).then(() => refetchCodeStudio());
        if (!skip) {
          setLeftPanel({
            type: StudioLeftPanelType.FILE,
            data: { repo, branch, filePath },
          });
        }
      }
    },
    [tab.key, contextFiles],
  );

  const onFileRangesChanged = useCallback(
    (
      ranges: [number, number][],
      filePath: string,
      repo_ref: string,
      branch: string | null,
    ) => {
      const patchedFile = contextFiles.find(
        (f) =>
          f.path === filePath && f.repo === repo_ref && f.branch === branch,
      );
      if (tab.key && patchedFile) {
        patchedFile.ranges = ranges.map((r) => ({
          start: r[0],
          end: r[1] + 1,
        }));
        const newContext = contextFiles
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
    [tab.key, contextFiles],
  );

  const onFileHide = useCallback(
    (
      filePath: string,
      repo_ref: string,
      branch: string | null,
      hide: boolean,
    ) => {
      const patchedFile = contextFiles.find(
        (f) =>
          f.path === filePath && f.repo === repo_ref && f.branch === branch,
      );
      if (tab.key && patchedFile) {
        patchedFile.hidden = hide;
        const newContext = contextFiles
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
    [tab.key, contextFiles],
  );

  const onFileRemove = useCallback(
    (
      f:
        | { path: string; repo: string; branch: string | null }
        | StudioContextFile[],
    ) => {
      const files = Array.isArray(f) ? f : [f];
      let newContext: StudioContextFile[] = JSON.parse(
        JSON.stringify(contextFiles),
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
    [tab.key, contextFiles],
  );

  return (
    <PageTemplate renderPage="studio">
      <div className="flex flex-1 w-screen relative">
        <div
          className="w-1/2 flex-shrink-0 flex-grow-0 flex flex-col"
          ref={leftPanelRef}
        >
          {leftPanel.type === StudioLeftPanelType.CONTEXT ? (
            <ContextPanel
              setLeftPanel={setLeftPanel}
              setAddContextOpen={setAddContextOpen}
              studioId={tab.key}
              contextFiles={contextFiles}
              tokensPerFile={tokensPerFile}
              onFileRemove={onFileRemove}
              onFileHide={onFileHide}
              onFileAdded={onFileAdded}
              tokensTotal={tokensTotal}
            />
          ) : leftPanel.type === StudioLeftPanelType.HISTORY ? (
            <HistoryPanel
              setLeftPanel={setLeftPanel}
              studioId={tab.key}
              refetchCodeStudio={refetchCodeStudio}
            />
          ) : leftPanel.type === StudioLeftPanelType.TEMPLATES ? (
            <TemplatesPanel setLeftPanel={setLeftPanel} />
          ) : leftPanel.type === StudioLeftPanelType.FILE ? (
            <FilePanel
              {...leftPanel.data}
              setLeftPanel={setLeftPanel}
              onFileRangesChanged={onFileRangesChanged}
              tokens={tokensPerFile[tokensPerFile.length - 1]}
              onFileHide={onFileHide}
              onFileRemove={onFileRemove}
              onFileAdded={onFileAdded}
              contextFiles={contextFiles}
            />
          ) : null}
          <AddContextModal
            isVisible={isAddContextOpen}
            onClose={handleAddContextClose}
            onSubmit={onFileAdded}
            contextFiles={contextFiles}
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
            messages={messages}
            refetchCodeStudio={refetchCodeStudio}
            tokensTotal={tokensTotal}
          />
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
