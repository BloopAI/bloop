type Props = {
  text: string;
  active?: boolean;
};

const Badge = ({ text, active }: Props) => {
  return (
    <span
      className={`${
        active ? 'bg-primary-400' : 'bg-gray-700'
      } px-2 py-1 rounded`}
    >
      {text}
    </span>
  );
};
export default Badge;
