import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CloseSign, PlusSignInCircle } from '../../icons';
import SeparateOnboardingStep from '../SeparateOnboardingStep';
import DialogText from '../../pages/Onboarding/DialogText';
import SearchableRepoList from '../RepoList/SearchableRepoList';
import Button from '../Button';
import { CodeStudioType } from '../../types/api';
import {
  getCodeStudio,
  getCodeStudios,
  importCodeStudio,
  patchCodeStudio,
  postCodeStudio,
} from '../../services/api';
import Tooltip from '../Tooltip';
import { UIContext } from '../../context/uiContext';
import { SearchContext } from '../../context/searchContext';
import { TabsContext } from '../../context/tabsContext';

type Props =
  | {
      filePath: string;
      threadId?: never;
      name?: never;
    }
  | { threadId: string; filePath?: never; name: string };

const AddStudioContext = ({ filePath, threadId, name }: Props) => {
  const { t } = useTranslation();
  const { tab } = useContext(UIContext.Tab);
  const { handleAddStudioTab } = useContext(TabsContext);
  const { selectedBranch } = useContext(SearchContext.SelectedBranch);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [studios, setStudios] = useState<CodeStudioType[]>([]);

  const refetchStudios = useCallback(() => {
    return getCodeStudios().then(setStudios);
  }, []);

  useEffect(() => {
    refetchStudios().finally(() => setLoading(false));
  }, [isOpen]);

  const onSubmit = useCallback(
    async (studioId?: string) => {
      setIsSubmitting(true);
      if (filePath) {
        if (studioId) {
          try {
            const studio = await getCodeStudio(studioId);
            const exists = studio.context.find(
              (f) =>
                f.path === filePath &&
                f.repo === tab.repoRef &&
                f.branch === selectedBranch,
            );
            if (!exists) {
              await patchCodeStudio(studioId, {
                context: [
                  ...studio.context,
                  {
                    path: filePath,
                    repo: tab.repoRef,
                    branch: selectedBranch,
                    ranges: [],
                    hidden: false,
                  },
                ],
              });
            }
            handleAddStudioTab(studio.name, studioId);
          } catch (err) {
            console.log(err);
          }
        } else {
          const exising = studios
            .filter((s) => s.name.startsWith('New Code Studio'))
            .sort((a, b) => a.name.localeCompare(b.name));
          const lastNum = Number(
            exising[exising.length - 1]?.name.split('#').pop() || 0,
          );
          const name = `New Code Studio${
            exising.length ? ` #${Number.isNaN(lastNum) ? 1 : lastNum + 1}` : ''
          }`;
          const id = await postCodeStudio(name);
          handleAddStudioTab(name, id);
          refetchStudios();
        }
      } else if (threadId) {
        const id = await importCodeStudio(threadId);
        handleAddStudioTab(name, id);
        refetchStudios();
      }
      setIsSubmitting(false);
      setIsOpen(false);
    },
    [filePath, tab.repoRef, selectedBranch, studios, threadId, name],
  );

  return (
    <div>
      <Tooltip
        text={t(
          filePath
            ? 'Add to Studio context'
            : 'Create new Studio Project with context',
        )}
        placement={filePath ? 'bottom-end' : 'top-end'}
      >
        <button
          className={`flex items-center justify-center shadow-low ${
            !!filePath ? 'w-6 h-6 rounded' : 'w-7 h-7 rounded-full'
          } bg-studio`}
          onClick={() => setIsOpen(true)}
        >
          <PlusSignInCircle raw sizeClassName="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <SeparateOnboardingStep
        isVisible={isOpen}
        onClose={() => setIsOpen(false)}
        noWrapper
      >
        <div
          className={`p-6 flex flex-col gap-8 w-99 relative flex-1 overflow-auto ${
            isSubmitting ? 'opacity-50 pointer-events-none' : ''
          } transition-all duration-150 ease-in-out`}
        >
          <div className="absolute top-2 right-2">
            <Button
              variant="tertiary"
              size="small"
              onClick={() => setIsOpen(false)}
              onlyIcon
              title={t('Close')}
            >
              <CloseSign />
            </Button>
          </div>
          <DialogText
            title={t('Add context')}
            description={t(
              'Add context in a new Studio project or add it to an existing one.',
            )}
          />
          <div className="flex flex-col overflow-auto">
            <SearchableRepoList
              items={studios}
              type="studio"
              isLoading={isLoading}
              onSync={onSubmit}
            />
          </div>
          <button
            className="body-s text-bg-main hover:text-bg-main-hover"
            onClick={() => onSubmit()}
          >
            <Trans>New Studio Project</Trans>
          </button>
        </div>
      </SeparateOnboardingStep>
    </div>
  );
};

export default memo(AddStudioContext);
