import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  MenuItemType,
  RepoType,
  StudioContextFile,
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import FileIcon from '../../../components/FileIcon';
import LinesBadge from '../LinesBadge';
import TokensUsageBadge from '../TokensUsageBadge';
import Button from '../../../components/Button';
import {
  EyeCut,
  Eye,
  MinusSignInCircle,
  MoreHorizontal,
  PlusSignInCircle,
  TrashCanFilled,
  PlusSignInBubble,
} from '../../../icons';
import RelatedFilesBadge from '../RelatedFilesBadge';
import { DropdownWithIcon } from '../../../components/Dropdown';
import { ContextMenuItem } from '../../../components/ContextMenu';
import { getRelatedFiles } from '../../../services/api';
import useRelatedFiles from '../../../hooks/useRelatedFiles';

type Props = StudioContextFile & {
  contextFiles: StudioContextFile[];
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  repoFull?: RepoType;
  tokens: number;
  onFileHide: (
    path: string,
    repo: string,
    branch: string,
    hide: boolean,
  ) => void;
  onFileRemove: (
    f: { path: string; repo: string; branch: string } | StudioContextFile[],
  ) => void;
  onFileAdded: (
    repo: RepoType,
    branch: string,
    filePath: string,
    skip: boolean,
  ) => void;
};

const ContextFileRow = ({
  path,
  tokens,
  ranges,
  repo,
  branch,
  hidden,
  contextFiles,
  setLeftPanel,
  repoFull,
  onFileRemove,
  onFileHide,
  onFileAdded,
}: Props) => {
  const { t } = useTranslation();
  const [relatedFiles, setRelatedFiles] = useState<
    { type: string; path: string }[]
  >([]);
  const [isAddingRelatedFiles, setAddingRelatedFiles] = useState(false);

  useEffect(() => {
    getRelatedFiles(path, repo, branch).then((resp) => {
      setRelatedFiles(
        resp.files_imported
          .map((path) => ({ type: 'imported', path }))
          .concat(
            resp.files_importing.map((path) => ({ type: 'importing', path })),
          ),
      );
    });
  }, []);

  const dropdownItems = useMemo(() => {
    const items: ContextMenuItem[] = [];
    const usedRelatedFiles = contextFiles.filter(
      (c) =>
        !!relatedFiles.find(
          (r) => r.path === c.path && c.repo === repo && c.branch === branch,
        ),
    );
    if (usedRelatedFiles.length) {
      items.push({
        type: MenuItemType.DEFAULT,
        text: t(`Remove related files`),
        icon: <MinusSignInCircle />,
        onClick: () => onFileRemove(usedRelatedFiles),
      });
    } else if (relatedFiles.length) {
      items.push({
        type: MenuItemType.DEFAULT,
        text: t(`Add related files`),
        icon: <PlusSignInCircle />,
        noCloseOnClick: true,
        onClick: () => setAddingRelatedFiles(true),
      });
    }
    items.push({
      type: MenuItemType.DEFAULT,
      text: t(`Hide`),
      icon: <EyeCut />,
      onClick: () => onFileHide(path, repo, branch, true),
    });
    items.push({
      type: MenuItemType.DEFAULT,
      text: t(`Remove`),
      icon: <TrashCanFilled />,
      onClick: () => onFileRemove({ path, repo, branch }),
    });
    return items;
  }, [onFileRemove, path, repo, branch, contextFiles, relatedFiles, t]);

  const mappedRanges = useMemo((): [number, number][] => {
    return ranges.map((r) => [r.start, r.end - 1]);
  }, [ranges]);

  const handleClick = useCallback(() => {
    if (repoFull && !hidden) {
      setLeftPanel({
        type: StudioLeftPanelType.FILE,
        data: {
          filePath: path,
          branch,
          repo: repoFull,
          initialRanges: mappedRanges,
        },
      });
    }
  }, [path, branch, repoFull, mappedRanges, hidden]);

  const handleRelatedFileAdded = useCallback(
    (filePath: string) => {
      if (repoFull) {
        onFileAdded(repoFull, branch, filePath, true);
      }
    },
    [repoFull, branch, onFileAdded],
  );

  const handleRelatedFileRemoved = useCallback(
    (path: string) => {
      if (repoFull) {
        onFileRemove({ branch, path, repo });
      }
    },
    [repo, branch, onFileRemove],
  );

  const { items: relatedFilesItems } = useRelatedFiles(
    contextFiles,
    relatedFiles,
    handleRelatedFileAdded,
    handleRelatedFileRemoved,
  );

  const onRelatedFiledClosed = useCallback(() => {
    setAddingRelatedFiles(false);
  }, []);

  return (
    <div
      className="w-full overflow-x-auto border-b border-bg-base bg-bg-sub group cursor-pointer"
      onClick={handleClick}
    >
      <div className={`max-w-full flex gap-3 items-center py-3 px-8`}>
        <div className="rounded bg-bg-base">
          <FileIcon filename={path} noMargin />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <p
            className={`body-s-strong text-label-title ellipsis ${
              hidden ? 'opacity-30' : ''
            }`}
          >
            {path.split('/').pop()}
          </p>
          <LinesBadge ranges={mappedRanges} isShort />
          <RelatedFilesBadge
            selectedFiles={contextFiles}
            relatedFiles={relatedFiles}
            onFileAdded={handleRelatedFileAdded}
            onFileRemove={handleRelatedFileRemoved}
          />
        </div>
        <div className="w-16 flex items-center flex-shrink-0">
          <TokensUsageBadge tokens={tokens} />
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownWithIcon
            items={relatedFilesItems}
            btnOnlyIcon
            btnTitle="Add related files"
            icon={
              <PlusSignInBubble
                raw
                sizeClassName="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-focus:opacity-100"
              />
            }
            noChevron
            btnSize="tiny"
            dropdownBtnClassName="flex-shrink-0"
            appendTo={document.body}
            onClose={onRelatedFiledClosed}
          />
        </div>
        <Button
          variant="tertiary"
          size="tiny"
          onlyIcon
          title={hidden ? t('Show file') : t('Hide file')}
          className={
            'opacity-50 group-hover:opacity-100 group-focus:opacity-100'
          }
          onClick={(e) => {
            e.stopPropagation();
            onFileHide(path, repo, branch, !hidden);
          }}
        >
          {hidden ? (
            <EyeCut raw sizeClassName="w-3.5 h-3.5" />
          ) : (
            <Eye raw sizeClassName="w-3.5 h-3.5" />
          )}
        </Button>
        <Button
          variant="tertiary"
          size="tiny"
          onlyIcon
          title={'Remove file'}
          className={
            'opacity-50 group-hover:opacity-100 group-focus:opacity-100'
          }
          onClick={(e) => {
            e.stopPropagation();
            onFileRemove({ path, repo, branch });
          }}
        >
          <TrashCanFilled raw sizeClassName="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default memo(ContextFileRow);
