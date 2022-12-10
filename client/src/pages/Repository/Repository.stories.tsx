import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { mockRepo } from '../../mocks';
import RepositoryPage from './index';

export default {
  title: 'pages/RepositoryPage',
  component: RepositoryPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export const RepositoryView = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route
          path="/"
          element={<RepositoryPage repository={mockRepo} sidebarOpen={false} />}
        />
      </Routes>
    </MemoryRouter>
  );
};
