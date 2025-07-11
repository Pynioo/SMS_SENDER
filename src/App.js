import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut
} from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { 
    Send, BookUser, Users, MessageSquareText, Clock, Plus, Trash2, Edit, X, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Menu, LogOut, AtSign, Lock
} from 'lucide-react';

// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC_e9cp-LRf9eTuAVMLMjJZfifE_mMJeSo",
  authDomain: "sms-main.firebaseapp.com",
  projectId: "sms-main",
  storageBucket: "sms-main.firebasestorage.app",
  messagingSenderId: "206157036055",
  appId: "1:206157036055:web:bce1052149a01b258dfa52",
  measurementId: "G-9G6FE4L8P8"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- KLASA DO OBS£UGI NUMERÓW TELEFONU ---
class PhoneNumberHz {
    constructor(rawNumber) {
        if (typeof rawNumber !== 'string') throw new Error('Numer telefonu musi byæ tekstem.');
        let cleanedNumber = rawNumber.replace(/[\s()+-]/g, '').replace(/^0+/, '');
        if (cleanedNumber.length < 9 || cleanedNumber.length > 20) throw new Error('Nieprawid³owa d³ugoœæ numeru telefonu.');
        if (cleanedNumber.length === 9) cleanedNumber = '48' + cleanedNumber;
        this.formattedNumber = cleanedNumber;
    }
    getNumber() { return this.formattedNumber; }
}

// --- G£ÓWNE KOMPONENTY UI ---
const CCard = ({ children, className = '' }) => (<div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>{children}</div>);
const CCardHeader = ({ children, className = '' }) => (<div className={`px-6 py-4 border-b border-gray-200 font-semibold text-gray-700 ${className}`}>{children}</div>);
const CCardBody = ({ children, className = '' }) => (<div className={`p-6 ${className}`}>{children}</div>);
const CButton = ({ children, onClick, color = 'primary', variant = 'solid', className = '', type = 'button', disabled = false }) => {
    const baseClasses = 'px-4 py-2 rounded-md font-semibold text-sm inline-flex items-center justify-center transition-colors duration-150';
    const colorClasses = {
        solid: { primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300', danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300', secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100' },
        outline: { primary: 'border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300', danger: 'border border-red-600 text-red-600 hover:bg-red-50 disabled:text-gray-400 disabled:border-gray-300' }
    };
    return (<button type={type} onClick={onClick} disabled={disabled} className={`${baseClasses} ${colorClasses[variant][color]} ${className}`}>{children}</button>);
};
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (<div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"><div className="flex justify-between items-center p-4 border-b"><h3 className="text-lg font-semibold text-gray-800">{title}</h3><button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100"><X size={24} /></button></div><div className="p-6 overflow-y-auto">{children}</div></div></div>);
};
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (<Modal isOpen={isOpen} onClose={onClose} title={title}><p className="text-gray-600 mb-6">{message}</p><div className="flex justify-end space-x-3"><CButton onClick={onClose} color="secondary">Anuluj</CButton><CButton onClick={onConfirm} color="danger">PotwierdŸ</CButton></div></Modal>);
};

const Toast = ({ message, type, onDismiss }) => {
    // POPRAWKA: Hak useEffect jest teraz wywo³ywany bezwarunkowo na pocz¹tku komponentu.
    useEffect(() => {
        // Logika warunkowa zosta³a przeniesiona do wnêtrza haka.
        if (message) {
            const timer = setTimeout(() => onDismiss(), 4000);
            return () => clearTimeout(timer);
        }
    }, [message, onDismiss]);

    // Warunkowe renderowanie (early return) jest teraz PO wszystkich hakach.
    if (!message) return null;

    const styles = { 
        success: { bg: 'bg-green-500', icon: <CheckCircle /> }, 
        error: { bg: 'bg-red-500', icon: <AlertCircle /> } 
    };
    
    return (
        <div className="fixed top-5 right-5 z-50">
            <div className={`${styles[type].bg} text-white rounded-lg shadow-lg p-4 flex items-center`}>
                {styles[type].icon}
                <span className="ml-3">{message}</span>
            </div>
        </div>
    );
};


