import { MemoryRouter } from 'react-router-dom';
import { SearchContextProvider } from '../../context/providers/SearchContextProvider';
import { RepoSource } from '../../types';
import SearchInput from './index';

export default {
  title: 'components/SearchInput',
  component: SearchInput,
};

export const Default = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <SearchContextProvider
        tab={{ name: '', repoName: '', key: '', source: RepoSource.LOCAL }}
      >
        <div className="relative">
          <SearchInput />
        </div>
      </SearchContextProvider>
    </MemoryRouter>
  );
};
