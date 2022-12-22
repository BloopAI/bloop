import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js';
import CodeBlockSearch from '../Search';
import Button from '../../Button';
import { ThumbsDown, ThumbsUp } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { getUpvote, saveUpvote } from '../../../services/api';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ResultClick } from '../../../types/results';
import 'highlight.js/styles/vs2015.css';
import { hashCode } from '../../../utils';
import useAnalytics from '../../../hooks/useAnalytics';

type Props = {
  answer: string;
  snippets: { code: string; path: string; repoName: string }[];
  onClick: ResultClick;
};
const SemanticSearch = ({ answer, snippets, onClick }: Props) => {
  const { deviceId } = useContext(DeviceContext);
  const { query } = useAppNavigation();
  const [isUpvoteLoading, setUpvoteLoading] = useState(true);
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const snippetId = useMemo(() => hashCode(answer).toString(), [answer]);
  const { trackUpvote } = useAnalytics();

  const highlightedAnswer = useMemo(() => {
    const code = answer.replace(/`(.*?)`/gs, (match) => {
      console.log(match.replace(/`/g, ''));
      const hl = hljs.highlightAuto(match.replace(/`/g, ''), [
        'javascript',
        'rust',
      ]).value;
      return `<code class="italic">\`${hl}\`</code>`;
    });

    return `<pre class="whitespace-pre-wrap break-words">${code}</pre>`;
  }, [answer]);

  useEffect(() => {
    setUpvoteLoading(true);
    setIsUpvote(false);
    setIsDownvote(false);
    getUpvote({
      unique_id: deviceId,
      snippet_id: snippetId,
      query: query,
    }).then((resp) => {
      setUpvoteLoading(false);
      if (resp) {
        setIsUpvote(resp.is_upvote === true);
        setIsDownvote(resp.is_upvote === false);
      }
    });
  }, [deviceId, query]);

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      trackUpvote(isUpvote, query, answer);
      return saveUpvote({
        unique_id: deviceId,
        is_upvote: isUpvote,
        query: query,
        snippet_id: snippetId,
        text: answer,
      });
    },
    [deviceId, query, answer],
  );
  return (
    <div className="flex flex-col">
      <div className="bg-gray-800 p-3 flex flex-row rounded-t relative">
        <span
          className="body-s pr-16"
          dangerouslySetInnerHTML={{ __html: highlightedAnswer }}
        ></span>
        {!isUpvoteLoading && (
          <div className="flex flex-row absolute top-2 right-3">
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
        )}
      </div>
      {snippets.map((item, index) => (
        <span key={index} className={`${index ? 'mt-5' : ''}`}>
          <CodeBlockSearch
            snippets={[{ code: item.code, highlights: [] }]}
            language={'JavaScript'}
            filePath={item.path}
            branch={''}
            repoName={item.repoName}
            repoPath={''}
            hideMatchCounter
            hideDropdown
            onClick={onClick}
          />
        </span>
      ))}
    </div>
  );
};
export default SemanticSearch;
