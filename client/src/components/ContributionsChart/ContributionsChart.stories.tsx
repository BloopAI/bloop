import ContributionsChart from './index';

export default {
  title: 'components/ContributionsChart',
  component: ContributionsChart,
};

export const ContributionsChartDefault = () => {
  return (
    <div style={{ width: '600px', backgroundColor: '', padding: '10px' }}>
      <ContributionsChart variant={'green'} border />
    </div>
  );
};
