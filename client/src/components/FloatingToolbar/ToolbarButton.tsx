import { ChatBubble } from '../../icons';

type Props = {
  color?: string;
  isActive?: boolean;
  onClick: () => void;
};

const ToolbarButton = ({ color, isActive, onClick }: Props) => {
  return (
    <button
      onClick={onClick}
      className={`outline-none outline-0 focus:outline-none rounded-4 w-8 h-8 p-0 m-1 ${
        isActive ? 'bg-bg-base-hover' : 'bg-transparent'
      } hover:bg-bg-base-hover  border-none flex items-center justify-center hover:text-label-title`}
    >
      <span
        className={`rounded-full ${
          color ? (isActive ? 'w-4 h-4' : 'w-3 h-3') : 'w-5 h-5'
        } ${color} inline-block transition-all ease-in-out duration-150`}
      >
        {!color ? <ChatBubble /> : null}
      </span>
    </button>
  );
};

export default ToolbarButton;
