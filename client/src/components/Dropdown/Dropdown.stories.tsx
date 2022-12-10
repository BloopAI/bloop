import { ArrowRevert, PlusSignInBubble, Tab } from '../../icons';
import { MenuListItemType } from '../ContextMenu';
import { DropdownNormal, DropdownWithIcon } from './index';

export default {
  title: 'components/Dropdown',
  component: DropdownNormal,
};

export const TabsDropdown = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <DropdownNormal
        items={[
          {
            text: 'Untitled search 1',
            icon: <Tab />,
            type: MenuListItemType.DEFAULT,
          },
          {
            text: 'Untitled search 2',
            icon: <Tab />,
            type: MenuListItemType.DEFAULT,
          },
          {
            text: 'Untitled search 3',
            icon: <Tab />,
            type: MenuListItemType.DEFAULT,
          },
          { type: MenuListItemType.DIVIDER },
          {
            text: 'Untitled search 3',
            icon: <PlusSignInBubble />,
            type: MenuListItemType.DEFAULT,
          },
        ]}
        hint={'Open tabs'}
      />
      <br />
    </div>
  );
};

export const DropdownIcon = () => {
  return (
    <div style={{ width: 384, backgroundColor: '#131315' }}>
      <DropdownWithIcon
        items={[
          {
            text: 'Untitled search 1',
            icon: <Tab />,
            type: MenuListItemType.DEFAULT,
          },
          {
            text: 'Untitled search 2',
            icon: <Tab />,
            type: MenuListItemType.DEFAULT,
          },
          {
            text: 'Untitled search 3',
            icon: <Tab />,
            type: MenuListItemType.DEFAULT,
          },
        ]}
        hint={'Open tabs'}
        icon={<ArrowRevert />}
      />
      <br />
    </div>
  );
};
