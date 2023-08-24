import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import CodeStudioToken from '../../../icons/CodeStudioToken';
import Button from '../../../components/Button';
import { CodeStudioColored, PlusSignInCircle } from '../../../icons';
import KeyboardChip from '../KeyboardChip';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { StudioContextFile, StudioPanelDataType } from '../../../types/general';
import { RepositoriesContext } from '../../../context/repositoriesContext';
import ContextFileRow from './ContextFileRow';

type Props = {
  setLeftPanel: Dispatch<SetStateAction<StudioPanelDataType>>;
  setAddContextOpen: Dispatch<SetStateAction<boolean>>;
  studioId: string;
  contextFiles: StudioContextFile[];
  tokensTotal: number;
  tokensPerFile: number[];
  onFileRemove: (path: string, repo: string, branch: string) => void;
  onFileHide: (
    path: string,
    repo: string,
    branch: string,
    hide: boolean,
  ) => void;
};

const ContextPanel = ({
  setLeftPanel,
  setAddContextOpen,
  studioId,
  contextFiles,
  tokensTotal,
  tokensPerFile,
  onFileRemove,
  onFileHide,
}: Props) => {
  const { t } = useTranslation();
  const { repositories } = useContext(RepositoriesContext);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setAddContextOpen(true);
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  const handlePopupOpen = useCallback(() => setAddContextOpen(true), []);

  return (
    <div className="flex flex-col w-full flex-1">
      <div className="flex gap-1 px-8 justify-between items-center border-b border-bg-border bg-bg-shade shadow-low h-11.5">
        <div className="flex gap-1.5 items-center text-bg-border-hover select-none">
          <p className="body-s text-label-title">
            <Trans>Context files</Trans>
          </p>
          <CodeStudioToken />
          <p className="caption text-label-base">
            {t('# of #', { count: tokensTotal, total: '42,000' })}
          </p>
        </div>
        <Button size="small" onClick={handlePopupOpen}>
          <PlusSignInCircle />
          <Trans>Add file</Trans>
          <div className="flex items-center gap-1 flex-shrink-0">
            <KeyboardChip type="cmd" variant="primary" />
            <KeyboardChip type="K" variant="primary" />
          </div>
        </Button>
      </div>
      {!contextFiles.length ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-30 h-30">
            <CodeStudioColored />
          </div>
          <p className="body-m text-label-title mt-3">
            <Trans>Studio Projects</Trans>
          </p>
          <p className="body-s text-label-base max-w-[414px] text-center">
            <Trans>
              In Studio Projects you can use generative AI with a user defined
              context to get more accurate responses. Press{' '}
              <span className="inline-flex items-center gap-1 flex-shrink-0">
                <KeyboardChip type="cmd" />
                <KeyboardChip type="K" />
              </span>{' '}
              to search for a files or press{' '}
              <span className="bg-[linear-gradient(135deg,#C7363E_0%,#C7369E_100%)] rounded px-1 py-0.5 text-label-control text-[9px]">
                Open in Studio
              </span>{' '}
              when creating semantic searches to open in a Studio Project.
            </Trans>
          </p>
        </div>
      ) : (
        <div className="flex flex-col w-full">
          {contextFiles.map((f, i) => (
            <ContextFileRow
              key={f.repo + f.path}
              {...f}
              contextFiles={contextFiles}
              setLeftPanel={setLeftPanel}
              repoFull={repositories?.find((r) => r.ref === f.repo)}
              tokens={tokensPerFile[i]}
              onFileRemove={onFileRemove}
              onFileHide={onFileHide}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ContextPanel);
