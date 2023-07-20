import { useEffect, useState } from 'react';
import Code from '../../../CodeBlock/Code';
import { buildRepoQuery, splitPath } from '../../../../utils';
import { File } from '../../../../types/api';
import { search } from '../../../../services/api';
import FileIcon from '../../../FileIcon';

type Props = {
  path: string;
  repoName: string;
  isMain: boolean;
  startLine: number;
};

const CodeSummary = ({ path, isMain, repoName, startLine }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => {
    if (repoName && path && isMain) {
      search(buildRepoQuery(repoName, path)).then((resp) => {
        setFile(resp.data[0].data as File);
      });
    }
  }, [path, repoName]);

  return (
    <div>
      <div className="flex gap-2 items-center w-full text-label-title caption p-2">
        <FileIcon filename={path} noMargin />
        {splitPath(path).pop()}
      </div>
      <div className="bg-chat-bg-sub code-s">
        {file?.contents ? (
          <Code
            code={file.contents
              .split('\n')
              .slice(startLine, startLine + 7)
              .join('\n')}
            language={file.lang}
            showLines={false}
          />
        ) : null}
      </div>
    </div>
  );
};

export default CodeSummary;
