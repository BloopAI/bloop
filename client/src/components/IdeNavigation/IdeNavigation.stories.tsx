import { Version, Branch } from '../../icons';
import FileIcon from '../FileIcon';
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
        files={[
          {
            name: '.editoconfig',
          },
          {
            name: '.gitognore',
          },
          {
            name: 'Styles',
            children: [{ name: 'main.css' }, { name: 'button.css' }],
          },
          {
            name: 'Javascript',
            children: [
              {
                name: 'tests',
                children: [
                  {
                    name: 'tests',
                    children: [
                      { name: 'app.spec.js' },
                      { name: 'index.spec.js' },
                      { name: 'functions.spec.js' },
                    ],
                  },
                  { name: 'app.spec.js' },
                  { name: 'index.spec.js' },
                  { name: 'functions.spec.js' },
                ],
              },
              { name: 'index.js' },
              { name: 'app.js' },
              { name: 'functions.js' },
            ],
          },
          {
            name: 'Html',
            children: [{ name: 'index.html' }, { name: 'main.html' }],
          },
          {
            name: 'index.tsx',
          },
          {
            name: 'config.json',
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
        onBackNavigate={() => {}}
      />
    </div>
  );
};
