import { memo, useMemo, useState } from 'react';
import { CornerArrow } from '../../icons';
import ContextMenu from '../../components/ContextMenu';
import { MenuItemType, StudioContextFile } from '../../types/general';
import useRelatedFiles from '../../hooks/useRelatedFiles';

type Props = {
  selectedFiles: StudioContextFile[];
  relatedFiles: { type: string; path: string }[];
  onFileAdded: (
    filePath: string,
    ranges: { start: number; end: number }[],
  ) => void;
  onFileRemove: (filePath: string) => void;
  repoRef: string;
  branch: string;
  filePath: string;
};

const RelatedFilesBadge = ({
  selectedFiles,
  relatedFiles,
  onFileAdded,
  onFileRemove,
  repoRef,
  filePath,
  branch,
}: Props) => {
  const [isVisible, setVisibility] = useState(false);
  const { items } = useRelatedFiles(
    selectedFiles,
    relatedFiles,
    onFileAdded,
    onFileRemove,
    repoRef,
    branch,
    filePath,
  );

  const filesNum = useMemo(() => {
    return items.filter(
      (i) => i.type === MenuItemType.SELECTABLE && i.isSelected,
    ).length;
  }, [items]);

  return (
    <>
      {!!filesNum && (
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <ContextMenu
            items={items}
            visible={isVisible}
            handleClose={() => setVisibility(false)}
            closeOnClickOutside
            appendTo={document.body}
            isDark
          >
            <button
              className={`flex h-6 pl-1.5 pr-2 items-center gap-1 border  rounded-full caption select-none ${
                isVisible
                  ? 'bg-bg-base-hover border-bg-border-hover text-label-title'
                  : 'border-bg-border text-label-base hover:bg-bg-base-hover hover:border-bg-border-hover hover:text-label-title'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setVisibility(!isVisible);
              }}
            >
              <CornerArrow raw sizeClassName="w-3.5 h-3.5" />
              {filesNum}
            </button>
          </ContextMenu>
        </div>
      )}
    </>
  );
};

export default memo(RelatedFilesBadge);
