import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler);

type Props = {
  variant: 'green' | 'red';
  border?: boolean;
};

const variantColorMap = {
  red: '#F78166',
  green: '#156534',
};

const ContributionsChart = ({ border, variant }: Props) => {
  return (
    <div
      className={`p-6 bg-gray-800 ${
        border ? 'rounded border border-gray-700' : ''
      }`}
    >
      <Line
        datasetIdKey="id"
        options={{
          plugins: {
            legend: {
              display: false,
            },
          },
          elements: {
            line: {
              tension: 0.4,
            },
          },
          color: 'gray',
          scales: {
            x: {
              grid: {
                display: false,
              },
            },
            y: {
              grid: {
                color: '#27272D',
              },
              ticks: {
                stepSize: 200,
              },
            },
          },
        }}
        data={{
          labels: ['2018', '2019', '2020', '2021', '2022'],
          datasets: [
            {
              label: 'Filled',
              backgroundColor: variantColorMap[variant],
              borderColor: variantColorMap[variant],
              data: [200, 450, 10, 222, 500],
              fill: true,
              pointRadius: 0,
            },
          ],
        }}
      />
    </div>
  );
};
export default ContributionsChart;
