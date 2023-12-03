import { memo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectContext } from '../context/projectContext';
import LeftSidebar from './LeftSidebar';
import CurrentTabContent from './CurrentTabContent';
import EmptyProject from './EmptyProject';

type Props = {};

const Project = ({}: Props) => {
  useTranslation();
  const { project } = useContext(ProjectContext.Current);

  return !project?.repos?.length ? (
    <EmptyProject />
  ) : (
    <div className="w-screen h-screen flex">
      <LeftSidebar />
      <CurrentTabContent />
    </div>
  );
};

export default memo(Project);
