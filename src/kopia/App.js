import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut 
} from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Importowanie komponentów i ikon z MUI (Material-UI)
import {
    Box, AppBar, Toolbar, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Typography, Button, Card, CardHeader, CardContent, Modal, TextField, Checkbox,
    Select, MenuItem, OutlinedInput, InputLabel, FormControl, Chip,
    Snackbar, Alert, CircularProgress, IconButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    ThemeProvider, createTheme, CssBaseline, FormControlLabel, Menu, Tooltip
} from '@mui/material';
import {
    Send, Book, Group, Message, Schedule, Add, Edit, Delete, Menu as MenuIcon, Logout, Email, Lock, X as XIcon, Palette
} from '@mui/icons-material';


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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- MOTYW GRAFICZNY BNP PARIBAS ---
const getDesignTokens = (mode) => ({
  palette: {
    mode,
    primary: {
      main: '#008754', // Główny zielony kolor BNP Paribas
    },
    ...(mode === 'light'
      ? {
          // Ciemnoszary motyw
          background: {
            default: '#e0e0e0', // Zmieniono na ciemniejszy szary
            paper: '#ffffff',
          },
        }
      : {
          // Ciemny motyw
          background: {
            default: '#121212',
            paper: '#1e1e1e',
          },
        }),
     ...(mode === 'white'
      ? {
          mode: 'light',
          background: {
            default: '#ffffff',
            paper: '#fdfdfd',
          },
        }
      : {}),
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#000000',
          boxShadow: '0 1px 4px 0 rgba(0,0,0,0.1)',
        },
      },
    },
  },
});


// --- KLASA DO OBSŁUGI NUMERÓW TELEFONU ---
class PhoneNumberHz {
    constructor(rawNumber) {
        if (typeof rawNumber !== 'string') throw new Error('Numer telefonu musi być tekstem.');
        let cleanedNumber = rawNumber.replace(/[\s()+-]/g, '').replace(/^0+/, '');
        if (cleanedNumber.length < 9 || cleanedNumber.length > 20) throw new Error('Nieprawidłowa długość numeru telefonu.');
        if (cleanedNumber.length === 9) cleanedNumber = '48' + cleanedNumber;
        this.formattedNumber = cleanedNumber;
    }
    getNumber() { return this.formattedNumber; }
}

// --- KOMPONENTY FORMULARZY ---
const ContactForm = ({ onSave, onCancel, contact }) => {
    const [formData, setFormData] = useState({ firstName: contact?.firstName || '', lastName: contact?.lastName || '', rawPhone: contact?.rawPhone || '' });
    const [error, setError] = useState('');
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = (e) => { e.preventDefault(); setError(''); const { firstName, lastName, rawPhone } = formData; if (!firstName || !lastName || !rawPhone) return setError('Wszystkie pola są wymagane.'); try { const phoneNumber = new PhoneNumberHz(rawPhone); onSave({ id: contact?.id, firstName, lastName, phone: phoneNumber.getNumber(), rawPhone }); } catch (err) { setError(err.message); } };
    return (<Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField name="firstName" label="Imię" value={formData.firstName} onChange={handleChange} error={!!error} required fullWidth />
        <TextField name="lastName" label="Nazwisko" value={formData.lastName} onChange={handleChange} error={!!error} required fullWidth />
        <TextField name="rawPhone" label="Numer telefonu" value={formData.rawPhone} onChange={handleChange} error={!!error} required fullWidth />
        {error && <Typography color="error" variant="body2">{error}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}><Button onClick={onCancel}>Anuluj</Button><Button type="submit" variant="contained">Zapisz</Button></Box>
    </Box>);
};
const GroupForm = ({ onSave, onCancel, group, contacts }) => {
    const [name, setName] = useState(group?.name || '');
    const [selectedContacts, setSelectedContacts] = useState(group?.contacts || []);
    const [error, setError] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (!name) return setError('Nazwa grupy jest wymagana.'); onSave({ id: group?.id, name, contacts: selectedContacts }); };
    return (<Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Nazwa grupy" value={name} onChange={(e) => setName(e.target.value)} error={!!error} required fullWidth />
        <FormControl fullWidth><InputLabel>Członkowie</InputLabel><Select multiple value={selectedContacts} onChange={(e) => setSelectedContacts(e.target.value)} input={<OutlinedInput label="Członkowie" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map(id => (<Chip key={id} label={contacts.find(c => c.id === id)?.firstName || '...'} />))}</Box>)}>{contacts.map(contact => (<MenuItem key={contact.id} value={contact.id}><Checkbox checked={selectedContacts.indexOf(contact.id) > -1} />{contact.firstName} {contact.lastName}</MenuItem>))}</Select></FormControl>
        {error && <Typography color="error" variant="body2">{error}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}><Button onClick={onCancel}>Anuluj</Button><Button type="submit" variant="contained">Zapisz</Button></Box>
    </Box>);
};
const TemplateForm = ({ onSave, onCancel, template }) => {
    const [name, setName] = useState(template?.name || '');
    const [content, setContent] = useState(template?.content || '');
    const [error, setError] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (!name || !content) return setError('Wszystkie pola są wymagane.'); onSave({ id: template?.id, name, content }); };
    return (<Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Nazwa szablonu" value={name} onChange={(e) => setName(e.target.value)} error={!!error} required fullWidth />
        <TextField label="Treść wiadomości" value={content} onChange={(e) => setContent(e.target.value)} multiline rows={4} error={!!error} required fullWidth />
        {error && <Typography color="error" variant="body2">{error}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}><Button onClick={onCancel}>Anuluj</Button><Button type="submit" variant="contained">Zapisz</Button></Box>
    </Box>);
};

