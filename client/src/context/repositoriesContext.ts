import { createContext, Dispatch, SetStateAction } from 'react';
import { IndexingStatusType } from '../types/general';

type ContextType = {
  indexingStatus: IndexingStatusType;
  setIndexingStatus: Dispatch<SetStateAction<IndexingStatusType>>;
};

export const RepositoriesContext = createContext<ContextType>({
  indexingStatus: {},
  setIndexingStatus: () => {},
});
