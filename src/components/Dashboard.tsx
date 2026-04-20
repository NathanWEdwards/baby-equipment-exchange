'use client';

//Components
import { Button, IconButton, Menu, MenuItem, Tab, Tabs, useMediaQuery } from '@mui/material';
import Organizations from './Organizations';
import Donations from './Donations';
import Users from './Users';
import ProtectedAdminRoute from './ProtectedAdminRoute';
import CustomTabPanel from './CustomTabPanel';
import Loader from './Loader';
import Notifications from './Notifications';
import Inventory from './Inventory';
import Categories from './Categories';
import Reports from './Reports';
import StorageLocations from './StorageLocations';
import NotificationFeed from './NotificationFeed';
//Hooks
import React, { useEffect, useState, useCallback } from 'react';
import { useRequestedInventoryContext } from '@/contexts/RequestedInventoryContext';
import { useRouter } from 'next/navigation';
//API
import { addErrorEvent, callGetOrganizationNames, getNotifications } from '@/api/firebase';
import { getAllDonations, getInventory } from '@/api/firebase-donations';
import { getAllDbUsers } from '@/api/firebase-users';
import { fetchNotificationFeedData } from '@/api/firebaseAdmin';
//Icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RefreshIcon from '@mui/icons-material/Refresh';
//Styles
import '@/styles/globalStyles.css';
import styles from '@/components/Dashboard.module.css';
//Types
import { Donation } from '@/models/donation';
import { Notification } from '@/types/NotificationTypes';
import { NotificationData, NotificationItem } from '@/types/NotificationTypes';
import { IUser } from '@/models/user';
import { InventoryItem } from '@/models/inventoryItem';
import { Category } from '@/models/category';
import { Storage as StorageLocation } from '@/models/storage';
import { CalendlyTimeRange } from '@/types/CalendlyTypes';
import { getAllCategories } from '@/api/firebase-categories';
import { getAllStorage } from '@/api/firebase-storage';

const tabOptions = ['Notifications', 'Donations', 'Inventory', 'Users', 'Organizations', 'Categories', 'Storage', 'Reports'];

