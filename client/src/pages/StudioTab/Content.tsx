import React, { memo, useCallback, useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { Trans, useTranslation } from 'react-i18next';
import ErrorFallback from '../../components/ErrorFallback';
import PageTemplate from '../../components/PageTemplate';
import Button from '../../components/Button';
import CodeStudioToken from '../../icons/CodeStudioToken';
import { Template } from '../../icons';
import {
  RepoType,
  StudioContextFile,
  StudioLeftPanelType,
  StudioPanelDataType,
  StudioTabType,
} from '../../types/general';
import { getCodeStudio, patchCodeStudio } from '../../services/api';
import { CodeStudioMessageType } from '../../types/api';
import Conversation from './Conversation';
import ContextPanel from './ContextPanel';
import HistoryPanel from './HistoryPanel';
import TemplatesPanel from './TemplatesPanel';
import FilePanel from './FilePanel';
import AddContextModal from './AddContextModal';

const ContentContainer = ({ tab }: { tab: StudioTabType }) => {
  const { t } = useTranslation();
  const [leftPanel, setLeftPanel] = useState<StudioPanelDataType>({
    type: StudioLeftPanelType.CONTEXT,
    data: null,
  });
  const [isAddContextOpen, setAddContextOpen] = useState(false);
  const [messages, setMessages] = useState<CodeStudioMessageType[]>([]);
  const [contextFiles, setContextFiles] = useState<StudioContextFile[]>([]);
  const [tokensTotal, setTokensTotal] = useState(0);
  const [tokensPerFile, setTokensPerFile] = useState([]);

  const refetchCodeStudio = useCallback(() => {
    if (tab.key) {
      getCodeStudio(tab.key).then((resp) => {
        setMessages(resp.messages);
        setContextFiles(resp.context);
        setTokensTotal(resp.token_counts.total);
        setTokensPerFile(resp.token_counts.per_file);
      });
    }
  }, [tab.key]);

  useEffect(() => {
    refetchCodeStudio();
  }, [refetchCodeStudio]);

  const handleAddContextClose = useCallback(() => setAddContextOpen(false), []);
  const onNewContextSubmit = useCallback(
    (repo: RepoType, branch: string, filePath: string) => {
      if (tab.key) {
        patchCodeStudio(tab.key, {
          context: [
            ...contextFiles,
            {
              path: filePath,
              branch,
              repo: repo.ref,
              hidden: false,
              ranges: [],
            },
          ],
        }).then(() => refetchCodeStudio());
        setLeftPanel({
          type: StudioLeftPanelType.FILE,
          data: { repo, branch, filePath },
        });
      }
    },
    [tab.key, contextFiles],
  );

  const onFileRangesChanged = useCallback(
    (
      ranges: [number, number][],
      filePath: string,
      repo_ref: string,
      branch: string,
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
    (filePath: string, repo_ref: string, branch: string, hide: boolean) => {
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
    (filePath: string, repo_ref: string, branch: string) => {
      const patchedFile = contextFiles.findIndex(
        (f) =>
          f.path === filePath && f.repo === repo_ref && f.branch === branch,
      );
      if (tab.key && patchedFile > -1) {
        const newContext = contextFiles.filter((f, i) => i !== patchedFile);
        patchCodeStudio(tab.key, {
          context: newContext,
        }).then(() => refetchCodeStudio());
      }
    },
    [tab.key, contextFiles],
  );

  return (
    <PageTemplate renderPage="studio">
      <div className="flex flex-1 w-screen">
        <div className="w-1/2 border-r border-bg-border flex-shrink-0 flex-grow-0 flex flex-col">
          {leftPanel.type === StudioLeftPanelType.CONTEXT ? (
            <ContextPanel
              setLeftPanel={setLeftPanel}
              setAddContextOpen={setAddContextOpen}
              studioId={tab.key}
              contextFiles={contextFiles}
              tokensTotal={tokensTotal}
              tokensPerFile={tokensPerFile}
              onFileRemove={onFileRemove}
              onFileHide={onFileHide}
            />
          ) : leftPanel.type === StudioLeftPanelType.HISTORY ? (
            <HistoryPanel setLeftPanel={setLeftPanel} />
          ) : leftPanel.type === StudioLeftPanelType.TEMPLATES ? (
            <TemplatesPanel setLeftPanel={setLeftPanel} />
          ) : leftPanel.type === StudioLeftPanelType.FILE ? (
            <FilePanel
              {...leftPanel.data}
              setLeftPanel={setLeftPanel}
              onFileRangesChanged={onFileRangesChanged}
            />
          ) : null}
          <AddContextModal
            isVisible={isAddContextOpen}
            onClose={handleAddContextClose}
            onSubmit={onNewContextSubmit}
          />
        </div>
        <div className="w-1/2 flex-shrink-0 flex-grow-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-8 h-11.5 border-b border-bg-border bg-bg-sub shadow-low select-none">
            <div className="flex items-center gap-1.5 text-label-muted">
              <p className="body-s text-label-title">
                <Trans>Studio conversation</Trans>
              </p>
              <CodeStudioToken />
              <span className="caption text-label-base">
                {t('# of #', { count: tokensTotal, total: '42,000' })}
              </span>
            </div>
            <Button
              size="tiny"
              variant="secondary"
              onClick={() =>
                setLeftPanel({
                  type: StudioLeftPanelType.TEMPLATES,
                  data: null,
                })
              }
            >
              <Template raw sizeClassName="w-3.5 h-3.5" />
              <Trans>My templates</Trans>
            </Button>
          </div>
          <Conversation
            setLeftPanel={setLeftPanel}
            studioId={tab.key}
            messages={messages}
            refetchCodeStudio={refetchCodeStudio}
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