// --- KOMPONENT LOGOWANIA ---
const AuthView = ({ showToast }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const handleAuthAction = async (e) => { e.preventDefault(); setError(''); setLoading(true); try { if (isLogin) { await signInWithEmailAndPassword(auth, email, password); showToast('Zalogowano pomyślnie!'); } else { await createUserWithEmailAndPassword(auth, email, password); showToast('Konto utworzone pomyślnie!'); } } catch (err) { setError(err.message); showToast(err.message, 'error'); } finally { setLoading(false); } };
    return (<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'grey.100' }}><Card sx={{ maxWidth: 400, p: 2, width: '100%' }}><CardHeader title={isLogin ? 'Logowanie' : 'Rejestracja'} titleTypographyProps={{ align: 'center' }} /><CardContent><Box component="form" onSubmit={handleAuthAction} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}><TextField type="email" label="Adres e-mail" value={email} onChange={e => setEmail(e.target.value)} required InputProps={{ startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} /> }} /><TextField type="password" label="Hasło" value={password} onChange={e => setPassword(e.target.value)} required InputProps={{ startAdornment: <Lock sx={{ mr: 1, color: 'action.active' }} /> }} />{error && <Typography color="error" variant="body2" align="center">{error}</Typography>}<Button type="submit" variant="contained" size="large" disabled={loading}>{loading ? <CircularProgress size={24} /> : (isLogin ? 'Zaloguj się' : 'Zarejestruj się')}</Button></Box><Button size="small" onClick={() => setIsLogin(!isLogin)} sx={{ mt: 2, textTransform: 'none' }}>{isLogin ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}</Button></CardContent></Card></Box>);
};

// --- KOMPONENT DIALOGU POTWIERDZENIA ---
const ConfirmationDialog = ({ open, onClose, onConfirm, title, message }) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent><DialogContentText>{message}</DialogContentText></DialogContent>
            <DialogActions><Button onClick={onClose}>Anuluj</Button><Button onClick={onConfirm} color="error" autoFocus>Potwierdź</Button></DialogActions>
        </Dialog>
    );
};

