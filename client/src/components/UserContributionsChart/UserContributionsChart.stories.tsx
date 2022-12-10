import UserContributionsChart from './index';

export default {
  title: 'components/UserContributionsChart',
  component: UserContributionsChart,
};

export const UserContributionsChartDefault = () => {
  return (
    <div style={{ width: '600px', backgroundColor: '', padding: '10px' }}>
      <UserContributionsChart
        commits={1200}
        userImage="/avatar.png"
        additions={11203}
        name="John Doe"
        deletions={22134}
      />
    </div>
  );
};
