import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Skeleton from './index';

export default {
  title: 'pages/SkeletonResults',
  component: Skeleton,
  parameters: {
    layout: 'fullscreen',
  },
};

export const CodeResults = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route path="/" element={<Skeleton />} />
      </Routes>
    </MemoryRouter>
  );
};
