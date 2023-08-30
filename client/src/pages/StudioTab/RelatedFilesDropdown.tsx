import { memo, PropsWithChildren } from 'react';
import ContextMenu from '../../components/ContextMenu';
import { StudioContextFile } from '../../types/general';
import useRelatedFiles from '../../hooks/useRelatedFiles';

type Props = {
  selectedFiles: StudioContextFile[];
  relatedFiles: { type: string; path: string }[];
  onFileAdded: (
    filePath: string,
    ranges: { start: number; end: number }[],
  ) => void;
  onFileRemove: (filePath: string) => void;
  isVisible: boolean;
  setVisibility: (b: boolean) => void;
  repoRef: string;
  branch: string;
  filePath: string;
};

const RelatedFilesDropdown = ({
  children,
  relatedFiles,
  selectedFiles,
  onFileRemove,
  onFileAdded,
  isVisible,
  setVisibility,
  repoRef,
  filePath,
  branch,
}: PropsWithChildren<Props>) => {
  const { items } = useRelatedFiles(
    selectedFiles,
    relatedFiles,
    onFileAdded,
    onFileRemove,
    repoRef,
    branch,
    filePath,
  );

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <ContextMenu
        items={items}
        visible={isVisible}
        handleClose={() => setVisibility(false)}
        closeOnClickOutside
        appendTo={document.body}
        isDark
      >
        {children}
      </ContextMenu>
    </div>
  );
};

export default memo(RelatedFilesDropdown);
