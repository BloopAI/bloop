import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';
import { QuillIcon } from '../../icons';
import useAnalytics from '../../hooks/useAnalytics';
import { saveUpvote } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { ChatMessageAuthor } from '../../types/general';
import { ChatContext } from '../../context/chatContext';

type Props = {
  author: ChatMessageAuthor;
  message?: string;
  error?: string;
  query: string;
  searchId: string;
  isHistory?: boolean;
  showInlineFeedback: boolean;
};

const ConversationMessage = ({
  author,
  message,
  error,
  isHistory,
  showInlineFeedback,
  query,
  searchId,
}: Props) => {
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const { trackUpvote } = useAnalytics();
  const { envConfig } = useContext(DeviceContext);
  const { setChatOpen } = useContext(ChatContext);
  const RiveUpvoteInline = useRive({
    src: '/like-blue.riv',
    autoplay: false,
  });
  const RiveDownvoteInline = useRive({
    src: '/like-red.riv',
    autoplay: false,
  });

  useEffect(() => {
    setChatOpen(true);
  }, []);

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
        className={`relative group-custom bg-chat-bg-shade flex items-center p-4 gap-3 border border-chat-bg-divider rounded-lg`}
      >
        {author === ChatMessageAuthor.User && (
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-chat-bg-sub overflow-hidden">
              <img src={envConfig.github_user?.avatar_url} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-3 bg-chat-bg-border box-content border-2 border-chat-bg-shade text-label-title rounded-full flex items-center justify-center">
              <div className="w-1.5 h-2">
                <QuillIcon raw />
              </div>
            </div>
          </div>
        )}
        <pre className="body-s text-label-title whitespace-pre-wrap">
          {message || error}
        </pre>
      </div>
      {showInlineFeedback && !isHistory && !error && (
        <div className="flex flex-col items-center gap-3">
          <p className="body-s text-label-title">
            How would you rate this response?
          </p>
          <div className="flex gap-1 items-center">
            <button
              onClick={() => handleUpvote(true)}
              className={`flex gap-1 items-center justify-center pl-3 pr-4 py-1 rounded-full text-bg-main body-s ${
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
              className={`flex gap-1 items-center justify-center pl-3 pr-4 py-1 rounded-full text-bg-danger-hover body-s ${
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