// --- GŁÓWNY KOMPONENT APLIKACJI ---
function AppContent({ onThemeChange }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [activeView, setActiveView] = useState('send');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [scheduled, setScheduled] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [modal, setModal] = useState({ isOpen: false, type: '', data: null });
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
    const [confirmation, setConfirmation] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [anchorEl, setAnchorEl] = useState(null);

    const drawerWidth = 220;
    const collapsedDrawerWidth = 70;

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
                        console.error(`Błąd nasłuchiwacza dla '${name}':`, error);
                        showToast("Błąd uprawnień. Sprawdź reguły bazy danych.", "error");
                    })
                );
                return () => unsubscribers.forEach(unsub => unsub());
            }
        });
        return () => authUnsubscribe();
    }, []);

    const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });
    const openModal = (type, data = null) => setModal({ isOpen: true, type, data });
    const closeModal = () => setModal({ isOpen: false, type: '', data: null });
    const closeConfirmation = () => setConfirmation({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const handleSaveData = async (collectionName, data) => {
        if (!currentUser) return showToast("Błąd: Użytkownik nie jest zalogowany.", "error");
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
        } catch (error) { showToast(`Błąd podczas zapisu ${collectionName.slice(0, -1)}.`, 'error'); }
    };
    
    const handleDeleteRequest = (collectionName, id) => {
        setConfirmation({ isOpen: true, title: 'Potwierdzenie usunięcia', message: 'Czy na pewno chcesz usunąć ten element? Tej operacji nie można cofnąć.', onConfirm: () => executeDelete(collectionName, id) });
    };

    const executeDelete = async (collectionName, id) => {
        try { await deleteDoc(doc(db, 'shared_data', 'data', collectionName, id)); showToast('Element usunięty.'); } catch (error) { showToast('Błąd podczas usuwania.', 'error'); }
        closeConfirmation();
    };
    
    const handleLogout = async () => {
        try { await signOut(auth); showToast("Wylogowano pomyślnie."); } catch (error) { showToast("Błąd podczas wylogowywania.", "error"); }
    };

    if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
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
        const titles = { contact: 'kontakt', group: 'grupę', template: 'szablon' };
        return modal.data ? `Edytuj ${titles[modal.type]}` : `Utwórz nowy ${titles[modal.type]}`;
    };
    
    const renderView = () => {
        switch (activeView) {
            case 'send': return <SendSmsView contacts={contacts} groups={groups} templates={templates} showToast={showToast} onSchedule={(data) => handleSaveData('scheduled', data)} />;
            case 'contacts': return <ContactsView data={contacts} onEdit={(c) => openModal('contact', c)} onDelete={(id) => handleDeleteRequest('contacts', id)} />;
            case 'groups': return <GroupsView groups={groups} contacts={contacts} onEdit={(g) => openModal('group', g)} onDelete={(id) => handleDeleteRequest('groups', id)} />;
            case 'templates': return <TemplatesView templates={templates} onEdit={(t) => openModal('template', t)} onDelete={(id) => handleDeleteRequest('templates', id)} />;
            case 'scheduled': return <ScheduledView scheduled={scheduled} contacts={contacts} groups={groups} onDelete={(id) => handleDeleteRequest('scheduled', id)} />;
            default: return <Typography>Wybierz opcję z menu.</Typography>;
        }
    };
    
    const viewTitles = { send: 'Wyślij SMS', contacts: 'Książka adresowa', groups: 'Grupy odbiorców', templates: 'Szablony wiadomości', scheduled: 'Zaplanowane' };

    return (
        <Box sx={{ display: 'flex' }}>
            <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast(p => ({...p, open: false}))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}><Alert onClose={() => setToast(p => ({...p, open: false}))} severity={toast.severity} sx={{ width: '100%' }}>{toast.message}</Alert></Snackbar>
            <Modal open={modal.isOpen} onClose={closeModal}>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 500, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" component="h2">{getModalTitle()}</Typography>
                        <IconButton onClick={closeModal}><XIcon /></IconButton>
                    </Box>
                    {renderModalContent()}
                </Box>
            </Modal>
            <ConfirmationDialog 
                open={confirmation.isOpen} 
                onClose={closeConfirmation} 
                onConfirm={confirmation.onConfirm}
                title={confirmation.title}
                message={confirmation.message}
            />
            
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton color="inherit" edge="start" onClick={() => setIsSidebarOpen(!isSidebarOpen)} sx={{ mr: 2 }}><MenuIcon /></IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>{viewTitles[activeView] || 'SMS Sender'}</Typography>
                    <Tooltip title="Zmień motyw"><IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}><Palette /></IconButton></Tooltip>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                        <MenuItem onClick={() => { onThemeChange('light'); setAnchorEl(null); }}>Ciemnoszary</MenuItem>
                        <MenuItem onClick={() => { onThemeChange('white'); setAnchorEl(null); }}>Biały</MenuItem>
                        <MenuItem onClick={() => { onThemeChange('dark'); setAnchorEl(null); }}>Ciemny</MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>
            
            <Drawer variant="permanent" open={isSidebarOpen} sx={{ width: isSidebarOpen ? drawerWidth : collapsedDrawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: isSidebarOpen ? drawerWidth : collapsedDrawerWidth, transition: (theme) => theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.enteringScreen }), boxSizing: 'border-box', overflowX: 'hidden' } }}>
                <Toolbar />
                <List>
                    {Object.keys(viewTitles).map(key => {
                        const icons = { send: <Send />, contacts: <Book />, groups: <Group />, templates: <Message />, scheduled: <Schedule /> };
                        return (<ListItem key={key} disablePadding sx={{ display: 'block' }}><ListItemButton selected={activeView === key} onClick={() => setActiveView(key)} sx={{ minHeight: 48, justifyContent: 'initial', px: 2.5, '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } } }}><ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center' }}>{icons[key]}</ListItemIcon><ListItemText primary={viewTitles[key]} sx={{ opacity: isSidebarOpen ? 1 : 0, transition: 'opacity 0.2s' }} /></ListItemButton></ListItem>);
                    })}
                </List>
                <Box sx={{ flexGrow: 1 }} />
                <List>
                    <ListItem disablePadding sx={{ display: 'block' }}><ListItemButton onClick={handleLogout} sx={{ minHeight: 48, justifyContent: 'initial', px: 2.5 }}><ListItemIcon sx={{ minWidth: 0, mr: 3, justifyContent: 'center' }}><Logout /></ListItemIcon><ListItemText primary="Wyloguj" sx={{ opacity: isSidebarOpen ? 1 : 0 }} /></ListItemButton></ListItem>
                </List>
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
                <Toolbar />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
                    {activeView === 'contacts' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('contact')}>Dodaj kontakt</Button>}
                    {activeView === 'groups' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('group')}>Utwórz grupę</Button>}
                    {activeView === 'templates' && <Button variant="contained" startIcon={<Add />} onClick={() => openModal('template')}>Utwórz szablon</Button>}
                </Box>
                {renderView()}
            </Box>
        </Box>
    );
}