export default function Dashboard() {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentTab, setCurrentTab] = useState<number>(0);
    const [donations, setDonations] = useState<Donation[] | null>(null);
    const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
    const [users, setUsers] = useState<IUser[] | null>(null);
    const [orgNamesAndIds, setOrgNamesAndIds] = useState<{
        [key: string]: string;
    } | null>(null);
    const [notifications, setNotifications] = useState<Notification | null>(null);
    const [notificationData, setNotificationData] = useState<NotificationData | null>(null);
    const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
    const [categories, setCategories] = useState<Category[] | null>(null);
    const [storageLocations, setStorageLocations] = useState<StorageLocation[] | null>(null);
    const [highlightedEntityId, setHighlightedEntityId] = useState<string | null>(null);
    const [notificationsSubTab, setNotificationsSubTab] = useState<number | null>(null);
    const [calendlyTimeRange, setCalendlyTimeRange] = useState<CalendlyTimeRange>('30days');

    const { requestedInventory } = useRequestedInventoryContext();
    const router = useRouter();

    //Track whether updates have been made
    const [notificationsUpdated, setNotificationsUpdated] = useState<boolean>(false);
    const [donationsUpdated, setDonationsUpdated] = useState<boolean>(false);
    const [inventoryUpdated, setInventoryUpdated] = useState<boolean>(false);
    const [usersUpdated, setUsersUpdated] = useState<boolean>(false);
    const [orgsUpdated, setOrgsUpdated] = useState<boolean>(false);
    const [categoriesUpdated, setCategoriesUpdated] = useState<boolean>(false);
    const [storageUpdated, setStorageUpdated] = useState<boolean>(false);

    //for mobile tab menu
    const matches = useMediaQuery('(min-width:600px)');
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClickListItem = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuItemClick = (event: React.MouseEvent<HTMLElement>, index: number) => {
        setCurrentTab(index);
        setAnchorEl(null);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleCurrentTab = (event: React.SyntheticEvent, target: number) => {
        setCurrentTab(target);
    };

    // Notification Feed navigation callback
    const handleFeedNavigation = useCallback((tabIndex: number, entityId: string) => {
        // Switch to Notifications tab (index 0 in Dashboard)
        setCurrentTab(0);
        setNotificationsSubTab(tabIndex);
        setHighlightedEntityId(entityId);
        // Clear highlight after a few seconds
        setTimeout(() => setHighlightedEntityId(null), 5000);
    }, []);

    async function fetchNotifications(): Promise<void> {
        setIsLoading(true);
        try {
            const notificationsResult = await getNotifications();
            setNotifications(notificationsResult);
            setNotificationsUpdated(false);

            // Also fetch full notification data with Calendly for the feed
            try {
                const feedData = await fetchNotificationFeedData(calendlyTimeRange);
                
                // Construct a hybrid NotificationData object purely for passing BookingStatusResult down to sub-components
                if (notificationsResult) {
                    setNotificationData({
                        ...notificationsResult,
                        pickupBookingStatus: feedData.pickupBookingStatus,
                        dropOffBookingStatus: feedData.dropOffBookingStatus,
                        calendlyTimeRange: calendlyTimeRange
                    });
                }
                
                // Rehydrate the ISO strings to full JS Date objects for the UI
                const items = feedData.items.map(item => ({...item, timestamp: new Date(item.timestamp)}));
                setNotificationItems(items);
            } catch (error) {
                addErrorEvent('Fetch notification data for feed', error);
            }
        } catch (error) {
            addErrorEvent('Fetch notifications', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchDonations(): Promise<void> {
        setIsLoading(true);
        try {
            const donationsResult = await getAllDonations();
            setDonations(donationsResult);
            setDonationsUpdated(false);
        } catch (error) {
            addErrorEvent('Error fetching all donations', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchInventory(): Promise<void> {
        setIsLoading(true);
        try {
            const inventoryResult = await getInventory();
            setInventory(inventoryResult);
        } catch (error) {
            addErrorEvent('Could not fetch inventory', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchUsers(): Promise<void> {
        setIsLoading(true);
        try {
            const usersResult = await getAllDbUsers();
            setUsers(usersResult.filter((user) => !user.isDeleted));
            setUsersUpdated(false);
        } catch (error) {
            addErrorEvent('Error fetching all users', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchOrgNames(): Promise<void> {
        setIsLoading(true);
        try {
            const orgNamesResult = await callGetOrganizationNames();
            setOrgNamesAndIds(orgNamesResult);
            setOrgsUpdated(false);
        } catch (error) {
            addErrorEvent('Could not fetch org names', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchCategories(): Promise<void> {
        setIsLoading(true);
        try {
            const categoriesResult = await getAllCategories();
            setCategories(categoriesResult);
            setCategoriesUpdated(false);
        } catch (error) {
            addErrorEvent('Could not fetch categories', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchStorageLocations(): Promise<void> {
        setIsLoading(true);
        try {
            const storageResult = await getAllStorage();
            setStorageLocations(storageResult);
            setStorageUpdated(false);
        } catch (error) {
            addErrorEvent('Could not fetch storage locations', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleRefresh() {
        if (currentTab === 0) {
            fetchNotifications();
        } else if (currentTab === 1) {
            fetchDonations();
        } else if (currentTab === 2) {
            fetchInventory();
        } else if (currentTab === 3) {
            fetchUsers();
        } else if (currentTab === 4) {
            fetchOrgNames();
        } else if (currentTab === 5) {
            fetchCategories();
        } else if (currentTab === 6) {
            fetchStorageLocations();
        }
    }

    // Only fetch collections once when selected unless there's been an update
    useEffect(() => {
        if ((currentTab === 0 && !notifications) || notificationsUpdated || donationsUpdated || usersUpdated) {
            fetchNotifications();
        } else if ((currentTab === 1 && !donations) || donationsUpdated) {
            fetchDonations();
        } else if ((currentTab === 2 && !inventory) || inventoryUpdated) {
            fetchInventory();
        } else if ((currentTab === 3 && !users) || usersUpdated) {
            fetchUsers();
        } else if ((currentTab === 4 && !orgNamesAndIds) || orgsUpdated) {
            fetchOrgNames();
        } else if ((currentTab === 5 && !categories) || categoriesUpdated) {
            fetchCategories();
        } else if ((currentTab === 6 && !storageLocations) || storageUpdated) {
            fetchStorageLocations();
        }
    }, [currentTab, donationsUpdated, inventoryUpdated, usersUpdated, orgsUpdated, notificationsUpdated, categoriesUpdated, storageUpdated]);

    return (
        <ProtectedAdminRoute>
            <div className={styles['navbar']}>
                {matches ? (
                    <Tabs
                        value={currentTab}
                        onChange={handleCurrentTab}
                        aria-label="dashboard"
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            flex: 1,
                            '& .MuiTab-root': {
                                color: '#666',
                                fontWeight: 500,
                                textTransform: 'none',
                                fontSize: '0.875rem',
                                minHeight: 48,
                                '&.Mui-selected': { color: '#1976d2', fontWeight: 600 }
                            },
                            '& .MuiTabs-indicator': {
                                height: 3,
                                borderRadius: '3px 3px 0 0'
                            }
                        }}
                    >
                        {tabOptions.map((tab) => (
                            <Tab key={tab} label={tab} />
                        ))}
                    </Tabs>
                ) : (
                    <>
                        <Button endIcon={<ArrowDropDownIcon />} onClick={handleClickListItem} sx={{ textTransform: 'none', fontWeight: 600 }}>
                            {tabOptions[currentTab]}
                        </Button>
                        <Menu id="selected-tab" anchorEl={anchorEl} open={open} onClose={handleClose}>
                            {tabOptions.map((tab, i) => (
                                <MenuItem key={tab} selected={i === currentTab} onClick={(event) => handleMenuItemClick(event, i)}>
                                    <p>{tab}</p>
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}
                <NotificationFeed items={notificationItems} onNavigate={handleFeedNavigation} notificationData={notificationData} />
                <IconButton onClick={handleRefresh} size="small" sx={{ mr: 1, color: '#666' }}>
                    <RefreshIcon fontSize="small" />
                </IconButton>
            </div>

            {isLoading ? (
                <Loader />
            ) : (
                <>
                    <CustomTabPanel value={currentTab} index={0}>
                        {notifications ? (
                            <Notifications
                                notifications={notifications}
                                setNotificationsUpdated={setNotificationsUpdated}
                                notificationData={notificationData}
                                highlightedEntityId={highlightedEntityId}
                                requestedTab={notificationsSubTab}
                            />
                        ) : (
                            <p>No notifications at this time.</p>
                        )}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={1}>
                        {donations ? <Donations donations={donations} setDonationsUpdated={setDonationsUpdated} /> : <p>No donations found.</p>}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={2}>
                        {inventory ? <Inventory inventory={inventory} setInventoryUpdated={setInventoryUpdated} /> : <p>No inventory found.</p>}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={3}>
                        {users ? <Users users={users} setUsersUpdated={setUsersUpdated} /> : <p>No users found.</p>}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={4}>
                        {orgNamesAndIds ? <Organizations orgNamesAndIds={orgNamesAndIds} setOrgsUpdated={setOrgsUpdated} /> : <p>No organizations found.</p>}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={5}>
                        {categories ? <Categories categories={categories} setCategoriesUpdated={setCategoriesUpdated} /> : <p>No categories found.</p>}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={6}>
                        {storageLocations ? (
                            <StorageLocations storageLocations={storageLocations} setStorageUpdated={setStorageUpdated} />
                        ) : (
                            <p>No storage locations found.</p>
                        )}
                    </CustomTabPanel>
                    <CustomTabPanel value={currentTab} index={7}>
                        <Reports />
                    </CustomTabPanel>
                </>
            )}
        </ProtectedAdminRoute>
    );
}
