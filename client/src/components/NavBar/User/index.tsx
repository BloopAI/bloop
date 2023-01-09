import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bug, ChevronDownFilled, Cog, Person } from '../../../icons';
import DropdownWithIcon from '../../Dropdown/WithIcon';
import ShareButton, { ShareFile } from '../../ShareButton';
import { MenuListItemType } from '../../ContextMenu';
import SearchInput from '../../SearchInput';
import { UIContext } from '../../../context/uiContext';
import Button from '../../Button';
import useAppNavigation from '../../../hooks/useAppNavigation';

type Props = {
  shareFiles?: ShareFile[];
  isSkeleton?: boolean;
};

const NavBarUser = ({ shareFiles, isSkeleton }: Props) => {
  const { setSettingsOpen, setBugReportModalOpen } = useContext(UIContext);
  const { navigateBack } = useAppNavigation();

  const backButtonHandler = useCallback(() => {
    navigateBack();
  }, []);

  return (
    <div className="flex flex-row flex-1 gap-4">
      <Button
        variant={'tertiary'}
        onlyIcon
        title={'Back'}
        onClick={backButtonHandler}
      >
        <ArrowLeft />
      </Button>
      <div className="flex items-center justify-between	w-full">
        <span />
        {/*{isSkeleton ? (*/}
        {/*  <div className="bg-gray-700 rounded-4 h-7 w-32" />*/}
        {/*) : (*/}
        {/*  <Dropdown*/}
        {/*    items={[*/}
        {/*      {*/}
        {/*        text: 'Untitled search',*/}
        {/*        icon: <Tab />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*      {*/}
        {/*        text: 'Untitled search',*/}
        {/*        icon: <Tab />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*      {*/}
        {/*        text: 'Untitled search',*/}
        {/*        icon: <Tab />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*      {*/}
        {/*        text: 'New tab',*/}
        {/*        icon: <PlusSignInBubble />,*/}
        {/*        type: MenuListItemType.DEFAULT,*/}
        {/*      },*/}
        {/*    ]}*/}
        {/*    hint={'Open tabs'}*/}
        {/*  />*/}
        {/*)}*/}
        <div className="flex items-center flex-1">
          {isSkeleton ? (
            <>
              <div className="bg-gray-700 rounded-4 h-7 w-68 mr-2" />
              <div className="bg-gray-700 rounded-4 h-7 w-32" />
            </>
          ) : (
            <SearchInput />
          )}
        </div>
        {shareFiles?.length ? <ShareButton files={shareFiles} visible /> : ''}
        <span>
          {isSkeleton ? (
            <div className="flex items-center gap-1.5 text-gray-500">
              <div className="bg-gray-700 rounded-full h-10 w-10" />
              <ChevronDownFilled />
            </div>
          ) : (
            <DropdownWithIcon
              items={[
                {
                  text: 'Settings',
                  icon: <Cog />,
                  type: MenuListItemType.DEFAULT,
                  onClick: () => setSettingsOpen(true),
                },
                // {
                //   text: 'My Collections',
                //   icon: <Collections />,
                //   type: MenuListItemType.DEFAULT,
                // },
                {
                  text: 'Report a bug',
                  icon: <Bug />,
                  type: MenuListItemType.DEFAULT,
                  onClick: () => setBugReportModalOpen(true),
                },
                // {
                //   text: 'Sign out',
                //   icon: <DoorRight />,
                //   type: MenuListItemType.DEFAULT,
                // },
              ]}
              icon={<Person />}
              dropdownBtnClassName="-mr-4"
            />
          )}
        </span>
      </div>
    </div>
  );
};
export default NavBarUser;
