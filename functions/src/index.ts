// Libs
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, CallableRequest, HttpsError, onRequest } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

//Types
import { UserRecord } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';

//Collections
const USERS_COLLECTION = 'Users';
const ORGANIZATIONS_COLLECTION = 'Organizations';
const DONATIONS_COLLECTION = 'Donations';
const CALENDLY_EVENTS_COLLECTION = 'CalendlyEvents';

admin.initializeApp();
const auth = admin.auth();
const db = admin.firestore();

setGlobalOptions({ region: process.env.REGION ? process.env.REGION : 'us-east1' });

//User-related
export const createnewuser = onCall(async (request: CallableRequest): Promise<UserRecord> => {
    try {
        const accountInfo = request.data;
        const { email, password, displayName, phoneNumber, organization, notes, title, termsAccepted } = accountInfo;

        if (!email || email.length === 0) return Promise.reject(new HttpsError('invalid-argument', 'A valid email address is required.'));
        if (!password || password.length === 0) return Promise.reject(new HttpsError('invalid-argument', 'Password is required.'));
        if (!displayName || displayName.length === 0) return Promise.reject(new HttpsError('invalid-argument', 'Display name is required.'));
        if (!phoneNumber || phoneNumber.length === 0) return Promise.reject(new HttpsError('invalid-argument', 'Phone number is required.'));

        const userRecord: UserRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: displayName,
            disabled: true
        });

        const userParams = {
            uid: userRecord.uid,
            isDisabled: true,
            email: userRecord.email,
            organization: organization,
            title: title,
            termsAccepted: termsAccepted,
            displayName: userRecord.displayName,
            phoneNumber: phoneNumber,
            requestedItems: [],
            notes: notes,
            createdAt: FieldValue.serverTimestamp(),
            modifiedAt: FieldValue.serverTimestamp()
        };

        const docRef = db.collection(USERS_COLLECTION).doc(userRecord.uid);
        const doc = await docRef.get();

        //If User exists in firestore, merge data
        if (doc.exists) {
            logger.error('User already exists in database', doc.data());
            docRef.set(userParams, { merge: true });
        } else {
            //Create new User in firestore
            docRef.set(userParams);
        }
        return userRecord;
    } catch (error) {
        logger.error('Error creating new user', error);
    }
    return Promise.reject(new HttpsError('unknown', 'An error occurred while trying to create a new user.'));
});

export const enableuser = onCall(async (request): Promise<void> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to enable user account.'));
    }
    if (request.auth && request.auth.token.admin != true) {
        return Promise.reject(new HttpsError('permission-denied', 'Only admins can enable user accounts.'));
    } else if (request.auth && request.auth.token.admin == true) {
        const userId = request.data.userId;
        if (!userId) {
            return Promise.reject(new HttpsError('invalid-argument', 'Must provide a user Id to enable a user account.'));
        } else {
            auth.updateUser(userId, { disabled: false })
                .then((user) => auth.setCustomUserClaims(user.uid, { 'aid-worker': true }))
                .then(() => console.log(`User ${userId} enabled`))
                .catch((error) => Promise.reject(new HttpsError('invalid-argument', 'Unable to update user account.')));
        }
    }
});

//Deletes firebase auth user
export const deleteuser = onCall(async (request): Promise<void> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to delete user account.'));
    }
    if (request.auth && request.auth.token.admin != true) {
        return Promise.reject(new HttpsError('permission-denied', 'Only admins can delete user accounts.'));
    } else if (request.auth && request.auth.token.admin == true) {
        const userId = request.data.userId;
        if (!userId) {
            return Promise.reject(new HttpsError('invalid-argument', 'Must provide a user Id to delete a user account.'));
        } else {
            auth.deleteUser(userId)
                .then(() => console.log(`User with ID: ${userId} deleted`))
                .catch((error) => Promise.reject(new HttpsError('invalid-argument', 'Unable to delete user account.')));
        }
    }
});

