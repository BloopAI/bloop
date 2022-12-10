import ContributionsChart from '../ContributionsChart';

type Props = {
  userImage: string;
  name: string;
  commits: number;
  additions: number;
  deletions: number;
};

const UserContributionsChart = ({
  userImage,
  name,
  commits,
  deletions,
  additions,
}: Props) => {
  return (
    <div className="flex flex-col rounded border border-gray-700 w-full">
      <span className="flex flex-row gap-3 items-center p-3">
        <img src={userImage} className="w-8 h-8 rounded-xl" alt="" />
        <span className="flex flex-col">
          <span>{name}</span>
          <span className="flex flex-row gap-2">
            <span className="text-gray-500">{commits} commits</span>
            <span className="text-success-700">{additions}++</span>
            <span className="text-danger-700">{deletions}--</span>
          </span>
        </span>
      </span>
      <ContributionsChart variant="red" />
      <div></div>
    </div>
  );
};
export default UserContributionsChart;
