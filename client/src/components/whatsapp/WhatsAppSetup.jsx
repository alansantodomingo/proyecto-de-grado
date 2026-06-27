import { QRCodeCanvas } from 'qrcode.react';
import { MessageSquare, RefreshCw, AlertCircle } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

const WhatsAppSetup = () => {
    const { status, qrCode, errorMsg, resetSession } = useSocket();

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full text-center">
                <h1 className="text-3xl font-bold mb-6 flex items-center justify-center gap-2">
                    <MessageSquare className="text-green-500" />
                    WhatsApp Agendamiento
                </h1>

                {status === 'connecting' && (
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCw className="animate-spin text-blue-400" size={48} />
                        <p>Conectando con el servidor...</p>
                    </div>
                )}

                {status === 'qr' && qrCode && (
                    <div className="flex flex-col items-center gap-6">
                        <p className="text-slate-300">Escanea el código QR para iniciar sesión</p>
                        <div className="bg-white p-4 rounded-xl">
                            <QRCodeCanvas value={qrCode} size={256} />
                        </div>
                        <p className="text-xs text-slate-400">El código se actualizará automáticamente</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-4">
                        <AlertCircle className="text-red-500" size={48} />
                        <h2 className="text-xl font-bold text-red-400">Error de Inicialización</h2>
                        <div className="bg-slate-900 p-3 rounded-lg text-xs font-mono text-red-300 break-all">
                            {errorMsg}
                        </div>
                        <button
                            onClick={resetSession}
                            className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
                        >
                            <RefreshCw size={18} />
                            Reiniciar Sesión
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppSetup;
