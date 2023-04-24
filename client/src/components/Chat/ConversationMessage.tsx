import React, { useCallback, useContext, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';
import { QuillIcon } from '../../icons';
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
      if (RiveUpvoteInline.rive && RiveDownvoteInline.rive) {
        if (isUpvote) {
          RiveUpvoteInline.rive.play();
          RiveDownvoteInline.rive.reset();
          RiveDownvoteInline.rive.drawFrame();
        } else {
          RiveDownvoteInline.rive.play();
          RiveUpvoteInline.rive.reset();
          RiveUpvoteInline.rive.drawFrame();
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
