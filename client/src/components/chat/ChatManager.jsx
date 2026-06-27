import { useState, useEffect } from 'react';
import {
    MessageSquare,
    Search,
    X,
    ArrowLeft
} from 'lucide-react';
import api from '../../api';

const ChatManager = ({ chats, fetchChats }) => {
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        let interval;
        if (!selectedChat) {
            interval = setInterval(fetchChats, 5000);
        } else {
            interval = setInterval(() => fetchMessages(selectedChat.phone), 3000);
        }
        return () => clearInterval(interval);
    }, [selectedChat, fetchChats]);

    const fetchMessages = async (phone) => {
        try {
            const res = await api.get(`/api/chats/${phone}/messages`);
            setMessages(res.data);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedChat) return;

        try {
            await api.post(`/api/chats/${selectedChat.phone}/send`, { body: newMessage });
            setNewMessage('');
            fetchMessages(selectedChat.phone);
            fetchChats();
        } catch (err) {
            alert('Error al enviar: ' + err.message);
        }
    };

    const toggleBot = async (phone, active) => {
        try {
            await api.post(`/api/chats/${phone}/toggle-bot`, { active });
            setSelectedChat(prev => ({ ...prev, is_bot_active: active }));
            fetchChats();
        } catch (err) {
            alert('Error al cambiar estado del bot: ' + err.message);
        }
    };

    return (
        <div className="flex h-[calc(100vh-10rem)] bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Contacts Sidebar */}
            <div className="w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50/50 dark:bg-slate-800/50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageSquare size={18} className="text-green-500" />
                        Conversaciones
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar paciente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-auto">
                    {chats
                        .filter(c =>
                            (c.patient_name && c.patient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            c.phone.includes(searchTerm)
                        )
                        .map((chat) => (
                            <button
                                key={chat.phone}
                                onClick={() => {
                                    setSelectedChat(chat);
                                    fetchMessages(chat.phone);
                                }}
                                className={`w-full p-4 flex flex-col gap-1 text-left transition-all border-b border-slate-200 dark:border-slate-700/50 ${selectedChat?.phone === chat.phone
                                    ? 'bg-blue-100 dark:bg-blue-600/20 border-l-4 border-l-blue-500'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-slate-900 dark:text-white truncate w-full pr-2 flex items-center gap-2">
                                        {chat.patient_name || chat.phone}
                                        {chat.advisor_requested && (
                                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" title="Solicitud de Asesor"></span>
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-500 font-mono mt-1">
                                    <span className="uppercase">{chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    <div className="flex gap-2 items-center">
                                        <span className={`w-1.5 h-1.5 rounded-full ${chat.is_bot_active ? 'bg-green-500' : 'bg-amber-500'}`} title={chat.is_bot_active ? 'Bot Activo' : 'Manual'}></span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate italic mt-1">
                                    {chat.from_me ? 'Tú: ' : ''}{chat.last_message || 'Sin mensajes'}
                                </p>
                            </button>
                        ))}
                </div>
            </div>

            {/* Chat Window */}
            {selectedChat ? (
                <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/20 backdrop-blur-sm">
                    {/* Chat Header */}
                    <header className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/80 dark:bg-slate-800/80">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedChat(null)}
                                className="hidden md:block p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 mr-1"
                                title="Cerrar chat"
                            >
                                <X size={16} />
                            </button>
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white uppercase shadow-lg shadow-blue-900/50">
                                {(selectedChat.patient_name || '?')[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {selectedChat.patient_name || 'Paciente'}
                                    {selectedChat.advisor_requested && <span className="text-[10px] bg-red-500/20 text-red-500 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-500/50">Solicita Asesor</span>}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{selectedChat.phone}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span className={`text-[10px] font-bold ${selectedChat.is_bot_active ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                    BOT: {selectedChat.is_bot_active ? 'ON' : 'OFF'}
                                </span>
                                <button
                                    onClick={() => toggleBot(selectedChat.phone, !selectedChat.is_bot_active)}
                                    className={`w-10 h-5 rounded-full relative transition-all ${selectedChat.is_bot_active ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${selectedChat.is_bot_active ? 'right-1' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Messages History */}
                    <div className="flex-1 overflow-auto p-6 space-y-4 bg-white/90 dark:bg-slate-900/90 relative">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.from_me ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative ${m.from_me
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                                    }`}>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                                    <span className={`text-[9px] block text-right mt-1 opacity-60 font-mono`}>
                                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Message Input */}
                    <footer className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white"
                            />
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl shadow-lg transition-transform active:scale-95"
                            >
                                <MessageSquare size={20} />
                            </button>
                        </form>
                    </footer>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full border border-slate-200 dark:border-slate-700 shadow-inner">
                        <MessageSquare size={64} className="opacity-20 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-400">Canal de Mensajería</h3>
                        <p className="max-w-xs text-sm">Selecciona una conversación a la izquierda para ver el historial y responder manualmente.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatManager;
