import { memo, useCallback, useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  ChatLoadingStep,
  ChatMessageAuthor,
  ParsedQueryType,
} from '../../../../types/general';
import { EnvContext } from '../../../../context/envContext';
import MarkdownWithCode from '../../../../components/MarkdownWithCode';
import Button from '../../../../components/Button';
import {
  CheckListIcon,
  LikeIcon,
  PencilIcon,
  UnlikeIcon,
  WarningSignIcon,
} from '../../../../icons';
import { getDateFnsLocale } from '../../../../utils';
import SpinLoaderContainer from '../../../../components/Loaders/SpinnerLoader';
import {
  getPlainFromStorage,
  LOADING_STEPS_SHOWN_KEY,
  savePlainToStorage,
} from '../../../../services/storage';
import { LocaleContext } from '../../../../context/localeContext';
import { upvoteAnswer } from '../../../../services/api';
import CopyButton from '../../../../components/MarkdownWithCode/CopyButton';
import UserParsedQuery from './UserParsedQuery';
import LoadingStep from './LoadingStep';

type Props = {
  author: ChatMessageAuthor;
  text: string;
  parsedQuery?: ParsedQueryType[];
  error?: string;
  threadId: string;
  queryId: string;
  responseTimestamp: string | null;
  showInlineFeedback: boolean;
  isLoading?: boolean;
  loadingSteps?: ChatLoadingStep[];
  i: number;
  onMessageEdit: (queryId: string, i: number) => void;
  singleFileExplanation?: boolean;
  side: 'left' | 'right';
  projectId: string;
};

