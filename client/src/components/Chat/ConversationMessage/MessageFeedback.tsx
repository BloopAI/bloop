import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useContext, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Unlike } from '../../../icons';
import Button from '../../Button';
import { upvoteAnswer } from '../../../services/api';
import { DeviceContext } from '../../../context/deviceContext';
import UpvoteBtn from '../FeedbackBtns/Upvote';
import DownvoteBtn from '../FeedbackBtns/Downvote';

type Props = {
  showInlineFeedback: boolean;
  isHistory?: boolean;
  scrollToBottom?: () => void;
  threadId: string;
  queryId: string;
  repoRef: string;
  error: boolean;
};

const MessageFeedback = ({
  showInlineFeedback,
  isHistory,
  scrollToBottom,
  threadId,
  queryId,
  repoRef,
  error,
}: Props) => {
  const { t } = useTranslation();
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const { envConfig } = useContext(DeviceContext);

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      if (!isUpvote) {
        setTimeout(() => {
          setShowCommentInput(true);
          setTimeout(() => scrollToBottom?.(), 10);
        }, 500); // to play animation
      }
      if (isUpvote) {
        return upvoteAnswer(threadId, queryId, repoRef, { type: 'positive' });
      }
    },
    [showInlineFeedback, envConfig.tracking_id, threadId, queryId, repoRef],
  );

  const handleSubmit = useCallback(() => {
    setIsSubmitted(true);
    setTimeout(() => scrollToBottom?.(), 150);
    return upvoteAnswer(threadId, queryId, repoRef, {
      type: 'negative',
      feedback: comment,
    });
  }, [comment, isUpvote, threadId, queryId, repoRef]);

  return (
    <>
      {showInlineFeedback &&
        !isHistory &&
        !error &&
        !isSubmitted &&
        !showCommentInput && (
          <div
            className="flex flex-col items-center gap-3 group-custom mt-3"
            key="feedback-btns"
          >
            {!isUpvote && !isDownvote && (
              <p className="body-s text-label-title">
                <Trans>How would you rate this response?</Trans>
              </p>
            )}
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
                <Trans>Good</Trans>
              </button>
              <button
                onClick={() => handleUpvote(false)}
                className={`flex gap-1 items-center justify-center pl-3 pr-4 py-1 rounded-full text-bg-danger-hover body-s ${
                  isDownvote
                    ? 'bg-[linear-gradient(88.29deg,rgba(251,113,133,0.16)_0%,rgba(251,113,133,0.16)_100%)]'
                    : 'bg-[linear-gradient(88.29deg,rgba(251,113,133,0.16)_1.45%,rgba(191,191,191,0.08)_98.55%)]'
                } ${
                  isUpvote ? 'opacity-20 group-custom-hover:opacity-100' : ''
                } hover:bg-[linear-gradient(88.29deg,rgba(251,113,133,0.16)_0%,rgba(251,113,133,0.16)_100%)] 
              transition-all duration-75 ease-in-out`}
              >
                <DownvoteBtn isDownvote={isDownvote} />
                <Trans>Bad</Trans>
              </button>
            </div>
          </div>
        )}
      <AnimatePresence>
        {showInlineFeedback && showCommentInput && !isSubmitted && (
          <motion.div
            className="w-full flex flex-col gap-4 bg-chat-bg-base border border-chat-bg-border rounded-lg mt-3"
            initial={{ height: '9.625rem' }}
            animate={{ height: '9.625rem' }}
            exit={{ height: '0rem' }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-4 overflow-hidden box-border">
              <div className="flex flex-col gap-2">
                <div className="flex gap-1.5 items-center caption text-danger-300">
                  <div className="w-3.5 h-3.5">
                    <Unlike raw />
                  </div>
                  <span>
                    <Trans>Bad response</Trans>
                  </span>
                </div>
                <textarea
                  placeholder={t(
                    'What was the issue with this response? How could it be improved?',
                  )}
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
                  <Trans>Cancel</Trans>
                </Button>
                <Button size="small" onClick={handleSubmit}>
                  <Trans>Submit</Trans>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {showInlineFeedback && isSubmitted && (
        <div className="w-full py-2 text-label-title body-s text-center">
          Thank you for your feedback!
        </div>
      )}
    </>
  );
};

export default MessageFeedback;
