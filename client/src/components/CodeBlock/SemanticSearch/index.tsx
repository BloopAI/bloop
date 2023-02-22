import { useMemo } from 'react';
import CodeBlockSearch from '../Search';
import { ResultClick } from '../../../types/results';
import Answer from './Answer';

type Props = {
  snippets: {
    code: string;
    path: string;
    repoName: string;
    lang: string;
    line: number;
    subSnippets: { text: string; range: { start: number; end: number } }[];
  }[];
  onClick: ResultClick;
  handleRetry: () => void;
  searchId: string;
  answer?: string;
  error?: string;
};

const SemanticSearch = ({
  snippets,
  onClick,
  handleRetry,
  searchId,
  answer,
  error,
}: Props) => {
  const renderedSnippets = useMemo(() => {
    return snippets.map((item, index) => (
      <span key={index} className={`${index ? 'mt-5' : ''}`}>
        <CodeBlockSearch
          snippets={item.subSnippets.map((ss) => ({
            code: ss.text,
            highlights: [],
            lineStart: ss.range.start,
          }))}
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
    ));
  }, [snippets, onClick]);
  return (
    <div className="flex flex-col">
      <Answer
        searchId={searchId}
        handleRetry={handleRetry}
        answer={answer}
        error={error}
      />
      {renderedSnippets}
    </div>
  );
};
export default SemanticSearch;
