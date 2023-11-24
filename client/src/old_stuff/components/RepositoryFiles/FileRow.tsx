import React, { memo, useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FileTreeFileType } from '../../../types';
import { EyeCut, FolderFilled } from '../../../icons';
import FileIcon from '../../../components/FileIcon';
import Button from '../../../components/Button';
import { SyncStatus } from '../../types/general';
import LiteLoaderContainer from '../../../components/Loaders/LiteLoader';

type Props = {
  path: string;
  name: string;
  type: FileTreeFileType;
  indexed: boolean;
  repoStatus: SyncStatus;
  onFileIndexRequested: (filePath: string) => void;
  onClick: (p: string, type: FileTreeFileType) => void;
};

const FileRow = ({
  path,
  name,
  type,
  onClick,
  indexed,
  repoStatus,
  onFileIndexRequested,
}: Props) => {
  useTranslation();
  const [indexRequested, setIndexRequested] = useState(false);
  const onIndexRequested = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFileIndexRequested(path);
      setIndexRequested(true);
    },
    [path],
  );

  return (
    <a
      className={`flex flex-row justify-between px-4 py-4 last:rounded-b group cursor-pointer text-left ${
        indexed ? 'text-label-base' : 'text-label-muted'
      } body-s focus:outline-0`}
      onClick={() => {
        onClick(path, type);
      }}
    >
      <span
        className={`w-fit ${
          indexed
            ? 'group-hover:text-label-title group-focus:text-label-title'
            : ''
        } flex items-center gap-2`}
      >
        {type === FileTreeFileType.DIR ? (
          <FolderFilled />
        ) : indexed ? (
          <FileIcon filename={name} />
        ) : (
          <EyeCut />
        )}
        <span
          className={
            indexed ? `group-hover:underline group-focus:underline` : ''
          }
        >
          {name}
        </span>
      </span>
      {!indexed && !indexRequested && (
        <Button
          onClick={onIndexRequested}
          variant="secondary"
          size="tiny"
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
        >
          <Trans>Index</Trans>
        </Button>
      )}
      {!indexed && indexRequested && repoStatus !== SyncStatus.Done && (
        <div className="text-bg-main">
          <LiteLoaderContainer />
        </div>
      )}
    </a>
  );
};

export default memo(FileRow);
