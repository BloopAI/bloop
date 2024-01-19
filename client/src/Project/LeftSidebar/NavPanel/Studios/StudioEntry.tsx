import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CodeStudioType } from '../../../../types/api';
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
import FileIcon from '../../../../components/FileIcon';
import { humanNumber, splitPath } from '../../../../utils';
import Tooltip from '../../../../components/Tooltip';
import StudioSubItem from './StudioSubItem';

type Props = CodeStudioType & {
  index: string;
  focusedIndex: string;
  expandedIndex: string;
  setExpandedIndex: Dispatch<SetStateAction<string>>;
  isLeftSidebarFocused: boolean;
  isCommandBarVisible: boolean;
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
}: Props) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (focusedIndex.startsWith(index)) {
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
        className={`w-full text-left h-7 flex-shrink-0 flex items-center gap-3 pr-2 cursor-pointer
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
        <ChevronRight
          sizeClassName="w-3.5 h-3.5"
          className={`${
            expandedIndex === index ? 'rotate-90' : ''
          } transition-transform duration-150`}
        />
        <CodeStudioIcon sizeClassName="w-3.5 h-3.5" />
        <span className="ellipsis">{name}</span>
      </a>
      {expandedIndex === index && (
        <div className="relative">
          <div className="absolute top-0 bottom-0 left-[1.375rem] w-px bg-bg-border" />
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
          {!!context.length && (
            <div className="body-tiny text-label-base pl-10.5 pr-4 h-7 flex items-center">
              <Trans>Context files</Trans>
            </div>
          )}
          {context.map((f, i) => (
            <StudioSubItem
              key={`${f.path}-${f.repo}-${f.branch}`}
              studioId={id}
              focusedIndex={focusedIndex}
              index={`${index}-${f.path}-${f.repo}-${f.branch}`}
              studioName={name}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
              path={f.path}
              repoRef={f.repo}
              branch={f.branch}
              ranges={f.ranges}
            >
              <FileIcon filename={f.path} noMargin />
              <span className="flex-1 ellipsis">{splitPath(f.path).pop()}</span>
              {!!f.ranges.length && (
                <Tooltip
                  text={
                    f.ranges.length === 1
                      ? t('Lines # - #', {
                          start: f.ranges[0].start + 1,
                          end: f.ranges[0].end ? f.ranges[0].end + 1 : '',
                        })
                      : t('# ranges', { count: f.ranges.length })
                  }
                  placement={'top'}
                >
                  <RangeIcon sizeClassName="w-3.5 h-3.5" />
                </Tooltip>
              )}
              <span
                className={`code-mini w-10 text-right ${
                  (token_counts.per_file[i] || 0) < 2000 &&
                  (token_counts.per_file[i] || 0) > 500
                    ? 'text-yellow'
                    : (token_counts.per_file[i] || 0) < 500
                    ? 'text-green'
                    : 'text-red'
                }`}
              >
                {humanNumber(token_counts.per_file[i] || 0)}
              </span>
            </StudioSubItem>
          ))}
          {!!doc_context.length && (
            <div className="body-tiny text-label-base pl-10.5 pr-4 h-7 flex items-center">
              <Trans>Documentation in studio</Trans>
            </div>
          )}
          {doc_context.map((d, i) => (
            <StudioSubItem
              key={`${d.doc_id}`}
              studioId={id}
              focusedIndex={focusedIndex}
              index={`${index}-${d.doc_id}`}
              studioName={name}
              isLeftSidebarFocused={isLeftSidebarFocused}
              isCommandBarVisible={isCommandBarVisible}
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
                  text={
                    d.ranges.length === 1
                      ? t('Lines # - #', {
                          start: d.ranges[0] + 1,
                          end: d.ranges[1],
                        })
                      : t('# ranges', { count: d.ranges.length })
                  }
                  placement={'top'}
                >
                  <RangeIcon sizeClassName="w-3.5 h-3.5" />
                </Tooltip>
              )}
              <span
                className={`code-mini w-10 text-right ${
                  (token_counts.per_doc_file[i] || 0) < 2000 &&
                  (token_counts.per_doc_file[i] || 0) > 500
                    ? 'text-yellow'
                    : (token_counts.per_doc_file[i] || 0) < 500
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
