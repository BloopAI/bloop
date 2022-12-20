import CodeBlockSearch from '../Search';
import Button from '../../Button';
import { ThumbsDown, ThumbsUp } from '../../../icons';

const SemanticSearch = () => {
  const results = [
    "listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}",
    "listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}",
    "listen(_: unknown, event: string, arg?: any): Event<any> {\n switch (event) {\n  default: throw new Error('no apples');\n }\n}",
  ];
  return (
    <div className="flex flex-col">
      <div className="bg-gray-800 p-3 flex flex-row rounded-t">
        <span className="text-gray-300 text-sm">
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
        <div className="flex flex-row">
          <Button onlyIcon title="ThumbsUp" variant={'tertiary'} size="small">
            <ThumbsUp />
          </Button>
          <Button onlyIcon title="ThumbsDown" variant="tertiary" size="small">
            <ThumbsDown />
          </Button>
        </div>
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
