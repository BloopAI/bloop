import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { HistoryConversationTurn } from '../../../../types/api';
import { getCodeStudioHistory } from '../../../../services/api';
import ChevronRight from '../../../../icons/ChevronRight';
import { ArrowHistoryIcon, DateTimeCalendarIcon } from '../../../../icons';
import { getDateFnsLocale } from '../../../../utils';
import { LocaleContext } from '../../../../context/localeContext';
import Badge from '../../../../components/Badge';
import { useArrowNavigationItemProps } from '../../../../hooks/useArrowNavigationItemProps';
import StudioSubItem from './StudioSubItem';

type Props = {
  projectId: string;
  studioId: string;
  shouldRefresh: any;
  index: string;
  studioName: string;
  previewingSnapshot?: string;
};

const StudioHistory = ({
  projectId,
  studioId,
  shouldRefresh,
  index,
  studioName,
  previewingSnapshot,
}: Props) => {
  const { t } = useTranslation();
  const { locale } = useContext(LocaleContext);
  const [snapshots, setSnapshots] = useState<HistoryConversationTurn[]>([]);

  const onClick = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const { isFocused, focusedIndex, props } =
    useArrowNavigationItemProps<HTMLAnchorElement>(index, onClick);

  const [isExpanded, setIsExpanded] = useState(focusedIndex.startsWith(index));

  useEffect(() => {
    getCodeStudioHistory(projectId, studioId).then((r) => setSnapshots(r));
  }, [shouldRefresh, projectId, studioId]);

  useEffect(() => {
    if (focusedIndex.startsWith(index) && focusedIndex !== index) {
      setIsExpanded(true);
    }
  }, [focusedIndex, index]);

  return !snapshots.length ? null : (
    <div>
      <a
        className={`w-full h-7 flex items-center gap-3 pl-10.5 pr-4 cursor-pointer ${
          isFocused ? 'bg-bg-sub-hover text-label-title' : 'text-label-base'
        }`}
        {...props}
      >
        <span className="flex items-center gap-3">
          <ChevronRight
            sizeClassName="w-3.5 h-3.5"
            className={`${
              isExpanded ? 'rotate-90' : ''
            } transition-transform duration-150`}
          />
          <ArrowHistoryIcon sizeClassName="w-3.5 h-3.5" />
          <span className="ellipsis">
            <Trans>History</Trans>
          </span>
        </span>
      </a>
      {isExpanded && (
        <div className="relative">
          <div className="absolute top-0 bottom-3 left-12 w-px bg-bg-border" />
          {snapshots.map((s, i) => (
            <StudioSubItem
              key={s.id}
              morePadding
              studioId={studioId}
              index={`${index}-${s.id}`}
              studioName={studioName}
              snapshot={i === 0 ? null : s}
              isCurrentPath={previewingSnapshot === s.id}
            >
              <DateTimeCalendarIcon sizeClassName="w-3.5 h-3.5" />
              <span className="flex-1 ellipsis">
                {format(
                  new Date(s.modified_at + '.000Z'),
                  'd MMM · hh:mm a',
                  getDateFnsLocale(locale),
                )}
              </span>
              {i === 0 && (
                <Badge text={t('Current')} type="green" size="mini" />
              )}
            </StudioSubItem>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(StudioHistory);
