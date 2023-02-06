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
  }[];
  onClick: ResultClick;
  handleRetry: () => void;
  searchId: string;
  nlQuery?: string;
};

const SemanticSearch = ({
  snippets,
  onClick,
  handleRetry,
  searchId,
  nlQuery,
}: Props) => {
  return (
    <div className="flex flex-col">
      <Answer nlQuery={nlQuery} searchId={searchId} handleRetry={handleRetry} />
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
