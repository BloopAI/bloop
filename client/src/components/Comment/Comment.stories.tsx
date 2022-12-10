import React from 'react';
import Comment from './index';

export default {
  title: 'components/Comment',
  component: Comment,
};

export const CommentReadOnly = () => {
  return (
    <div style={{ width: 384, backgroundColor: '', padding: '10px' }}>
      <Comment
        comment={
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
        }
        author={'Louis Knight-Webb'}
        readonly
        avatar={'/avatar.png'}
      />
    </div>
  );
};

export const CommentAuthor = () => {
  return (
    <div style={{ width: 384, backgroundColor: '', padding: '10px' }}>
      <Comment
        comment={
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
        }
        author={'Louis Knight-Webb'}
        avatar={'/avatar.png'}
      />
      <br />
    </div>
  );
};
