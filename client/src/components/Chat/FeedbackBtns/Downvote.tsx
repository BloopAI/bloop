import { useRive } from '@rive-app/react-canvas';
import React, { useEffect } from 'react';

const DownvoteBtn = ({ isDownvote }: { isDownvote: boolean }) => {
  const RiveDownvoteInline = useRive({
    src: '/like-red.riv',
    autoplay: false,
  });

  useEffect(() => {
    if (isDownvote) {
      RiveDownvoteInline.rive?.play();
    } else {
      RiveDownvoteInline.rive?.reset();
      RiveDownvoteInline.rive?.drawFrame();
    }
  }, [isDownvote, RiveDownvoteInline.rive]);

  return (
    <RiveDownvoteInline.RiveComponent
      className="w-4.5 h-4.5 transform scale-1 flex-shrink-0"
      key="downvote"
    />
  );
};

export default DownvoteBtn;
