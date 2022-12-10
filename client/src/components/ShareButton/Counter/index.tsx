type Props = {
  count: number;
};

const Counter = ({ count }: Props) => {
  return (
    <span className="relative flex">
      {count >= 3 ? (
        <span className="relative z-50 rounded-l bg-gray-700/25 text-gray-100 text-xs px-1.5 py-1" />
      ) : (
        ''
      )}
      {count >= 2 ? (
        <span
          className={`relative z-20 ${
            count > 2 ? 'right-[15%]' : ''
          } rounded-l bg-gray-700/50 text-gray-100 text-xs px-1.5 py-1`}
        />
      ) : (
        ''
      )}
      <span
        className={`relative ${
          count >= 3 ? `right-[30%]` : count === 2 ? 'right-[15%]' : ''
        } rounded bg-gray-700 text-gray-100 text-xs px-1.5 py-1`}
      >
        {count}
      </span>
    </span>
  );
};
export default Counter;
