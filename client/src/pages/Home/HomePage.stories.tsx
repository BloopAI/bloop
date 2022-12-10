import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomePage from './index';
import '../../index.css';

export default {
  title: 'pages/HomePage',
  component: HomePage,
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </MemoryRouter>
  );
};

export const NoRepos = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route path="/" element={<HomePage emptyRepos />} />
      </Routes>
    </MemoryRouter>
  );
};
