import React, {
  Dispatch,
  Fragment,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import { CodeStudioColored, Info, PlusSignInCircle } from '../../../icons';
import KeyboardChip from '../KeyboardChip';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { StudioContextFile, StudioPanelDataType } from '../../../types/general';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import { TOKEN_LIMIT } from '../../../consts/codeStudio';
import ContextFileRow from './ContextFileRow';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  setAddContextOpen: Dispatch<SetStateAction<boolean>>;
  studioId: string;
  contextFiles: StudioContextFile[];
  tokensPerFile: number[];
  onFileRemove: (
    f:
      | { path: string; repo: string; branch: string | null }
      | StudioContextFile[],
  ) => void;
  onFileHide: (
    path: string,
    repo: string,
    branch: string | null,
    hide: boolean,
  ) => void;
  onFileAdded: (
    repoRef: string,
    branch: string | null,
    filePath: string,
    ranges?: { start: number; end: number }[],
  ) => void;
  tokensTotal: number;
};

type FileList = {
  repo: string;
  branch: string | null;
  files: (StudioContextFile & { originalIndex: number; fileName: string })[];
}[];

const ContextPanel = ({
  setLeftPanel,
  setAddContextOpen,
  contextFiles,
  tokensPerFile,
  onFileRemove,
  onFileHide,
  onFileAdded,
  tokensTotal,
}: Props) => {
  useTranslation();
  const { repositories } = useContext(RepositoriesContext);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setAddContextOpen(true);
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  const handlePopupOpen = useCallback(() => setAddContextOpen(true), []);

  const fileList = useMemo(
    () =>
      contextFiles
        .reduce<FileList>((acc, f, originalIndex) => {
          const existing = acc.find(
            (a) => a.repo === f.repo && a.branch === f.branch,
          );
          const fileName = f.path.split('/').pop()!;
          if (existing) {
            existing.files.push({ ...f, originalIndex, fileName });
          } else {
            acc.push({
              repo: f.repo,
              branch: f.branch,
              files: [{ ...f, originalIndex, fileName }],
            });
          }
          return acc;
        }, [])
        .sort((a, b) => {
          const sortString = `${a.repo}${a.branch}`.localeCompare(
            `${b.repo}${b.branch}`,
          );
          if (sortString === 0) {
            return 1;
          }
          return sortString;
        })
        .map((f) => {
          f.files.sort((a, b) => a.path.localeCompare(b.path));
          return f;
        }),
    [contextFiles],
  );

  return (
    <div className="flex flex-col w-full flex-1 overflow-auto">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5 flex-shrink-0">
        <div className="flex gap-1.5 items-center text-bg-border-hover select-none">
          <p className="body-s text-label-title">
            <Trans>Context files</Trans>
          </p>
        </div>
        <Button size="small" onClick={handlePopupOpen}>
          <PlusSignInCircle />
          <Trans>Add file</Trans>
          <div className="flex items-center gap-1 flex-shrink-0">
            <KeyboardChip type="cmd" variant="primary" />
            <KeyboardChip type="K" variant="primary" />
          </div>
        </Button>
      </div>
      {tokensTotal > TOKEN_LIMIT && (
        <div className="flex items-center gap-2 px-8 py-2 bg-bg-danger/12 select-none">
          <Info raw sizeClassName="w-4.5 h-4.5" className="text-bg-danger" />
          <p className="text-bg-danger caption">
            <Trans>
              Conversation tokens exceeded. Reduce the number of files to
              generate!
            </Trans>
          </p>
        </div>
      )}
      {!contextFiles.length ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-30 h-30">
            <CodeStudioColored />
          </div>
          <p className="body-m text-label-title mt-3">
            <Trans>Studio Projects</Trans>
          </p>
          <p className="body-s text-label-base max-w-[414px] text-center">
            <Trans>
              In Studio Projects you can use generative AI with a user defined
              context to get more accurate responses. Press{' '}
              <span className="inline-flex items-center gap-1 flex-shrink-0">
                <KeyboardChip type="cmd" />
                <KeyboardChip type="K" />
              </span>{' '}
              to search for a files or press{' '}
              <span className="bg-studio rounded px-1 py-0.5 text-label-control text-[9px]">
                Open in Studio
              </span>{' '}
              when creating semantic searches to open in a Studio Project.
            </Trans>
          </p>
        </div>
      ) : (
        <div className="flex flex-col w-full overflow-auto">
          {fileList.map((repoBranch) => (
            <Fragment key={repoBranch.repo + repoBranch.branch}>
              <div className="w-full overflow-x-auto border-b border-bg-base bg-bg-main/15 group cursor-pointer flex-shrink-0">
                <div className={`max-w-full flex gap-3 items-center py-0 px-8`}>
                  <p className={`body-s text-label-title ellipsis`}>
                    {`${repoBranch.repo.split('/').pop()}${
                      repoBranch.branch
                        ? ` / ${repoBranch.branch.replace(/^origin\//, '')}`
                        : ''
                    }`}
                  </p>
                </div>
              </div>
              {repoBranch.files.map((file) => (
                <ContextFileRow
                  key={file.repo + file.branch + file.path}
                  {...file}
                  contextFiles={contextFiles}
                  setLeftPanel={setLeftPanel}
                  repoFull={repositories?.find((r) => r.ref === file.repo)}
                  tokens={tokensPerFile[file.originalIndex]}
                  onFileRemove={onFileRemove}
                  onFileHide={onFileHide}
                  onFileAdded={onFileAdded}
                  displayName={
                    file.path.split('/').length > 1
                      ? file.path.split('/').slice(-2).join('/')
                      : file.path
                  }
                />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ContextPanel);
