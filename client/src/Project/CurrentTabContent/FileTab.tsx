import React, { memo, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { getHoverables, search } from '../../services/api';
import { buildRepoQuery, splitPath } from '../../utils';
import FileIcon from '../../components/FileIcon';
import Button from '../../components/Button';
import { EyeCutIcon, MoreHorizontalIcon } from '../../icons';
import { File } from '../../types/api';
import { mapRanges } from '../../mappers/results';
import { Range } from '../../types/results';
import CodeFull from '../../components/Code/CodeFull';
import IpynbRenderer from '../../components/IpynbRenderer';

type Props = { repoName: string; path: string; noBorder?: boolean };

const FileTab = ({ repoName, path, noBorder }: Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<
    (File & { hoverableRanges?: Record<number, Range[]> }) | null
  >(null);

  useEffect(() => {
    search(buildRepoQuery(repoName, path)).then((resp) => {
      const item = resp?.data?.[0]?.data as File;
      if (!item) {
        return;
      }
      setFile(item);
      getHoverables(
        item.relative_path,
        item.repo_ref,
        // selectedBranch ? selectedBranch : undefined,
      ).then((data) => {
        setFile((prevState) => ({
          ...prevState!,
          hoverableRanges: mapRanges(data.ranges),
        }));
      });
    });
  }, [repoName, path]);

  return (
    <div
      className={`flex flex-col flex-1 h-full overflow-auto ${
        noBorder ? '' : 'border-l border-bg-border'
      }`}
    >
      <div className="w-full h-10 px-4 flex justify-between items-center flex-shrink-0 border-b border-bg-border bg-bg-sub">
        <div className="flex items-center gap-3 body-s text-label-title ellipsis">
          <FileIcon filename={path} noMargin />
          {splitPath(path).slice(-2).join('/')}
        </div>
        <Button variant="tertiary" size="mini" onlyIcon title={t('')}>
          <MoreHorizontalIcon sizeClassName="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 h-full max-w-full pl-4 py-4 overflow-auto">
        {file?.lang === 'jupyter notebook' ? (
          <IpynbRenderer data={file.contents} />
        ) : file?.indexed ? (
          <CodeFull
            code={file.contents}
            language={file.lang}
            repoPath={file.repo_ref}
            relativePath={file.relative_path}
            hoverableRanges={file.hoverableRanges}
            repoName={file.repo_name}
          />
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-6">
            <div className="w-15 h-15 flex items-center justify-center rounded-xl border border-bg-divider">
              <EyeCutIcon sizeClassName="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-2 items-center text-center max-w-[18.75rem]">
              <p className="body-base-b text-label-title">
                <Trans>File not indexed</Trans>
              </p>
              <p className="body-s text-label-base !leading-5">
                <Trans>
                  This file was not indexed by bloop. The reason for this might
                  be that the file is to big or is in our list of excluded file
                  types.
                </Trans>
              </p>
            </div>
            <Button size="large" variant="primary">
              <Trans>Force index</Trans>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(FileTab);
