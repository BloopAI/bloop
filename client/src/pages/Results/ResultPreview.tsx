import { useContext } from 'react';
import CodeBlockSearch from '../../components/CodeBlock/Search';
import SearchRepo from '../../components/CodeBlock/SearchRepo';
import { ResultClick, ResultItemType, ResultType } from '../../types/results';
import SearchFile from '../../components/CodeBlock/SearchFile';
import { UIContext } from '../../context/uiContext';

type Props = {
  result: ResultType;
  onClick: ResultClick;
};

const ResultPreview = ({ result, onClick }: Props) => {
  const { symbolsCollapsed } = useContext(UIContext);
  const getItem = (result: ResultType) => {
    switch (result.type) {
      case ResultItemType.CODE:
        return (
          <CodeBlockSearch
            snippets={result.snippets}
            language={result.language}
            filePath={result.relativePath}
            branch={result.branch}
            collapsed={symbolsCollapsed}
            onClick={onClick}
            repoName={result.repoName}
            repoPath={result.repoPath}
          />
        );
      case ResultItemType.FILE:
        return (
          <SearchFile
            filePath={result.relativePath}
            lines={result.lines}
            highlights={result.highlights}
            onFileClick={onClick}
            repoName={result.repoName}
          />
        );
      case ResultItemType.REPO:
        return (
          <SearchRepo
            repository={result.repository}
            highlights={result.highlights}
            // branches={result.branches}
            // files={result.files}
            onClick={onClick}
          />
        );
    }
  };

  return <li>{getItem(result)}</li>;
};

export default ResultPreview;