export default function App() {
    const [themeMode, setThemeMode] = useState('light');

    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode') || 'light';
        setThemeMode(savedMode);
    }, []);

    const theme = useMemo(() => createTheme(getDesignTokens(themeMode)), [themeMode]);

    const handleThemeChange = (mode) => {
        localStorage.setItem('themeMode', mode);
        setThemeMode(mode);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppContent onThemeChange={handleThemeChange} />
        </ThemeProvider>
    );
}


// --- KOMPONENTY WIDOKÓW ---
const ContactsView = ({ data, onEdit, onDelete }) => (
    <Card><CardHeader title="Lista kontaktów" /><CardContent>
        {data.length === 0 ? <Typography align="center" p={4}>Brak kontaktów.</Typography> :
        <Box sx={{ overflowX: 'auto' }}>
            <table style={{width: "100%", borderCollapse: "collapse"}}>
                <thead><tr><th style={{padding: "8px", textAlign: "left"}}>Imię i Nazwisko</th><th style={{padding: "8px", textAlign: "left"}}>Numer telefonu</th><th style={{padding: "8px", textAlign: "right"}}>Akcje</th></tr></thead>
                <tbody>{data.map(contact => (<tr key={contact.id} style={{borderTop: "1px solid #eee"}}>
                    <td style={{padding: "8px"}}>{contact.firstName} {contact.lastName}</td>
                    <td style={{padding: "8px"}}>{contact.phone}</td>
                    <td style={{padding: "8px", textAlign: "right"}}><IconButton onClick={() => onEdit(contact)}><Edit /></IconButton><IconButton onClick={() => onDelete(contact.id)}><Delete /></IconButton></td>
                </tr>))}</tbody>
            </table>
        </Box>}
    </CardContent></Card>
);
const GroupsView = ({ groups, contacts, onEdit, onDelete }) => {
    const getContactName = (id) => contacts.find(c => c.id === id)?.firstName + ' ' + contacts.find(c => c.id === id)?.lastName || 'Nieznany';
    return (<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.length === 0 ? <Card><CardContent><Typography align="center" p={4}>Brak grup.</Typography></CardContent></Card> :
        groups.map(group => (<Card key={group.id}><CardHeader title={group.name} subheader={`${group.contacts?.length || 0} członków`} action={<><IconButton onClick={() => onEdit(group)}><Edit /></IconButton><IconButton onClick={() => onDelete(group.id)}><Delete /></IconButton></>} /><CardContent><Typography>Członkowie: {group.contacts?.map(getContactName).join(', ')}</Typography></CardContent></Card>))}
    </Box>);
};
const TemplatesView = ({ templates, onEdit, onDelete }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {templates.length === 0 ? <Card><CardContent><Typography align="center" p={4}>Brak szablonów.</Typography></CardContent></Card> :
        templates.map(template => (<Card key={template.id}><CardHeader title={template.name} action={<><IconButton onClick={() => onEdit(template)}><Edit /></IconButton><IconButton onClick={() => onDelete(template.id)}><Delete /></IconButton></>} /><CardContent><Typography>"{template.content}"</Typography></CardContent></Card>))}
    </Box>
);
const SendSmsView = ({ contacts, groups, templates, showToast, onSchedule }) => {
    // --- INTEGRACJA SMSAPI ---
    // Krok 1: Wklej swój token API uzyskany z panelu SMSAPI.pl
    const SMSAPI_TOKEN = 'TWOJ_TOKEN_API_Z_PANELU_SMSAPI';
    // Krok 2: Wpisz nazwę nadawcy, którą zarejestrowałeś w panelu SMSAPI
    const SENDER_NAME = 'Info'; // Przykładowa nazwa, zmień na swoją

    const [recipients, setRecipients] = useState([]);
    const [message, setMessage] = useState('');
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    
    const allRecipientOptions = useMemo(() => [...contacts.map(c => ({ id: `contact-${c.id}`, label: `${c.firstName} ${c.lastName}` })), ...groups.map(g => ({ id: `group-${g.id}`, label: `Grupa: ${g.name}` }))], [contacts, groups]);
    
    const getPhoneNumbers = () => {
        const phoneNumbers = new Set();
        recipients.forEach(recId => {
            if (recId.startsWith('contact-')) {
                const contact = contacts.find(c => c.id === recId.replace('contact-', ''));
                if (contact) phoneNumbers.add(contact.phone);
            } else if (recId.startsWith('group-')) {
                const group = groups.find(g => g.id === recId.replace('group-', ''));
                group?.contacts?.forEach(contactId => {
                    const contact = contacts.find(c => c.id === contactId);
                    if (contact) phoneNumbers.add(contact.phone);
                });
            }
        });
        return Array.from(phoneNumbers);
    };

    const handleRealSend = async () => {
        const numbers = getPhoneNumbers();
        if (numbers.length === 0) return showToast('Brak prawidłowych numerów do wysyłki.', 'error');

        const formData = new URLSearchParams();
        formData.append('to', numbers.join(','));
        formData.append('from', SENDER_NAME);
        formData.append('message', message);

        try {
            const response = await fetch('https://api.smsapi.pl/sms.do', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SMSAPI_TOKEN}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            const result = await response.text(); // API SMSAPI często zwraca tekst
            if (response.ok && !result.startsWith('ERROR')) {
                showToast(`Wiadomość wysłana pomyślnie!`, 'success');
                setRecipients([]);
                setMessage('');
            } else {
                showToast(`Błąd wysyłki: ${result}`, 'error');
            }
        } catch (error) {
            showToast('Błąd sieciowy podczas wysyłania SMS.', 'error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (recipients.length === 0 || !message) return showToast('Wybierz odbiorców i wpisz treść wiadomości.', 'error');
        
        if (isScheduling) {
            if (!scheduleDate || !scheduleTime) return showToast('Ustaw datę i godzinę wysyłki.', 'error');
            const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
            if (new Date(scheduledAt) < new Date()) return showToast('Nie można zaplanować wysyłki w przeszłości.', 'error');
            
            const success = await onSchedule({ recipients, message, scheduledAt, status: 'pending' });
            if (success) {
                setRecipients([]);
                setMessage('');
                setIsScheduling(false);
                setScheduleDate('');
                setScheduleTime('');
            }
        } else {
            handleRealSend();
        }
    };

    return (<Card><CardHeader title="Nowa wiadomość" /><CardContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <FormControl fullWidth><InputLabel>Odbiorcy</InputLabel><Select multiple value={recipients} onChange={e => setRecipients(e.target.value)} input={<OutlinedInput label="Odbiorcy" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map(id => (<Chip key={id} label={allRecipientOptions.find(o => o.id === id)?.label || '...'} />))}</Box>)}>{allRecipientOptions.map(option => (<MenuItem key={option.id} value={option.id}><Checkbox checked={recipients.indexOf(option.id) > -1} />{option.label}</MenuItem>))}</Select></FormControl>
            <TextField label="Treść wiadomości" multiline rows={5} value={message} onChange={e => setMessage(e.target.value)} />
            <Box><Typography variant="body2" mb={1}>Użyj szablonu:</Typography><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{templates.map(t => (<Button key={t.id} variant="outlined" onClick={() => setMessage(t.content)}>{t.name}</Button>))}</Box></Box>
            
            <FormControlLabel control={<Checkbox checked={isScheduling} onChange={(e) => setIsScheduling(e.target.checked)} />} label="Zaplanuj wysyłkę" />
            
            {isScheduling && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField label="Data wysyłki" type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
                    <TextField label="Godzina wysyłki" type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
                </Box>
            )}

            <Button type="submit" variant="contained" size="large" startIcon={isScheduling ? <Schedule /> : <Send />}>{isScheduling ? 'Zaplanuj wiadomość' : 'Wyślij teraz'}</Button>
        </Box>
    </CardContent></Card>);
};

