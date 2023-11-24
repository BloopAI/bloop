import React, { useEffect, useState } from 'react';
import { Clipboard, CloseSign, FloppyDisk } from '../../../icons';
import FileIcon from '../../../components/FileIcon';
import ContextMenu, {
  ContextMenuItem,
  MenuListItemType,
} from '../../../components/ContextMenu';
import Counter from './Counter';

export type ShareFile = {
  name: string;
  annotations: number;
};
type Props = {
  visible: boolean;
  files: ShareFile[];
};
const ShareButton = ({ files, visible }: Props) => {
  const [buttonVisible, setButtonVisible] = useState(visible);
  const [menuVisible, setMenuVisible] = useState(false);
  const [fileItems, setFileItems] = useState(
    files.map((file, index) => ({ ...file, index })),
  );
  const [menuItems, setMenuItems] = useState<ContextMenuItem[]>([]);

  useEffect(() => {
    setMenuItems(
      fileItems.map((file, index) => ({
        text: file.name,
        annotations: file.annotations,
        type: MenuListItemType.SHARED,
        icon: <FileIcon filename={file.name} />,
        removable: true,
        onDelete: () => handleDelete(file.index),
      })),
    );
  }, [fileItems]);

  const handleDelete = (index: number) => {
    setFileItems(fileItems.filter((item) => index !== item.index));
  };

  return (
    <div className={`relative ${buttonVisible ? '' : 'hidden'}`}>
      <span
        className={`w-fit text-label-base flex cursor-pointer h-10 `}
        onClick={() => setMenuVisible(!menuVisible)}
      >
        <span className="inline-flex gap-2 items-center border border-bg-border w-fit p-2 rounded-l-4 bg-bg-base hover:border-bg-border-hover hover:border-r-bg-border">
          <Counter count={fileItems.length} />
          <span>Multi share</span>
        </span>
        <span
          className="inline-flex items-center gap-1 border border-bg-border w-fit bg-bg-base p-2 rounded-r-4 border-l-0 hover:border-bg-border-hover"
          onClick={() => setButtonVisible(false)}
        >
          <CloseSign />
        </span>
      </span>
      <ContextMenu
        items={[
          ...menuItems,
          { type: MenuListItemType.DIVIDER },
          {
            text: 'Save to my collections',
            icon: <FloppyDisk />,
            type: MenuListItemType.DEFAULT,
          },
          {
            text: 'Copy sharing link',
            icon: <Clipboard />,
            type: MenuListItemType.DEFAULT,
          },
        ]}
        visible={menuVisible}
        title={'Will be shared'}
        handleClose={() => setMenuVisible(false)}
      />
    </div>
  );
};
export default ShareButton;
