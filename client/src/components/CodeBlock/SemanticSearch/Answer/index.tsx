import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Remarkable } from 'remarkable';
import hljs from 'highlight.js';
import 'highlight.js/styles/vs2015.css';
import Button from '../../../Button';
import { ArrowRotate, ThumbsDown, ThumbsUp } from '../../../../icons';
import { DeviceContext } from '../../../../context/deviceContext';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import useAnalytics from '../../../../hooks/useAnalytics';
import { saveUpvote } from '../../../../services/api';

const md = new Remarkable({
  html: true,
  highlight(str: string, lang: string): string {
    try {
      const langSubset = lang ? [lang] : undefined;
      return hljs.highlightAuto(str, langSubset).value;
    } catch (e) {
      return str;
    }
  },
  linkTarget: '__blank',
});

type Props = {
  handleRetry: () => void;
  searchId: string;
  nlQuery?: string;
};

const Answer = ({ handleRetry, nlQuery, searchId }: Props) => {
  const { deviceId, apiUrl } = useContext(DeviceContext);
  const { query } = useAppNavigation();
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const { trackUpvote } = useAnalytics();

  const highlightedAnswer = useMemo(() => md.render(answer), [answer]);

  useEffect(() => {
    let eventSource: EventSource;
    if (nlQuery) {
      eventSource = new EventSource(
        `${apiUrl.replace(
          'https:',
          '',
        )}/answer?q=${nlQuery}&user_id=${deviceId}`,
      );
      let i = 0;
      eventSource.onmessage = (ev) => {
        const newData = JSON.parse(ev.data);
        if (newData.Err) {
          setError(newData.Err);
        } else if (i !== 0) {
          setAnswer((prev) => prev + newData.Ok);
        }
        i++;
      };
      eventSource.onerror = (err) => {
        console.log('Event source error:', err);
        eventSource.close();
      };
    }
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [nlQuery, deviceId]);

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      trackUpvote(isUpvote, query, answer, searchId);
      return saveUpvote({
        unique_id: deviceId,
        is_upvote: isUpvote,
        query: query,
        snippet_id: searchId,
        text: answer,
      });
    },
    [deviceId, query, answer],
  );

  return (
    <div className="bg-gray-800 p-3 flex flex-row rounded-t relative">
      <div
        className="body-s w-full semantic-answer overflow-auto"
        dangerouslySetInnerHTML={{
          __html:
            highlightedAnswer +
            (error ? (
              <p className="text-danger-500">An error occurred: {error}</p>
            ) : (
              ''
            )),
        }}
      ></div>
      <div className="flex flex-row">
        <Button
          onlyIcon
          title="Retry"
          variant="tertiary"
          size="small"
          onClick={handleRetry}
        >
          <ArrowRotate />
        </Button>
        <Button
          onlyIcon
          title="Upvote"
          variant={isUpvote ? 'secondary' : 'tertiary'}
          size="small"
          onClick={() => handleUpvote(true)}
        >
          <ThumbsUp />
        </Button>
        <Button
          onlyIcon
          title="Downvote"
          variant={isDownvote ? 'secondary' : 'tertiary'}
          size="small"
          onClick={() => handleUpvote(false)}
        >
          <ThumbsDown />
        </Button>
      </div>
    </div>
  );
};

export default Answer;