export const updateauthuser = onCall(async (request): Promise<UserRecord> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to list all users.'));
    }
    if (request.auth && !request.auth.token.admin) {
        return Promise.reject(new HttpsError('permission-denied', 'Only admins can update custom claims for users.'));
    }
    try {
        const { uid, accountInformation } = request.data;
        const updatedUser = await auth.updateUser(uid, accountInformation);
        return updatedUser;
    } catch (error) {
        logger.error('Error updating user', error);
    }
    return Promise.reject(new HttpsError('invalid-argument', 'Error updating user account.'));
});

export const isemailinuse = onCall(async (request): Promise<boolean> => {
    try {
        const email = request.data.email;
        const existingUser: UserRecord = await auth.getUserByEmail(email);
        if (existingUser !== undefined) {
            return true;
        } else {
            return false;
        }
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            return false;
        }
        if (error.code !== 'auth/invalid-email') {
            logger.error('Error checking if email is in use', error);
        }
    }
    return true;
});

export const listallusers = onCall(async (request): Promise<UserRecord[]> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to list all users.'));
    }
    if (request.auth && !request.auth.token.admin) {
        return Promise.reject(new HttpsError('permission-denied', 'Only admins can list all user accounts.'));
    }
    try {
        const usersListresult = await auth.listUsers(1000);
        const usersList: UserRecord[] = usersListresult.users;
        return usersList;
    } catch (error) {
        logger.error('Error fetching list of users', error);
    }
    return Promise.reject(new HttpsError('unknown', 'An error occurred while trying to list all users.'));
});

export const setcustomclaims = onCall(async (request): Promise<void> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to list all users.'));
    }
    if (request.auth && !request.auth.token.admin) {
        return Promise.reject(new HttpsError('permission-denied', 'Only admins can update custom claims for users.'));
    }
    try {
        const { userId, claims } = request.data;
        await auth.setCustomUserClaims(userId, claims);
    } catch (error) {
        logger.error('Error updating custom claims', error);
    }
});

//Orgs-related
export const getorganizationnames = onCall(
    async (
        request
    ): Promise<{
        [key: string]: string;
    }> => {
        try {
            const orgNames: {
                [key: string]: string;
            } = {};
            const snapshot = await db.collection(ORGANIZATIONS_COLLECTION).orderBy('name', 'asc').get();
            snapshot.forEach((snap) => {
                const { name } = snap.data();
                orgNames[name] = snap.id;
            });
            return orgNames;
        } catch (error) {
            return Promise.reject(new HttpsError('unavailable', 'Unable to fetch organization names'));
        }
    }
);

export const aredonationsavailable = onCall(async (request): Promise<string[]> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to check if donations are available.'));
    }
    try {
        let unavailableDonations = [];
        const requestedDonationIds = request.data;
        for (const requestedDonationId of requestedDonationIds) {
            const docRef = db.collection(DONATIONS_COLLECTION).doc(requestedDonationId);
            const donationDoc = await docRef.get();
            if (donationDoc.exists) {
                const donationDocData = donationDoc.data();
                if (donationDocData && donationDocData.status !== 'available') {
                    unavailableDonations.push(requestedDonationId);
                }
            }
        }
        return unavailableDonations;
    } catch (error) {
        return Promise.reject(new HttpsError('unavailable', 'Error checking if requested donations are still available.'));
    }
});

// Calendly Integration

const CALENDLY_API_BASE = 'https://api.calendly.com';

interface CalendlyTimeRangeMap {
    [key: string]: number;
}

const TIME_RANGE_DAYS: CalendlyTimeRangeMap = {
    '1week': 7,
    '2weeks': 14,
    '30days': 30,
    '60days': 60,
    '90days': 90
};

/**
 * Helper: Fetch from Calendly API with authorization.
 */
async function calendlyFetch(url: string, apiKey: string): Promise<any> {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${apiKey}`
        }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendly API error ${response.status}: ${errorText}`);
    }
    return response.json();
}

/**
 * On-demand Calendly sync: fetches scheduled events and their invitees,
 * then caches them in the CalendlyEvents Firestore collection.
 * Triggered by admin action.
 */
