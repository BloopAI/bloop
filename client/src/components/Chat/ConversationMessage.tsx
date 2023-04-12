import React, { useCallback, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';
import { QuillIcon } from '../../icons';
import Button from '../Button';
import useAnalytics from '../../hooks/useAnalytics';
import { saveUpvote } from '../../services/api';

type Props = {
  author: 'user' | 'server';
  message: string;
};

const ConversationMessage = ({ author, message }: Props) => {
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const RiveUpvote = useRive({
    src: '/like_button.riv',
    autoplay: false,
  });
  const RiveDownvote = useRive({
    src: '/like_button.riv',
    autoplay: false,
  });

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
      // trackUpvote(isUpvote, query, answer || '', searchId);
      // return saveUpvote({
      //   unique_id: deviceId,
      //   is_upvote: isUpvote,
      //   query: query,
      //   snippet_id: searchId,
      //   text: answer || '',
      // });
    },
    [RiveUpvote, RiveDownvote],
  );

  return (
    <div
      className={`relative group ${
        author === 'user' ? 'bg-gray-800' : 'bg-gray-700'
      } flex items-center p-4 gap-3 border border-gray-700 rounded-lg`}
    >
      {author === 'user' && (
        <div className="relative">
          <div className="w-6 h-6 rounded-full bg-gray-500" />
          <div className="absolute -bottom-1 -right-1 w-4 h-3 bg-gray-600 box-content border-2 border-gray-800 text-white rounded-full flex items-center justify-center">
            <div className="w-1.5 h-2">
              <QuillIcon raw />
            </div>
          </div>
        </div>
      )}
      <pre className="body-s text-gray-200 whitespace-pre-wrap">{message}</pre>
      {author === 'server' && !!message && (
        <div
          className={`absolute top-2 right-2 flex items-center gap-1 p-1 bg-gray-900/75 backdrop-blur-4 rounded-md opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          <Button
            variant={'tertiary'}
            onlyIcon
            size="small"
            title="Upvote"
            onClick={() => handleUpvote(true, message)}
          >
            <RiveUpvote.RiveComponent className="w-4/5 h-4/5 transform scale-1" />
          </Button>
          <Button
            variant={'tertiary'}
            onlyIcon
            size="small"
            title="Downvote"
            onClick={() => handleUpvote(false, message)}
          >
            <RiveDownvote.RiveComponent className="w-4/5 h-4/5 transform rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConversationMessage;
