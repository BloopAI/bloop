type Props = {
  linesNum: number;
  focusedLine?: number;
  offset?: number;
};

const LineNumbers = ({ linesNum, focusedLine, offset = 0 }: Props) => {
  return (
    <div className="px-1 text-right select-none text-gray-500">
      {[...Array(linesNum).keys()].map((_, i) => (
        <div
          key={i}
          className={`code-s ${
            focusedLine === i
              ? 'text-editor-foreground'
              : 'text-editor-line-number'
          }`}
        >
          {i + 1 + offset}
        </div>
      ))}
    </div>
  );
};

export default LineNumbers;
