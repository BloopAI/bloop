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
  MinusSignInCircle,
  MoreHorizontal,
  TrashCanFilled,
} from '../../../icons';
import RelatedFilesBadge from '../RelatedFilesBadge';
import { DropdownWithIcon } from '../../../components/Dropdown';
import { ContextMenuItem } from '../../../components/ContextMenu';

type Props = StudioContextFile & {
  contextFiles: StudioContextFile[];
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  repo?: RepoType;
};

const ContextFileRow = ({
  file_path,
  tokens,
  ranges,
  repo_name,
  branch,
  is_hidden,
  contextFiles,
  setLeftPanel,
  repo,
}: Props) => {
  const { t } = useTranslation();
  const [relatedFiles, setRelatedFiles] = useState<
    { type: string; path: string }[]
  >([]);
  useEffect(() => {
    Promise.resolve(
      file_path === 'client/src/context/providers/AnalyticsContextProvider.tsx'
        ? [
            { type: 'imported', path: 'client/src/App.tsx' },
            { type: 'imported', path: 'client/src/icons/Lock.tsx' },
            { type: 'importing', path: 'client/src/icons/Intellisense.tsx' },
            { type: 'importing', path: 'client/src/icons/Paper.tsx' },
            { type: 'imported', path: 'client/src/icons/Modal.tsx' },
          ]
        : [],
    ).then((resp) => {
      setRelatedFiles(resp);
    });
  }, []);

  const dropdownItems = useMemo(() => {
    return [
      {
        type: MenuItemType.DEFAULT,
        text: t(`Remove related files`),
        icon: <MinusSignInCircle />,
      },
      {
        type: MenuItemType.DEFAULT,
        text: t(`Hide`),
        icon: <EyeCut />,
      },
      {
        type: MenuItemType.DEFAULT,
        text: t(`Remove`),
        icon: <TrashCanFilled />,
      },
    ] as ContextMenuItem[];
  }, []);

  const handleClick = useCallback(() => {
    if (repo) {
      setLeftPanel({
        type: StudioLeftPanelType.FILE,
        data: { filePath: file_path, branch, repo, initialRanges: ranges },
      });
    }
  }, [file_path, branch, repo, ranges]);

  return (
    <div
      className="w-full overflow-x-auto border-b border-bg-base bg-bg-sub group"
      onClick={handleClick}
    >
      <div
        className={`flex gap-3 items-center py-3 px-8 ${
          is_hidden ? 'opacity-30' : ''
        }`}
      >
        <div className="rounded bg-bg-base">
          <FileIcon filename={file_path} noMargin />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <p className="body-s-strong text-label-title ellipsis">
            {file_path.split('/').pop()}
          </p>
          <LinesBadge ranges={ranges} isShort />
          <RelatedFilesBadge
            selectedFiles={contextFiles}
            relatedFiles={relatedFiles}
          />
        </div>
        <TokensUsageBadge tokens={tokens} />
        <div className="h-6 px-2 flex items-center rounded-full border border-bg-border overflow-hidden max-w-12 caption text-label-base">
          <span className="ellipsis">{`${repo_name.split('/').pop()}${
            branch ? ` / ${branch.replace(/^origin\//, '')}` : ''
          }`}</span>
        </div>
        {is_hidden ? (
          <Button
            variant="tertiary"
            size="tiny"
            onlyIcon
            title={t(is_hidden ? '' : '')}
            className={
              'opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity '
            }
          >
            <EyeCut raw sizeClassName="w-3.5 h-3.5" />
          </Button>
        ) : (
          <DropdownWithIcon
            items={dropdownItems}
            btnOnlyIcon
            icon={<MoreHorizontal sizeClassName="w-3.5 h-3.5" />}
            noChevron
            btnSize="tiny"
            appendTo={document.body}
          />
        )}
      </div>
    </div>
  );
};

export default memo(ContextFileRow);
