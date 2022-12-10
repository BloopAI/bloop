import React, { useState } from 'react';
import { RepoProvider, RepoUi, SyncStatus } from '../../types/general';
import Tabs from '../Tabs';
import RepoList from './index';
import '../../index.css';

export default {
  title: 'components/RepoList',
  component: RepoList,
};

const mockRepos = [
  {
    provider: RepoProvider.GitHub,
    name: 'anastasiya1155/random-number-client',
    ref: 'github.com/anastasiya1155/random-number-client',
    local_duplicates: [],
    sync_status: SyncStatus.Uninitialized,
    last_update: '2019-10-23T13:08:30Z',
    last_index: '2019-10-23T13:08:30Z',
    selected: true,
    folderName: 'anastasiya1155',
    shortName: 'random-number-client',
    most_common_lang: 'TSX',
  },
  {
    provider: RepoProvider.GitHub,
    name: 'anastasiya1155/react-electron-todo-list',
    ref: 'github.com/anastasiya1155/react-electron-todo-list',
    local_duplicates: ['local//Users/anastasiia/Projects/electron-todo-list'],
    sync_status: SyncStatus.Uninitialized,
    last_update: '2022-08-18T04:18:13Z',
    last_index: '2022-08-18T04:18:13Z',
    selected: true,
    folderName: 'anastasiya1155',
    shortName: 'react-electron-todo-list',
    most_common_lang: 'TSX',
  },
  {
    provider: RepoProvider.GitHub,
    name: 'anastasiya1155/react-nodegui-todo-list',
    ref: 'github.com/anastasiya1155/react-nodegui-todo-list',
    local_duplicates: [
      'local//Users/anastasiia/Projects/react-nodegui-todo-list',
    ],
    sync_status: SyncStatus.Uninitialized,
    last_update: '2022-08-16T09:40:01Z',
    last_index: '2022-08-16T09:40:01Z',
    selected: true,
    folderName: 'anastasiya1155',
    shortName: 'react-nodegui-todo-list',
    most_common_lang: 'TSX',
  },
  {
    provider: RepoProvider.GitHub,
    name: 'anastasiya1155/rocket-todo-app',
    ref: 'github.com/anastasiya1155/rocket-todo-app',
    local_duplicates: ['local//Users/anastasiia/Projects/rocket-app'],
    sync_status: SyncStatus.Uninitialized,
    last_update: '2022-09-19T06:58:49Z',
    last_index: '2022-09-19T06:58:49Z',
    selected: true,
    folderName: 'anastasiya1155',
    shortName: 'rocket-todo-app',
    most_common_lang: 'TSX',
  },
  {
    provider: RepoProvider.GitHub,
    name: 'anastasiya1155/search-job-helper-be',
    ref: 'github.com/anastasiya1155/search-job-helper-be',
    local_duplicates: [
      'local//Users/anastasiia/Projects/search-job-helper/search-job-helper-be',
    ],
    sync_status: SyncStatus.Uninitialized,
    last_update: '2022-10-12T19:04:16Z',
    last_index: '2022-10-12T19:04:16Z',
    selected: true,
    folderName: 'anastasiya1155',
    shortName: 'search-job-helper-be',
    most_common_lang: 'TSX',
  },
];
const tabs = [{ title: 'Sync all repos' }, { title: 'Sync selected repos' }];

export const Default = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [repos, setRepos] = useState<RepoUi[]>(mockRepos);
  return (
    <div className="bg-gray-900 max-w-md2 p-6 w-full">
      <div className="flex flex-col overflow-auto">
        <div className="overflow-hidden flex-shrink-0">
          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
            variant="button"
            fullWidth
          />
        </div>
        <RepoList
          repos={repos}
          setRepos={setRepos}
          source="local"
          activeTab={activeTab}
        />
      </div>
    </div>
  );
};
