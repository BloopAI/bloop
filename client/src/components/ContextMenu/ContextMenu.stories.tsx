import { MailIcon } from '../../icons';
import { MenuItemType } from '../../types/general';
import ItemShared from './ContextMenuItem/ItemShared';
import Item from './ContextMenuItem/Item';
import ContextMenu, { MenuListItemType } from './index';

export default {
  title: 'components/ContextMenu',
  component: ContextMenu,
};

export const ContextMenuItems = () => {
  return (
    <div style={{ width: 384, padding: '10px' }}>
      <Item
        icon={<MailIcon />}
        onClick={() => {}}
        text={'Default'}
        type={MenuItemType.DEFAULT}
      />
      <br />
      <Item
        text={'Item dismissible'}
        icon={<MailIcon />}
        onClick={() => {}}
        type={MenuItemType.REMOVABLE}
      />
      <br />
      <Item
        text={'Item selectable'}
        icon={<MailIcon />}
        onClick={() => {}}
        type={MenuItemType.SELECTABLE}
      />
      <br />
      <Item
        text={'Item danger'}
        icon={<MailIcon />}
        onClick={() => {}}
        type={MenuItemType.DANGER}
      />
      <br />
      <ItemShared
        text={'Item shared'}
        annotations={1}
        icon={<MailIcon />}
        onClick={() => {}}
        removable
      />
    </div>
  );
};

export const ContextMenuDefault = () => {
  return (
    <div
      style={{
        width: 384,
        position: 'relative',
      }}
    >
      <ContextMenu
        items={[
          {
            text: 'Item One',
            icon: <MailIcon />,
            onClick: () => {},
            type: MenuItemType.DEFAULT,
          },
          {
            text: 'Item Two',
            icon: <MailIcon />,
            onClick: () => {},
            type: MenuItemType.DEFAULT,
          },
          {
            type: MenuListItemType.DIVIDER,
          },
          {
            text: 'Item Three',
            icon: <MailIcon />,
            type: MenuItemType.SELECTABLE,
            isSelected: false,
            onChange: () => {},
          },
          {
            text: 'Item Four',
            icon: <MailIcon />,
            type: MenuItemType.SELECTABLE,
            isSelected: false,
            onChange: () => {},
          },
          {
            type: MenuListItemType.DIVIDER_WITH_TEXT,
            text: 'Divider',
          },
          {
            text: 'Item Five',
            icon: <MailIcon />,
            onClick: () => {},
            type: MenuItemType.DANGER,
          },
        ]}
        visible
        title={'Sample label'}
        handleClose={() => {}}
      />
    </div>
  );
};
