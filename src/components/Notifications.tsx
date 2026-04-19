'use client';
//Hooks
import { Dispatch, MouseEvent, SetStateAction, SyntheticEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
//Components
import ProtectedAdminRoute from '@/components/ProtectedAdminRoute';
import UserDetails from '@/components/UserDetails';
import DonationDetails from '@/components/DonationDetails';
import ReviewOrder from './ReviewOrder';
import NotificationCard from '@/components/NotificationCard';
import CustomTabPanel from './CustomTabPanel';
import { Button, Menu, MenuItem, Paper, Tab, Tabs, Typography, useMediaQuery } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
//Styles
import '@/styles/globalStyles.css';
import notificationStyles from '@/components/NotificationCard.module.css';
import dashboardStyles from '@/components/Dashboard.module.css';
//Types
import { Notification, NotificationData } from '@/types/NotificationTypes';
import { Donation } from '@/models/donation';
import { BookingMatchConfidence } from '@/types/CalendlyTypes';

type NotificationsProps = {
    notifications: Notification;
    setNotificationsUpdated?: Dispatch<SetStateAction<boolean>>;
    activeSubTab?: number;
    onSubTabChange?: Dispatch<SetStateAction<number>>;
    notificationData?: NotificationData | null;
    highlightedEntityId?: string | null;
};

const notificationTabs = ['Pending Approval', 'Pending Deliveries', 'Requested', 'Reserved', 'Pending Users'];

const sortArrayByBulkId = (array: Donation[]): Donation[][] => {
    const groupedByField = array.reduce(
        (acc, item) => {
            const sortByField = item.bulkCollection;
            if (!acc[sortByField]) {
                acc[sortByField] = [];
            }
            acc[sortByField].push(item);
            return acc;
        },
        {} as Record<string, Donation[]>
    );
    return Object.values(groupedByField);
};

const sortArrayByRequestor = (array: Donation[]): Donation[][] => {
    const groupedByField = array.reduce(
        (acc, item) => {
            const sortByField = item.requestor ? item.requestor.id : '';
            if (!acc[sortByField]) {
                acc[sortByField] = [];
            }
            acc[sortByField].push(item);
            return acc;
        },
        {} as Record<string, Donation[]>
    );
    return Object.values(groupedByField);
};

const Notifications = (props: NotificationsProps) => {
    const { notifications, setNotificationsUpdated, activeSubTab, onSubTabChange, notificationData, highlightedEntityId } = props;

    const [donationIdToDisplay, setDonationIdToDisplay] = useState<string | null>(null);
    const [userIdToDisplay, setUserIdToDisplay] = useState<string | null>(null);
    const [orderIdToDisplay, setOrderIdToDisplay] = useState<string | null>(null);
    const [localSubTab, setLocalSubTab] = useState<number>(0);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const matches = useMediaQuery('(min-width:600px)');
    const currentTab = activeSubTab ?? localSubTab;
    const open = Boolean(anchorEl);

    const donationsAwaitingApproval = notifications.donations.filter((donation) => donation.status === 'in processing');
    const sortedDonationsWaitingApproval = sortArrayByBulkId(donationsAwaitingApproval);
    const donationsAwaitingDropoff = notifications.donations.filter((donation) => donation.status === 'pending delivery');
    const sortedDonationsAwaitingDropoff = sortArrayByBulkId(donationsAwaitingDropoff);
    const donationsAwaitingPickup = notifications.donations.filter((donation) => donation.status === 'reserved');
    const sortedDonationsAwaitingPickup = sortArrayByRequestor(donationsAwaitingPickup);
    const orders = notifications.orders.filter((order) => order.items.length > 0);
    const usersAwaitingApproval = notifications.users.filter((user) => !user.isDeleted); //Filters out recently deleted users

    const router = useRouter();
    const hasNotifications = notifications.donations.length > 0 || notifications.orders.length > 0 || notifications.users.length > 0;

    const handleTabChange = (target: number) => {
        setLocalSubTab(target);
        if (onSubTabChange) onSubTabChange(target);
    };

    const emptyTabMessage = (label: string) => (
        <Typography sx={{ marginTop: '1rem' }} variant="body1">
            No {label.toLowerCase()} notifications at this time.
        </Typography>
    );

    const getBookingStatus = (donationId: string, mode: 'pickup' | 'dropoff'): BookingMatchConfidence | undefined => {
        const statusResult = mode === 'pickup' ? notificationData?.pickupBookingStatus : notificationData?.dropOffBookingStatus;
        return statusResult?.byDonationId[donationId]?.confidence;
    };

    return (
        <ProtectedAdminRoute>
            {donationIdToDisplay && <DonationDetails id={donationIdToDisplay} setIdToDisplay={setDonationIdToDisplay} />}
            {userIdToDisplay && <UserDetails id={userIdToDisplay} setIdToDisplay={setUserIdToDisplay} />}
            {orderIdToDisplay && (
                <ReviewOrder
                    id={orderIdToDisplay}
                    // order={orders.find((o) => o.id === orderIdToDisplay)}
                    setIdToDisplay={setOrderIdToDisplay}
                    setNotificationsUpdated={setNotificationsUpdated}
                />
            )}
            {!donationIdToDisplay && !userIdToDisplay && !orderIdToDisplay && (
                <>
                    {!hasNotifications && (
                        <Typography sx={{ marginTop: '1rem' }} variant="body1">
                            No new notifications at this time.
                        </Typography>
                    )}
                    {hasNotifications && (
                        <>
                            <div className={dashboardStyles['sub-navbar']}>
                                {matches ? (
                                    <Tabs
                                        value={currentTab}
                                        onChange={(_event: SyntheticEvent, target: number) => handleTabChange(target)}
                                        aria-label="notifications"
                                        variant="scrollable"
                                        scrollButtons="auto"
                                    >
                                        {notificationTabs.map((tab) => (
                                            <Tab key={tab} label={tab} sx={{ color: 'black' }} />
                                        ))}
                                    </Tabs>
                                ) : (
                                    <>
                                        <Button endIcon={<ArrowDropDownIcon />} onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}>
                                            {notificationTabs[currentTab]}
                                        </Button>
                                        <Menu id="selected-notification-tab" anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
                                            {notificationTabs.map((tab, i) => (
                                                <MenuItem
                                                    key={tab}
                                                    selected={i === currentTab}
                                                    onClick={() => {
                                                        handleTabChange(i);
                                                        setAnchorEl(null);
                                                    }}
                                                >
                                                    <p>{tab}</p>
                                                </MenuItem>
                                            ))}
                                        </Menu>
                                    </>
                                )}
                            </div>

                            <CustomTabPanel value={currentTab} index={0}>
                                {sortedDonationsWaitingApproval.length === 0
                                    ? emptyTabMessage('Pending Approval')
                                    : sortedDonationsWaitingApproval.map((donationArray) => (
                                          <Paper
                                              className={notificationStyles['notification-card--container']}
                                              key={donationArray[0]?.bulkCollection ?? donationArray[0]?.id}
                                              elevation={3}
                                          >
                                              {donationArray.map((donation) => (
                                                  <NotificationCard
                                                      key={donation.id}
                                                      donation={donation}
                                                      type="pending-donation"
                                                      setIdToDisplay={setDonationIdToDisplay}
                                                      setNotificationsUpdated={setNotificationsUpdated}
                                                      isHighlighted={highlightedEntityId === donation.id}
                                                  />
                                              ))}
                                              <Button
                                                  className={notificationStyles['notification-card--container--btn']}
                                                  variant="contained"
                                                  onClick={() => router.push(`/accept/${donationArray[0].bulkCollection}`)}
                                              >
                                                  Review
                                              </Button>
                                          </Paper>
                                      ))}
                            </CustomTabPanel>

                            <CustomTabPanel value={currentTab} index={1}>
                                {sortedDonationsAwaitingDropoff.length === 0
                                    ? emptyTabMessage('Pending Deliveries')
                                    : sortedDonationsAwaitingDropoff.map((donationArray) => (
                                          <Paper
                                              className={notificationStyles['notification-card--container']}
                                              key={donationArray[0]?.bulkCollection ?? donationArray[0]?.id}
                                              elevation={3}
                                          >
                                              {donationArray.map((donation) => (
                                                  <NotificationCard
                                                      key={donation.id}
                                                      donation={donation}
                                                      type="pending-delivery"
                                                      setIdToDisplay={setDonationIdToDisplay}
                                                      setNotificationsUpdated={setNotificationsUpdated}
                                                      calendlyStatus={getBookingStatus(donation.id, 'dropoff')}
                                                      isHighlighted={highlightedEntityId === donation.id}
                                                  />
                                              ))}
                                          </Paper>
                                      ))}
                            </CustomTabPanel>

                            <CustomTabPanel value={currentTab} index={2}>
                                {orders.length === 0
                                    ? emptyTabMessage('Requested')
                                    : orders.map((order) => (
                                          <Paper className={notificationStyles['notification-card--container']} key={order.id} elevation={3}>
                                              <Typography variant="h6">{`${order.requestor.name} has requested the following items:`}</Typography>
                                              {order.items.map((item) => (
                                                  <NotificationCard
                                                      key={item.id}
                                                      type="order"
                                                      donation={item}
                                                      setIdToDisplay={setDonationIdToDisplay}
                                                      setNotificationsUpdated={setNotificationsUpdated}
                                                      isHighlighted={highlightedEntityId === order.id || highlightedEntityId === item.id}
                                                  />
                                              ))}
                                              <Button
                                                  className={notificationStyles['notification-card--container--btn']}
                                                  variant="contained"
                                                  onClick={() => setOrderIdToDisplay(order.id)}
                                              >
                                                  Review
                                              </Button>
                                          </Paper>
                                      ))}
                            </CustomTabPanel>

                            <CustomTabPanel value={currentTab} index={3}>
                                {sortedDonationsAwaitingPickup.length === 0
                                    ? emptyTabMessage('Reserved')
                                    : sortedDonationsAwaitingPickup.map((donationArray) => (
                                          <Paper
                                              className={notificationStyles['notification-card--container']}
                                              key={donationArray[0]?.requestor?.id ?? donationArray[0]?.id}
                                              elevation={3}
                                          >
                                              {donationArray.map((donation) => (
                                                  <NotificationCard
                                                      key={donation.id}
                                                      donation={donation}
                                                      type="reserved"
                                                      setIdToDisplay={setDonationIdToDisplay}
                                                      setNotificationsUpdated={setNotificationsUpdated}
                                                      calendlyStatus={getBookingStatus(donation.id, 'pickup')}
                                                      isHighlighted={highlightedEntityId === donation.id}
                                                  />
                                              ))}
                                          </Paper>
                                      ))}
                            </CustomTabPanel>

                            <CustomTabPanel value={currentTab} index={4}>
                                {usersAwaitingApproval.length === 0
                                    ? emptyTabMessage('Pending Users')
                                    : usersAwaitingApproval.map((user) => (
                                          <NotificationCard
                                              key={user.uid}
                                              type="pending-user"
                                              user={user}
                                              setIdToDisplay={setUserIdToDisplay}
                                              setNotificationsUpdated={setNotificationsUpdated}
                                              isHighlighted={highlightedEntityId === user.uid}
                                          />
                                      ))}
                            </CustomTabPanel>
                        </>
                    )}
                </>
            )}
        </ProtectedAdminRoute>
    );
};

export default Notifications;
