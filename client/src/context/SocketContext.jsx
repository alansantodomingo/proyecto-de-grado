import { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api';

const SocketContext = createContext();

const socket = io(API_URL);

export const SocketProvider = ({ children }) => {
    const [status, setStatus] = useState('disconnected');
    const [qrCode, setQrCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        socket.on('status_sync', (data) => {
            setStatus(data.status);
            if (data.message) setErrorMsg(data.message);
        });

        socket.on('qr', (qr) => {
            setQrCode(qr);
            setStatus('qr');
        });

        socket.on('ready', () => {
            setStatus('ready');
            setQrCode('');
        });

        return () => {
            socket.off('status_sync');
            socket.off('qr');
            socket.off('ready');
        };
    }, []);

    const resetSession = () => {
        socket.emit('reset_session');
    };

    return (
        <SocketContext.Provider value={{ socket, status, qrCode, errorMsg, resetSession }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
