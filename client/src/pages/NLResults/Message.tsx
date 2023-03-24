import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';
import { Remarkable } from 'remarkable';
import hljs from 'highlight.js';
import Button from '../../components/Button';
import { Checkmark } from '../../icons';
import ThreeDotsLoader from '../../components/Loaders/ThreeDotsLoader';
import { saveUpvote } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import useAppNavigation from '../../hooks/useAppNavigation';
import useAnalytics from '../../hooks/useAnalytics';
import { ConversationMessage } from '../../types/general';

const md = new Remarkable({
  html: false,
  linkTarget: '__blank',
  highlight(str: string, lang: string): string {
    try {
      const langSubset = lang ? [lang] : undefined;
      return hljs.highlightAuto(str, langSubset).value;
    } catch (e) {
      return str;
    }
  },
});

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
  const RiveUpvote = useRive({
    src: '/like_button.riv',
    autoplay: false,
  });
  const RiveDownvote = useRive({
    src: '/like_button.riv',
    autoplay: false,
  });

  const highlightedAnswer = useMemo(
    () =>
      message.author === 'server' && message.text
        ? md.render(message.text)
        : message.text,
    [message],
  );

  const handleUpvote = useCallback(
    (isUpvote: boolean, answer?: string) => {
      if (RiveUpvote.rive) {
        if (isUpvote) {
          RiveUpvote.rive.play();
        } else {
          RiveUpvote.rive.reset();
          RiveUpvote.rive.drawFrame();
        }
      }
      if (RiveDownvote.rive) {
        if (!isUpvote) {
          RiveDownvote.rive.play();
        } else {
          RiveDownvote.rive.reset();
          RiveDownvote.rive.drawFrame();
        }
      }
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
    [deviceId, query, RiveUpvote, RiveDownvote],
  );
  return (
    <div
      className={`max-w-[80%] w-fit relative group ${
        message.author === 'user' ? 'self-end' : 'self-start'
      }`}
    >
      {message.author === 'server' ? (
        <div className="flex justify-between items-center mb-2">
          <span className="flex gap-2 items-center">
            {message.isLoading ? (
              <span className="text-gray-300 text-xs">
                <ThreeDotsLoader />
              </span>
            ) : (
              <span className="text-success-500 h-5">
                <Checkmark />
              </span>
            )}
            <p className="body-s">Searching</p>
          </span>
          {!message.isLoading &&
          i !== currentlyViewedSnippets &&
          !!message.snippets?.length ? (
            <div className="flex items-center justify-end">
              <button
                className="text-primary-300 body-s mr-2"
                onClick={() => onViewSnippetsClick(i)}
              >
                View
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        {message.author === 'user' ? (
          <div className="conversation-message rounded-lg p-3 bg-gray-700">
            {message.author === 'user' ? message.text : null}
          </div>
        ) : message.text || message.error ? (
          <div
            className="conversation-message rounded-lg p-3 bg-primary-400"
            dangerouslySetInnerHTML={{
              __html: highlightedAnswer || message.error || '',
            }}
          />
        ) : null}
        {message.author === 'server' && !!message.text && (
          <div
            className={`absolute top-1/2 -right-11 ml-2 transform -translate-y-1/2 w-8`}
          >
            <Button
              variant={'tertiary'}
              onlyIcon
              size="small"
              title="Upvote"
              className={
                isUpvote
                  ? ''
                  : 'opacity-0 group-hover:opacity-100 transition-opacity'
              }
              onClick={() => handleUpvote(true, message.text)}
            >
              <RiveUpvote.RiveComponent className="w-4/5 h-4/5 transform scale-1" />
            </Button>
            <Button
              variant={'tertiary'}
              onlyIcon
              size="small"
              title="Downvote"
              className={
                isDownvote
                  ? ''
                  : 'opacity-0 group-hover:opacity-100 transition-opacity'
              }
              onClick={() => handleUpvote(false, message.text)}
            >
              <RiveDownvote.RiveComponent className="w-4/5 h-4/5 transform rotate-180" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
