import { Papers } from '../../icons';
import Accordion from './index';

export default {
  title: 'components/Accordion',
  component: Accordion,
};

export const Default = () => {
  return (
    <Accordion
      title="Accordion"
      icon={<Papers />}
      headerItems={['one', 'two', 'three'].map((i) => (
        <span key={i}>{i}</span>
      ))}
    >
      <p>Item 1</p>
      <p>Item 2</p>
    </Accordion>
  );
};