export const synccalendlyevents = onCall(async (request): Promise<{ count: number; syncedAt: string }> => {
    if (!request.auth) {
        return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in to sync Calendly events.'));
    }
    if (!request.auth.token.admin) {
        return Promise.reject(new HttpsError('permission-denied', 'Only admins can sync Calendly events.'));
    }

    const timeRange: string = request.data?.timeRange || '30days';
    const days = TIME_RANGE_DAYS[timeRange] || 30;
    const apiKey = process.env.CALENDLY_API_KEY;
    const orgId = process.env.CALENDLY_ORGANIZATION;

    if (!apiKey || !orgId) {
        return Promise.reject(new HttpsError('failed-precondition', 'Calendly API key or organization ID not configured.'));
    }

    const organizationUri = `${CALENDLY_API_BASE}/organizations/${orgId}`;
    const now = new Date();
    const minStart = new Date(now);
    minStart.setHours(0, 0, 0, 0);
    const maxStart = new Date(now);
    maxStart.setDate(maxStart.getDate() + days);
    maxStart.setHours(23, 59, 59, 999);

    try {
        // 1. Fetch all scheduled events with pagination
        const allEvents: any[] = [];
        let nextPageToken: string | null = null;

        do {
            const params = new URLSearchParams({
                organization: organizationUri,
                min_start_time: minStart.toISOString(),
                max_start_time: maxStart.toISOString(),
                status: 'active',
                sort: 'start_time:asc',
                count: '100'
            });
            if (nextPageToken) params.set('page_token', nextPageToken);

            const data = await calendlyFetch(`${CALENDLY_API_BASE}/scheduled_events?${params.toString()}`, apiKey);
            allEvents.push(...data.collection);
            nextPageToken = data.pagination?.next_page_token || null;
        } while (nextPageToken);

        // 2. Fetch invitees for each event
        const batch = db.batch();
        for (const event of allEvents) {
            const invitees: any[] = [];
            let inviteeToken: string | null = null;

            do {
                const invParams = new URLSearchParams({ status: 'active', count: '100' });
                if (inviteeToken) invParams.set('page_token', inviteeToken);

                const invData = await calendlyFetch(`${event.uri}/invitees?${invParams.toString()}`, apiKey);
                invitees.push(
                    ...invData.collection.map((inv: any) => ({
                        name: inv.name,
                        email: inv.email,
                        firstName: inv.first_name,
                        lastName: inv.last_name,
                        status: inv.status
                    }))
                );
                inviteeToken = invData.pagination?.next_page_token || null;
            } while (inviteeToken);

            // Use a safe document ID from the event URI
            const eventId = event.uri.split('/').pop() || event.uri;
            const docRef = db.collection(CALENDLY_EVENTS_COLLECTION).doc(eventId);

            batch.set(
                docRef,
                {
                    eventUri: event.uri,
                    name: event.name,
                    status: event.status,
                    startTime: event.start_time,
                    endTime: event.end_time,
                    eventType: event.event_type,
                    invitees: invitees,
                    eventMemberships: event.event_memberships || [],
                    syncedAt: FieldValue.serverTimestamp()
                },
                { merge: true }
            );
        }

        await batch.commit();
        const syncedAt = new Date().toISOString();
        logger.info(`Synced ${allEvents.length} Calendly events at ${syncedAt}`);

        return { count: allEvents.length, syncedAt };
    } catch (error) {
        logger.error('Error syncing Calendly events', error);
        return Promise.reject(new HttpsError('internal', 'Failed to sync Calendly events.'));
    }
});

/**
 * Calendly webhook endpoint: receives real-time booking notifications.
 * Upserts the CalendlyEvents collection when invitees are created, canceled, etc.
 */
