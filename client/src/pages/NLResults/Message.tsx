import React, { useCallback, useContext, useState } from 'react';
import Button from '../../components/Button';
import { ThumbsDown, ThumbsUp } from '../../icons';
import CircleProgressLoader from '../../components/Loaders/CircleProgressLoader';
import { saveUpvote } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import useAppNavigation from '../../hooks/useAppNavigation';
import useAnalytics from '../../hooks/useAnalytics';
import { ConversationMessage } from '../../types/general';

type Props = {
  message: ConversationMessage;
  searchId: string;
  i: number;
  currentlyViewedSnippets: number;
  onViewSnippetsClick: (i: number) => void;
};

const Message = ({
  message,
  searchId,
  i,
  currentlyViewedSnippets,
  onViewSnippetsClick,
}: Props) => {
  const { deviceId } = useContext(DeviceContext);
  const { query } = useAppNavigation();
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const { trackUpvote } = useAnalytics();

  const handleUpvote = useCallback(
    (isUpvote: boolean, answer?: string) => {
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      trackUpvote(isUpvote, query, answer || '', searchId);
      return saveUpvote({
        unique_id: deviceId,
        is_upvote: isUpvote,
        query: query,
        snippet_id: searchId,
        text: answer || '',
      });
    },
    [deviceId, query],
  );
  return (
    <div
      className={`max-w-[80%] w-fit relative group ${
        message.author === 'user' ? 'self-end' : 'self-start'
      }`}
    >
      {message.author === 'server' && !!message.text && (
        <div
          className={`absolute top-1/2 -right-11 ml-2 transform -translate-y-1/2 
              opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          <Button
            variant={isUpvote ? 'secondary' : 'tertiary'}
            onlyIcon
            size="small"
            title="Upvote"
            onClick={() => handleUpvote(true, message.text)}
          >
            <ThumbsUp />
          </Button>
          <Button
            variant={isDownvote ? 'secondary' : 'tertiary'}
            onlyIcon
            size="small"
            title="Downvote"
            onClick={() => handleUpvote(false, message.text)}
          >
            <ThumbsDown />
          </Button>
        </div>
      )}

      {message.isLoading ? (
        <span className="flex gap-2 items-center">
          <span className="transform scale-90">
            <CircleProgressLoader percent={50} />
          </span>
          <p>Searching...</p>
        </span>
      ) : null}

      {message.text || message.error ? (
        <div
          className={`rounded-lg p-3 ${
            message.author === 'user' ? 'bg-gray-700' : 'bg-primary-400'
          }`}
        >
          {message.text || message.error}
        </div>
      ) : null}
      {message.isLoading ? null : message.author === 'server' &&
        i !== currentlyViewedSnippets &&
        !!message.snippets?.length ? (
        <div className="flex items-center justify-between mt-2">
          <button
            className="text-primary-300 body-s mr-2"
            onClick={() => onViewSnippetsClick(i)}
          >
            View
          </button>
        </div>
      ) : (
        ''
      )}
    </div>
  );
};

export default Message;
