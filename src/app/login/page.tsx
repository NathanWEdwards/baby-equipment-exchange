'use client';
//Components
import ToasterNotification from '@/components/ToasterNotification';
import Loader from '@/components/Loader';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { Box, TextField, Button } from '@mui/material';

//Hooks
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
//Libs
import { addEvent, signInAuthUserWithEmailAndPassword, onAuthStateChangedListener } from '@/api/firebase';
//Styling
import globalStyles from '@/styles/globalStyles.module.scss';
import styles from './Login.module.css';

export default function Login() {
    const [loginState, setLoginState] = useState<'pending' | 'loggedIn' | 'loggedOut'>('pending');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [status, setStatus] = useState<string|null>(null);
    const router = useRouter();

    useEffect(() => {
        onAuthStateChangedListener((user) => {
            if (user) router.push('/');
            else setLoginState('loggedOut');
        });
    }, [router]);

    const handleLogin = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        signInAuthUserWithEmailAndPassword(email, password)
            .then((_) => {router.push('/');})
            .catch((error) => {
                addEvent({"error":error});
                setStatus('invalid_login');
            });
    };

    return (
        <>
            <div className={styles['login__container']}>
                <h1>Login</h1>
                <h4>[Page Summary]</h4>
                <div className={globalStyles['content__container']}>
                    {loginState === 'pending' && <Loader />}
                    {loginState === 'loggedOut' && (
                        <>
                            <Box component="form" gap={3} display={'flex'} flexDirection={'column'} onSubmit={handleLogin}>
                                <TextField
                                    type="text"
                                    name="email"
                                    id="email"
                                    label="Email"
                                    placeholder="Input Email"
                                    autoComplete="email"
                                    value={email}
                                    required
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                        setEmail(event.target.value);
                                    }}
                                />
                                <TextField
                                    type="password"
                                    name="password"
                                    id="password"
                                    label="Password"
                                    placeholder="Input Password"
                                    autoComplete="current-password"
                                    value={password}
                                    required
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                                        setPassword(event.target.value);
                                    }}
                                />
                                <Button variant="contained" type="submit" endIcon={<VpnKeyOutlinedIcon />}>
                                    Login
                                </Button>
                            </Box>
                            <hr />
                            <span>Instructions for forgotten password.</span>
                        </>
                    )}
                </div>
            </div>
            {status && <ToasterNotification status={status} />}
        </>
    );
}
