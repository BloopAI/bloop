import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CodeStudioType, HistoryConversationTurn } from '../../../../types/api';
import {
  CodeStudioIcon,
  MagazineIcon,
  PromptIcon,
  RangeIcon,
} from '../../../../icons';
import ChevronRight from '../../../../icons/ChevronRight';
import TokenUsage from '../../../../components/TokenUsage';
import { TOKEN_LIMIT } from '../../../../consts/codeStudio';
import { useEnterKey } from '../../../../hooks/useEnterKey';
import { humanNumber } from '../../../../utils';
import Tooltip from '../../../../components/Tooltip';
import Badge from '../../../../components/Badge';
import { IndexingStatusType } from '../../../../types/general';
import StudioSubItem from './StudioSubItem';
import AddContextFile from './AddContextFile';
import StudioFile from './StudioFile';
import StudioHistory from './StudioHistory';

type Props = CodeStudioType & {
  index: string;
  focusedIndex: string;
  expandedIndex: string;
  setExpandedIndex: Dispatch<SetStateAction<string>>;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
  indexingStatus: IndexingStatusType;
  projectId: string;
  previewingSnapshot: HistoryConversationTurn | null;
};

const StudioEntry = ({
  id,
  index,
  focusedIndex,
  name,
  expandedIndex,
  setExpandedIndex,
  context,
  token_counts,
  doc_context,
  isLeftSidebarFocused,
  isCommandBarVisible,
  indexingStatus,
  projectId,
  previewingSnapshot,
}: Props) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (focusedIndex.startsWith(index) && focusedIndex !== index) {
      setExpandedIndex(index);
    }
  }, [index, focusedIndex]);

  const handleExpand = useCallback(() => {
    setExpandedIndex((prev) => (prev === index ? '' : index));
  }, [index]);

  useEnterKey(
    handleExpand,
    focusedIndex !== index || !isLeftSidebarFocused || isCommandBarVisible,
  );

  return (
    <div className="body-mini">
      <a
        href="#"
        className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 justify-between pr-2 cursor-pointer
          ellipsis body-mini group ${
            focusedIndex === index ? 'bg-bg-sub-hover' : ''
          } ${
            expandedIndex === index || focusedIndex.startsWith(index)
              ? 'text-label-title'
              : 'text-label-base'
          }
          hover:bg-bg-base-hover hover:text-label-title active:bg-transparent pl-4`}
        onClick={handleExpand}
        data-node-index={index}
      >
        <span className="flex items-center gap-3">
          <ChevronRight
            sizeClassName="w-3.5 h-3.5"
            className={`${
              expandedIndex === index ? 'rotate-90' : ''
            } transition-transform duration-150`}
          />
          <CodeStudioIcon sizeClassName="w-3.5 h-3.5" />
          <span className="ellipsis">{name}</span>
        </span>
        {!token_counts.total && (
          <Badge text={t('New')} type="studio" size="mini" />
        )}
      </a>
      {expandedIndex === index && (
        <div className="relative">
          <div className="absolute top-0 bottom-0 left-[1.375rem] w-px bg-bg-border" />
          <StudioHistory
            studioName={name}
            studioId={id}
            projectId={projectId}
            shouldRefresh={token_counts}
            focusedIndex={focusedIndex}
            index={`${index}-history`}
            isLeftSidebarFocused={isLeftSidebarFocused}
            isCommandBarVisible={isCommandBarVisible}
          />
          <StudioSubItem
            studioId={id}
            focusedIndex={focusedIndex}
            index={`${index}-prompts`}
            studioName={name}
            isLeftSidebarFocused={isLeftSidebarFocused}
            isCommandBarVisible={isCommandBarVisible}
          >
            <PromptIcon sizeClassName="w-3.5 h-3.5" />
            <span className="flex-1 ellipsis">
              <Trans>Prompts</Trans>
            </span>
            <TokenUsage percent={(token_counts.messages / TOKEN_LIMIT) * 100} />
          </StudioSubItem>
          <div className="body-tiny text-label-base pl-10.5 pr-4 h-7 flex items-center">
            <Trans>Context files</Trans>
          </div>
          {!context.length && !previewingSnapshot && (
            <AddContextFile
              studioId={id}
              focusedIndex={focusedIndex}
              index={`${index}-add-file`}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
            />
          )}
          {(previewingSnapshot?.context || context).map((f, i) => (
            <StudioFile
              key={`${f.path}-${f.repo}-${f.branch}`}
              studioId={id}
              focusedIndex={focusedIndex}
              index={`${index}-${f.path}-${f.repo}-${f.branch}`}
              studioName={name}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
              tokens={token_counts.per_file[i]}
              indexingData={indexingStatus[f.repo]}
              {...f}
            />
          ))}
          {!!(doc_context.length || previewingSnapshot?.doc_context.length) && (
            <div className="body-tiny text-label-base pl-10.5 pr-4 h-7 flex items-center">
              <Trans>Documentation in studio</Trans>
            </div>
          )}
          {(previewingSnapshot?.doc_context || doc_context).map((d, i) => (
            <StudioSubItem
              key={`${d.doc_id}-${d.doc_id}-${d.relative_url}`}
              studioId={id}
              focusedIndex={focusedIndex}
              index={`${index}-${d.doc_id}-${d.relative_url}`}
              studioName={name}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
              docId={d.doc_id}
              relativeUrl={d.relative_url}
              docTitle={d.doc_title || ''}
              docFavicon={d.doc_icon || ''}
              sections={d.ranges}
            >
              {d.doc_icon ? (
                <img
                  src={d.doc_icon}
                  alt={d.doc_title || d.absolute_url}
                  className={'w-4 h-4'}
                />
              ) : (
                <MagazineIcon sizeClassName="w-4 h-4" />
              )}
              <span className="flex-1 ellipsis">{d.doc_title}</span>
              {!!d.ranges.length && (
                <Tooltip
                  text={t('# selected section', { count: d.ranges.length })}
                  placement={'top'}
                >
                  <RangeIcon sizeClassName="w-3.5 h-3.5" />
                </Tooltip>
              )}
              <span
                className={`code-mini w-10 text-right ${
                  (token_counts.per_doc_file[i] || 0) < 18000 &&
                  (token_counts.per_doc_file[i] || 0) > 1500
                    ? 'text-yellow'
                    : (token_counts.per_doc_file[i] || 0) <= 1500
                    ? 'text-green'
                    : 'text-red'
                }`}
              >
                {humanNumber(token_counts.per_doc_file[i] || 0)}
              </span>
            </StudioSubItem>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(StudioEntry);
