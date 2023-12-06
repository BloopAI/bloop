import {
  memo,
  useCallback,
  useContext,
  useRef,
  useState,
  MouseEvent,
  ChangeEvent,
  useMemo,
  useEffect,
} from 'react';
import { useTranslation } from 'react-i18next';
import DropdownSection from '../../../components/Dropdown/Section';
import SectionItem from '../../../components/Dropdown/Section/SectionItem';
import {
  ArrowTriangleBottomIcon,
  BranchIcon,
  RefreshIcon,
  TrashCanIcon,
} from '../../../icons';
import {
  indexRepoBranch,
  removeRepoFromProject,
  syncRepo,
} from '../../../services/api';
import { SyncStatus } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import SpinLoaderContainer from '../../../components/Loaders/SpinnerLoader';
import SectionLabel from '../../../components/Dropdown/Section/SectionLabel';
import Button from '../../../components/Button';
import { ProjectContext } from '../../../context/projectContext';
import { PersonalQuotaContext } from '../../../context/personalQuotaContext';

type Props = {
  repoRef: string;
  projectId: string;
  selectedBranch?: string | null;
  allBranches: { name: string; last_commit_unix_secs: number }[];
  indexedBranches: string[];
};

const RepoDropdown = ({
  repoRef,
  selectedBranch,
  indexedBranches,
  allBranches,
  projectId,
}: Props) => {
  const { t } = useTranslation();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [branchesToSync, setBranchesToSync] = useState<string[]>([]);
  const [indexing, setIndexing] = useState({ branch: '', percentage: 0 });
  const { apiUrl, isSelfServe } = useContext(DeviceContext);
  const { refreshCurrentProjectRepos } = useContext(ProjectContext.Current);
  const { isSubscribed } = useContext(PersonalQuotaContext.Values);

  const startEventSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = new EventSource(
      `${apiUrl.replace('https:', '')}/repos/status`,
    );
    eventSourceRef.current.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log('data', data);
        if (data.ev?.status_change && data.ref === repoRef) {
          if (data.ev?.status_change === SyncStatus.Done) {
            setIsSyncing(false);
            refreshCurrentProjectRepos();
          }
        }
        if (data.ev?.index_percent && data.b?.select[0]) {
          setIndexing(() => ({
            branch: data.b?.select[0],
            percentage: data.ev?.index_percent || 1,
          }));
        }
      } catch {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
      }
    };
    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [repoRef]);

  useEffect(() => {
    if (!branchesToSync.length) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    }
  }, [branchesToSync]);

  const onRepoSync = useCallback(
    async (e?: MouseEvent) => {
      e?.stopPropagation();
      await syncRepo(repoRef);
      setIsSyncing(true);
      startEventSource();
    },
    [repoRef],
  );

  const toggleBranches = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
    setIsBranchesOpen((prev) => !prev);
  }, []);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const noPropagate = useCallback((e?: MouseEvent) => {
    e?.stopPropagation();
  }, []);

  useEffect(() => {
    setBranchesToSync((prevState) =>
      prevState.filter((p) => !indexedBranches.includes(p)),
    );
  }, [indexedBranches]);

  const notSyncedBranches = useMemo(() => {
    return [...allBranches]
      .reverse()
      .filter(
        (b) =>
          !indexedBranches.includes(b.name) && !branchesToSync.includes(b.name),
      )
      .map((b) => b.name);
  }, [indexedBranches, allBranches, branchesToSync]);

  const handleRemoveFromProject = useCallback(async () => {
    if (projectId) {
      await removeRepoFromProject(projectId, repoRef);
      refreshCurrentProjectRepos();
    }
  }, [projectId, repoRef]);

  const indexedBranchesToShow = useMemo(() => {
    if (!search) {
      return indexedBranches;
    }
    return indexedBranches.filter((b) =>
      b
        .replace(/^origin\//, '')
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [indexedBranches, search]);

  const indexingBranchesToShow = useMemo(() => {
    if (!search) {
      return branchesToSync;
    }
    return branchesToSync.filter((b) =>
      b
        .replace(/^origin\//, '')
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [branchesToSync, search]);

  const notIndexedBranchesToShow = useMemo(() => {
    if (!search) {
      return notSyncedBranches;
    }
    return notSyncedBranches.filter((b) =>
      b
        .replace(/^origin\//, '')
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [notSyncedBranches, search]);

  const switchToBranch = useCallback(
    (branch: string, e?: MouseEvent) => {
      e?.stopPropagation();
      // addRepoToProject(projectId, repoRef, branch);
      // refreshCurrentProjectRepos();
    },
    [projectId, repoRef],
  );

  return (
    <div onClick={noPropagate}>
      <DropdownSection borderBottom>
        <SectionItem
          onClick={onRepoSync}
          label={t('Re-sync')}
          icon={
            isSyncing ? (
              <SpinLoaderContainer sizeClassName="w-4 h-4" />
            ) : (
              <RefreshIcon sizeClassName="w-4 h-4" />
            )
          }
        />
        {(isSelfServe || isSubscribed) && (
          <SectionItem
            onClick={toggleBranches}
            label={t('Branches')}
            icon={<BranchIcon sizeClassName="w-4 h-4" />}
            customRightElement={
              <span className="body-s text-label-muted">
                {selectedBranch}
                <ArrowTriangleBottomIcon
                  sizeClassName="w-2 h-2"
                  className={`ml-2 ${
                    isBranchesOpen ? 'rotate-180' : 'rotate-0'
                  } transition-transform duration-150 ease-in-out`}
                />
              </span>
            }
          />
        )}
      </DropdownSection>
      <div
        style={{
          maxHeight: isBranchesOpen ? undefined : 0,
        }}
        className="overflow-hidden"
      >
        <DropdownSection borderBottom>
          <input
            value={search}
            name={'search'}
            placeholder={t('Search branches...')}
            onChange={handleInputChange}
            className="px-2 bg-transparent h-8 rounded focus:outline-0 focus:outline-none"
            autoFocus
            type="search"
            autoComplete="off"
          />
        </DropdownSection>
        {!!indexedBranchesToShow.length && (
          <DropdownSection borderBottom>
            <SectionLabel text={t('Synced')} />
            {indexedBranchesToShow.map((b) => (
              <SectionItem
                onClick={(e) => switchToBranch(b, e)}
                label={b.replace(/^origin\//, '')}
                icon={<BranchIcon sizeClassName="w-4 h-4" />}
                key={b}
                isSelected={selectedBranch === b}
              />
            ))}
          </DropdownSection>
        )}
        {!!indexingBranchesToShow.length && (
          <DropdownSection borderBottom>
            <SectionLabel text={t('Syncing')} />
            {indexingBranchesToShow.map((b) => (
              <SectionItem
                onClick={noPropagate}
                icon={<SpinLoaderContainer sizeClassName="w-4 h-4" />}
                label={b.replace(/^origin\//, '')}
                key={b}
                customRightElement={
                  <span className="text-label-muted body-s">
                    {indexing.branch === b
                      ? indexing.percentage + '%'
                      : t('Queued...')}
                  </span>
                }
              />
            ))}
          </DropdownSection>
        )}
        {!!notIndexedBranchesToShow.length && (
          <DropdownSection borderBottom>
            <SectionLabel text={t('Not synced')} />
            {notIndexedBranchesToShow.map((b) => (
              <SectionItem
                onClick={noPropagate}
                label={b.replace(/^origin\//, '')}
                key={b}
                icon={<BranchIcon sizeClassName="w-4 h-4" />}
                customRightElement={
                  <Button
                    variant="secondary"
                    size="mini"
                    onClick={async () => {
                      setBranchesToSync((prev) => [...prev, b]);
                      await indexRepoBranch(repoRef, b);
                      startEventSource();
                    }}
                  >
                    {t('Sync')}
                  </Button>
                }
              />
            ))}
          </DropdownSection>
        )}
      </div>
      <DropdownSection>
        <SectionItem
          onClick={handleRemoveFromProject}
          label={t('Remove from project')}
          icon={<TrashCanIcon sizeClassName="w-4 h-4" />}
        />
      </DropdownSection>
    </div>
  );
};

export default memo(RepoDropdown);
