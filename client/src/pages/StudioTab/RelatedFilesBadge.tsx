import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CornerArrow } from '../../icons';
import ContextMenu, { ContextMenuItem } from '../../components/ContextMenu';
import {
  ExtendedMenuItemType,
  MenuItemType,
  StudioContextFile,
} from '../../types/general';
import FileIcon from '../../components/FileIcon';

type Props = {
  selectedFiles: StudioContextFile[];
  relatedFiles: { type: string; path: string }[];
};

const RelatedFilesBadge = ({ selectedFiles, relatedFiles }: Props) => {
  const { t } = useTranslation();
  const [isVisible, setVisibility] = useState(false);
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  useEffect(() => {
    const imported = relatedFiles
      .filter((f) => f.type === 'imported')
      .sort((a, b) => (a.path < b.path ? -1 : 1));
    const importing = relatedFiles
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
          isSelected: !!selectedFiles.find((s) => s.path === f.path),
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
          isSelected: !!selectedFiles.find((s) => s.path === f.path),
          onChange: () => {},
        })),
      );
    }
    setItems(menuItems);
  }, [selectedFiles, relatedFiles]);

  const filesNum = useMemo(() => {
    return items.filter(
      (i) => i.type === MenuItemType.SELECTABLE && i.isSelected,
    ).length;
  }, [items]);

  return (
    <>
      {!!filesNum && (
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
