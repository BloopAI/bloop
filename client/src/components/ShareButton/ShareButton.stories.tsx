import React from 'react';

import ShareButton from './index';

export default {
  title: 'components/ShareButton',
  component: ShareButton,
};

export const ShareButtonExample = () => {
  return (
    <div
      style={{ width: '100%', backgroundColor: '' }}
      className="flex flex-row gap-4"
    >
      <ShareButton
        visible
        files={[
          {
            name: 'app.js',
            annotations: 2,
          },
          {
            name: 'components.ts',
            annotations: 3,
          },
          {
            name: 'build.js',
            annotations: 0,
          },
          {
            name: 'styles.css',
            annotations: 4,
          },
        ]}
      />
      <ShareButton
        visible
        files={[
          {
            name: 'app.js',
            annotations: 2,
          },
          {
            name: 'components.ts',
            annotations: 3,
          },
        ]}
      />

      <ShareButton
        visible
        files={[
          {
            name: 'app.js',
            annotations: 2,
          },
        ]}
      />
    </div>
  );
};
