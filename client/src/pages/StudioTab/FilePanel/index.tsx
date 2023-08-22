import { Dispatch, memo, SetStateAction, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  RepoType,
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import { ArrowLeft, Branch, Fire } from '../../../icons';
import FileIcon from '../../../components/FileIcon';
import { search } from '../../../services/api';
import {
  buildRepoQuery,
  getFileExtensionForLang,
  humanNumber,
} from '../../../utils';
import { File } from '../../../types/api';
import CodeStudioToken from '../../../icons/CodeStudioToken';
import CodeFullSelectable from '../../../components/CodeBlock/CodeFullSelectable';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  filePath: string;
  branch: string;
  repo: RepoType;
};

const HEADER_HEIGHT = 32;
const SUBHEADER_HEIGHT = 46;
const FOOTER_HEIGHT = 64;
const VERTICAL_PADDINGS = 32;
const HORIZONTAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 41;

const FilePanel = ({ setLeftPanel, filePath, branch, repo }: Props) => {
  const { t } = useTranslation();
  const [tipShown, setTipShown] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [selectedLines, setSelectedLines] = useState<
    ([number, number] | [number])[]
  >([]);

  useEffect(() => {
    console.log(repo);
    search(
      buildRepoQuery(
        repo.ref.startsWith('github.com/') ? repo.ref : repo.name,
        filePath,
        branch,
      ),
    ).then((resp) => {
      if (resp?.data?.[0]?.kind === 'file') {
        setFile(resp?.data?.[0]?.data);
      }
    });
  }, [filePath, branch, repo]);

  return (
    <div className="flex flex-col w-full flex-1 overflow-auto relative">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5">
        <div className="flex items-center gap-3">
          <Button
            size="small"
            variant="tertiary"
            onlyIcon
            title={t('Back')}
            onClick={() => setLeftPanel({ type: StudioLeftPanelType.CONTEXT })}
          >
            <ArrowLeft />
          </Button>
          <div className="flex items-center p-1 rounded border border-bg-border bg-bg-base">
            <FileIcon filename={filePath || ''} noMargin />
          </div>
          <p className="body-s-strong text-label-title ellipsis">{filePath}</p>
        </div>
      </div>
      <div className="flex px-8 py-2 items-center gap-2 border-b border-bg-border bg-bg-sub  text-label-base">
        <div className="flex items-center gap-1.5 flex-1">
          <FileIcon filename={getFileExtensionForLang(repo.most_common_lang)} />
          <span className="caption ellipsis">
            {repo.name.replace(/^github\.com\//, '')}
          </span>
          <span className="w-0.5 h-0.5 bg-bg-border-hover rounded-full" />
          {!!branch && (
            <>
              <Branch sizeClassName="w-4 h-4" />
              <span className="caption ellipsis">
                {branch.replace(/^origin\//, '')}
              </span>
            </>
          )}
        </div>
        {!!file && (
          <div className="flex h-6 pl-1 pr-2 items-center gap-1 bg-bg-shade rounded-full">
            <CodeStudioToken className="text-bg-danger" />
            <span className="caption text-label-title">
              {humanNumber(file?.contents?.length)}
            </span>
          </div>
        )}
      </div>
      <div className="py-4 px-4 overflow-auto flex flex-col">
        {!!file && (
          <CodeFullSelectable
            code={file.contents}
            language={file.lang}
            relativePath={filePath}
            containerWidth={window.innerWidth / 2 - HORIZONTAL_PADDINGS}
            containerHeight={
              window.innerHeight -
              HEADER_HEIGHT -
              SUBHEADER_HEIGHT -
              FOOTER_HEIGHT -
              VERTICAL_PADDINGS -
              BREADCRUMBS_HEIGHT
            }
            currentSelection={selectedLines}
            setCurrentSelection={setSelectedLines}
          />
        )}
      </div>
      {tipShown && (
        <div
          onClick={() => setTipShown(false)}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-full flex h-8 items-center gap-2 p-2 pr-2.5 border-bg-border bg-bg-base shadow-float caption text-label-title flex-shrink-0 w-fit select-none cursor-pointer"
        >
          <Fire />
          <Trans>Tip: Select code to create ranges for context use.</Trans>
        </div>
      )}
    </div>
  );
};

export default memo(FilePanel);
