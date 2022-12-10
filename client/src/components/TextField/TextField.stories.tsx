import { Version, Branch } from '../../icons';
import TextField from './index';
import '../../index.css';

export default {
  title: 'components/TextField',
  component: TextField,
};

export const GitBranch = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextField value={'test/main'} icon={<Branch />} active />
    </div>
  );
};

export const RepoVersion = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <TextField value={'2.3'} icon={<Version />} active />
    </div>
  );
};
