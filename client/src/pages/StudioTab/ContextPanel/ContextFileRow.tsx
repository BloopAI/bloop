import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItemType, StudioContextFile } from '../../../types/general';
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

type Props = StudioContextFile;

const ContextFileRow = ({
  file_path,
  tokens,
  ranges,
  repo_name,
  branch,
  is_hidden,
  related_files_num,
}: Props) => {
  const { t } = useTranslation();
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
  return (
    <div
      className={`flex gap-3 items-center py-3 px-8 border-b border-bg-base bg-bg-sub group ${
        is_hidden ? 'opacity-30' : ''
      } overflow-x-auto`}
    >
      <div className="rounded bg-bg-base">
        <FileIcon filename={file_path} noMargin />
      </div>
      <div className="flex items-center gap-2 flex-1">
        <p className="body-s-strong text-label-title ellipsis">
          {file_path.split('/').pop()}
        </p>
        <LinesBadge ranges={ranges} isShort />
        {!!related_files_num && (
          <RelatedFilesBadge filesNum={related_files_num} />
        )}
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
  );
};

export default memo(ContextFileRow);
