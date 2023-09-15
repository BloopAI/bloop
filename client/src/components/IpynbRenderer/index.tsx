import { useMemo } from 'react';
import { IpynbCellType } from '../../types/general';
import Cell from './IpynbCell';

type Props = {
  data: string;
};

const IpynbRenderer = ({ data }: Props) => {
  const cells = useMemo(() => {
    const ipynb = JSON.parse(data);
    return ipynb.cells || ipynb.worksheets?.[0]?.cells || [];
  }, [data]);
  return (
    <div className="pb-14 pl-2 overflow-auto flex flex-col gap-4">
      {cells.map((cell: IpynbCellType, i: number) => {
        return <Cell key={i} cell={cell} seq={i + 1} />;
      })}
    </div>
  );
};

export default IpynbRenderer;
