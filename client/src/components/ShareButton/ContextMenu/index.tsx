import { Clipboard, DragVertical, FloppyDisk } from '../../../icons';
import TextField from '../../TextField';
import FileIcon from '../../FileIcon';

type ContextMenuItem = {
  text: string;
  annotations: number;
};

type Props = {
  items: ContextMenuItem[];
  visible: boolean;
  rightSide?: boolean;
};
const ContextMenu = ({ items, visible, rightSide }: Props) => {
  return (
    <div
      className={`${visible ? '' : 'hidden'} ${
        rightSide ? 'right-0' : ''
      } flex flex-col divide-y divide-gray-700 z-10 rounded p-1 bg-gray-800/75 drop-shadow-lg absolute w-72 top-12 text-gray-300 p-2`}
    >
      <span className="text-xs px-1">Will be shared</span>
      <div className="my-2 py-2">
        {items.map((item) => (
          <span
            className="flex items-center gap-3 py-1 hover:bg-gray-700 cursor-pointer"
            key={item.text}
          >
            <span className="text-gray-500">
              <DragVertical />
            </span>
            <span className="flex flex-col">
              <TextField
                value={item.text}
                icon={<FileIcon filename={item.text} />}
              />
              <span className="text-gray-500 text-xs">
                {item.annotations} annotations
              </span>
            </span>
          </span>
        ))}
      </div>
      <span className="py-3 px-1 hover:bg-gray-700 cursor-pointer">
        <TextField value={'Save to my collections'} icon={<FloppyDisk />} />
      </span>
      <span className="py-3 px-1 hover:bg-gray-700 cursor-pointer">
        <TextField value={'Copy sharing link'} icon={<Clipboard />} />
      </span>
    </div>
  );
};

export default ContextMenu;
