import { useRive } from '@rive-app/react-canvas';
import React, { useEffect } from 'react';

const UpvoteBtn = ({ isUpvote }: { isUpvote: boolean }) => {
  const RiveUpvoteInline = useRive({
    src: '/like-blue.riv',
    autoplay: false,
  });

  useEffect(() => {
    if (isUpvote) {
      RiveUpvoteInline.rive?.play();
    } else {
      RiveUpvoteInline.rive?.reset();
      RiveUpvoteInline.rive?.drawFrame();
    }
  }, [isUpvote, RiveUpvoteInline.rive]);

  return (
    <RiveUpvoteInline.RiveComponent
      className="w-4.5 h-4.5 transform scale-1 flex-shrink-0"
      key="upvote"
    />
  );
};

export default UpvoteBtn;
