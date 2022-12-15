import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Index from './Skeleton';

export default {
  title: 'pages/SkeletonResults',
  component: Index,
  parameters: {
    layout: 'fullscreen',
  },
};

export const CodeResults = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <Routes>
        <Route path="/" element={<Index />} />
      </Routes>
    </MemoryRouter>
  );
};
