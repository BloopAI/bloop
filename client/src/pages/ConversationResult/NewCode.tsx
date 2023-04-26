import Code from '../../components/CodeBlock/Code';
import Button from '../../components/Button';
import { Clipboard } from '../../icons';
import { copyToClipboard } from '../../utils';

type Props = {
  code: string;
  language: string;
};

const NewCode = ({ code, language }: Props) => {
  return (
    <div className="text-sm p-4 border border-gray-700 rounded-md relative">
      <div className="overflow-auto">
        <Code showLines={false} code={code} language={language} />
      </div>
      <div
        className={`absolute ${
          code.split('\n').length > 1 ? 'top-4 right-4' : 'top-2.5 right-2.5'
        }`}
      >
        <Button
          variant="secondary"
          size="small"
          onClick={() => copyToClipboard(code)}
        >
          <Clipboard />
          Copy
        </Button>
      </div>
    </div>
  );
};

export default NewCode;