export const calendlywebhook = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const payload = req.body;
        const eventType = payload?.event; // e.g. 'invitee.created', 'invitee.canceled'
        const eventPayload = payload?.payload;

        if (!eventType || !eventPayload) {
            res.status(400).send('Invalid webhook payload');
            return;
        }

        logger.info(`Calendly webhook received: ${eventType}`);

        // Extract the scheduled event URI from the payload
        const scheduledEventUri = eventPayload.scheduled_event?.uri;
        if (!scheduledEventUri) {
            res.status(200).send('OK - no scheduled event URI');
            return;
        }

        const eventId = scheduledEventUri.split('/').pop();
        if (!eventId) {
            res.status(200).send('OK - could not parse event ID');
            return;
        }

        const docRef = db.collection(CALENDLY_EVENTS_COLLECTION).doc(eventId);
        const existingDoc = await docRef.get();

        if (eventType === 'invitee.created') {
            const newInvitee = {
                name: eventPayload.name || '',
                email: eventPayload.email || '',
                firstName: eventPayload.first_name || null,
                lastName: eventPayload.last_name || null,
                status: 'active'
            };

            if (existingDoc.exists) {
                // Append invitee to existing event doc
                const existingData = existingDoc.data();
                const invitees = existingData?.invitees || [];
                // Avoid duplicates by checking email
                const alreadyExists = invitees.some((inv: any) => inv.email === newInvitee.email);
                if (!alreadyExists) {
                    invitees.push(newInvitee);
                }
                await docRef.update({
                    invitees: invitees,
                    syncedAt: FieldValue.serverTimestamp()
                });
            } else {
                // Create new event doc with basic info
                const scheduledEvent = eventPayload.scheduled_event;
                await docRef.set({
                    eventUri: scheduledEventUri,
                    name: scheduledEvent?.name || 'Unknown Event',
                    status: scheduledEvent?.status || 'active',
                    startTime: scheduledEvent?.start_time || '',
                    endTime: scheduledEvent?.end_time || '',
                    eventType: scheduledEvent?.event_type || '',
                    invitees: [newInvitee],
                    eventMemberships: scheduledEvent?.event_memberships || [],
                    syncedAt: FieldValue.serverTimestamp()
                });
            }
        } else if (eventType === 'invitee.canceled') {
            if (existingDoc.exists) {
                const existingData = existingDoc.data();
                const invitees = (existingData?.invitees || []).map((inv: any) => {
                    if (inv.email === eventPayload.email) {
                        return { ...inv, status: 'canceled' };
                    }
                    return inv;
                });
                await docRef.update({
                    invitees: invitees,
                    syncedAt: FieldValue.serverTimestamp()
                });
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('Error processing Calendly webhook', error);
        res.status(500).send('Internal Server Error');
    }
});

/**
 * Get booking status: cross-references cached CalendlyEvents with Donations
 * and Users to determine which bookings are confirmed, possible matches, or unconfirmed.
 */
