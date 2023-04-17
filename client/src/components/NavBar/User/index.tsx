import React, { useCallback, useContext, useMemo } from 'react';
import {
  ArrowLeft,
  Bug,
  ChevronDownFilled,
  Cog,
  Person,
  PlusSignInBubble,
  Tab,
  Magazine,
  ArrowRight,
  DoorRight,
} from '../../../icons';
import DropdownWithIcon from '../../Dropdown/WithIcon';
import Dropdown from '../../Dropdown/Normal';
import ShareButton, { ShareFile } from '../../ShareButton';
import { ContextMenuItem, MenuListItemType } from '../../ContextMenu';
import SearchInput from '../../SearchInput';
import { UIContext } from '../../../context/uiContext';
import Button from '../../Button';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { TabsContext } from '../../../context/tabsContext';
import { MenuItemType } from '../../../types/general';
import { DeviceContext } from '../../../context/deviceContext';
import { deleteAuthCookie } from '../../../utils';

type Props = {
  shareFiles?: ShareFile[];
  isSkeleton?: boolean;
};

const NavBarUser = ({ shareFiles, isSkeleton }: Props) => {
  const {
    setSettingsOpen,
    setBugReportModalOpen,
    setShouldShowWelcome,
    setGithubConnected,
  } = useContext(UIContext);
  const { isRepoManagementAllowed, openLink, isSelfServe } =
    useContext(DeviceContext);
  const {
    navigateBack,
    navigationHistory,
    navigateForward,
    forwardNavigation,
  } = useAppNavigation();
  const { tabs, setActiveTab, handleAddTab, activeTab, handleRemoveTab } =
    useContext(TabsContext);

  const backButtonHandler = useCallback(() => {
    navigateBack();
  }, [navigateBack]);

  const forwardButtonHandler = useCallback(() => {
    navigateForward();
  }, [navigateForward]);

  const tabItems = useMemo(
    () =>
      tabs
        .map(
          (t): ContextMenuItem => ({
            text: t.name,
            type:
              tabs.length > 1
                ? MenuListItemType.REMOVABLE
                : MenuItemType.DEFAULT,
            onClick: () => setActiveTab(t.key),
            onDelete: () => handleRemoveTab(t.key),
            icon: <Tab />,
          }),
        )
        .concat(
          tabs.length < 5
            ? [
                {
                  type: MenuListItemType.DIVIDER,
                  text: '',
                  onClick: () => {},
                  icon: <Tab />,
                },
                {
                  type: MenuListItemType.DEFAULT,
                  text: 'Add tab',
                  icon: <PlusSignInBubble />,
                  onClick: handleAddTab,
                },
              ]
            : [],
        ),
    [tabs, activeTab, setActiveTab, handleAddTab],
  );

  return (
    <div className="flex flex-row flex-1 gap-4">
      <Button
        variant={'tertiary'}
        onlyIcon
        title={'Back'}
        disabled={!navigationHistory.length}
        className={!navigationHistory.length ? 'opacity-0' : ''}
        onClick={backButtonHandler}
      >
        <ArrowLeft />
      </Button>
      <Button
        variant={'tertiary'}
        onlyIcon
        title={'Forward'}
        disabled={!forwardNavigation.length}
        className={!forwardNavigation.length ? 'opacity-0' : ''}
        onClick={forwardButtonHandler}
      >
        <ArrowRight />
      </Button>
      {!isSkeleton && (
        <Dropdown
          items={tabItems}
          selected={tabItems[tabs.findIndex((t) => t.key === activeTab)]}
          hint="Open tabs"
          titleClassName="max-w-[120px] ellipsis"
        />
      )}
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
        {isRepoManagementAllowed ? (
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
                  {
                    text: 'Documentation',
                    icon: <Magazine />,
                    type: MenuListItemType.DEFAULT,
                    onClick: () => openLink('https://bloop.ai/docs'),
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
                  ...(isSelfServe
                    ? [
                        {
                          text: 'Sign out',
                          icon: <DoorRight />,
                          type: MenuListItemType.DEFAULT,
                          onClick: () => {
                            setShouldShowWelcome(true);
                            deleteAuthCookie();
                            setGithubConnected(false);
                          },
                        },
                      ]
                    : []),
                ]}
                icon={<Person />}
                dropdownBtnClassName="-mr-4"
              />
            )}
          </span>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
};
export default NavBarUser;
