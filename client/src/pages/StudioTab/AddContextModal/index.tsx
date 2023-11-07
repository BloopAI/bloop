import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import SeparateOnboardingStep from '../../../components/SeparateOnboardingStep';
import KeyboardChip from '../KeyboardChip';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import { Branch, Paper, RepositoryFilled } from '../../../icons';
import { RepoType, StudioContextFile } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import { UIContext } from '../../../context/uiContext';
import StepItem from './StepItem';
import SelectRepo from './SelectRepo';
import SelectBranch from './SelectBranch';
import SelectFile from './SelectFile';

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (
    repo: RepoType,
    branch: string,
    filePath: string,
    isMultiSelect?: boolean,
  ) => void;
  contextFiles: StudioContextFile[];
};

const AddContextModal = ({
  isVisible,
  onClose,
  onSubmit,
  contextFiles,
}: Props) => {
  const { t } = useTranslation();
  const { isSelfServe } = useContext(DeviceContext);
  const [step, setStep] = useState(0);
  const [selectedRepo, setSelectedRepo] = useState<RepoType | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [search, setSearch] = useState('');
  const [canSkipRepo, setCanSkipRepo] = useState(true);
  const { setCloudFeaturePopupOpen } = useContext(UIContext.CloudFeaturePopup);

  const handleKeyEvent = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, []);
  useKeyboardNavigation(handleKeyEvent);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleRepoSubmit = useCallback((repo: RepoType) => {
    setSelectedRepo(repo);
    setSearch('');
    setStep(1);
  }, []);

  const handleBranchSubmit = useCallback((branch: string) => {
    setSelectedBranch(branch);
    setSearch('');
    setStep(2);
  }, []);

  const handleFileSubmit = useCallback(
    (file: string, isMultiSelect?: boolean) => {
      onSubmit(selectedRepo!, selectedBranch, file, isMultiSelect);
      if (!isMultiSelect) {
        onClose();
      }
    },
    [selectedRepo, selectedBranch, onSubmit],
  );

  return (
    <SeparateOnboardingStep isVisible={isVisible} onClose={onClose} noWrapper>
      <div className="flex flex-col w-[38.75rem] relative flex-1 overflow-auto">
        <div className="flex flex-col gap-3 items-start w-full border-b border-bg-border-hover py-3 px-4">
          <div className="flex items-center gap-0.5">
            <StepItem text={t('Add context file')} />
            {!!selectedRepo && (
              <StepItem
                text={selectedRepo.name.replace(/^github\.com\//, '')}
                icon={<RepositoryFilled raw sizeClassName="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedRepo(null);
                  setSelectedBranch('');
                  setSearch('');
                  setCanSkipRepo(false);
                  setStep(0);
                }}
              />
            )}
            {!!selectedBranch && (
              <StepItem
                text={selectedBranch.replace(/^origin\//, '')}
                icon={<Branch sizeClassName="w-3.5 h-3.5" />}
                onClick={() => {
                  if (isSelfServe) {
                    setSelectedBranch('');
                    setSearch('');
                    setStep(1);
                  } else {
                    setCloudFeaturePopupOpen(true);
                  }
                }}
              />
            )}
            <StepItem
              text={t(
                step === 0
                  ? 'Select repository'
                  : step === 1
                  ? 'Select branch'
                  : 'Select file',
              )}
              icon={
                <span className="inline-block w-3.5 h-3.5">
                  {step === 0 ? (
                    <RepositoryFilled raw />
                  ) : step === 1 ? (
                    <Branch />
                  ) : (
                    <Paper raw />
                  )}
                </span>
              }
            />
          </div>
          <input
            key={step}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            className="w-full bg-transparent outline-none focus:outline-0 body-m placeholder:text-label-muted"
            value={search}
            onChange={handleSearchChange}
            placeholder={t(
              step === 0
                ? 'Search repository...'
                : step === 1
                ? 'Search branch...'
                : 'Search file...',
            )}
            autoFocus
          />
        </div>
        <div className="flex max-h-72 overflow-auto px-1 py-3 flex-col items-start gap-1">
          {step === 0 ? (
            <SelectRepo
              search={search}
              onSubmit={handleRepoSubmit}
              contextFiles={contextFiles}
              canSkip={canSkipRepo}
            />
          ) : step === 1 ? (
            <SelectBranch
              onSubmit={handleBranchSubmit}
              search={search}
              repo={selectedRepo!}
            />
          ) : (
            <SelectFile
              search={search}
              repo={selectedRepo!}
              branch={selectedBranch}
              onSubmit={handleFileSubmit}
              filterOutFiles={contextFiles}
            />
          )}
        </div>
        <div className="flex justify-between items-center gap-1 py-3 px-4 border-t border-bg-border bg-bg-base">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <KeyboardChip type="Esc" />
              <span className="caption text-label-base">
                <Trans>Close</Trans>
              </span>
            </div>
            {step === 2 && (
              <>
                <div className="h-3.5 w-px bg-bg-border flex-shrink-0" />
                <span className="caption text-label-base flex items-center gap-1">
                  <Trans>
                    Hold <KeyboardChip type="⇧" /> to add multiple files
                  </Trans>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <KeyboardChip type="↑" />
            <KeyboardChip type="↓" />
            <span className="caption text-label-base">
              <Trans>Navigate</Trans>
            </span>
          </div>
        </div>
      </div>
    </SeparateOnboardingStep>
  );
};

export default memo(AddContextModal);
