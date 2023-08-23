import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CornerArrow } from '../../icons';
import ContextMenu, { ContextMenuItem } from '../../components/ContextMenu';
import { ExtendedMenuItemType, MenuItemType } from '../../types/general';
import FileIcon from '../../components/FileIcon';

type Props = {
  filesNum: number;
};

const RelatedFilesBadge = ({ filesNum }: Props) => {
  const { t } = useTranslation();
  const [isVisible, setVisibility] = useState(false);
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  useEffect(() => {
    Promise.resolve([
      { type: 'imported', path: 'client/src/icons/Home.tsx' },
      { type: 'imported', path: 'client/src/icons/Lock.tsx' },
      { type: 'importing', path: 'client/src/icons/Intellisense.tsx' },
      { type: 'importing', path: 'client/src/icons/Paper.tsx' },
      { type: 'imported', path: 'client/src/icons/Modal.tsx' },
    ]).then((resp) => {
      const imported = resp
        .filter((f) => f.type === 'imported')
        .sort((a, b) => (a.path < b.path ? -1 : 1));
      const importing = resp
        .filter((f) => f.type === 'importing')
        .sort((a, b) => (a.path < b.path ? -1 : 1));
      const menuItems = [];
      if (imported.length) {
        menuItems.push({
          type: ExtendedMenuItemType.DIVIDER_WITH_TEXT,
          text: t('Imported files'),
        });
        menuItems.push(
          ...imported.map((f) => ({
            type: MenuItemType.SELECTABLE,
            icon: <FileIcon filename={f.path} />,
            text: f.path,
            isSelected: false,
            onChange: () => {},
          })),
        );
      }
      if (importing.length) {
        menuItems.push({
          type: ExtendedMenuItemType.DIVIDER_WITH_TEXT,
          text: t('Referencing target file'),
        });
        menuItems.push(
          ...importing.map((f) => ({
            type: MenuItemType.SELECTABLE,
            icon: <FileIcon filename={f.path} />,
            text: f.path,
            isSelected: false,
            onChange: () => {},
          })),
        );
      }
      setItems(menuItems);
    });
  }, []);

  return (
    <div className="relative">
      <ContextMenu
        items={items}
        visible={isVisible}
        handleClose={() => setVisibility(false)}
        closeOnClickOutside
        appendTo={document.body}
        isDark
      >
        <button
          className={`flex h-6 pl-1.5 pr-2 items-center gap-1 border  rounded-full caption  ${
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
  );
};

export default memo(RelatedFilesBadge);
