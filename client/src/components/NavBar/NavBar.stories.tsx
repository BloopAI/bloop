import { MemoryRouter } from 'react-router-dom';
import NavBar from './index';

export default {
  title: 'components/NavBar',
  component: NavBar,
};

export const IdeNavBar = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ width: '100%' }}>
        <NavBar userSigned />
        <br />
        <NavBar />
      </div>
    </MemoryRouter>
  );
};
