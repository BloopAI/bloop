import React, { useCallback, useContext, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';
import { QuillIcon } from '../../icons';
import Button from '../Button';
import useAnalytics from '../../hooks/useAnalytics';
import { saveUpvote } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { ChatMessageAuthor } from '../../types/general';

type Props = {
  author: ChatMessageAuthor;
  message: string;
  query: string;
  searchId: string;
  isHistory: boolean;
  showInlineFeedback: boolean;
};

const ConversationMessage = ({
  author,
  message,
  isHistory,
  showInlineFeedback,
  query,
  searchId,
}: Props) => {
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const { trackUpvote } = useAnalytics();
  const { envConfig } = useContext(DeviceContext);
  const RiveUpvote = useRive({
    src: '/gray-to-blue.riv',
    autoplay: false,
  });
  const RiveDownvote = useRive({
    src: '/gray-to-red.riv',
    autoplay: false,
  });
  const RiveUpvoteInline = useRive({
    src: '/like-blue.riv',
    autoplay: false,
  });
  const RiveDownvoteInline = useRive({
    src: '/like-red.riv',
    autoplay: false,
  });

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
      const upvoteComponent = showInlineFeedback
        ? RiveUpvoteInline.rive
        : RiveUpvote.rive;
      const downvoteComponent = showInlineFeedback
        ? RiveDownvoteInline.rive
        : RiveDownvote.rive;
      if (upvoteComponent && downvoteComponent) {
        if (isUpvote) {
          upvoteComponent.play();
          downvoteComponent.reset();
          downvoteComponent.drawFrame();
        } else {
          downvoteComponent.play();
          upvoteComponent.reset();
          upvoteComponent.drawFrame();
        }
      }
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      trackUpvote(isUpvote, query, message || '', searchId);
      return saveUpvote({
        unique_id: envConfig.tracking_id || '',
        is_upvote: isUpvote,
        query: query,
        snippet_id: searchId,
        text: message || '',
      });
    },
    [
      RiveUpvote,
      RiveDownvote,
      RiveUpvoteInline,
      RiveDownvoteInline,
      showInlineFeedback,
      envConfig.tracking_id,
    ],
  );

  return (
    <>
      <div
        className={`relative group-custom ${
          author === ChatMessageAuthor.User || !isHistory
            ? 'bg-gray-800'
            : 'bg-gray-700'
        } flex items-center p-4 gap-3 border border-gray-700 rounded-lg`}
      >
        {author === ChatMessageAuthor.User && (
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-gray-500" />
            <div className="absolute -bottom-1 -right-1 w-4 h-3 bg-gray-600 box-content border-2 border-gray-800 text-white rounded-full flex items-center justify-center">
              <div className="w-1.5 h-2">
                <QuillIcon raw />
              </div>
            </div>
          </div>
        )}
        <pre className="body-s text-gray-200 whitespace-pre-wrap">
          {message}
        </pre>
        {author === ChatMessageAuthor.Server &&
          !!message &&
          !showInlineFeedback && (
            <div
              className={`absolute top-2 right-2 flex items-center gap-1 p-1 bg-gray-900/75 backdrop-blur-4 rounded-md opacity-0 group-custom-hover:opacity-100 transition-opacity`}
            >
              <Button
                variant={'tertiary'}
                onlyIcon
                size="small"
                title="Upvote"
                onClick={() => handleUpvote(true)}
              >
                <RiveUpvote.RiveComponent className="w-4/5 h-4/5 transform scale-1" />
              </Button>
              <Button
                variant={'tertiary'}
                onlyIcon
                size="small"
                title="Downvote"
                onClick={() => handleUpvote(false)}
              >
                <RiveDownvote.RiveComponent className="w-4/5 h-4/5 transform scale-1" />
              </Button>
            </div>
          )}
      </div>
      {showInlineFeedback && (
        <div className="flex flex-col items-center gap-3">
          <p className="body-s text-gray-200">
            How would you rate this response?
          </p>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => handleUpvote(true)}
              className={`flex gap-1 items-center justify-center pl-3 pr-4 py-1 rounded-full text-primary-300 body-s ${
                isUpvote
                  ? 'bg-[linear-gradient(88.29deg,rgba(48,79,255,0.16)_0%,rgba(48,79,255,0.16)_100%)]'
                  : 'bg-[linear-gradient(88.29deg,rgba(48,79,255,0.16)_1.45%,rgba(191,191,191,0.08)_98.55%)]'
              } hover:bg-[linear-gradient(88.29deg,rgba(48,79,255,0.16)_0%,rgba(48,79,255,0.16)_100%)] 
              transition-all duration-75 ease-in-out`}
            >
              <RiveUpvoteInline.RiveComponent className="w-4.5 h-4.5 transform scale-1 flex-shrink-0" />
              Good
            </button>
            <button
              onClick={() => handleUpvote(false)}
              className={`flex gap-1 items-center justify-center pl-3 pr-4 py-1 rounded-full text-danger-300 body-s ${
                isDownvote
                  ? 'bg-[linear-gradient(88.29deg,rgba(251,113,133,0.16)_0%,rgba(251,113,133,0.16)_100%)]'
                  : 'bg-[linear-gradient(88.29deg,rgba(251,113,133,0.16)_1.45%,rgba(191,191,191,0.08)_98.55%)]'
              } hover:bg-[linear-gradient(88.29deg,rgba(251,113,133,0.16)_0%,rgba(251,113,133,0.16)_100%)] 
              transition-all duration-75 ease-in-out`}
            >
              <RiveDownvoteInline.RiveComponent className="w-4.5 h-4.5 transform scale-1 flex-shrink-0" />
              Bad
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ConversationMessage;
