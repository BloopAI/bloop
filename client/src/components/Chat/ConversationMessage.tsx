import React, { useCallback, useContext, useEffect, useState } from 'react';
import { QuillIcon, Unlike } from '../../icons';
import useAnalytics from '../../hooks/useAnalytics';
import { saveUpvote } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { ChatMessageAuthor } from '../../types/general';
import { ChatContext } from '../../context/chatContext';
import Button from '../Button';
import UpvoteBtn from './FeedbackBtns/Upvote';
import DownvoteBtn from './FeedbackBtns/Downvote';

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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const { trackUpvote } = useAnalytics();
  const { envConfig } = useContext(DeviceContext);
  const { setChatOpen } = useContext(ChatContext);

  useEffect(() => {
    setChatOpen(true);
  }, []);

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      if (!isUpvote) {
        setTimeout(() => setShowCommentInput(true), 500); // to play animation
      }
      if (isUpvote) {
        trackUpvote(isUpvote, query, message || '', searchId);
        return saveUpvote({
          unique_id: envConfig.tracking_id || '',
          is_upvote: isUpvote,
          query: query,
          snippet_id: searchId,
          text: message || '',
        });
      }
    },
    [showInlineFeedback, envConfig.tracking_id, searchId],
  );

  const handleSubmit = useCallback(() => {
    trackUpvote(isUpvote, query, message || '', searchId, comment);
    setIsSubmitted(true);
    return saveUpvote({
      unique_id: envConfig.tracking_id || '',
      is_upvote: isUpvote,
      query: query,
      snippet_id: searchId,
      text: comment,
    });
  }, [comment, isUpvote, searchId]);

  return (
    <>
      <div
        className={`relative group-custom bg-chat-bg-shade flex items-center p-4 gap-3 border border-chat-bg-divider rounded-lg`}
      >
        {author === ChatMessageAuthor.User && (
          <div className="relative">
            <div className="w-6 h-6 rounded-full bg-chat-bg-sub overflow-hidden">
              <img src={envConfig.github_user?.avatar_url} alt="avatar" />
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
      {showInlineFeedback &&
        !isHistory &&
        !error &&
        !isSubmitted &&
        !showCommentInput && (
          <div className="flex flex-col items-center gap-3" key="feedback-btns">
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
                <UpvoteBtn isUpvote={isUpvote} />
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
                <DownvoteBtn isDownvote={isDownvote} />
                Bad
              </button>
            </div>
          </div>
        )}
      {showInlineFeedback && showCommentInput && !isSubmitted && (
        <div className="w-full flex flex-col gap-4 bg-chat-bg-base border border-chat-bg-border rounded-lg p-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 items-center caption text-danger-300">
              <div className="w-3.5 h-3.5">
                <Unlike raw />
              </div>
              <span>Bad response</span>
            </div>
            <textarea
              placeholder="What was the issue with this response? How could it be improved?"
              rows={3}
              value={comment}
              autoFocus={true}
              autoComplete="off"
              onChange={(e) => setComment(e.target.value)}
              className="body-s bg-transparent resize-none outline-0 outline-none focus:outline-0 focus:outline-none focus:placeholder:text-label-base"
            />
          </div>
          <div className="flex w-full justify-end items-center gap-2">
            <Button
              variant="tertiary"
              size="small"
              onClick={() => {
                setIsDownvote(false);
                setShowCommentInput(false);
              }}
            >
              Cancel
            </Button>
            <Button size="small" onClick={handleSubmit}>
              Submit
            </Button>
          </div>
        </div>
      )}
      {showInlineFeedback && isSubmitted && (
        <div className="w-full py-2 text-label-title body-s text-center">
          Thank you for your feedback!
        </div>
      )}
    </>
  );
};

export default ConversationMessage;
