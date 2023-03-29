import { Version, Branch } from '../../icons';
import FileIcon from '../FileIcon';
import { FileTreeFileType } from '../../types';
import NavigationItem from './NavigationItem';
import NavigationItemChevron from './NavigationItemChevron';
import '../../index.css';
import IdeNavigation from './index';

export default {
  title: 'components/IdeNavigation',
  component: IdeNavigation,
};

export const IdeNavigationItems = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <NavigationItem
        value={'test.ts'}
        icon={<FileIcon filename={'test.ts'} />}
        variant={'default'}
      />
      <NavigationItem
        value={'test.ts'}
        icon={<FileIcon filename={'test.ts'} />}
        variant={'default'}
      />
      <br />
      <NavigationItemChevron value={'javascript'} />
      <NavigationItemChevron value={'javascript'} active />
      <br />
      <NavigationItem
        value={'main/feature-one'}
        icon={<Branch />}
        variant={'default'}
      />
      <NavigationItem
        value={'main/feature-one'}
        icon={<Branch />}
        variant={'default'}
      />
      <br />
      <NavigationItem value={'2.3'} icon={<Version />} variant={'default'} />
      <NavigationItem value={'2.3'} icon={<Version />} variant={'default'} />
    </div>
  );
};

export const IdeNavigationPanel = () => {
  return (
    <div style={{ width: 354, backgroundColor: '#131315' }}>
      <IdeNavigation
        currentPath={''}
        onFileClick={() => {}}
        initialBranch={0}
        initialVersion={0}
        files={[
          {
            name: '.editoconfig',
            type: FileTreeFileType.FILE,
            path: '/',
            children: [],
          },
          {
            name: '.gitignore',
            type: FileTreeFileType.FILE,
            path: '/',
            children: [],
          },
          {
            name: 'Styles',
            type: FileTreeFileType.DIR,
            path: '/',
            children: [],
          },
          {
            name: 'Javascript',
            type: FileTreeFileType.FILE,
            path: '/',
            children: [],
          },
          {
            name: 'Html',
            type: FileTreeFileType.DIR,
            path: '/',
            children: [],
          },
          {
            name: 'index.tsx',
            type: FileTreeFileType.FILE,
            path: '/',
            children: [],
          },
          {
            name: 'config.json',
            type: FileTreeFileType.FILE,
            path: '/',
            children: [],
          },
        ]}
        branches={[
          { title: 'main' },
          { title: 'dev/main-feature' },
          { title: 'test/first' },
        ]}
        versions={[
          { title: '2.1.1' },
          { title: '2.1.2' },
          { title: '2.1.2-alpha' },
        ]}
        repoName={'bloop-enterprise'}
      />
    </div>
  );
};
