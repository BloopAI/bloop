import React, { useMemo, useState } from 'react';
import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { Clipboard } from '../../icons';
import { copyToClipboard, splitPathForBreadcrumbs } from '../../utils';
import FileIcon from '../../components/FileIcon';
import { MessageResultModify } from '../../types/general';
import Breadcrumbs from '../../components/Breadcrumbs';

type Props = {
  data: MessageResultModify['Modify'];
};

const DiffCode = ({ data }: Props) => {
  const [showRaw, setShowRaw] = useState(false);
  const rawCode = useMemo(
    () =>
      data.diff.lines
        ?.filter((l) => !l.startsWith('-'))
        .map((l) => (l.startsWith('+') ? ' ' + l.slice(1) : l))
        .join('\n'),
    [data.diff.lines],
  );

  return (
    <div className="text-sm border border-bg-border rounded-md">
      <div className="w-full bg-bg-base p-3 border-b border-bg-border select-none flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-[calc(100%-120px)] w-full">
          <FileIcon filename={data.path} />
          <div className="overflow-hidden">
            <Breadcrumbs
              pathParts={splitPathForBreadcrumbs(data.path, () => {})}
              path={data.path}
            />
          </div>
        </div>
        <div className="flex items-center justify-center p-0.5 gap-0.5 bg-bg-sub rounded-4">
          <button
            className={`px-2 h-6 rounded-4 caption flex items-center justify-center outline-none focus:outline-none focus:border-bg-border ${
              !showRaw
                ? 'text-label-title bg-bg-base border-bg-border shadow-tiny'
                : 'text-label-base border-transparent'
            } transition-all duration-150 ease-in-bounce border`}
            onClick={() => setShowRaw(false)}
          >
            Diff
          </button>
          <button
            className={`px-2 h-6 rounded-4 caption flex items-center justify-center outline-none focus:outline-none focus:border-bg-border ${
              showRaw
                ? 'text-white bg-bg-base border-bg-border shadow-tiny'
                : 'text-label-base border-transparent'
            } transition-all duration-150 ease-in-bounce border`}
            onClick={() => setShowRaw(true)}
          >
            Raw
          </button>
        </div>
      </div>
      {data.diff?.lines ? (
        <div className="relative py-4">
          <div className="overflow-auto">
            <Code
              lineStart={data.diff.header?.old_start}
              code={showRaw ? rawCode : data.diff.lines?.join('\n')}
              language={data.language}
              isDiff
              removePaddings
            />
          </div>
          <div className="absolute top-4 right-4">
            <Button
              variant="secondary"
              size="small"
              onClick={() => copyToClipboard(rawCode)}
            >
              <Clipboard />
              Copy
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DiffCode;
