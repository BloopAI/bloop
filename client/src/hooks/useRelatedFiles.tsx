import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenuItem } from '../components/ContextMenu';
import {
  ExtendedMenuItemType,
  MenuItemType,
  StudioContextFile,
} from '../types/general';
import FileIcon from '../components/FileIcon';
import { getRelatedFileRanges, getRelatedFiles } from '../services/api';
import Tooltip from '../components/Tooltip';
import { mergeRanges } from '../utils';

const useRelatedFiles = (
  selectedFiles: StudioContextFile[],
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
  const [isLoading, setIsLoading] = useState(true);
  const [relatedFiles, setRelatedFiles] = useState<
    { type: string; path: string }[]
  >([]);

  useEffect(() => {
    setIsLoading(true);
    getRelatedFiles(filePath, repoRef, branch ? branch : undefined)
      .then((resp) => {
        setRelatedFiles(
          resp.files_imported
            .map((path) => ({ type: 'imported', path }))
            .concat(
              resp.files_importing.map((path) => ({ type: 'importing', path })),
            ),
        );
      })
      .finally(() => setIsLoading(false));
  }, [filePath, repoRef, branch]);

  const onChange = useCallback(
    async (path: string, kind: 'Imported' | 'Importing', b: boolean) => {
      if (b) {
        const resp = await getRelatedFileRanges(
          repoRef,
          branch ? branch : undefined,
          filePath,
          path,
          kind,
        );
        onFileAdded(
          path,
          mergeRanges(
            resp?.ranges?.map((r) => [r.start.line, r.end.line + 1]),
          ).map(
            (r) =>
              ({
                start: r[0],
                end: r[1],
              }) || [],
          ),
        );
      } else {
        onFileRemove(path);
      }
    },
    [onFileRemove, onFileAdded],
  );

  useEffect(() => {
    const imported = relatedFiles
      .filter((f) => f.type === 'imported')
      .sort((a, b) => (a.path < b.path ? -1 : 1));
    const importing = relatedFiles
      .filter((f) => f.type === 'importing')
      .sort((a, b) => (a.path < b.path ? -1 : 1));
    const menuItems: ContextMenuItem[] = [];
    if (imported.length) {
      menuItems.push({
        type: ExtendedMenuItemType.DIVIDER_WITH_TEXT,
        text: t('Imported files'),
      });
      menuItems.push(
        ...imported.map((f) => ({
          type: MenuItemType.SELECTABLE,
          icon: <FileIcon filename={f.path} />,
          text:
            f.path.length > 33 ? (
              <Tooltip text={f.path} placement={'right'} delay={500}>
                ...{f.path.slice(-31)}
              </Tooltip>
            ) : (
              f.path
            ),
          isSelected: !!selectedFiles.find((s) => s.path === f.path),
          onChange: (b: boolean) => onChange(f.path, 'Imported', b),
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
          text:
            f.path.length > 33 ? (
              <Tooltip text={f.path} placement={'right'} delay={500}>
                ...{f.path.slice(-31)}
              </Tooltip>
            ) : (
              f.path
            ),
          isSelected: !!selectedFiles.find((s) => s.path === f.path),
          onChange: (b: boolean) => onChange(f.path, 'Importing', b),
        })),
      );
    }
    if (!menuItems.length) {
      menuItems.push({
        type: ExtendedMenuItemType.DIVIDER_WITH_TEXT,
        text: isLoading ? t('Loading...') : t('No related files found'),
      });
    }
    setItems(menuItems);
  }, [selectedFiles, relatedFiles, t, onChange, isLoading]);

  return { items };
};

export default useRelatedFiles;
