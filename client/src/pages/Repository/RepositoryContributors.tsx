import { useState } from 'react';
import TextInput from '../../components/TextInput';
import Tabs from '../../components/Tabs';

enum Mode {
  ALL,
  ACTIVE,
  STALE,
}

type Contributor = {
  name: string;
  image: string;
  commits: number;
  additions: number;
  deletions: number;
};

type Props = {
  contributors: Contributor[];
};

const RepositoryContributors = ({ contributors }: Props) => {
  const [currentTab, setCurrentTab] = useState<Mode>(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-between ">
        <span className="w-1/2">
          <TextInput
            value={''}
            onChange={() => {}}
            name={'Search'}
            placeholder={'Search branches'}
          />
        </span>
        <span className="w-1/2 pl-12">
          <Tabs
            activeTab={currentTab}
            onTabChange={setCurrentTab}
            size={'medium'}
            fullWidth
            tabs={[
              { title: 'All' },
              { title: 'Additions' },
              { title: 'Deletions' },
            ]}
            variant={'button'}
            divider
          />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col divide-gray-700 divide-gray-700 divide-y rounded border border-gray-700">
          {contributors.map((contributor, id) => (
            <span
              key={id}
              className="flex flex-row px-2 py-2 items-center bg-gray-900 first:rounded-t last:rounded-b"
            >
              <span className="flex flex-row w-1/2 items-center gap-2">
                <span className="w-8 cursor-pointer select-none">
                  <img src={contributor.image} alt="" />
                </span>
                <span className="flex flex-col">
                  <span className="cursor-pointer hover:underline">
                    {contributor.name}
                  </span>
                  <span className="text-xs text-gray-500 select-none">
                    {contributor.commits} commits
                  </span>
                </span>
              </span>
              <span className="text-sm flex flex-row gap-2 select-none">
                <span className="text-success-700">
                  {contributor.additions}++
                </span>
                <span className="text-danger-700">
                  {contributor.additions}--
                </span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
export default RepositoryContributors;
