import React, {
  memo,
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Tippy, { TippyProps } from '@tippyjs/react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ExtendedMenuItemType,
  MenuItemType,
  StudioContextFile,
} from '../../types/general';
import { getRelatedFileRanges, getRelatedFiles } from '../../services/api';
import { mergeRanges } from '../../utils';
import { ContextMenuItem, sizesMap } from '../../components/ContextMenu';
import FileIcon from '../../components/FileIcon';
import Tooltip from '../../components/Tooltip';
import { useOnClickOutside } from '../../hooks/useOnClickOutsideHook';
import ItemSelectable from '../../components/ContextMenu/ContextMenuItem/ItemSelectable';

type Props = {
  dropdownPlacement?: TippyProps['placement'];
  selectedFiles: StudioContextFile[];
  onFileRemove: (
    f:
      | { path: string; repo: string; branch: string | null }
      | StudioContextFile[],
  ) => void;
  onFileAdded: (
    repoRef: string,
    branch: string | null,
    filePath: string,
    ranges: { start: number; end: number }[],
  ) => void;
  branch: string | null;
  filePath: string;
  repoRef: string;
  isDark?: boolean;
  size?: 'small' | 'medium' | 'large';
};

const RelatedFilesDropdown = ({
  dropdownPlacement,
  children,
  selectedFiles,
  onFileAdded,
  onFileRemove,
  branch,
  filePath,
  repoRef,
  isDark,
  size = 'medium',
}: PropsWithChildren<Props>) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedFiles, setRelatedFiles] = useState<
    { type: string; path: string }[]
  >([]);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setIsVisible(false));

  const handleRelatedFileAdded = useCallback(
    async (path: string, ranges: { start: number; end: number }[]) => {
      onFileAdded(repoRef, branch, path, ranges);
    },
    [repoRef, branch, onFileAdded, filePath],
  );
  const handleRelatedFileRemoved = useCallback(
    (path: string) => {
      onFileRemove({ branch, path, repo: repoRef });
    },
    [repoRef, branch, onFileRemove],
  );

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
        handleRelatedFileAdded(
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
        handleRelatedFileRemoved(path);
      }
    },
    [
      handleRelatedFileRemoved,
      handleRelatedFileAdded,
      repoRef,
      branch,
      filePath,
    ],
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
    setItems(menuItems);
  }, [selectedFiles, relatedFiles, t, onChange, isLoading]);

  useEffect(() => {
    if (isVisible) {
      getRelatedFiles(filePath, repoRef, branch ? branch : undefined)
        .then((resp) => {
          setRelatedFiles(
            resp.files_imported
              .map((path) => ({ type: 'imported', path }))
              .concat(
                resp.files_importing.map((path) => ({
                  type: 'importing',
                  path,
                })),
              ),
          );
        })
        .finally(() => setIsLoading(false));
    }
  }, [filePath, repoRef, branch, isVisible]);

  const renderItem = useCallback((item: ContextMenuItem, i: number) => {
    switch (item.type) {
      case MenuItemType.SELECTABLE:
        return (
          <ItemSelectable
            key={i}
            text={item.text}
            onChange={item.onChange}
            isSelected={item.isSelected}
            disabled={item.disabled}
            icon={item.icon}
          />
        );
      case ExtendedMenuItemType.DIVIDER_WITH_TEXT:
        return (
          <div
            className="px-2.5 py-2 border-b border-bg-border caption text-label-base sticky top-0 bg-bg-shade z-10"
            key={i}
          >
            {item.text}
          </div>
        );
      default:
        return item.text;
    }
  }, []);
  return (
    <div ref={ref}>
      <Tippy
        placement={dropdownPlacement}
        interactive
        visible={isVisible}
        render={() =>
          !isVisible ? null : (
            <div
              id="dropdown"
              className={`
      transition-all duration-300 ease-in-slow max-h-96 overflow-auto
       rounded-md ${
         isDark ? 'bg-bg-sub' : 'bg-bg-shade'
       } border border-bg-border shadow-high ${
         sizesMap[size]
       } flex flex-col gap-1`}
            >
              {isLoading ? (
                <div className="px-4 py-4 text-center text-label-base body-s">
                  <Trans>Loading...</Trans>
                </div>
              ) : !items.length ? (
                <div className="px-4 py-4 text-center text-label-base body-s">
                  <Trans>No related files found</Trans>
                </div>
              ) : (
                items.map(renderItem)
              )}
            </div>
          )
        }
      >
        <span
          className={'cursor-pointer'}
          onClick={() => setIsVisible((prev) => !prev)}
        >
          {children}
        </span>
      </Tippy>
    </div>
  );
};

export default memo(RelatedFilesDropdown);