const ConversationMessage = ({
  author,
  text,
  parsedQuery,
  i,
  queryId,
  onMessageEdit,
  singleFileExplanation,
  threadId,
  isLoading,
  loadingSteps,
  showInlineFeedback,
  responseTimestamp,
  error,
  side,
  projectId,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(EnvContext);
  const { locale } = useContext(LocaleContext);
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const [isLoadingStepsShown, setLoadingStepsShown] = useState(
    getPlainFromStorage(LOADING_STEPS_SHOWN_KEY)
      ? !!Number(getPlainFromStorage(LOADING_STEPS_SHOWN_KEY))
      : true,
  );

  useEffect(() => {
    savePlainToStorage(
      LOADING_STEPS_SHOWN_KEY,
      isLoadingStepsShown ? '1' : '0',
    );
  }, [isLoadingStepsShown]);

  const toggleStepsShown = useCallback(() => {
    setLoadingStepsShown((prev) => !prev);
  }, []);

  const handleEdit = useCallback(() => {
    onMessageEdit(queryId, i);
  }, [onMessageEdit, queryId, i]);

  const handleUpvote = useCallback(() => {
    setIsUpvote(true);
    setIsDownvote(false);
    return upvoteAnswer(projectId, threadId, queryId, { type: 'positive' });
  }, [showInlineFeedback, envConfig.tracking_id, threadId, queryId, projectId]);

  const handleDownvote = useCallback(() => {
    setIsUpvote(false);
    setIsDownvote(true);
    return upvoteAnswer(projectId, threadId, queryId, {
      type: 'negative',
      feedback: '',
    });
  }, [showInlineFeedback, envConfig.tracking_id, threadId, queryId, projectId]);

  return (
    <div
      className={`flex items-start gap-5 rounded-md p-4 relative group ${
        error ? '' : 'hover:bg-bg-sub-hover'
      }`}
    >
      {error ? (
        <div className="flex items-center w-full gap-4 select-none">
          <div className="w-7 h-7 flex items-center justify-center rounded-full bg-red-subtle text-red flex-shrink-0">
            <WarningSignIcon sizeClassName="w-3.5 h-3.5" />
          </div>
          <p className="text-red body-s">{error}</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className="flex w-7 h-7 items-center justify-center rounded-full flex-shrink-0 bg-brand-default-subtitle overflow-hidden">
              {author === ChatMessageAuthor.User ? (
                <img
                  src={envConfig.github_user?.avatar_url}
                  alt={t('avatar')}
                />
              ) : isLoading ? (
                <SpinLoaderContainer
                  sizeClassName="w-4.5 h-4.5"
                  colorClassName="text-brand-default"
                />
              ) : (
                <img className="bloop-head-img w-7 h-7" alt="bloop" />
              )}
            </div>
            {(isUpvote || isDownvote) && (
              <div
                className={`absolute -right-1.5 -bottom-2 rotate-[-15deg] ${
                  isUpvote ? 'text-brand-default' : 'text-red'
                }`}
              >
                {isUpvote ? (
                  <LikeIcon sizeClassName="w-4 h-4" className="icon-stroked" />
                ) : (
                  <UnlikeIcon
                    sizeClassName="w-4 h-4"
                    className="icon-stroked"
                  />
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 flex-1 overflow-auto">
            <div className="body-base-b text-label-title select-none flex items-center gap-1.5">
              {author === ChatMessageAuthor.User ? <Trans>You</Trans> : 'bloop'}
              {author === ChatMessageAuthor.Server && (
                <p className="body-mini text-label-muted">
                  ·{' '}
                  {isLoading ? (
                    <Trans>Streaming response...</Trans>
                  ) : responseTimestamp ? (
                    format(
                      new Date(responseTimestamp),
                      'hh:mm aa',
                      getDateFnsLocale(locale),
                    )
                  ) : null}
                </p>
              )}
              {author === ChatMessageAuthor.Server && (
                <Button
                  size="mini"
                  variant={isLoadingStepsShown ? 'tertiary-active' : 'tertiary'}
                  onlyIcon
                  title={t(
                    `${isLoadingStepsShown ? 'Hide' : 'Show'} search steps`,
                  )}
                  onClick={toggleStepsShown}
                >
                  <CheckListIcon
                    className="text-green"
                    sizeClassName="w-3.5 h-3.5"
                  />
                </Button>
              )}
            </div>
            {!!loadingSteps?.length && (
              <div
                className={`${
                  isLoadingStepsShown ? 'my-2' : ''
                } flex flex-col gap-3 overflow-hidden transition-all duration-200 ease-linear`}
                style={{
                  maxHeight: isLoadingStepsShown ? loadingSteps.length * 36 : 0,
                }}
              >
                {loadingSteps.map((s, i) => (
                  <LoadingStep {...s} key={i} side={side} />
                ))}
              </div>
            )}
            <div className="text-label-title body-base code-studio-md break-word overflow-auto">
              {author === ChatMessageAuthor.Server ? (
                <MarkdownWithCode
                  markdown={text!}
                  side={side}
                  singleFileExplanation={singleFileExplanation}
                />
              ) : (
                <UserParsedQuery textQuery={text!} parsedQuery={parsedQuery} />
              )}
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 p-1 absolute -top-4 right-4 rounded-6 border border-bg-border bg-bg-base shadow-medium">
            {author === ChatMessageAuthor.User ? (
              <Button
                variant="tertiary"
                size="mini"
                onlyIcon
                title={t('Edit')}
                onClick={handleEdit}
              >
                <PencilIcon sizeClassName="w-3.5 h-3.5" />
              </Button>
            ) : (
              !isLoading && (
                <>
                  <Button
                    variant={isUpvote ? 'tertiary-active' : 'tertiary'}
                    size="mini"
                    onlyIcon
                    title={t('Upvote')}
                    onClick={handleUpvote}
                  >
                    <LikeIcon sizeClassName="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={isDownvote ? 'tertiary-active' : 'tertiary'}
                    size="mini"
                    onlyIcon
                    title={t('Downvote')}
                    onClick={handleDownvote}
                  >
                    <UnlikeIcon sizeClassName="w-3.5 h-3.5" />
                  </Button>
                </>
              )
            )}
            <CopyButton code={text} isInHeader btnVariant="tertiary" />
          </div>
        </>
      )}
    </div>
  );
};

export default memo(ConversationMessage);
