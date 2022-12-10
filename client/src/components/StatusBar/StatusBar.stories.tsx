import StatusBar from './index';

export default {
  title: 'components/StatusBar',
  component: StatusBar,
};

export const StatusBarExample = () => {
  return (
    <div style={{ width: '100%', backgroundColor: '#fff' }}>
      <StatusBar />
    </div>
  );
};