// --- KOMPONENTY FORMULARZY ---
const ContactForm = ({ onSave, onCancel, contact }) => {
    const [formData, setFormData] = useState({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', rawPhone: contact?.rawPhone || '' });
    const [error, setError] = useState('');
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => { e.preventDefault(); setError(''); const { firstName, lastName, rawPhone } = formData; if (!firstName || !lastName || !rawPhone) return setError('Wszystkie pola s¹ wymagane.'); try { const phoneNumber = new PhoneNumberHz(rawPhone); onSave({ id: contact?.id, firstName, lastName, phone: phoneNumber.getNumber(), rawPhone }); } catch (err) { setError(err.message); } };
    return (<form onSubmit={handleSubmit} className="space-y-4">{['firstName', 'lastName', 'rawPhone'].map(field => { const labels = { firstName: 'Imiê', lastName: 'Nazwisko', rawPhone: 'Numer telefonu' }; return (<div key={field}><label className="block text-sm font-medium text-gray-700 mb-1">{labels[field]}</label><input type="text" name={field} value={formData[field]} onChange={handleChange} className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div>); })}{error && <p className="text-red-500 text-sm">{error}</p>}<div className="flex justify-end space-x-3 pt-4"><CButton onClick={onCancel} color="secondary">Anuluj</CButton><CButton type="submit" color="primary">Zapisz</CButton></div></form>);
};
const GroupForm = ({ onSave, onCancel, group, contacts }) => {
    const [name, setName] = useState(group?.name || '');
    const [selectedContacts, setSelectedContacts] = useState(group?.contacts || []);
    const [error, setError] = useState('');
    const handleToggleContact = (contactId) => setSelectedContacts(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]);
    const handleSubmit = (e) => { e.preventDefault(); if (!name) return setError('Nazwa grupy jest wymagana.'); onSave({ id: group?.id, name, contacts: selectedContacts }); };
    return (<form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700">Nazwa grupy</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="np. Zespó³ marketingowy" /></div><div><label className="block text-sm font-medium text-gray-700">Cz³onkowie</label><div className="mt-2 max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-2">{contacts.length > 0 ? contacts.map(contact => (<div key={contact.id} className="flex items-center"><input type="checkbox" id={`contact-${contact.id}`} checked={selectedContacts.includes(contact.id)} onChange={() => handleToggleContact(contact.id)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" /><label htmlFor={`contact-${contact.id}`} className="ml-3 text-sm text-gray-700">{contact.firstName} {contact.lastName} ({contact.phone})</label></div>)) : <p className="text-sm text-gray-500">Brak kontaktów do dodania.</p>}</div></div>{error && <p className="text-red-500 text-sm">{error}</p>}<div className="flex justify-end space-x-3 pt-4"><CButton onClick={onCancel} color="secondary">Anuluj</CButton><CButton type="submit" color="primary">Zapisz</CButton></div></form>);
};
const TemplateForm = ({ onSave, onCancel, template }) => {
    const [name, setName] = useState(template?.name || '');
    const [content, setContent] = useState(template?.content || '');
    const [error, setError] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (!name || !content) return setError('Wszystkie pola s¹ wymagane.'); onSave({ id: template?.id, name, content }); };
    return (<form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700">Nazwa szablonu</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="np. Przypomnienie o spotkaniu" /></div><div><label className="block text-sm font-medium text-gray-700">Treœæ wiadomoœci</label><textarea value={content} onChange={(e) => setContent(e.target.value)} rows="4" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Szanowni Pañstwo, przypominamy o..."></textarea></div>{error && <p className="text-red-500 text-sm">{error}</p>}<div className="flex justify-end space-x-3 pt-4"><CButton onClick={onCancel} color="secondary">Anuluj</CButton><CButton type="submit" color="primary">Zapisz</CButton></div></form>);
};

