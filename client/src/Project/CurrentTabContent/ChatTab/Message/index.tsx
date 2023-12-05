import { memo, useContext } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ChatLoadingStep,
  ChatMessageAuthor,
  ParsedQueryType,
} from '../../../../types/general';
import { EnvContext } from '../../../../context/envContext';
import MarkdownWithCode from '../../../../components/MarkdownWithCode';
import UserParsedQuery from './UserParsedQuery';

type Props = {
  author: ChatMessageAuthor;
  text?: string;
  parsedQuery?: ParsedQueryType[];
  error?: string;
  threadId: string;
  queryId: string;
  responseTimestamp: string | null;
  isHistory?: boolean;
  showInlineFeedback: boolean;
  isLoading?: boolean;
  loadingSteps?: ChatLoadingStep[];
  i: number;
  onMessageEdit: (queryId: string, i: number) => void;
  singleFileExplanation?: boolean;
};

const ConversationMessage = ({
  author,
  text,
  parsedQuery,
  i,
  queryId,
  onMessageEdit,
  singleFileExplanation,
  isHistory,
  threadId,
  isLoading,
  loadingSteps,
  showInlineFeedback,
  responseTimestamp,
  error,
}: Props) => {
  const { t } = useTranslation();
  const { envConfig } = useContext(EnvContext);
  return (
    <div className="flex items-start overflow-hidden gap-5 rounded-md py-4">
      <div className="flex w-7 h-7 items-center justify-center rounded-full flex-shrink-0 bg-brand-default-subtitle overflow-hidden">
        {author === ChatMessageAuthor.User ? (
          <img src={envConfig.github_user?.avatar_url} alt={t('avatar')} />
        ) : (
          <img className="bloop-head-img w-7 h-7" alt="bloop" />
        )}
      </div>
      <div className="flex flex-col gap-1 flex-1 overflow-auto">
        <p className="body-base-b text-label-title select-none">
          {author === ChatMessageAuthor.User ? <Trans>You</Trans> : 'bloop'}
        </p>
        <div className="text-label-title body-base code-studio-md break-word overflow-auto">
          {author === ChatMessageAuthor.Server ? (
            <MarkdownWithCode
              markdown={text!}
              threadId={threadId}
              recordId={i}
            />
          ) : (
            <UserParsedQuery textQuery={text!} parsedQuery={parsedQuery} />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ConversationMessage);
