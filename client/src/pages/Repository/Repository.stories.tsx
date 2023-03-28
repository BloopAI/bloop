import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { codeSearch } from '../../mocks/api_mocks';
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
          element={<RepositoryPage repositoryData={codeSearch as any} />}
        />
      </Routes>
    </MemoryRouter>
  );
};
