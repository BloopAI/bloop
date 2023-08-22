import React, { memo, useState } from 'react';
import * as Sentry from '@sentry/react';
import { Trans, useTranslation } from 'react-i18next';
import ErrorFallback from '../../components/ErrorFallback';
import PageTemplate from '../../components/PageTemplate';
import Button from '../../components/Button';
import CodeStudioToken from '../../icons/CodeStudioToken';
import { Template } from '../../icons';
import { StudioLeftPanelType, StudioPanelDataType } from '../../types/general';
import Conversation from './Conversation';
import ContextPanel from './ContextPanel';
import HistoryPanel from './HistoryPanel';
import TemplatesPanel from './TemplatesPanel';
import FilePanel from './FilePanel';

const ContentContainer = () => {
  const { t } = useTranslation();
  const [leftPanel, setLeftPanel] = useState<StudioPanelDataType>({
    type: StudioLeftPanelType.CONTEXT,
    data: null,
  });

  return (
    <PageTemplate renderPage="studio">
      <div className="flex flex-1 w-screen">
        <div className="w-1/2 border-r border-bg-border flex-shrink-0 flex-grow-0 flex flex-col">
          {leftPanel.type === StudioLeftPanelType.CONTEXT ? (
            <ContextPanel setLeftPanel={setLeftPanel} />
          ) : leftPanel.type === StudioLeftPanelType.HISTORY ? (
            <HistoryPanel setLeftPanel={setLeftPanel} />
          ) : leftPanel.type === StudioLeftPanelType.TEMPLATES ? (
            <TemplatesPanel setLeftPanel={setLeftPanel} />
          ) : leftPanel.type === StudioLeftPanelType.FILE ? (
            <FilePanel setLeftPanel={setLeftPanel} {...leftPanel.data} />
          ) : null}
        </div>
        <div className="w-1/2 flex-shrink-0 flex-grow-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-8 h-11.5 border-b border-bg-border bg-bg-sub shadow-low">
            <div className="flex items-center gap-1.5 text-label-muted">
              <p className="body-s text-label-title">
                <Trans>Studio conversation</Trans>
              </p>
              <CodeStudioToken />
              <span className="caption text-label-base">
                {t('# of #', { count: 0, total: '42,000' })}
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
          <Conversation setLeftPanel={setLeftPanel} />
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
