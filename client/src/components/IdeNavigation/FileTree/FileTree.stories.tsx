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
        items={[
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
      />
    </div>
  );
};
