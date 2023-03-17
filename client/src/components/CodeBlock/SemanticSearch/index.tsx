import { useMemo } from 'react';
import CodeBlockSearch from '../Search';
import { ResultClick } from '../../../types/results';

type Props = {
  snippets: {
    code: string;
    path: string;
    repoName: string;
    lang: string;
    line: number;
  }[];
  onClick: ResultClick;
};

const SemanticSearch = ({ snippets, onClick }: Props) => {
  const renderedSnippets = useMemo(() => {
    return snippets.map((item, index) => (
      <li key={index} className={`${index ? 'mt-5' : ''}`}>
        <CodeBlockSearch
          snippets={[{ code: item.code, highlights: [], lineStart: item.line }]}
          language={item.lang}
          filePath={item.path}
          branch={''}
          repoName={item.repoName}
          repoPath={''}
          hideMatchCounter
          hideDropdown
          onClick={onClick}
        />
      </li>
    ));
  }, [snippets, onClick]);
  return <ul className="flex flex-col">{renderedSnippets}</ul>;
};
export default SemanticSearch;
