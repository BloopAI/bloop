import { useState } from 'react';
import { RepositoriesContext } from '../../context/repositoriesContext';
import { RepoProvider, RepoType, SyncStatus } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import Settings from './index';
import '../../index.css';

export default {
  title: 'components/Settings',
  component: Settings,
};

export const Default = () => {
  const [settingsSection, setSettingsSection] = useState(0);

  return (
    <div className="bg-gray-900">
      <UIContext.Provider
        value={{
          isSettingsOpen: true,
          settingsSection,
          setSettingsSection,
          setSettingsOpen: () => {},
          setSymbolsCollapsed: () => {},
          symbolsCollapsed: true,
          onBoardingState: {
            STEP_DATA_FORM: {
              firstName: 'Anastasiia',
              lastName: 'Solop',
              email: 'anastasiia@bloop.ai',
            },
          },
          setOnBoardingState: () => {},
          isBugReportModalOpen: false,
          setBugReportModalOpen: () => {},
          isGithubConnected: false,
          setGithubConnected: () => {},
          isGithubChecked: true,
          shouldShowWelcome: false,
          setShouldShowWelcome: () => {},
        }}
      >
        <RepositoriesContext.Provider
          value={{
            repositories: [],
            setRepositories: () => {},
            localSyncError: false,
            githubSyncError: false,
          }}
        >
          <Settings />
        </RepositoriesContext.Provider>
      </UIContext.Provider>
    </div>
  );
};

export const ScanErrors = () => {
  const [settingsSection, setSettingsSection] = useState(0);

  return (
    <div className="bg-gray-900">
      <UIContext.Provider
        value={{
          isSettingsOpen: true,
          settingsSection,
          setSettingsSection,
          setSettingsOpen: () => {},
          setSymbolsCollapsed: () => {},
          symbolsCollapsed: true,
          onBoardingState: {
            STEP_DATA_FORM: {
              firstName: 'Anastasiia',
              lastName: 'Solop',
              email: 'anastasiia@bloop.ai',
            },
          },
          setOnBoardingState: () => {},
          isBugReportModalOpen: false,
          setBugReportModalOpen: () => {},
          isGithubConnected: false,
          setGithubConnected: () => {},
          isGithubChecked: true,
          shouldShowWelcome: false,
          setShouldShowWelcome: () => {},
        }}
      >
        <RepositoriesContext.Provider
          value={{
            repositories: [],
            setRepositories: () => {},
            localSyncError: true,
            githubSyncError: true,
          }}
        >
          <Settings />
        </RepositoriesContext.Provider>
      </UIContext.Provider>
    </div>
  );
};

const mockRepos: RepoType[] = [
  {
    name: 'enterprise-search',
    ref: 'github.com/BloopAI/enterprise-search',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Done,
    provider: RepoProvider.GitHub,
    most_common_lang: 'TSX',
  },
  {
    name: 'bloop-website',
    ref: 'local//Projects/bloop-website',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Done,
    provider: RepoProvider.Local,
    most_common_lang: 'TSX',
  },
  {
    name: 'client-apps',
    ref: 'github.com/BloopAI/client-apps',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Done,
    provider: RepoProvider.GitHub,
    most_common_lang: 'TSX',
  },
  {
    name: 'prism-fork',
    ref: 'local//Projects/prism-fork',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Done,
    provider: RepoProvider.Local,
    most_common_lang: 'TSX',
  },
  {
    name: 'vscode-plugin',
    ref: 'local//Projects/vscode-plugin',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Done,
    provider: RepoProvider.Local,
    most_common_lang: 'TSX',
  },
  {
    name: 'webstorm-plugin',
    ref: 'github.com/BloopAI/webstorm-plugin',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Done,
    provider: RepoProvider.GitHub,
    most_common_lang: 'TSX',
  },
  {
    name: 'minecraft',
    ref: 'local//Project/minecraft',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Uninitialized,
    provider: RepoProvider.Local,
    most_common_lang: 'TSX',
  },
  {
    name: 'tetris-react',
    ref: 'github.com/anastasiya1155/tetris-react',
    local_duplicates: [],
    last_update: '2022-11-11T00:00:00Z',
    last_index: '2022-11-11T00:00:00Z',
    sync_status: SyncStatus.Uninitialized,
    provider: RepoProvider.GitHub,
    most_common_lang: 'TSX',
  },
];

export const EmailConfirmedReposSynced = () => {
  const [settingsSection, setSettingsSection] = useState(0);
  return (
    <div className="bg-gray-900">
      <UIContext.Provider
        value={{
          isSettingsOpen: true,
          settingsSection,
          setSettingsSection,
          setSettingsOpen: () => {},
          setSymbolsCollapsed: () => {},
          symbolsCollapsed: true,
          onBoardingState: {
            STEP_DATA_FORM: {
              firstName: 'Anastasiia',
              lastName: 'Solop',
              email: 'anastasiia@bloop.ai',
            },
          },
          setOnBoardingState: () => {},
          isBugReportModalOpen: false,
          setBugReportModalOpen: () => {},
          isGithubConnected: true,
          setGithubConnected: () => {},
          isGithubChecked: true,
          shouldShowWelcome: false,
          setShouldShowWelcome: () => {},
        }}
      >
        <RepositoriesContext.Provider
          value={{
            repositories: mockRepos as any,
            setRepositories: () => {},
            localSyncError: false,
            githubSyncError: false,
          }}
        >
          <Settings />
        </RepositoriesContext.Provider>
      </UIContext.Provider>
    </div>
  );
};