const ScheduledView = ({ scheduled, contacts, groups, onDelete }) => {
    const getRecipientNames = (recipientIds) => {
        return recipientIds.map(id => {
            if (id.startsWith('contact-')) {
                const contact = contacts.find(c => c.id === id.replace('contact-', ''));
                return contact ? `${contact.firstName} ${contact.lastName}` : 'Nieznany kontakt';
            }
            if (id.startsWith('group-')) {
                const group = groups.find(g => g.id === id.replace('group-', ''));
                return group ? `Grupa: ${group.name}` : 'Nieznana grupa';
            }
            return 'Nieznany odbiorca';
        }).join(', ');
    };

    return (
        <Card><CardHeader title="Zaplanowane wysyłki" /><CardContent>
            {scheduled.length === 0 ? <Typography align="center" p={4}>Brak zaplanowanych wiadomości.</Typography> :
            <Box sx={{ overflowX: 'auto' }}>
                <table style={{width: "100%", borderCollapse: "collapse"}}>
                    <thead><tr><th style={{padding: "8px", textAlign: "left"}}>Data wysyłki</th><th style={{padding: "8px", textAlign: "left"}}>Odbiorcy</th><th style={{padding: "8px", textAlign: "left"}}>Treść</th><th style={{padding: "8px", textAlign: "right"}}>Akcje</th></tr></thead>
                    <tbody>{scheduled.map(item => (<tr key={item.id} style={{borderTop: "1px solid #eee"}}>
                        <td style={{padding: "8px"}}>{new Date(item.scheduledAt).toLocaleString('pl-PL')}</td>
                        <td style={{padding: "8px"}}>{getRecipientNames(item.recipients)}</td>
                        <td style={{padding: "8px", maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.message}</td>
                        <td style={{padding: "8px", textAlign: "right"}}><IconButton onClick={() => onDelete(item.id)}><Delete /></IconButton></td>
                    </tr>))}</tbody>
                </table>
            </Box>}
        </CardContent></Card>
    );
};
