import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenuItem } from '../components/ContextMenu';
import {
  ExtendedMenuItemType,
  MenuItemType,
  StudioContextFile,
} from '../types/general';
import FileIcon from '../components/FileIcon';
import { getRelatedFileRanges } from '../services/api';

const useRelatedFiles = (
  selectedFiles: StudioContextFile[],
  relatedFiles: { type: string; path: string }[],
  onFileAdded: (
    filePath: string,
    ranges: { start: number; end: number }[],
  ) => void,
  onFileRemove: (filePath: string) => void,
  repoRef: string,
  branch: string | null,
  filePath: string,
) => {
  const { t } = useTranslation();
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
          onChange: async (b: boolean) => {
            if (b) {
              const resp = await getRelatedFileRanges(
                repoRef,
                branch ? branch : undefined,
                filePath,
                f.path,
                'Imported',
              );
              onFileAdded(
                f.path,
                resp?.ranges?.map((r) => ({
                  start: r.start.line,
                  end: r.end.line + 1,
                })) || [],
              );
            } else {
              onFileRemove(f.path);
            }
          },
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
          onChange: async (b: boolean) => {
            if (b) {
              const resp = await getRelatedFileRanges(
                repoRef,
                branch ? branch : undefined,
                filePath,
                f.path,
                'Importing',
              );
              onFileAdded(
                f.path,
                resp?.ranges?.map((r) => ({
                  start: r.start.line,
                  end: r.end.line + 1,
                })) || [],
              );
            } else {
              onFileRemove(f.path);
            }
          },
        })),
      );
    }
    setItems(menuItems);
  }, [selectedFiles, relatedFiles, onFileAdded, onFileRemove, t]);

  return { items };
};

export default useRelatedFiles;
