import { FileTreeFileType } from '../../../types';
import FileTree from './index';
import '../../../index.css';

export default {
  title: 'components/FileTree',
  component: FileTree,
};

export const FileTreeSample = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <FileTree
        onFileClick={() => {}}
        currentPath={'/'}
        items={[
          {
            name: '.editoconfig',
            type: FileTreeFileType.FILE,
            path: '/',
            children: [],
          },
          {
            name: '.gitognore',
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
            type: FileTreeFileType.DIR,
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
      />
    </div>
  );
};
