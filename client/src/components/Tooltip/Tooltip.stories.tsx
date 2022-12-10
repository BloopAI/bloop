import Button from '../Button';
import { MailIcon } from '../../icons';
import Tooltip from './index';

export default {
  title: 'components/Tooltip',
  component: Tooltip,
};

export const TooltipDefault = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315', padding: 50 }}>
      <div className="flex flex-col gap-3 items-center justify-center">
        <Tooltip placement={'top-start'} text={'Tooltip top left position'}>
          <span>left top</span>
        </Tooltip>

        <Tooltip placement={'top-end'} text={'Tooltip top right position'}>
          <span>right top</span>
        </Tooltip>

        <Tooltip placement={'top'} text={'Tooltip top center position'}>
          <span>center top</span>
        </Tooltip>

        <Tooltip placement={'left'} text={'Left center position'}>
          <span>center left</span>
        </Tooltip>

        <Tooltip placement={'right'} text={'Right center position'}>
          <span>center right</span>
        </Tooltip>

        <Tooltip placement={'bottom-start'} text={'Bottom left position'}>
          <span>left bottom</span>
        </Tooltip>

        <Tooltip placement={'bottom'} text={'Bottom center position'}>
          <span>center bottom</span>
        </Tooltip>

        <Tooltip placement={'bottom-end'} text={'Bottom right position'}>
          <span>right bottom</span>
        </Tooltip>
      </div>
    </div>
  );
};

export const TooltipIconOnlyButton = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315', padding: 50 }}>
      <div className="flex flex-col gap-3 items-center justify-center">
        <Button
          onlyIcon
          tooltipPlacement={'top-start'}
          title={'Tooltip top left position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'top-end'}
          title={'Tooltip top right position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'top'}
          title={'Tooltip top center position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'left'}
          title={'Left center position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'right'}
          title={'Right center position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'bottom-start'}
          title={'Bottom left position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'bottom'}
          title={'Bottom center position'}
        >
          <MailIcon />
        </Button>

        <Button
          onlyIcon
          tooltipPlacement={'bottom-end'}
          title={'Bottom right position'}
        >
          <MailIcon />
        </Button>
      </div>
    </div>
  );
};
