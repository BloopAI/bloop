import { useContext, useRef } from 'react';
import CodeBlockSearch from '../../components/CodeBlock/Search';
import SearchRepo from '../../components/CodeBlock/SearchRepo';
import { ResultClick, ResultItemType, ResultType } from '../../types/results';
import SearchFile from '../../components/CodeBlock/SearchFile';
import { UIContext } from '../../context/uiContext';
import useIsOnScreen from '../../hooks/useIsOnScreen';

type Props = {
  result: ResultType;
  onClick: ResultClick;
};

let wasRendered = false;

const ResultPreview = ({ result, onClick }: Props) => {
  const { symbolsCollapsed } = useContext(UIContext);
  const ref = useRef(null);
  const isOnScreen = useIsOnScreen(ref);

  const getItem = (result: ResultType) => {
    wasRendered = true;
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

  return (
    <li ref={ref}>{isOnScreen || wasRendered ? getItem(result) : null}</li>
  );
};

export default ResultPreview;
