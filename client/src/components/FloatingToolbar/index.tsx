import { useState } from 'react';
import TextInput from '../TextInput';
import Button from '../Button';
import { CloseSign, ReturnKey } from '../../icons';
import ToolbarButton from './ToolbarButton';

type Props = {
  position: 'left' | 'center' | 'right';
};

const positionMap = {
  left: { tail: 'left-2', fixBorder: 'left-[13px]' },
  center: {
    tail: 'left-1/2 -translate-x-1/2',
    fixBorder: 'left-[13px] left-1/2 -translate-x-1/2 transform',
  },
  right: { tail: 'right-2', fixBorder: 'right-[13px]' },
};

const FloatingToolbar = ({ position }: Props) => {
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  return (
    <div className="relative pb-[5px]">
      <div
        className={`text-gray-500 rounded-4 border border-gray-700 w-fit ${
          isCommentOpen ? 'w-[286px] h-[52px]' : 'w-[203px] h-[42px]'
        } flex relative z-10 bg-gray-900 relative transition-all duration-300 ease-in-bounce`}
      >
        {isCommentOpen ? (
          <div className="flex items-center p-1 gap-1">
            <TextInput
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              name="comment"
              variant="filled"
            />
            <Button onlyIcon title="Submit">
              <ReturnKey />
            </Button>
            <Button
              onlyIcon
              variant="tertiary"
              onClick={() => setIsCommentOpen(false)}
              title="Close"
            >
              <CloseSign />
            </Button>
          </div>
        ) : (
          <>
            <div className="border-r border-gray-700 flex">
              <ToolbarButton
                color="bg-sky-500"
                isActive={activeButton === 0}
                onClick={() => setActiveButton(0)}
              />
              <ToolbarButton
                color="bg-pink-500"
                isActive={activeButton === 1}
                onClick={() => setActiveButton(1)}
              />
              <ToolbarButton
                color="bg-yellow-500"
                isActive={activeButton === 2}
                onClick={() => setActiveButton(2)}
              />
              <ToolbarButton
                color="bg-violet-500"
                isActive={activeButton === 3}
                onClick={() => setActiveButton(3)}
              />
            </div>
            <ToolbarButton onClick={() => setIsCommentOpen(true)} />
          </>
        )}
        <span
          className={`absolute bottom-[-1px] ${positionMap[position].fixBorder} w-[8px] h-[1px] bg-gray-900`}
        />
      </div>
      <span
        className={`absolute bottom-1 ${positionMap[position].tail} w-5 h-5 border border-gray-700 bg-gray-900 transform rotate-45 box-border z-0`}
      />
    </div>
  );
};

export default FloatingToolbar;
