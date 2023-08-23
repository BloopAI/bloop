import { Dispatch, memo, SetStateAction, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../../components/Button';
import {
  RepoType,
  StudioLeftPanelType,
  StudioPanelDataType,
} from '../../../types/general';
import { ArrowLeft, Branch, CursorSelection, Fire } from '../../../icons';
import FileIcon from '../../../components/FileIcon';
import { search } from '../../../services/api';
import { buildRepoQuery, getFileExtensionForLang } from '../../../utils';
import { File } from '../../../types/api';
import CodeFullSelectable from '../../../components/CodeBlock/CodeFullSelectable';
import LinesBadge from '../LinesBadge';
import TokensUsageBadge from '../TokensUsageBadge';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  filePath: string;
  branch: string;
  repo: RepoType;
  initialRanges?: [number, number][];
};

const HEADER_HEIGHT = 32;
const SUBHEADER_HEIGHT = 46;
const FOOTER_HEIGHT = 64;
const VERTICAL_PADDINGS = 32;
const HORIZONTAL_PADDINGS = 32;
const BREADCRUMBS_HEIGHT = 41;

const FilePanel = ({
  setLeftPanel,
  filePath,
  branch,
  repo,
  initialRanges,
}: Props) => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [selectedLines, setSelectedLines] = useState<
    ([number, number] | [number])[]
  >(initialRanges || []);

  useEffect(() => {
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
          <p className="body-s-strong text-label-title ellipsis">
            {filePath.split('/').pop()}
          </p>
          <LinesBadge ranges={selectedLines} />
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
        {!!file && <TokensUsageBadge tokens={file?.contents?.length} />}
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
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 rounded-full flex h-8 items-center gap-2 p-2 pr-2.5 border border-bg-border bg-bg-base shadow-float caption text-label-title flex-shrink-0 w-fit">
        {!selectedLines.length ? <Fire /> : <CursorSelection />}
        <p className="pointer-events-none select-none cursor-default">
          {!selectedLines.length ? (
            <Trans>Tip: Select code to create ranges for context use.</Trans>
          ) : selectedLines.length === 1 && selectedLines[0].length === 2 ? (
            <Trans
              values={{
                start: selectedLines[0][0] + 1,
                end: selectedLines[0][1] + 1,
              }}
            >
              Only the selected lines (# - #) will be used as context.
            </Trans>
          ) : (
            <Trans>Only the selected ranges will be used as context.</Trans>
          )}
        </p>
        {!!selectedLines.length && (
          <Button
            variant="tertiary"
            size="tiny"
            onClick={() => setSelectedLines([])}
          >
            <Trans>Clear ranges</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(FilePanel);
