import { useCallback, useContext, useMemo, useState } from 'react';
import hljs from 'highlight.js';
import { Remarkable } from 'remarkable';
import { useRive } from '@rive-app/react-canvas';
import CodeBlockSearch from '../Search';
import Button from '../../Button';
import { ArrowRotate } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { saveUpvote } from '../../../services/api';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ResultClick } from '../../../types/results';
import 'highlight.js/styles/vs2015.css';
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
  const RiveUpvote = useRive({
    src: '/like_button.riv',
    autoplay: false,
  });
  const RiveDownvote = useRive({
    src: '/like_button.riv',
    autoplay: false,
  });

  const highlightedAnswer = useMemo(() => md.render(answer), [answer]);

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
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
      trackUpvote(isUpvote, query, answer, searchId);
      return saveUpvote({
        unique_id: deviceId,
        is_upvote: isUpvote,
        query: query,
        snippet_id: searchId,
        text: answer,
      });
    },
    [deviceId, query, answer, RiveUpvote, RiveDownvote],
  );

  return (
    <div className="flex flex-col">
      <div className="bg-gray-800 p-3 flex flex-row rounded-t relative">
        <div
          className="body-s w-full semantic-answer overflow-auto"
          dangerouslySetInnerHTML={{ __html: highlightedAnswer }}
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
            <RiveUpvote.RiveComponent className="w-4/5 h-4/5" />
          </Button>
          <Button
            onlyIcon
            title="Downvote"
            variant={isDownvote ? 'secondary' : 'tertiary'}
            size="small"
            onClick={() => handleUpvote(false)}
          >
            <RiveDownvote.RiveComponent className="w-4/5 h-4/5 transform rotate-180" />
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
