import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Header from '../Header';
import { CommandBarStepEnum, TabTypesEnum } from '../../types/general';
import { CommandBarContext } from '../../context/commandBarContext';
import {
  getAutocomplete,
  getCodeStudio,
  patchCodeStudio,
} from '../../services/api';
import { FileResItem } from '../../types/api';
import Body from '../Body';
import FileIcon from '../../components/FileIcon';
import { TabsContext } from '../../context/tabsContext';
import { ProjectContext } from '../../context/projectContext';
import Footer from '../Footer';
import { splitPath } from '../../utils';
import { getJsonFromStorage, RECENT_FILES_KEY } from '../../services/storage';
import { UIContext } from '../../context/uiContext';
import { filterOutDuplicates } from '../../utils/mappers';

type Props = {
  studioId?: string;
};

const SearchFiles = ({ studioId }: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { project, refreshCurrentProjectRepos } = useContext(
    ProjectContext.Current,
  );
  const { openNewTab } = useContext(TabsContext.Handlers);
  const { setIsLeftSidebarFocused } = useContext(UIContext.Focus);
  const [files, setFiles] = useState<
    { path: string; repo: string; branch: string | null }[]
  >([]);
  const searchValue = useDeferredValue(inputValue);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  useEffect(() => {
    if (!searchValue) {
      const recentFiles = getJsonFromStorage<string[]>(RECENT_FILES_KEY);
      const newFiles: { path: string; repo: string; branch: string | null }[] =
        [];
      recentFiles?.forEach((f) => {
        const [repo, path, branch] = f.split(':');
        if (project?.repos.find((r) => r.repo.ref === repo)) {
          newFiles.push({ repo, path, branch: branch || null });
        }
      });
      if (newFiles.length > 1) {
        setFiles(newFiles.reverse());
        return;
      }
    }
    if (project?.id) {
      getAutocomplete(
        project.id,
        `path:${searchValue}&content=false&file=true&page_size=20`,
      ).then((respPath) => {
        const fileResults = respPath.data
          .filter(
            (d): d is FileResItem => d.kind === 'file_result' && !d.data.is_dir,
          )
          .map((d) => ({
            path: d.data.relative_path.text,
            repo: d.data.repo_ref,
            branch: d.data.branches || null,
          }));
        setFiles(fileResults);
      });
    }
  }, [searchValue, project?.id]);

  const breadcrumbs = useMemo(() => {
    return studioId ? [t('Add file to studio')] : [t('Search files')];
  }, [t, studioId]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const sections = useMemo(() => {
    return [
      {
        key: 'files',
        items: filterOutDuplicates(
          files.map((f) => ({ ...f, key: `${f.path}-${f.repo}-${f.branch}` })),
          'key',
        ).map(({ path, repo, branch, key }) => {
          const addMultipleFilesToStudio = async () => {
            if (project?.id && studioId) {
              const studio = await getCodeStudio(project.id, studioId);
              const patchedFile = studio?.context.find(
                (f) =>
                  f.path === path && f.repo === repo && f.branch === branch,
              );
              if (!patchedFile) {
                await patchCodeStudio(project.id, studioId, {
                  context: [
                    ...(studio?.context || []),
                    {
                      path,
                      branch: branch,
                      repo,
                      hidden: false,
                      ranges: [],
                    },
                  ],
                });
                refreshCurrentProjectRepos();
                openNewTab({
                  type: TabTypesEnum.FILE,
                  path,
                  repoRef: repo,
                  branch,
                  studioId,
                  isFileInContext: true,
                  initialRanges: [],
                });
              }
            }
          };
          return {
            key,
            id: key,
            onClick: async (e: React.MouseEvent | KeyboardEvent) => {
              if (studioId && e.shiftKey && project?.id) {
                await addMultipleFilesToStudio();
              } else {
                openNewTab({
                  type: TabTypesEnum.FILE,
                  path,
                  repoRef: repo,
                  branch,
                  studioId,
                });
                setIsLeftSidebarFocused(false);
                setIsVisible(false);
                setChosenStep({ id: CommandBarStepEnum.INITIAL });
              }
            },
            label: path,
            footerHint: `${splitPath(repo)
              .slice(repo.startsWith('local//') ? -1 : -2)
              .join('/')} ${
              branch ? `/ ${splitPath(branch).pop()} ` : ''
            }/ ${path}`,
            footerBtns: [
              ...(studioId
                ? [
                    {
                      label: t('Add multiple files'),
                      shortcut: ['shift', 'entr'],
                      action: addMultipleFilesToStudio,
                    },
                  ]
                : []),
              {
                label: studioId ? t('Add file') : t('Open'),
                shortcut: ['entr'],
              },
            ],
            Icon: (props: { sizeClassName?: string }) => (
              <FileIcon filename={path} noMargin />
            ),
          };
        }),
        itemsOffset: 0,
      },
    ];
  }, [files, studioId, project?.id]);

  return (
    <div className="flex flex-col h-[28.875rem] w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={studioId ? undefined : handleBack}
        placeholder={t('Search files...')}
        value={inputValue}
        onChange={handleInputChange}
      />
      {files.length ? (
        <Body sections={sections} />
      ) : (
        <div className="flex-1 items-center justify-center text-label-muted text-center py-2">
          <Trans>No files found...</Trans>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default memo(SearchFiles);
