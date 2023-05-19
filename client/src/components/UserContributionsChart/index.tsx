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
    <div className="flex flex-col rounded border border-bg-border w-full">
      <span className="flex flex-row gap-3 items-center p-3">
        <img src={userImage} className="w-8 h-8 rounded-xl" alt="" />
        <span className="flex flex-col">
          <span>{name}</span>
          <span className="flex flex-row gap-2">
            <span className="text-label-muted">{commits} commits</span>
            <span className="text-bg-success">{additions}++</span>
            <span className="text-bg-danger">{deletions}--</span>
          </span>
        </span>
      </span>
      <ContributionsChart variant="red" />
      <div></div>
    </div>
  );
};
export default UserContributionsChart;
