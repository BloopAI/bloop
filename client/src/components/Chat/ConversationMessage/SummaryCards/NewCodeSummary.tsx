import Code from '../../../CodeBlock/Code';

type Props = {
  code: string;
  language: string;
};

const CodeSummary = ({ code, language }: Props) => {
  return (
    <div className="bg-chat-bg-sub code-s">
      <Code code={code} language={language} />
    </div>
  );
};

export default CodeSummary;
