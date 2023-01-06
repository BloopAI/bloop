import { useCallback, useContext, useMemo, useState } from 'react';
import hljs from 'highlight.js';
import CodeBlockSearch from '../Search';
import Button from '../../Button';
import { ArrowRotate, ThumbsDown, ThumbsUp } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { saveUpvote } from '../../../services/api';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ResultClick } from '../../../types/results';
import 'highlight.js/styles/vs2015.css';
import { hashCode } from '../../../utils';
import useAnalytics from '../../../hooks/useAnalytics';

type Props = {
  answer: string;
  snippets: {
    code: string;
    path: string;
    repoName: string;
    lang: string;
    line: number;
  }[];
  onClick: ResultClick;
  handleRetry: () => void;
  searchId: string;
};
const SemanticSearch = ({
  answer,
  snippets,
  onClick,
  handleRetry,
  searchId,
}: Props) => {
  const { deviceId } = useContext(DeviceContext);
  const { query } = useAppNavigation();
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);
  const { trackUpvote } = useAnalytics();

  const highlightedAnswer = useMemo(() => {
    const lang = /```(.*?)\n/.exec(answer)?.[1];

    const langSubset = lang ? [lang.trim()] : undefined;
    let code = answer.replace(/```(.*?)```/gs, (match) => {
      const escapedString = match.replace(/```/g, '');
      if (!escapedString.length) {
        return '';
      }
      const hl = hljs.highlightAuto(escapedString, langSubset).value;
      return `<pre class="whitespace-pre-wrap break-words bg-gray-700 rounded my-1 text-xs p-1"><code>${hl}</code></pre>`;
    });

    code = code.replace(/`(.*?)`/gs, (match) => {
      const escapedString = match.replace(/`/g, '');
      if (!escapedString.length) {
        return '';
      }
      const hl = hljs.highlightAuto(
        escapedString,
        langSubset || ['markdown'],
      ).value;
      return `<code class="bg-gray-700 p-[2px] rounded">${hl}</code>`;
    });

    return `${code}`;
  }, [answer]);

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
    <div className="flex flex-col">
      <div className="bg-gray-800 p-3 flex flex-row rounded-t relative">
        <span
          className="body-s pr-24"
          dangerouslySetInnerHTML={{ __html: highlightedAnswer }}
        ></span>
        <div className="flex flex-row absolute top-2 right-3">
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
      {snippets.map((item, index) => (
        <span key={index} className={`${index ? 'mt-5' : ''}`}>
          <CodeBlockSearch
            snippets={[
              { code: item.code, highlights: [], lineStart: item.line },
            ]}
            language={item.lang}
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
