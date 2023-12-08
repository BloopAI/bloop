import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  forceFileToBeIndexed,
  getHoverables,
  search,
} from '../../services/api';
import { buildRepoQuery, splitPath } from '../../utils';
import FileIcon from '../../components/FileIcon';
import Button from '../../components/Button';
import { EyeCutIcon, MoreHorizontalIcon } from '../../icons';
import { File } from '../../types/api';
import { mapRanges } from '../../mappers/results';
import { Range } from '../../types/results';
import CodeFull from '../../components/Code/CodeFull';
import IpynbRenderer from '../../components/IpynbRenderer';
import SpinLoaderContainer from '../../components/Loaders/SpinnerLoader';
import { SyncStatus } from '../../types/general';
import { DeviceContext } from '../../context/deviceContext';
import { ProjectContext } from '../../context/projectContext';

type Props = {
  repoName: string;
  repoRef: string;
  path: string;
  scrollToLine?: string;
  tokenRange?: string;
  noBorder?: boolean;
  branch?: string | null;
};

const FileTab = ({
  repoName,
  path,
  noBorder,
  repoRef,
  scrollToLine,
  branch,
  tokenRange,
}: Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<
    (File & { hoverableRanges?: Record<number, Range[]> }) | null
  >(null);
  const [indexRequested, setIndexRequested] = useState(false);
  const { apiUrl } = useContext(DeviceContext);
  const { refreshCurrentProjectRepos } = useContext(ProjectContext.Current);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setIndexRequested(false);
  }, [repoName, path, repoRef]);

  const refetchFile = useCallback(() => {
    search(buildRepoQuery(repoName, path, branch)).then((resp) => {
      const item = resp?.data?.[0]?.data as File;
      if (!item) {
        return;
      }
      setFile(item);
      if (item.indexed) {
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
      }
    });
  }, [repoName, path, branch]);

  useEffect(() => {
    refetchFile();
  }, [refetchFile]);

  const startEventSource = useCallback(() => {
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.ev?.status_change && data.ref === repoRef) {
          if (data.ev?.status_change === SyncStatus.Done) {
            eventSourceRef.current?.close();
            eventSourceRef.current = null;
            refreshCurrentProjectRepos();
            setTimeout(refetchFile, 2000);
          }
        }
      } catch {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      }
    };
    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [repoRef]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const onIndexRequested = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (path) {
        setIndexRequested(true);
        await forceFileToBeIndexed(repoRef, path);
        startEventSource();
        setTimeout(() => refetchFile(), 1000);
      }
    },
    [repoRef, path],
  );

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
        <Button
          variant="tertiary"
          size="mini"
          onlyIcon
          title={t('More actions')}
        >
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
            repoRef={file.repo_ref}
            relativePath={file.relative_path}
            hoverableRanges={file.hoverableRanges}
            repoName={file.repo_name}
            scrollToLine={scrollToLine}
            branch={branch}
            tokenRange={tokenRange}
          />
        ) : !!file && !file.indexed ? (
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
                  This might be because the file is too big or it has one of
                  bloop&apos;s excluded file types.
                </Trans>
              </p>
            </div>
            {!indexRequested ? (
              <Button size="large" variant="primary" onClick={onIndexRequested}>
                <Trans>Index</Trans>
              </Button>
            ) : (
              <div className="text-bg-main mt-6">
                <SpinLoaderContainer sizeClassName="w-8 h-8" />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default memo(FileTab);
