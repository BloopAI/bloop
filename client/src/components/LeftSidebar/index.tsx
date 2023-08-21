import { memo } from 'react';
import { RenderPage } from '../../pages/RepoTab/Content';
import IdeNavigation from '../IdeNavigation';
import Filters from '../Filters';

type Props = {
  renderPage: RenderPage;
};

const LeftSidebar = ({ renderPage }: Props) => {
  return (
    <div className="h-full overflow-auto">
      {renderPage === 'full-result' ? <IdeNavigation /> : <Filters />}
    </div>
  );
};

export default memo(LeftSidebar);
