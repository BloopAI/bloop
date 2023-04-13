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
    <div className="text-sm p-4 border border-gray-700 rounded-md">
      <div className="relative overflow-auto">
        <Code showLines={false} code={code} language={language} />
        <div className="absolute top-0 right-0">
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
    </div>
  );
};

export default NewCode;
