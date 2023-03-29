import React from 'react';
import Dropdown from '../Dropdown/Normal';
import { MenuItemType } from '../../types/general';
import ContributionsChart from '../ContributionsChart';
import UserContributionsChart from '../UserContributionsChart';

const Contributors = () => {
  return (
    <div
      className={`flex px-2 py-4 bg-gray-900 h-[calc(100vh-15rem)] overflow-y-auto p-3 pr-12`}
    >
      <div className="flex flex-col gap-5 w-full">
        <div className="flex flex-row justify-between items-center pt-4">
          <span className="flex flex-col">
            <span className="text-lg">Jan 8,2017 - Oct 19,2020</span>
            <span className="text-sm text-gray-500">
              View the contributions to this file from the moment it was created
            </span>
          </span>
          <Dropdown
            items={[
              { text: 'Commits', type: MenuItemType.LINK },
              { text: 'Additions', type: MenuItemType.LINK },
              { text: 'Deletions', type: MenuItemType.LINK },
            ]}
            btnHint="Contributions:"
          />
        </div>
        <ContributionsChart variant="green" border />
        <div className="flex flex-row gap-5 justify-between">
          <UserContributionsChart
            userImage={'/avatar.png'}
            name={'John Doe'}
            commits={2234}
            additions={2211}
            deletions={3321}
          />
          <UserContributionsChart
            userImage={'avatar.png'}
            name={'John Doe'}
            commits={1731}
            additions={2214}
            deletions={4412}
          />
        </div>
      </div>
    </div>
  );
};

export default Contributors;
