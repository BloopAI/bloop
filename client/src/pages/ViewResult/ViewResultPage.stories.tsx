import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ViewResultPage from './index';
import '../../index.css';

export default {
  title: 'pages/ViewResultPage',
  component: ViewResultPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export const Default = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route path="/" element={<ViewResultPage />} />
      </Routes>
    </MemoryRouter>
  );
};
