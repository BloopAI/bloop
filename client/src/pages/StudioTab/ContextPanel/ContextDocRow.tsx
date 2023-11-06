import React, { Dispatch, memo, SetStateAction, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StudioContextDoc,
  StudioLeftPanelDataType,
  StudioLeftPanelType,
} from '../../../types/general';
import TokensUsageBadge from '../TokensUsageBadge';
import Button from '../../../components/Button';
import {
  Eye,
  EyeCut,
  Magazine,
  TrashCanFilled,
  WarningSign,
} from '../../../icons';
import Tooltip from '../../../components/Tooltip';
import SectionsBadge from '../DocPanel/SectionsBadge';

type Props = StudioContextDoc & {
  setLeftPanel: Dispatch<SetStateAction<StudioLeftPanelDataType>>;
  tokens: number | null;
  onDocHide: (
    docId: string,
    baseUrl: string,
    relativeUrl: string,
    hide: boolean,
  ) => void;
  onDocRemove: (docId: string, baseUrl: string, relativeUrl: string) => void;
  isPreviewing: boolean;
};

const ContextFileRow = ({
  tokens,
  ranges,
  hidden,
  setLeftPanel,
  isPreviewing,
  relative_url,
  absolute_url,
  doc_icon,
  doc_title,
  doc_id,
  doc_source,
  onDocHide,
  onDocRemove,
}: Props) => {
  const { t } = useTranslation();

  const handleClick = useCallback(() => {
    if (tokens !== null) {
      setLeftPanel({
        type: StudioLeftPanelType.DOCS,
        data: {
          docProvider: {
            id: doc_id,
            url: doc_source,
            name: doc_title || '',
            favicon: doc_icon || '',
          },
          absoluteUrl: absolute_url,
          title: doc_title || doc_source,
          isDocInContext: true,
          url: relative_url,
          initialSections: ranges,
        },
      });
    }
  }, [doc_id, doc_source, relative_url, ranges, tokens, absolute_url]);

  return (
    <div
      className="w-full overflow-x-auto border-b border-bg-base bg-bg-sub group cursor-pointer flex-shrink-0 select-none"
      onClick={handleClick}
    >
      <div className={`max-w-full flex gap-2 items-center py-3 px-8`}>
        {tokens === null ? (
          <Tooltip
            text={
              <div className="max-w-xs text-left">
                {t(
                  'This page is currently unavailable. Ability to generate will be resumed as soon as this issue is resolved.',
                )}
              </div>
            }
            placement={'top'}
          >
            <div
              className={`rounded flex-shrink-0 items-center justify-center p-1 bg-bg-base relative`}
            >
              {doc_icon ? (
                <img src={doc_icon} alt={doc_title || ''} className="w-5 h-5" />
              ) : (
                <Magazine />
              )}
              <div className="absolute -bottom-3 -right-2 text-warning-300">
                <WarningSign raw sizeClassName="w-3.5 h-3.5" />
              </div>
            </div>
          </Tooltip>
        ) : (
          <div
            className={`rounded flex-shrink-0 items-center justify-center p-1 bg-bg-base`}
          >
            {doc_icon ? (
              <img src={doc_icon} alt={doc_title || ''} className="w-5 h-5" />
            ) : (
              <Magazine />
            )}
          </div>
        )}
        <div className="flex items-center gap-2 flex-1">
          <p
            className={`body-s-strong text-label-title ellipsis ${
              hidden ? 'opacity-30' : ''
            }`}
          >
            <Tooltip text={absolute_url} placement={'bottom-start'} delay={500}>
              {doc_title || absolute_url}
            </Tooltip>
          </p>
          <SectionsBadge sections={ranges} />
        </div>
        {tokens !== null && tokens !== undefined && (
          <div className="w-16 flex items-center flex-shrink-0">
            <TokensUsageBadge tokens={tokens} />
          </div>
        )}
        {!isPreviewing && (
          <>
            {tokens !== null && (
              <Button
                variant="tertiary"
                size="tiny"
                onlyIcon
                title={hidden ? t('Show file') : t('Hide file')}
                className={
                  'opacity-50 group-hover:opacity-100 group-focus:opacity-100'
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onDocHide(doc_id, doc_source, relative_url, !hidden);
                }}
              >
                {hidden ? (
                  <EyeCut raw sizeClassName="w-3.5 h-3.5" />
                ) : (
                  <Eye raw sizeClassName="w-3.5 h-3.5" />
                )}
              </Button>
            )}
            <Button
              variant="tertiary"
              size="tiny"
              onlyIcon
              title={t('Remove file')}
              className={
                'opacity-50 group-hover:opacity-100 group-focus:opacity-100'
              }
              onClick={(e) => {
                e.stopPropagation();
                onDocRemove(doc_id, doc_source, relative_url);
              }}
            >
              <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(ContextFileRow);
