import {
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
import { getAutocomplete } from '../../services/api';
import { FileResItem } from '../../types/api';
import Body from '../Body';
import FileIcon from '../../components/FileIcon';
import { TabsContext } from '../../context/tabsContext';

type Props = {};

const SearchFiles = ({}: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const { setChosenStep, setIsVisible } = useContext(
    CommandBarContext.Handlers,
  );
  const { openNewTab } = useContext(TabsContext.Handlers);
  const [files, setFiles] = useState<{ path: string; repo: string }[]>([]);
  const searchValue = useDeferredValue(inputValue);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  useEffect(() => {
    getAutocomplete(`path:${searchValue}&content=false`).then((respPath) => {
      const fileResults = respPath.data
        .filter(
          (d): d is FileResItem => d.kind === 'file_result' && !d.data.is_dir,
        )
        .map((d) => ({
          path: d.data.relative_path.text,
          repo: d.data.repo_ref,
        }));
      setFiles(fileResults);
    });
  }, [searchValue]);

  const breadcrumbs = useMemo(() => {
    return [t('Search files')];
  }, [t]);

  const handleBack = useCallback(() => {
    setChosenStep({ id: CommandBarStepEnum.INITIAL });
  }, []);

  const sections = useMemo(() => {
    return [
      {
        key: 'files',
        items: files.map(({ path, repo }) => ({
          key: `${path}-${repo}`,
          id: `${path}-${repo}`,
          onClick: () => {
            openNewTab({ type: TabTypesEnum.FILE, path, repoRef: repo });
            setIsVisible(false);
            setChosenStep({ id: CommandBarStepEnum.INITIAL });
          },
          label: path,
          footerHint: t('Open'),
          footerBtns: [{ label: t('Open'), shortcut: ['entr'] }],
          Icon: (props: { sizeClassName?: string }) => (
            <FileIcon filename={path} noMargin />
          ),
        })),
        itemsOffset: 0,
      },
    ];
  }, [files]);

  return (
    <div className="w-full flex flex-col h-[28.875rem] max-w-[40rem] overflow-auto">
      <Header
        breadcrumbs={breadcrumbs}
        handleBack={handleBack}
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
    </div>
  );
};

export default memo(SearchFiles);
