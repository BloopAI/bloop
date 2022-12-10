import Icon from './index';

export default {
  title: 'CodeSymbolIcons',
};

export const Default = () => {
  return (
    <div
      className="gap-2 grid grid-cols-5 justify-items-center justify-center text-gray-100 items-center"
      style={{ backgroundColor: '#131315', color: '#F1F1F2' }}
    >
      <span className="flex flex-col gap-1 items-center">
        <span>Text</span>
        <Icon type={'text'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Module</span>
        <Icon type={'module'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Event</span>
        <Icon type={'event'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Enum, Value</span>
        <Icon type={'enum'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Interface</span>
        <Icon type={'interface'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>File</span>
        <Icon type={'file'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Method, Constructor</span>
        <Icon type={'method'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Class</span>
        <Icon type={'class'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Color</span>
        <Icon type={'color'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Constant</span>
        <Icon type={'constant'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Field</span>
        <Icon type={'field'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Folder</span>
        <Icon type={'folder'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Keyword</span>
        <Icon type={'keyword'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>TypeParameter</span>
        <Icon type={'typeParameter'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Snippet</span>
        <Icon type={'snippet'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Operator</span>
        <Icon type={'operator'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Reference</span>
        <Icon type={'reference'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Property</span>
        <Icon type={'property'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Struct</span>
        <Icon type={'struct'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Unit</span>
        <Icon type={'unit'} />
      </span>
      <span className="flex flex-col gap-1 items-center">
        <span>Folder</span>
        <Icon type={'folder'} />
      </span>
    </div>
  );
};