export const getcalendlybookingstatus = onCall(
    async (
        request
    ): Promise<{
        pickup: { confirmed: any[]; possibleMatches: any[]; unconfirmed: any[] };
        dropoff: { confirmed: any[]; possibleMatches: any[]; unconfirmed: any[] };
    }> => {
        if (!request.auth) {
            return Promise.reject(new HttpsError('unauthenticated', 'Must be signed in.'));
        }
        if (!request.auth.token.admin) {
            return Promise.reject(new HttpsError('permission-denied', 'Only admins can view booking status.'));
        }

        const timeRange: string = request.data?.timeRange || '30days';
        const days = TIME_RANGE_DAYS[timeRange] || 30;

        try {
            // 1. Fetch cached Calendly events within range
            const now = new Date();
            const minStart = new Date(now);
            minStart.setHours(0, 0, 0, 0);
            const maxStart = new Date(now);
            maxStart.setDate(maxStart.getDate() + days);

            const eventsSnapshot = await db
                .collection(CALENDLY_EVENTS_COLLECTION)
                .where('startTime', '>=', minStart.toISOString())
                .where('startTime', '<=', maxStart.toISOString())
                .get();

            const cachedEvents: any[] = [];
            eventsSnapshot.forEach((doc) => cachedEvents.push({ id: doc.id, ...doc.data() }));

            // Build invitee index: { email -> event[], name -> event[] }
            const inviteeByEmail: Map<string, any[]> = new Map();
            const inviteeByName: Map<string, any[]> = new Map();

            for (const event of cachedEvents) {
                for (const inv of event.invitees || []) {
                    if (inv.status !== 'active') continue;

                    const email = (inv.email || '').toLowerCase().trim();
                    const name = (inv.name || '').toLowerCase().trim();

                    if (email) {
                        if (!inviteeByEmail.has(email)) inviteeByEmail.set(email, []);
                        inviteeByEmail.get(email)!.push({ invitee: inv, event });
                    }
                    if (name) {
                        if (!inviteeByName.has(name)) inviteeByName.set(name, []);
                        inviteeByName.get(name)!.push({ invitee: inv, event });
                    }
                }
            }

            // 2. Fetch donations in relevant statuses
            const [reservedSnap, pendingDeliverySnap] = await Promise.all([
                db.collection(DONATIONS_COLLECTION).where('status', '==', 'reserved').get(),
                db.collection(DONATIONS_COLLECTION).where('status', '==', 'pending delivery').get()
            ]);

            // 3. Match reserved donations (pickup) against invitees
            const pickupConfirmed: any[] = [];
            const pickupPossible: any[] = [];
            const pickupUnconfirmed: any[] = [];

            reservedSnap.forEach((docSnap) => {
                const d = docSnap.data();
                const email = (d.requestor?.email || '').toLowerCase().trim();
                const name = (d.requestor?.name || '').toLowerCase().trim();

                const emailMatch = email ? inviteeByEmail.get(email) : undefined;
                if (emailMatch && emailMatch.length > 0) {
                    pickupConfirmed.push({
                        donationId: docSnap.id,
                        lookupEmail: email,
                        lookupName: name,
                        confidence: 'confirmed',
                        matchedInvitee: emailMatch[0].invitee,
                        matchedEventName: emailMatch[0].event.name,
                        matchedEventStart: emailMatch[0].event.startTime
                    });
                } else {
                    // Try name match
                    const nameMatch = name ? inviteeByName.get(name) : undefined;
                    if (nameMatch && nameMatch.length > 0) {
                        pickupPossible.push({
                            donationId: docSnap.id,
                            lookupEmail: email,
                            lookupName: name,
                            confidence: 'possible-match',
                            matchedInvitee: nameMatch[0].invitee,
                            matchedEventName: nameMatch[0].event.name,
                            matchedEventStart: nameMatch[0].event.startTime
                        });
                    } else {
                        pickupUnconfirmed.push({
                            donationId: docSnap.id,
                            lookupEmail: email,
                            lookupName: name,
                            confidence: 'unconfirmed'
                        });
                    }
                }
            });

            // 4. Match pending delivery donations (drop-off) against invitees
            const dropoffConfirmed: any[] = [];
            const dropoffPossible: any[] = [];
            const dropoffUnconfirmed: any[] = [];

            pendingDeliverySnap.forEach((docSnap) => {
                const d = docSnap.data();
                const email = (d.donorEmail || '').toLowerCase().trim();
                const name = (d.donorName || '').toLowerCase().trim();

                const emailMatch = email ? inviteeByEmail.get(email) : undefined;
                if (emailMatch && emailMatch.length > 0) {
                    dropoffConfirmed.push({
                        donationId: docSnap.id,
                        lookupEmail: email,
                        lookupName: name,
                        confidence: 'confirmed',
                        matchedInvitee: emailMatch[0].invitee,
                        matchedEventName: emailMatch[0].event.name,
                        matchedEventStart: emailMatch[0].event.startTime
                    });
                } else {
                    const nameMatch = name ? inviteeByName.get(name) : undefined;
                    if (nameMatch && nameMatch.length > 0) {
                        dropoffPossible.push({
                            donationId: docSnap.id,
                            lookupEmail: email,
                            lookupName: name,
                            confidence: 'possible-match',
                            matchedInvitee: nameMatch[0].invitee,
                            matchedEventName: nameMatch[0].event.name,
                            matchedEventStart: nameMatch[0].event.startTime
                        });
                    } else {
                        dropoffUnconfirmed.push({
                            donationId: docSnap.id,
                            lookupEmail: email,
                            lookupName: name,
                            confidence: 'unconfirmed'
                        });
                    }
                }
            });

            return {
                pickup: { confirmed: pickupConfirmed, possibleMatches: pickupPossible, unconfirmed: pickupUnconfirmed },
                dropoff: { confirmed: dropoffConfirmed, possibleMatches: dropoffPossible, unconfirmed: dropoffUnconfirmed }
            };
        } catch (error) {
            logger.error('Error getting booking status', error);
            return Promise.reject(new HttpsError('internal', 'Failed to get booking status.'));
        }
    }
);