// --- KOMPONENT LOGOWANIA ---
const AuthView = ({ showToast }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('Zalogowano pomyœlnie!');
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                showToast('Konto utworzone pomyœlnie!');
            }
        } catch (err) {
            setError(err.message);
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-center text-gray-800">{isLogin ? 'Logowanie' : 'Rejestracja'}</h2>
                <form onSubmit={handleAuthAction} className="space-y-6">
                    <div className="relative"><AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Adres e-mail" required className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/></div>
                    <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Has³o" required className="w-full py-2 pl-10 pr-4 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"/></div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div><CButton type="submit" color="primary" className="w-full" disabled={loading}>{loading ? 'Przetwarzanie...' : (isLogin ? 'Zaloguj siê' : 'Zarejestruj siê')}</CButton></div>
                </form>
                <div className="text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm text-blue-600 hover:underline">
                        {isLogin ? 'Nie masz konta? Zarejestruj siê' : 'Masz ju¿ konto? Zaloguj siê'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- G£ÓWNY KOMPONENT APLIKACJI ---
export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [activeView, setActiveView] = useState('send');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [scheduled, setScheduled] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [modal, setModal] = useState({ isOpen: false, type: '', data: null });
    const [toast, setToast] = useState({ message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    useEffect(() => {
        const authUnsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setIsLoading(false);
            if (user) {
                const collections = { contacts: setContacts, groups: setGroups, templates: setTemplates, scheduled: setScheduled };
                const unsubscribers = Object.entries(collections).map(([name, setter]) => 
                    onSnapshot(collection(db, 'shared_data', 'data', name), snapshot => {
                        setter(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    }, (error) => {
                        console.error(`B³¹d nas³uchiwacza dla '${name}':`, error);
                        showToast("B³¹d uprawnieñ. SprawdŸ regu³y bazy danych.", "error");
                    })
                );
                return () => unsubscribers.forEach(unsub => unsub());
            }
        });
        return () => authUnsubscribe();
    }, []);

    const showToast = (message, type = 'success') => setToast({ message, type });
    const openModal = (type, data = null) => setModal({ isOpen: true, type, data });
    const closeModal = () => setModal({ isOpen: false, type: '', data: null });
    const closeConfirmation = () => setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const handleSaveData = async (collectionName, data) => {
        if (!currentUser) return showToast("B³¹d: U¿ytkownik nie jest zalogowany.", "error");
        try {
            const path = collection(db, 'shared_data', 'data', collectionName);
            const { id, ...restData } = data;
            if (id) {
                await updateDoc(doc(path, id), restData);
                showToast(`${collectionName.slice(0, -1)} zaktualizowany!`);
            } else {
                await addDoc(path, restData);
                showToast(`${collectionName.slice(0, -1)} dodany!`);
            }
            closeModal();
        } catch (error) { showToast(`B³¹d podczas zapisu ${collectionName.slice(0, -1)}.`, 'error'); }
    };
    
    const handleDeleteRequest = (collectionName, id) => {
        setConfirmation({ isOpen: true, title: 'Potwierdzenie usuniêcia', message: 'Czy na pewno chcesz usun¹æ ten element? Tej operacji nie mo¿na cofn¹æ.', onConfirm: () => executeDelete(collectionName, id) });
    };

    const executeDelete = async (collectionName, id) => {
        try { 
            await deleteDoc(doc(db, 'shared_data', 'data', collectionName, id)); 
            showToast('Element usuniêty.'); 
        } catch (error) { showToast('B³¹d podczas usuwania.', 'error'); }
        closeConfirmation();
    };

    const handleScheduleMessage = async (scheduleData) => {
        if (!currentUser) return showToast("B³¹d: U¿ytkownik nie jest zalogowany.", "error");
        try { 
            await addDoc(collection(db, 'shared_data', 'data', 'scheduled'), scheduleData); 
            showToast('Wiadomoœæ zaplanowana!', 'success'); return true; 
        } catch (error) { showToast('B³¹d planowania wiadomoœci.', 'error'); return false; }
    };
    
    const handleLogout = async () => {
        try { await signOut(auth); showToast("Wylogowano pomyœlnie."); } catch (error) { showToast("B³¹d podczas wylogowywania.", "error"); }
    };

    if (isLoading) return <div className="flex items-center justify-center h-screen">£adowanie...</div>;
    
    if (!currentUser) return <AuthView showToast={showToast} />;

    const renderModalContent = () => {
        switch (modal.type) {
            case 'contact': return <ContactForm onSave={(data) => handleSaveData('contacts', data)} onCancel={closeModal} contact={modal.data} />;
            case 'group': return <GroupForm onSave={(data) => handleSaveData('groups', data)} onCancel={closeModal} group={modal.data} contacts={contacts} />;
            case 'template': return <TemplateForm onSave={(data) => handleSaveData('templates', data)} onCancel={closeModal} template={modal.data} />;
            default: return null;
        }
    };
    
    const getModalTitle = () => {
        const titles = { contact: 'kontakt', group: 'grupê', template: 'szablon' };
        return modal.data ? `Edytuj ${titles[modal.type]}` : `Utwórz nowy ${titles[modal.type]}`;
    };
    
    const renderView = () => {
        switch (activeView) {
            case 'send': return <SendSmsView contacts={contacts} groups={groups} templates={templates} onSchedule={handleScheduleMessage} showToast={showToast} />;
            case 'contacts': return <ContactsView contacts={contacts} onEdit={(c) => openModal('contact', c)} onDelete={(id) => handleDeleteRequest('contacts', id)} />;
            case 'groups': return <GroupsView groups={groups} contacts={contacts} onEdit={(g) => openModal('group', g)} onDelete={(id) => handleDeleteRequest('groups', id)} />;
            case 'templates': return <TemplatesView templates={templates} onEdit={(t) => openModal('template', t)} onDelete={(id) => handleDeleteRequest('templates', id)} />;
            default: return <DashboardView />;
        }
    };
    
    const viewTitles = { send: 'Wyœlij SMS', contacts: 'Ksi¹¿ka adresowa', groups: 'Grupy odbiorców', templates: 'Szablony wiadomoœci', scheduled: 'Zaplanowane wysy³ki' };

    const getHeaderAction = () => {
        const actions = { contacts: { label: 'Dodaj kontakt', modal: 'contact' }, groups: { label: 'Utwórz grupê', modal: 'group' }, templates: { label: 'Utwórz szablon', modal: 'template' } };
        const action = actions[activeView];
        if (!action) return null;
        return <CButton onClick={() => openModal(action.modal)} color="primary"><Plus size={16} className="mr-1" /> {action.label}</CButton>;
    };

    return (
        <div className="flex h-screen bg-gray-100">
            <Toast message={toast.message} type={toast.type} onDismiss={() => setToast({ message: '', type: '' })} />
            <Modal isOpen={modal.isOpen} onClose={closeModal} title={getModalTitle()}>{renderModalContent()}</Modal>
            <ConfirmationModal isOpen={confirmation.isOpen} onClose={closeConfirmation} onConfirm={confirmation.onConfirm} title={confirmation.title} message={confirmation.message} />
            
            <aside className={`bg-[#3c4b64] text-white flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
                <div className="h-16 flex items-center justify-center bg-[#344054] text-xl font-semibold">{isSidebarOpen ? 'SMS Sender' : 'SMS'}</div>
                <nav className="flex-grow p-2 space-y-2">
                    {Object.keys(viewTitles).map(key => {
                        const icons = { send: <Send size={20}/>, contacts: <BookUser size={20}/>, groups: <Users size={20}/>, templates: <MessageSquareText size={20}/>, scheduled: <Clock size={20}/> };
                        return <NavItem key={key} icon={icons[key]} label={viewTitles[key]} isSidebarOpen={isSidebarOpen} isActive={activeView === key} onClick={() => setActiveView(key)} />;
                    })}
                </nav>
                <div className="p-2 border-t border-gray-700">
                    <NavItem icon={<LogOut size={20}/>} label="Wyloguj" isSidebarOpen={isSidebarOpen} isActive={false} onClick={handleLogout} />
                </div>
                <div className="p-4 border-t border-gray-700 text-xs text-gray-400 break-words">
                    <p className="font-semibold">Zalogowano jako:</p>
                    <p>{currentUser.email}</p>
                </div>
            </aside>

            <div className="flex-1 flex flex-col">
                <header className="h-16 bg-white border-b flex items-center justify-between px-6">
                    <div className="flex items-center"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-600 mr-4"><Menu size={24} /></button><h1 className="text-lg font-semibold text-gray-800">{viewTitles[activeView] || 'Panel'}</h1></div>
                    <div className="flex items-center">{getHeaderAction()}</div>
                </header>
                <main className="flex-1 p-6 overflow-y-auto">{renderView()}</main>
            </div>
        </div>
    );
}

const NavItem = ({ icon, label, isSidebarOpen, isActive, onClick }) => (<button onClick={onClick} className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-[#4a5a78]'}`}>{icon}{isSidebarOpen && <span className="ml-4">{label}</span>}</button>);

const DashboardView = () => (<CCard><CCardHeader>Witaj w panelu SMS Sender</CCardHeader><CCardBody><p>Wybierz jedn¹ z opcji w menu po lewej stronie, aby rozpocz¹æ pracê.</p></CCardBody></CCard>);
const ContactsView = ({ contacts, onEdit, onDelete }) => (<CCard><CCardHeader>Lista kontaktów</CCardHeader><CCardBody><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-600"><thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Imiê i Nazwisko</th><th className="px-6 py-3">Numer telefonu</th><th className="px-6 py-3 text-right">Akcje</th></tr></thead><tbody>{contacts.map(contact => (<tr key={contact.id} className="bg-white border-b hover:bg-gray-50"><td className="px-6 py-4 font-medium text-gray-900">{contact.firstName} {contact.lastName}</td><td className="px-6 py-4 font-mono">{contact.phone}</td><td className="px-6 py-4 text-right space-x-2"><CButton onClick={() => onEdit(contact)} color="primary" variant="outline" className="p-2"><Edit size={16} /></CButton><CButton onClick={() => onDelete(contact.id)} color="danger" variant="outline" className="p-2"><Trash2 size={16} /></CButton></td></tr>))}</tbody></table>{contacts.length === 0 && <p className="text-center text-gray-500 py-8">Brak kontaktów w ksi¹¿ce adresowej.</p>}</div></CCardBody></CCard>);
const GroupsView = ({ groups, contacts, onEdit, onDelete }) => {
    const [expandedGroupId, setExpandedGroupId] = useState(null);
    const getContactName = (contactId) => contacts.find(c => c.id === contactId)?.firstName + ' ' + contacts.find(c => c.id === contactId)?.lastName || 'Nieznany';
    return (<div className="space-y-4">{groups.length > 0 ? groups.map(group => (<CCard key={group.id}><div className="p-4 flex justify-between items-center"><button className="flex items-center text-left w-full" onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}>{expandedGroupId === group.id ? <ChevronDown size={20} className="mr-3" /> : <ChevronRight size={20} className="mr-3" />}<h3 className="font-semibold text-lg text-gray-800">{group.name}</h3><span className="ml-4 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{group.contacts?.length || 0} cz³onków</span></button><div className="flex space-x-2 flex-shrink-0 ml-4"><CButton onClick={(e) => { e.stopPropagation(); onEdit(group); }} color="primary" variant="outline" className="p-2"><Edit size={18} /></CButton><CButton onClick={(e) => { e.stopPropagation(); onDelete(group.id); }} color="danger" variant="outline" className="p-2"><Trash2 size={18} /></CButton></div></div>{expandedGroupId === group.id && (<div className="border-t p-6"><h4 className="font-semibold mb-2 text-gray-700">Cz³onkowie grupy:</h4><ul className="list-disc list-inside space-y-1 text-gray-600">{group.contacts?.length > 0 ? group.contacts.map(contactId => (<li key={contactId}>{getContactName(contactId)}</li>)) : <li className="text-gray-400">Brak cz³onków w tej grupie.</li>}</ul></div>)}</CCard>)) : (<CCard><CCardBody><p className="text-center text-gray-500 py-8">Brak grup. Kliknij "Utwórz grupê", aby dodaæ pierwsz¹.</p></CCardBody></CCard>)}</div>);
};
const TemplatesView = ({ templates, onEdit, onDelete }) => (<div className="space-y-4">{templates.length > 0 ? templates.map(template => (<CCard key={template.id}><CCardHeader>{template.name}</CCardHeader><CCardBody><p className="text-gray-600 italic">"{template.content}"</p><div className="text-right mt-4 space-x-2"><CButton onClick={() => onEdit(template)} color="primary" variant="outline"><Edit size={16} className="mr-2"/> Edytuj</CButton><CButton onClick={() => onDelete(template.id)} color="danger" variant="outline"><Trash2 size={16} className="mr-2"/> Usuñ</CButton></div></CCardBody></CCard>)) : (<CCard><CCardBody><p className="text-center text-gray-500 py-8">Brak szablonów. Kliknij "Utwórz szablon", aby dodaæ pierwszy.</p></CCardBody></CCard>)}</div>);
const SendSmsView = ({ contacts, groups, templates, onSchedule, showToast }) => {
    const [recipients, setRecipients] = useState([]);
    const [message, setMessage] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const allRecipientOptions = useMemo(() => [...contacts.map(c => ({ id: `contact-${c.id}`, label: `${c.firstName} ${c.lastName}`, type: 'contact' })), ...groups.map(g => ({ id: `group-${g.id}`, label: `Grupa: ${g.name}`, type: 'group' }))], [contacts, groups]);
    const handleRecipientChange = (id) => setRecipients(prev => prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (recipients.length === 0 || !message) return showToast('Wybierz odbiorców i wpisz treœæ wiadomoœci.', 'error');
        if (isScheduling) {
            if (!scheduleDate || !scheduleTime) return showToast('Ustaw datê i godzinê wysy³ki.', 'error');
            const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
            const success = await onSchedule({ recipients, message, scheduledAt, status: 'pending' });
            if (success) { setRecipients([]); setMessage(''); setIsScheduling(false); }
        } else {
            const operatorId = Math.floor(Math.random() * 9) + 1;
            const messageId = Date.now();
            const uniqueMessageId = `${operatorId}${messageId}`;
            console.log("WYSY£KA SMS:", { recipients, message, uniqueMessageId });
            showToast(`Wiadomoœæ wys³ana! ID: ${uniqueMessageId}`, 'success');
            setRecipients([]);
            setMessage('');
        }
    };
    return (<CCard><CCardHeader>Nowa wiadomoœæ SMS</CCardHeader><CCardBody><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-700 mb-2">Odbiorcy</label><RecipientSelector allRecipients={allRecipientOptions} selected={recipients} onToggle={handleRecipientChange} /></div><div><label className="block text-sm font-medium text-gray-700">Treœæ wiadomoœci</label><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows="5" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Wpisz treœæ wiadomoœci..."></textarea></div><div><label className="block text-sm font-medium text-gray-700 mb-2">U¿yj szablonu</label><div className="flex flex-wrap gap-2">{templates.map(t => <CButton key={t.id} onClick={() => setMessage(t.content)} color="secondary" variant="outline">{t.name}</CButton>)}</div></div><div className="space-y-4 pt-4"><div className="flex items-center"><input id="schedule-checkbox" type="checkbox" checked={isScheduling} onChange={(e) => setIsScheduling(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" /><label htmlFor="schedule-checkbox" className="ml-2 block text-sm text-gray-900">Zaplanuj wysy³kê</label></div>{isScheduling && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md bg-gray-50"><div><label htmlFor="schedule-date" className="block text-sm font-medium text-gray-700">Data</label><input type="date" id="schedule-date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" min={new Date().toISOString().split('T')[0]} /></div><div><label htmlFor="schedule-time" className="block text-sm font-medium text-gray-700">Godzina</label><input type="time" id="schedule-time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" /></div></div>)}</div><div className="flex justify-end"><CButton type="submit" color="primary" disabled={recipients.length === 0 || !message}>{isScheduling ? <Clock size={18} className="mr-2" /> : <Send size={18} className="mr-2" />}{isScheduling ? 'Zaplanuj wiadomoœæ' : 'Wyœlij teraz'}</CButton></div></form></CCardBody></CCard>);
};
const RecipientSelector = ({ allRecipients, selected, onToggle }) => {
    const [isOpen, setIsOpen] = useState(false);
    const getSelectedLabel = () => { if (selected.length === 0) return "Wybierz odbiorców..."; if (selected.length === 1) return allRecipients.find(r => r.id === selected[0])?.label || "1 odbiorca"; return `${selected.length} odbiorców`; };
    return (<div className="relative"><button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full text-left bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 flex justify-between items-center"><span>{getSelectedLabel()}</span><ChevronDown size={20} /></button>{isOpen && (<div className="absolute z-10 mt-1 w-full bg-white shadow-lg border rounded-md max-h-60 overflow-auto"><ul className="py-1">{allRecipients.map(recipient => (<li key={recipient.id} onClick={() => onToggle(recipient.id)} className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center"><input type="checkbox" readOnly checked={selected.includes(recipient.id)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3" />{recipient.label}</li>))}</ul></div>)}</div>);
};
