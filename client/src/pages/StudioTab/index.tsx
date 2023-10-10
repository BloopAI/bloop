import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StudioTabType, SyncStatus } from '../../types/general';
import { StudioContextProvider } from '../../context/providers/StudioContextProvider';
import { CodeStudioType } from '../../types/api';
import { getCodeStudio } from '../../services/api';
import { TabsContext } from '../../context/tabsContext';
import { RepositoriesContext } from '../../context/repositoriesContext';
import Content from './Content';

type Props = {
  isActive: boolean;
  isTransitioning: boolean;
  tab: StudioTabType;
};

const emptyCodeStudio: CodeStudioType = {
  messages: [],
  context: [],
  token_counts: { total: 0, per_file: [], messages: 0, baseline: 0 },
  name: '',
  id: '',
  modified_at: '',
};

const StudioTab = ({ isActive, tab, isTransitioning }: Props) => {
  const { updateTabName } = useContext(TabsContext);
  const { repositories } = useContext(RepositoriesContext);
  const [currentContext, setCurrentContext] = useState<
    CodeStudioType['context']
  >([]);
  const [currentMessages, setCurrentMessages] = useState<
    CodeStudioType['messages']
  >([]);
  const [currentTokenCounts, setCurrentTokenCounts] = useState<
    CodeStudioType['token_counts']
  >(emptyCodeStudio.token_counts);
  const [isLoaded, setIsLoaded] = useState(false);

  const refetchCodeStudio = useCallback(
    async (keyToUpdate?: keyof CodeStudioType) => {
      if (tab.key) {
        const resp = await getCodeStudio(tab.key);
        updateTabName(tab.key, resp.name);
        setIsLoaded(true);
        if (keyToUpdate) {
          if (keyToUpdate === 'token_counts') {
            setCurrentTokenCounts((prev) => {
              if (JSON.stringify(resp) === JSON.stringify(prev)) {
                return prev;
              }
              return resp.token_counts;
            });
          }
        } else {
          setCurrentTokenCounts((prev) => {
            if (JSON.stringify(resp) === JSON.stringify(prev)) {
              return prev;
            }
            return resp.token_counts;
          });
          setCurrentContext((prev) => {
            if (JSON.stringify(resp) === JSON.stringify(prev)) {
              return prev;
            }
            return resp.context;
          });
          setCurrentMessages((prev) => {
            if (JSON.stringify(resp) === JSON.stringify(prev)) {
              return prev;
            }
            return resp.messages;
          });
        }
      }
    },
    [tab.key],
  );

  const indexingRepos = useMemo(() => {
    const usedRepos =
      repositories?.filter((r) =>
        currentContext.find((f) => f.repo === r.ref),
      ) || [];
    return JSON.stringify(
      usedRepos
        .filter((r) =>
          [SyncStatus.Indexing, SyncStatus.Syncing, SyncStatus.Queued].includes(
            r.sync_status,
          ),
        )
        .map((r) => r.ref),
    );
  }, [repositories, currentContext]);

  useEffect(() => {
    if (isActive) {
      refetchCodeStudio();
    }
  }, [isActive, refetchCodeStudio]);

  useEffect(() => {
    if (isActive && indexingRepos === '[]' && isLoaded) {
      refetchCodeStudio('token_counts');
    }
  }, [indexingRepos]);

  return (
    <div
      className={`${isActive ? '' : 'hidden'} ${
        isTransitioning ? 'opacity-70' : 'opacity-100'
      }`}
      data-active={isActive ? 'true' : 'false'}
    >
      <StudioContextProvider>
        <Content
          tab={tab}
          isActive={isActive}
          refetchCodeStudio={refetchCodeStudio}
          currentContext={currentContext}
          currentMessages={currentMessages}
          currentTokenCounts={currentTokenCounts}
        />
      </StudioContextProvider>
    </div>
  );
};

export default memo(StudioTab);
