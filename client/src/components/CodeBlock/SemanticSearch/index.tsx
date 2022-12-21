import { useCallback, useContext, useEffect, useState } from 'react';
import CodeBlockSearch from '../Search';
import Button from '../../Button';
import { ThumbsDown, ThumbsUp } from '../../../icons';
import { DeviceContext } from '../../../context/deviceContext';
import { getUpvote, saveUpvote } from '../../../services/api';
import useAppNavigation from '../../../hooks/useAppNavigation';

const SemanticSearch = () => {
  const { deviceId } = useContext(DeviceContext);
  const { query } = useAppNavigation();
  const [isUpvoteLoading, setUpvoteLoading] = useState(true);
  const [isUpvote, setIsUpvote] = useState(false);
  const [isDownvote, setIsDownvote] = useState(false);

  const results = [
    "listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}",
    "listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}",
    "listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}",
  ];

  useEffect(() => {
    setUpvoteLoading(true);
    setIsUpvote(false);
    setIsDownvote(false);
    getUpvote({ unique_id: deviceId, snippet_id: '1', query: query }).then(
      (resp) => {
        setUpvoteLoading(false);
        if (resp) {
          setIsUpvote(resp.is_upvote === true);
          setIsDownvote(resp.is_upvote === false);
        }
      },
    );
  }, [deviceId, query]);

  const handleUpvote = useCallback(
    (isUpvote: boolean) => {
      setIsUpvote(isUpvote);
      setIsDownvote(!isUpvote);
      return saveUpvote({
        unique_id: deviceId,
        is_upvote: isUpvote,
        query: query,
        snippet_id: '1',
        text: 'lorem ipsum',
      });
    },
    [deviceId, query],
  );
  return (
    <div className="flex flex-col">
      <div className="bg-gray-800 p-3 flex flex-row rounded-t relative">
        <span className="body-s pr-16">
          We calculate the speed of the last query by tracking the start time of
          the query and comparing it to the current time. This can be done by
          using the Date.now) function to get the current time and comparing it
          to the start time stored in a variable. We can track the speed of the
          query by subtracting the start time from the current time and storing
          this as the last query time and setting it as the value for the
          lastQueryTime variable. This can be seen in the useSearch hook in the
          bloop / client / src / hooks / useSearch.tsx file with the following
          code:
        </span>
        {!isUpvoteLoading && (
          <div className="flex flex-row absolute top-3 right-3">
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
      {results.map((item, index) => (
        <span key={index} className={`${index ? 'mt-5' : ''}`}>
          <CodeBlockSearch
            snippets={[{ code: item, highlights: [] }]}
            language={'JavaScript'}
            filePath={'test/main/src.js'}
            branch={''}
            repoName={''}
            repoPath={''}
            hideMatchCounter
            hideDropdown
          />
        </span>
      ))}
    </div>
  );
};
export default SemanticSearch;
