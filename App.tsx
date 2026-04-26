/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  LayoutDashboard, 
  LogOut, 
  ChevronRight,
  Home,
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Heart,
  Briefcase,
  DollarSign,
  AlertCircle,
  Eye,
  EyeOff,
  History,
  BarChart3,
  Target,
  User,
  Settings,
  ShieldCheck,
  Calendar,
  Download,
  RefreshCcw,
  Link as LinkIcon,
  Info,
  X,
  Edit2,
  Rocket,
  Sun,
  Moon,
  CheckCircle2,
  Camera,
  Upload,
  Bell,
  Search,
  Filter,
  Check,
  ChevronLeft,
  BellDot,
  Trash,
  Scale
} from 'lucide-react';
import { CalendarPicker } from './components/CalendarPicker';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Sector,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { cn } from './lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  deleteUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

type TransactionType = 'income' | 'expense';

interface Transaction {
  id: string;
  amount: number;
  category: string;
  customCategory?: string | null;
  date: string;
  description: string;
  type: TransactionType;
  linkedIncomeIds?: string[] | null;
}

interface Category {
  name: string;
  icon: React.ReactNode;
  color: string;
}

// --- Constants ---

const CATEGORIES: Record<string, Category> = {
  Bazar: { name: 'Bazar', icon: <ShoppingBag size={18} />, color: '#ff7f50' },
  'Rickshaw/CNG': { name: 'Rickshaw/CNG', icon: <Car size={18} />, color: '#ff8c69' },
  'Mobile Recharge': { name: 'Mobile Recharge', icon: <Zap size={18} />, color: '#ff9977' },
  Rent: { name: 'Rent', icon: <Home size={18} />, color: '#ff7f50' },
  Utilities: { name: 'Utilities', icon: <Zap size={18} />, color: '#ff8c69' },
  Tuition: { name: 'Tuition', icon: <Briefcase size={18} />, color: '#ff9977' },
  Hostel: { name: 'Hostel', icon: <Home size={18} />, color: '#ff7f50' },
  Food: { name: 'Food', icon: <Utensils size={18} />, color: '#ff8c69' },
  Shopping: { name: 'Shopping', icon: <ShoppingBag size={18} />, color: '#ff7f50' },
  Health: { name: 'Health', icon: <Heart size={18} />, color: '#ff9977' },
  Entertainment: { name: 'Entertainment', icon: <PieChartIcon size={18} />, color: '#ff8c69' },
  Salary: { name: 'Salary', icon: <Briefcase size={18} />, color: '#ff7f50' },
  Other: { name: 'Other', icon: <DollarSign size={18} />, color: '#aeb5b5' },
};

const INCOME_CATEGORIES = ['Salary', 'Investment', 'Gift', 'Other'];
const EXPENSE_CATEGORIES = Object.keys(CATEGORIES).filter(c => c !== 'Salary');

// --- Components ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userDisplayName, setUserDisplayName] = useState('');
  const [userPhotoURL, setUserPhotoURL] = useState('');
  const [userGender, setUserGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'all' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const day = new Date().getDate();
    return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currency, setCurrency] = useState('৳');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [trendPeriod, setTrendPeriod] = useState<'7days' | 'monthComparison'>('7days');
  const [notifications, setNotifications] = useState<{
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: 'info' | 'warning' | 'success';
  }[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const completeOnboarding = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        hasCompletedOnboarding: true
      });
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      setShowOnboarding(false); // Fallback
    }
  };
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'add' | 'history' | 'analytics' | 'budget' | 'user' | 'settings'>('overview');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalType, setProfileModalType] = useState<'name' | 'password'>('name');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Theme Persistence
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          theme: newTheme
        });
      } catch (error) {
        console.error("Error updating theme:", error);
      }
    }
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email || undefined,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setFirestoreError(errInfo.error);
    // Auto-clear error after 5 seconds
    setTimeout(() => setFirestoreError(null), 5000);
  };

  // Sub-component for filters to use across tabs
  const FilterControls = () => (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <div className="flex flex-wrap bg-white/5 p-1 rounded-xl border border-white/10 w-full sm:w-auto">
        {(['all', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setTimeFilter(f)}
            className={cn(
              "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
              timeFilter === f ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-accent"
            )}
          >
            {f}
          </button>
        ))}
      </div>
      {(timeFilter === 'monthly' || timeFilter === 'yearly' || timeFilter === 'weekly') && (
        <div className="flex gap-2">
          {(timeFilter === 'monthly' || timeFilter === 'weekly') && (
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="flex-1 sm:flex-none bg-bg-deep border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary focus:outline-none focus:border-accent/50"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          )}
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="flex-1 sm:flex-none bg-bg-deep border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary focus:outline-none focus:border-accent/50"
          >
            {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {timeFilter === 'weekly' && (
            <select 
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="flex-1 sm:flex-none bg-bg-deep border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary focus:outline-none focus:border-accent/50"
            >
              {[1, 2, 3, 4, 5].map(w => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setIsLoggedIn(true);
          setUserEmail(user.email || '');
          setUserDisplayName(user.displayName || user.email?.split('@')[0] || '');
          
          // Fetch user profile for budget and registration date
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setBudget(userData.budget || 0);
            setUserGender(userData.gender || '');
            setUserPhotoURL(userData.photoURL || '');
            if (userData.theme) {
              setTheme(userData.theme);
            }
            if (!userData.hasCompletedOnboarding) {
              setShowOnboarding(true);
            }
            if (userData.createdAt) {
              const date = userData.createdAt instanceof Timestamp ? userData.createdAt.toDate() : new Date(userData.createdAt);
              setRegistrationDate(date.toISOString());
            }
          } else {
            // Create missing profile for legacy users
            await setDoc(userRef, {
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0],
              createdAt: serverTimestamp(),
              budget: 0,
              gender: '',
              hasCompletedOnboarding: false
            });
            setBudget(0);
            setUserGender('');
            setShowOnboarding(true);
            setRegistrationDate(new Date().toISOString());
          }
        } else {
          setIsLoggedIn(false);
          setTransactions([]);
          setBudget(0);
        }
      } catch (error) {
        console.error("Auth Listener Error:", error);
        handleFirestoreError(error, OperationType.GET, 'users');
      } finally {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Connection Test
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;
    const testConnection = async () => {
      try {
        await getDoc(doc(db, 'users', auth.currentUser!.uid));
        console.log("Firestore connection verified");
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'connection_test');
      }
    };
    testConnection();
  }, [isLoggedIn]);

  // Budget Alerts & Notifications
  useEffect(() => {
    if (budget > 0) {
      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0);
      
      const percentage = (totalExpenses / budget) * 100;
      
      if (percentage >= 100) {
        const id = 'budget-exceeded';
        if (!notifications.some(n => n.id === id)) {
          setNotifications(prev => [{
            id,
            title: 'Budget Exceeded!',
            message: `You have spent 100% of your monthly budget (${currency}${budget.toLocaleString()}).`,
            time: 'Just now',
            read: false,
            type: 'warning'
          }, ...prev]);
        }
      } else if (percentage >= 80) {
        const id = 'budget-80';
        if (!notifications.some(n => n.id === id)) {
          setNotifications(prev => [{
            id,
            title: 'Budget Alert',
            message: `You have used 80% of your monthly budget. Current spending: ${currency}${totalExpenses.toLocaleString()}.`,
            time: 'Just now',
            read: false,
            type: 'info'
          }, ...prev]);
        }
      }
    }
  }, [transactions, budget, currency]);

  // Real-time Transactions
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;

    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      // Sort client-side to avoid index issues
      txs.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateB !== dateA) return dateB - dateA;
        
        // Fallback to ID or other stable property if dates are equal
        return b.id.localeCompare(a.id);
      });
      
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const previousBalance = useMemo(() => {
    if (!transactions.length) return 0;
    
    // Determine the start date of the current filtered period
    let startDate: Date;
    if (timeFilter === 'all') return 0;
    
    if (timeFilter === 'yearly') {
      startDate = new Date(selectedYear, 0, 1);
    } else if (timeFilter === 'monthly') {
      startDate = new Date(selectedYear, selectedMonth, 1);
    } else if (timeFilter === 'weekly') {
      const startDay = (selectedWeek - 1) * 7 + 1;
      startDate = new Date(selectedYear, selectedMonth, startDay);
    } else {
      return 0;
    }

    // Sum all transactions BEFORE this start date
    return transactions
      .filter(t => new Date(t.date) < startDate)
      .reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
  }, [transactions, timeFilter, selectedMonth, selectedYear, selectedWeek]);

  const filteredTransactions = useMemo(() => {
    let result = transactions;

    // Time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      result = result.filter(t => {
        const tDate = new Date(t.date);
        if (timeFilter === 'weekly') {
          // Calculate start and end day of the selected week
          const startDay = (selectedWeek - 1) * 7 + 1;
          let endDay = selectedWeek * 7;
          
          // Handle Month end
          const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
          if (endDay > daysInMonth) endDay = daysInMonth;
          if (selectedWeek === 5 && startDay > daysInMonth) return false;

          const startDate = new Date(selectedYear, selectedMonth, startDay, 0, 0, 0, 0);
          const endDate = new Date(selectedYear, selectedMonth, endDay, 23, 59, 59, 999);
          
          return tDate >= startDate && tDate <= endDate;
        }
        if (timeFilter === 'monthly') {
          return tDate.getMonth() === selectedMonth && tDate.getFullYear() === selectedYear;
        }
        if (timeFilter === 'yearly') {
          return tDate.getFullYear() === selectedYear;
        }
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.description.toLowerCase().includes(query) || 
        t.category.toLowerCase().includes(query) ||
        (t.customCategory && t.customCategory.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }

    return result;
  }, [transactions, timeFilter, selectedMonth, selectedYear, selectedWeek, searchQuery, categoryFilter]);

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text("RR - Transaction Report", 14, 15);
      doc.setFontSize(10);
      doc.text(`User: ${userEmail} | Date: ${new Date().toLocaleDateString()}`, 14, 22);
      
      const tableData = transactions.map(t => [
        t.date,
        t.type.toUpperCase(),
        t.category === 'Other' ? (t.customCategory || 'Other') : t.category,
        t.description,
        `BDT ${t.amount.toLocaleString()}`
      ]);

      autoTable(doc, {
        head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
        body: tableData,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
      });

      doc.save('rr_report.pdf');
    } catch (error) {
      console.error("PDF Export Error:", error);
    }
  };

  const exportToExcel = () => {
    const data = transactions.map(t => ({
      Date: t.date,
      Type: t.type.toUpperCase(),
      Category: t.category === 'Other' ? (t.customCategory || 'Other') : t.category,
      Description: t.description,
      Amount: t.amount
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, "rr_report.xlsx");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const addTransaction = async (transaction: Omit<Transaction, 'id'>) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'transactions'), {
        ...transaction,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      });
      setActiveTab('history');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const updateTransaction = async (id: string, updatedData: Omit<Transaction, 'id'>) => {
    try {
      await updateDoc(doc(db, 'transactions', id), {
        ...updatedData
      });
      setEditingTransaction(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
    }
  };

  const updateBudget = async (newBudget: number) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        budget: newBudget
      });
      setBudget(newBudget);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-deep">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden flex flex-col md:flex-row">
      <div className="atmosphere" />
      
      {/* Mobile Navigation (Bottom Bar) */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[95%] max-w-md">
        <div className="glass px-1 py-3 rounded-full flex items-center justify-around shadow-2xl border-white/10">
          <NavButton 
            id="mobile-nav-overview"
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard size={18} />}
            label="Home"
          />
          <NavButton 
            id="mobile-nav-add"
            active={activeTab === 'add'} 
            onClick={() => setActiveTab('add')}
            icon={<Plus size={18} />}
            label="Add"
          />
          <NavButton 
            id="mobile-nav-history"
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History size={18} />}
            label="History"
          />
          <NavButton 
            id="mobile-nav-analytics"
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
            icon={<BarChart3 size={18} />}
            label="Stats"
          />
          <NavButton 
            id="mobile-nav-settings"
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings size={18} />}
            label="Settings"
          />
          <NavButton 
            id="mobile-nav-profile"
            active={activeTab === 'user'} 
            onClick={() => setActiveTab('user')}
            icon={<User size={18} />}
            label="Profile"
            imageUrl={userPhotoURL}
          />
        </div>
      </nav>

      {/* Desktop Navigation (Sidebar) */}
      <aside className="hidden md:flex w-64 h-screen sticky top-0 flex-col glass border-r border-glass-border/20 p-6 z-50">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center border border-accent/30 shadow-[0_0_20px_rgba(76,201,240,0.1)]">
            <Wallet size={24} className="text-accent" />
          </div>
          <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-accent to-sky-600 bg-clip-text text-transparent">RR</h2>
        </div>

        <div className="flex-1 space-y-2">
          <SidebarLink 
            id="tour-nav-dashboard"
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          <SidebarLink 
            id="tour-nav-add"
            active={activeTab === 'add'} 
            onClick={() => setActiveTab('add')}
            icon={<Plus size={20} />}
            label="Add Transaction"
          />
          <SidebarLink 
            id="tour-nav-history"
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History size={20} />}
            label="Transaction History"
          />
          <SidebarLink 
            id="tour-nav-analytics"
            active={activeTab === 'analytics'} 
            onClick={() => setActiveTab('analytics')}
            icon={<BarChart3 size={20} />}
            label="Visual Analytics"
          />
          <SidebarLink 
            id="tour-nav-budget"
            active={activeTab === 'budget'} 
            onClick={() => setActiveTab('budget')}
            icon={<Target size={20} />}
            label="Budget Goals"
          />
          <SidebarLink 
            id="tour-nav-profile"
            active={activeTab === 'user'} 
            onClick={() => setActiveTab('user')}
            icon={<User size={20} />}
            label="User Profile"
            imageUrl={userPhotoURL}
          />
          <SidebarLink 
            id="tour-nav-settings"
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings size={20} />}
            label="Settings"
          />
        </div>

        <div className="pt-6 border-t border-glass-border/20">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-muted hover:text-accent hover:bg-accent/5 rounded-xl transition-all duration-300"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 w-full px-0 sm:px-2 pt-8 sm:pt-12 pb-32 md:pb-12 overflow-y-auto">
        <AnimatePresence>
          {firestoreError && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-sky-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20"
            >
              <AlertCircle size={20} />
              <span className="text-sm font-bold">{firestoreError}</span>
              <button onClick={() => setFirestoreError(null)} className="ml-2 opacity-50 hover:opacity-100">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex justify-between items-center mb-8 sm:mb-12 animate-in">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-primary">
              Hello, <span className="text-accent">{userDisplayName || 'User'}</span>
            </h1>
            <p className="text-muted text-sm">Your {currency} portfolio at a glance.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative p-3 glass rounded-2xl text-muted hover:text-accent hover:border-accent/30 transition-all active:scale-95"
            >
              {notifications.some(n => !n.read) ? (
                <BellDot size={20} className="text-accent animate-pulse" />
              ) : (
                <Bell size={20} />
              )}
              {notifications.some(n => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-bg-deep shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
              )}
            </button>
            <div id="header-balance-info" className="flex flex-col items-end group translate-y-1">
              <div className="flex items-center gap-2 mb-1 mr-1">
                <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-accent font-black">
                  {timeFilter === 'all' 
                    ? 'Total' 
                    : timeFilter === 'monthly' 
                      ? new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'short' }) 
                      : timeFilter === 'weekly' 
                        ? `Week ${selectedWeek}`
                        : selectedYear
                  } Balance
                </p>
              </div>
              <div className="relative">
                <motion.div 
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -inset-1 bg-accent/20 blur-lg rounded-full"
                />
                <div className="relative px-6 py-2 rounded-full bg-accent text-white border border-white/20 shadow-[0_0_20px_rgba(76,201,240,0.5)] flex items-center gap-3">
                  <Wallet size={16} className="text-white/80" />
                  <div className="font-black text-white text-lg sm:text-xl tracking-tighter tabular-nums drop-shadow-sm">
                    {(() => {
                      const bal = filteredTransactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
                      return `${bal < 0 ? '-' : ''}${currency}${Math.abs(bal).toLocaleString()}`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <NotificationCentre 
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
          onClearAll={() => setNotifications([])}
        />

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div 
                      onClick={() => setActiveTab('user')}
                      className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center cursor-pointer hover:border-accent/50 transition-colors"
                    >
                      {userPhotoURL ? (
                        <img src={userPhotoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={24} className="text-faint" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-3xl font-bold tracking-tight">Financial Overview</h2>
                      <p className="text-muted text-xs sm:text-sm">Welcome back, {userDisplayName || 'User'}!</p>
                    </div>
                  </div>
                  
                  <div id="dashboard-filter-controls">
                    <FilterControls />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <SummaryCard 
                    id="sum-card-income"
                    title="Total Income" 
                    amount={filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)}
                    icon={<TrendingUp className="text-income" />}
                    color="income"
                    timeFilter={timeFilter}
                    currency={currency}
                  />
                  <SummaryCard 
                    id="sum-card-expense"
                    title="Total Expenses" 
                    amount={filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)}
                    icon={<TrendingDown className="text-expense" />}
                    color="expense"
                    timeFilter={timeFilter}
                    currency={currency}
                  />
                  <SummaryCard 
                    id="sum-card-carryover"
                    title="Carried Savings" 
                    amount={previousBalance}
                    icon={<History className="text-sky-400" />}
                    color="primary"
                    timeFilter="Prior"
                    currency={currency}
                  />
                  <SummaryCard 
                    id="sum-card-savings"
                    title="Net Balance" 
                    amount={filteredTransactions.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0)}
                    icon={<Scale className="text-primary" size={20} />}
                    color="primary"
                    timeFilter={timeFilter}
                    currency={currency}
                    highlighted={true}
                  />
                </div>
              </div>

              <div className="glass-card p-6 rounded-3xl border border-white/5">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-bold">Recent Activity</h3>
                    <p className="text-xs text-secondary/60">Showing {timeFilter} transactions</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="text-xs text-accent hover:text-accent/80 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>
                <TransactionList 
                  transactions={filteredTransactions.slice(0, 5)} 
                  onDelete={deleteTransaction} 
                  onEdit={(t) => setEditingTransaction(t)}
                  compact 
                  currency={currency}
                  allTransactions={transactions}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-2xl font-bold tracking-tight">Add New Entry</h3>
                <FilterControls />
              </div>
              <div className="glass-card">
                <TransactionForm 
                  onAdd={(t) => {
                    addTransaction(t);
                    setActiveTab('overview');
                  }} 
                  transactions={filteredTransactions}
                  currency={currency}
                  previousBalance={previousBalance}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card min-h-[500px] pb-24 md:pb-8"
            >
              <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Transaction History</h2>
                  <FilterControls />
                </div>

                <div id="history-search-controls" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" size={18} />
                    <input 
                      type="text"
                      placeholder="Search transactions, categories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-accent/50 transition-all text-primary placeholder:text-faint"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-accent"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" size={18} />
                    <select 
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-accent/50 transition-all appearance-none text-primary"
                    >
                      <option value="all" className="bg-bg-deep italic">All Categories</option>
                      {Object.keys(CATEGORIES).map(cat => (
                        <option key={cat} value={cat} className="bg-bg-deep">{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-faint text-[10px] font-bold uppercase tracking-widest ml-1">
                  <span>Showing {filteredTransactions.length} of {transactions.length} records</span>
                  {(searchQuery || categoryFilter !== 'all') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setCategoryFilter('all');
                      }}
                      className="text-accent hover:underline flex items-center gap-1"
                    >
                      Reset Filters <RefreshCcw size={10} />
                    </button>
                  )}
                </div>
              </div>
              <TransactionList 
                transactions={filteredTransactions} 
                onDelete={deleteTransaction} 
                onEdit={(t) => setEditingTransaction(t)}
                currency={currency}
                allTransactions={transactions}
              />
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pb-24 md:pb-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                  <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-3">
                    <TrendingUp size={24} className="text-accent" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-accent font-black mb-2 opacity-80">Top Expense</p>
                  <p className="text-2xl font-black tracking-tight">
                    {filteredTransactions.filter(t => t.type === 'expense').length > 0 
                      ? filteredTransactions.filter(t => t.type === 'expense').sort((a,b) => b.amount - a.amount)[0].category 
                      : 'N/A'}
                  </p>
                </div>
                <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                  <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-3">
                    <DollarSign size={24} className="text-accent" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-accent font-black mb-2 opacity-80">Avg. Daily</p>
                  <p className="text-2xl font-black tracking-tight">
                    {currency}{(filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0) / (timeFilter === 'monthly' ? 30 : timeFilter === 'weekly' ? 7 : 30)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                  <div className="p-3 rounded-2xl bg-accent/10 text-accent border border-accent/20">
                    <AlertCircle size={24} className="text-sky-400" />
                  </div>
                  <p className="text-xs uppercase tracking-widest text-sky-400/80 font-black mb-2 opacity-80">Period Net</p>
                  <p className="text-2xl font-black tracking-tight">
                    {currency}{(filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) - filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div id="analytics-trend-chart" className="glass-card h-[450px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp size={20} className="text-accent" />
                      {trendPeriod === '7days' ? 'Recent Trend' : 'Monthly Comparison'}
                    </h3>
                    <div className="flex bg-accent/5 p-1 rounded-xl self-start sm:self-auto border border-accent/20">
                      <button 
                        onClick={() => setTrendPeriod('7days')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          trendPeriod === '7days' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-primary"
                        )}
                      >
                        7 Days
                      </button>
                      <button 
                        onClick={() => setTrendPeriod('monthComparison')}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                          trendPeriod === 'monthComparison' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-primary"
                        )}
                      >
                        Vs Last Month
                      </button>
                    </div>
                  </div>
                  <div className="h-[330px] w-full">
                    {trendPeriod === '7days' ? (
                      <TrendChart transactions={filteredTransactions} currency={currency} />
                    ) : (
                      <MonthlyComparisonChart transactions={filteredTransactions} currency={currency} />
                    )}
                  </div>
                </div>
                
                <div className="glass-card h-[450px]">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <PieChartIcon size={20} className="text-accent" />
                    Expense Distribution
                  </h3>
                  <div className="h-[350px] w-full">
                    <CategoryChart transactions={filteredTransactions} currency={currency} />
                  </div>
                </div>
              </div>

              <div className="glass-card h-[450px]">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <BarChart3 size={20} className="text-accent" />
                  Category Comparison
                </h3>
                <div className="h-[350px] w-full">
                  <ComparisonBarChart transactions={filteredTransactions} currency={currency} />
                </div>
              </div>

              <div className="glass-card">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <RefreshCcw size={20} className="text-accent" />
                   Month-over-Month Comparison
                </h3>
                <ComparisonSummary transactions={filteredTransactions} currency={currency} />
              </div>
            </motion.div>
          )}

              {activeTab === 'budget' && (
                <motion.div 
                  key="budget"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full space-y-6"
                >
                  <BudgetCard 
                    budget={budget} 
                    setBudget={updateBudget} 
                    transactions={filteredTransactions} 
                    currency={currency} 
                    previousBalance={previousBalance}
                  />
              
              <div className="mt-8 glass-card">
                <h4 className="text-lg font-semibold mb-4 text-primary">Budgeting Tips</h4>
                <ul className="space-y-4 text-sm text-muted">
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    Set realistic monthly limits based on your average Bazar and Rent costs.
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    Always track small expenses like Rickshaw/CNG to avoid "financial leaks".
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                    Aim to save at least 20% of your income for long-term financial growth.
                  </li>
                </ul>
              </div>
            </motion.div>
          )}

          {activeTab === 'user' && (
            <motion.div 
              key="user"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6"
            >
              <div className="glass-card text-center">
                <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-6 border border-accent/20 relative group bg-white/5 flex items-center justify-center">
                  {userPhotoURL ? (
                    <img src={userPhotoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={48} className="text-accent" />
                  )}
                  <div 
                    onClick={() => {
                      setProfileModalType('name');
                      setIsProfileModalOpen(true);
                    }}
                    className="absolute inset-0 bg-accent/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <Settings size={20} className="text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold mb-2">{userDisplayName || userEmail.split('@')[0]}</h2>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium border border-accent/20 mb-8">
                  <ShieldCheck size={14} /> Verified Account
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-8">
                  <div className="p-4 glass rounded-2xl border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">Email Address</p>
                    <p className="text-sm font-medium">{userEmail}</p>
                  </div>
                  <div className="p-4 glass rounded-2xl border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">Gender</p>
                    <p className="text-sm font-medium">{userGender || 'Not Set'}</p>
                  </div>
                  <div className="p-4 glass rounded-2xl border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">Member Since</p>
                    <p className="text-sm font-medium">
                      {registrationDate ? new Date(registrationDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric', day: 'numeric' }) : 'April 2026'}
                    </p>
                  </div>
                  <div className="p-4 glass rounded-2xl border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">Account Type</p>
                    <p className="text-sm font-medium">Personal Finance Pro</p>
                  </div>
                  <div className="p-4 glass rounded-2xl border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">Security Status</p>
                    <p className="text-sm font-medium text-accent">Bank-Grade Active</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      setProfileModalType('name');
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full py-3 glass rounded-xl text-sm font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <User size={16} /> Update Profile Info
                  </button>
                  <button 
                    onClick={() => {
                      setProfileModalType('password');
                      setIsProfileModalOpen(true);
                    }}
                    className="w-full py-3 glass rounded-xl text-sm font-bold hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={16} /> Change Password
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmAction({
                        title: "Delete Account",
                        message: "CRITICAL: Are you sure you want to delete your account? All your transaction data will be permanently erased. This action cannot be undone.",
                        isDanger: true,
                        onConfirm: async () => {
                          if (!auth.currentUser) return;
                          try {
                            // Delete transactions
                            const q = query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid));
                            const snapshot = await getDocs(q);
                            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                            await Promise.all(deletePromises);
                            
                            // Delete user doc
                            await deleteDoc(doc(db, 'users', auth.currentUser.uid));
                            
                            // Delete auth user
                            await deleteUser(auth.currentUser);
                            
                            handleLogout();
                          } catch (error: any) {
                            console.error("Delete Account Error:", error);
                            if (error.code === 'auth/requires-recent-login') {
                              alert("Please log out and log in again to perform this sensitive action.");
                            }
                          }
                        }
                      });
                      setIsConfirmModalOpen(true);
                    }}
                    className="w-full py-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl text-sm font-bold hover:bg-sky-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Delete Account
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="w-full py-3 glass rounded-xl text-sm font-bold text-muted hover:text-primary hover:bg-accent/10 transition-colors flex items-center justify-center gap-2 md:hidden"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full space-y-6"
            >
              <div className="glass-card">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Settings size={20} className="text-accent" />
                  Application Settings
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                        <Rocket size={20} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Restart Feature Tour</p>
                        <p className="text-[10px] text-muted">Watch the onboarding guide again</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowOnboarding(true)}
                      className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold transition-colors"
                    >
                      Start
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                        <Wallet size={20} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Preferred Currency</p>
                        <p className="text-[10px] text-muted">Change the currency symbol across the app</p>
                      </div>
                    </div>
                    <select 
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="bg-accent/10 border border-accent/20 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:border-accent/50 appearance-none text-primary"
                    >
                      <option value="৳" className="bg-white text-primary">BDT (৳)</option>
                      <option value="$" className="bg-white text-primary">USD ($)</option>
                      <option value="€" className="bg-white text-primary">EUR (€)</option>
                      <option value="£" className="bg-white text-primary">GBP (£)</option>
                      <option value="¥" className="bg-white text-primary">JPY (¥)</option>
                      <option value="₹" className="bg-white text-primary">INR (₹)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                        {theme === 'dark' ? <Moon size={20} className="text-accent" /> : <Sun size={20} className="text-accent" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">Display Theme</p>
                        <p className="text-[10px] text-muted">Switch between light and dark mode</p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleTheme}
                      className="relative w-12 h-6 bg-white/10 rounded-full p-1 transition-colors duration-300"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full transition-transform duration-300 flex items-center justify-center",
                        theme === 'dark' ? "translate-x-6 bg-accent" : "translate-x-0 bg-white"
                      )}>
                        {theme === 'dark' ? <Moon size={10} className="text-white" /> : <Sun size={10} className="text-accent" />}
                      </div>
                    </button>
                  </div>

                  <div className="p-4 glass rounded-2xl border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <Download size={20} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Export Data</p>
                        <p className="text-[10px] text-muted">Download your transaction records in various formats</p>
                      </div>
                    </div>
                    <div id="tour-export-section" className="grid grid-cols-3 gap-2">
                      <button 
                        onClick={() => {
                          const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
                          const rows = transactions.map(t => [
                            t.date,
                            t.type,
                            t.category === 'Other' ? t.customCategory : t.category,
                            `"${(t.description || '').replace(/"/g, '""')}"`,
                            t.amount
                          ].join(','));
                          const csvContent = [headers.join(','), ...rows].join('\n');
                          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `rr_${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                        }}
                        className="py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        CSV
                      </button>
                      <button 
                        onClick={exportToPDF}
                        className="py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        PDF
                      </button>
                      <button 
                        onClick={exportToExcel}
                        className="py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        EXCEL
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sky-500/10 rounded-xl flex items-center justify-center border border-sky-500/20">
                        <RefreshCcw size={20} className="text-sky-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Reset All Data</p>
                        <p className="text-[10px] text-white/40">Permanently clear all transactions</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setConfirmAction({
                          title: "Reset All Data",
                          message: "Are you sure you want to clear all data? This cannot be undone.",
                          isDanger: true,
                          onConfirm: () => {
                            setTransactions([]);
                            setBudget(0);
                            localStorage.removeItem('finflow_transactions');
                            localStorage.removeItem('finflow_budget');
                            setActiveTab('overview');
                          }
                        });
                        setIsConfirmModalOpen(true);
                      }}
                      className="px-4 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 rounded-xl text-xs font-bold transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 glass rounded-2xl border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                        <Info size={20} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">About RR</p>
                        <p className="text-[10px] text-white/40">Version 1.0.0 • 2026 Edition</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-faint italic">CS301 Project</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isProfileModalOpen && (
            <ProfileModal 
              type={profileModalType} 
              onClose={() => setIsProfileModalOpen(false)}
              userEmail={userEmail}
              userDisplayName={userDisplayName}
              setUserDisplayName={setUserDisplayName}
              userPhotoURL={userPhotoURL}
              setUserPhotoURL={setUserPhotoURL}
              userGender={userGender}
              setUserGender={setUserGender}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showOnboarding && (
            <Onboarding 
              onComplete={completeOnboarding} 
              onSkip={completeOnboarding}
              setActiveTab={setActiveTab}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {editingTransaction && (
            <TransactionEditModal 
              transaction={editingTransaction}
              onClose={() => setEditingTransaction(null)}
              onUpdate={updateTransaction}
              transactions={transactions}
              currency={currency}
              previousBalance={previousBalance}
            />
          )}
          {isConfirmModalOpen && confirmAction && (
            <ConfirmModal 
              title={confirmAction.title}
              message={confirmAction.message}
              isDanger={confirmAction.isDanger}
              onConfirm={() => {
                confirmAction.onConfirm();
                setIsConfirmModalOpen(false);
              }}
              onClose={() => setIsConfirmModalOpen(false)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-components ---

function LoginView({ onLogin }: { onLogin: (e: React.FormEvent) => void }) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateEmail = (email: string) => {
    const re = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return re.test(email.toLowerCase());
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[^A-Za-z0-9]/.test(pass)) strength++;
    return strength;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateEmail(email)) {
      setError('Please enter a valid @gmail.com address.');
      return;
    }

    if ((authMode === 'register' || (authMode === 'forgot' && forgotStep === 'reset')) && getPasswordStrength(authMode === 'register' ? password : newPassword) < 3) {
      setError('Password too weak. Use at least 8 chars, uppercase, numbers, and symbols.');
      return;
    }

    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email,
          displayName: email.split('@')[0],
          createdAt: serverTimestamp(),
          budget: 0,
          gender: '',
          hasCompletedOnboarding: false
        });

        await updateProfile(user, {
          displayName: email.split('@')[0]
        });

        setAuthMode('login');
        setSuccess('Successfully created! Please login.');
        setEmail('');
        setPassword('');
      } else if (authMode === 'login') {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          // onAuthStateChanged will handle the rest
        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            setError('Account not registered. Create a new one.');
          } else if (err.code === 'auth/wrong-password') {
            setError('Incorrect password. Please try again or reset your password.');
          } else if (err.code === 'auth/invalid-credential') {
            setError('Invalid credentials. Check your password or try resetting it if you forgot.');
          } else {
            setError('Login failed. Please check your credentials or reset your password.');
          }
        }
      } else if (authMode === 'forgot') {
        if (forgotStep === 'email') {
          try {
            await sendPasswordResetEmail(auth, email);
            setSuccess('Password reset email sent! Please check your inbox.');
          } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
              setError('User not found. Please register.');
            } else {
              setError('Failed to send reset email.');
            }
          }
        }
      }
    } catch (err: any) {
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        setError('This email is already registered. If you forgot your password, please reset it.');
      } else {
        console.error("Auth Error:", err);
        setError(errorMessage || 'An unexpected error occurred.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-6">
      <div className="atmosphere" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass-card max-w-md w-full p-6 sm:p-10 text-center"
      >
        <motion.div 
          initial={{ rotate: -10, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 bg-accent/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-accent/30 shadow-[0_0_30px_rgba(0,242,255,0.2)]"
        >
          <Wallet size={40} className="text-accent" />
        </motion.div>
        
        <h1 className="text-3xl font-bold mb-2 tracking-tight">RR</h1>
        <p className="text-muted mb-10 text-sm">
          {authMode === 'login' && 'Master your BDT portfolio with elegance.'}
          {authMode === 'register' && 'Join the elite financial circle.'}
          {authMode === 'forgot' && 'Recover your financial access.'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-5">
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-accent/10 border border-accent/20 text-accent text-xs py-2 px-4 rounded-xl mb-4 flex flex-col gap-2"
              >
                <span>{error}</span>
                {error.includes('Account not found') && (
                  <button 
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                    }}
                    className="text-accent hover:underline font-bold text-[10px] uppercase tracking-widest text-left"
                  >
                    Register Now →
                  </button>
                )}
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-accent/10 border border-accent/20 text-accent py-4 px-4 rounded-xl mb-6 text-center"
              >
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-50 mb-1">System Message</div>
                <div className="text-lg font-mono font-bold tracking-[0.2em]">{success}</div>
                {authMode === 'forgot' && forgotStep === 'otp' && (
                  <div className="text-[10px] mt-2 opacity-50 italic">Since this is a demo, the OTP is shown above.</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Gmail Address</label>
            <input 
              type="email" 
              placeholder="yourname@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-glass border border-glass-border rounded-2xl px-5 py-4 focus:outline-none focus:border-accent/50 transition-all duration-300 placeholder:text-faint disabled:opacity-50 text-primary"
              required
              disabled={authMode === 'forgot' && forgotStep !== 'email'}
            />
          </div>
          
          {(authMode === 'login' || authMode === 'register') && (
            <div className="space-y-2 text-left relative">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Password</label>
                {authMode === 'register' && password && (
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-widest",
                    getPasswordStrength(password) < 2 ? "text-sky-400" : 
                    getPasswordStrength(password) < 4 ? "text-cyan-400" : "text-accent"
                  )}>
                    Strength: {getPasswordStrength(password) < 2 ? 'Weak' : getPasswordStrength(password) < 4 ? 'Medium' : 'Strong'}
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-glass border border-glass-border rounded-2xl px-5 py-4 focus:outline-none focus:border-accent/50 transition-all duration-300 placeholder:text-faint pr-12 text-primary"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {authMode === 'register' && (
                <div className="flex gap-1 mt-1 px-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-500",
                        getPasswordStrength(password) >= i 
                          ? (getPasswordStrength(password) < 2 ? "bg-sky-500" : getPasswordStrength(password) < 4 ? "bg-cyan-500" : "bg-accent")
                          : "bg-glass"
                      )} 
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {authMode === 'forgot' && forgotStep === 'otp' && (
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Enter 6-Digit OTP</label>
              <input 
                type="text" 
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-glass border border-glass-border rounded-2xl px-5 py-4 focus:outline-none focus:border-accent/50 transition-all duration-300 placeholder:text-faint text-primary"
                required
                maxLength={6}
              />
            </div>
          )}

          {authMode === 'forgot' && forgotStep === 'reset' && (
            <div className="space-y-2 text-left relative">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">New Password</label>
                {newPassword && (
                  <span className={cn(
                    "text-[8px] font-bold uppercase tracking-widest",
                    getPasswordStrength(newPassword) < 2 ? "text-sky-400" : 
                    getPasswordStrength(newPassword) < 4 ? "text-cyan-400" : "text-accent"
                  )}>
                    Strength: {getPasswordStrength(newPassword) < 2 ? 'Weak' : getPasswordStrength(newPassword) < 4 ? 'Medium' : 'Strong'}
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-glass border border-glass-border rounded-2xl px-5 py-4 focus:outline-none focus:border-accent/50 transition-all duration-300 placeholder:text-faint pr-12 text-primary"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="flex gap-1 mt-1 px-1">
                {[1, 2, 3, 4].map((i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-500",
                      getPasswordStrength(newPassword) >= i 
                        ? (getPasswordStrength(newPassword) < 2 ? "bg-sky-500" : getPasswordStrength(newPassword) < 4 ? "bg-cyan-500" : "bg-accent")
                        : "bg-glass"
                    )} 
                  />
                ))}
              </div>
            </div>
          )}
          
          {authMode === 'login' && (
            <div className="text-right">
              <button 
                type="button"
                onClick={() => {
                  setAuthMode('forgot');
                  setForgotStep('email');
                  setError('');
                  setSuccess('');
                }}
                className="text-[10px] font-bold uppercase tracking-widest text-faint hover:text-accent transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-accent hover:bg-sky-400 text-bg-deep font-bold py-4 rounded-2xl transition-all shadow-lg shadow-accent/20 mt-4"
          >
            {authMode === 'login' && 'ACCESS TRACKER'}
            {authMode === 'register' && 'CREATE BDT ACCOUNT'}
            {authMode === 'forgot' && (
              forgotStep === 'email' ? 'SEND OTP' : 
              forgotStep === 'otp' ? 'VERIFY OTP' : 
              'RESET PASSWORD'
            )}
          </motion.button>
        </form>
        
        <div className="mt-8 space-y-3">
          {authMode === 'login' ? (
            <button 
              onClick={() => {
                setAuthMode('register');
                setError('');
                setSuccess('');
              }}
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              New to the platform? <span className="underline">Register BDT Account</span>
            </button>
          ) : (
            <button 
              onClick={() => {
                setAuthMode('login');
                setForgotStep('email');
                setError('');
                setSuccess('');
              }}
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              Back to Sign In
            </button>
          )}
        </div>

        <p className="text-[10px] text-faint mt-10 uppercase tracking-widest font-medium">
          Bank-Grade Encryption Enabled
        </p>
      </motion.div>
    </div>
  );
}


function SidebarLink({ active, onClick, icon, label, imageUrl, id }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; imageUrl?: string; id?: string }) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
        active 
          ? "bg-accent text-white shadow-lg shadow-accent/40" 
          : "text-muted hover:text-primary hover:bg-accent/5"
      )}
    >
      <span className={cn(
        "transition-transform duration-300 w-5 h-5 flex items-center justify-center overflow-hidden rounded-full",
        active ? "scale-110" : "group-hover:scale-110"
      )}>
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : icon}
      </span>
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}

function NavButton({ active, onClick, icon, label, imageUrl, id }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; imageUrl?: string; id?: string }) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all duration-300 relative px-2",
        active ? "text-accent" : "text-muted hover:text-primary"
      )}
    >
      <div className="w-5 h-5 flex items-center justify-center overflow-hidden rounded-full">
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : icon}
      </div>
      <span className="text-[9px] xs:text-[10px] uppercase tracking-widest font-bold">{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-indicator"
          className="absolute -top-12 w-1 h-1 bg-accent rounded-full shadow-[0_0_10px_rgba(76,201,240,0.8)]"
        />
      )}
    </button>
  );
}

function BalanceDisplay({ transactions, currency = '৳', className }: { transactions: Transaction[]; currency?: string; className?: string }) {
  const balance = transactions.reduce((acc, t) => {
    return t.type === 'income' ? acc + t.amount : acc - t.amount;
  }, 0);

  return (
    <div className={cn("font-mono font-bold tracking-tighter truncate", className || "text-2xl sm:text-3xl md:text-4xl text-primary")}>
      {balance < 0 && '-'}{currency}{Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 0 })}
    </div>
  );
}

function SummaryCard({ title, amount, icon, color, timeFilter, currency = '৳', id, highlighted }: { title: string; amount: number; icon: React.ReactNode; color: 'income' | 'expense' | 'primary'; timeFilter: string; currency?: string; id?: string; highlighted?: boolean }) {
  return (
    <div 
      id={id} 
      className={cn(
        "glass-card group p-6 rounded-3xl border transition-all duration-700 relative overflow-hidden",
        highlighted 
          ? "border-accent/60 shadow-[0_0_40px_rgba(76,201,240,0.25)] scale-[1.03]" 
          : "border-white/5 hover:border-accent/30"
      )}
    >
      {highlighted && (
        <>
          <motion.div 
            animate={{ 
              x: ['-100%', '200%'],
              opacity: [0, 0.3, 0]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/30 to-transparent skew-x-12 pointer-events-none" 
          />
          <motion.div 
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-accent/5 pointer-events-none" 
          />
        </>
      )}
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className={cn(
          "p-3 rounded-2xl border transition-colors",
          color === 'income' ? "bg-income/10 border-income/20 text-income" : 
          color === 'expense' ? "bg-expense/10 border-expense/20 text-expense" :
          "bg-accent/10 border-accent/20 text-accent shadow-[0_0_15px_rgba(76,201,240,0.3)]"
        )}>
          {React.cloneElement(icon as React.ReactElement, { size: 20 })}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-primary/40 group-hover:text-accent transition-colors">
          {timeFilter}
        </div>
      </div>
      <h4 className="text-secondary text-xs sm:text-sm font-medium mb-2 opacity-80 relative z-10">{title}</h4>
      <p className={cn(
        "font-mono font-bold truncate relative z-10 tracking-tighter",
        highlighted ? "text-4xl sm:text-5xl text-white drop-shadow-[0_0_15px_rgba(76,201,240,0.4)]" : "text-2xl sm:text-3xl"
      )}>
        {currency}{amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
      </p>
    </div>
  );
}

function BudgetCard({ budget, setBudget, transactions, currency = '৳', previousBalance = 0 }: { budget: number; setBudget: (v: number) => void; transactions: Transaction[]; currency?: string; previousBalance?: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBudget, setTempBudget] = useState(budget.toString());

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
  
  const budgetTitle = "Monthly Budget Goal";
  
  const percentage = budget > 0 ? (totalExpenses / budget) * 100 : 0;
  const clampedPercentage = Math.min(percentage, 100);
  const isOverBudget = budget > 0 && totalExpenses > budget;

  const donutData = budget > 0 ? [
    { name: 'Spent', value: totalExpenses, color: isOverBudget ? '#f72585' : 'var(--accent)' },
    { name: 'Remaining', value: Math.max(budget - totalExpenses, 0), color: 'rgba(255,255,255,0.03)' }
  ] : [];

  const handleSave = () => {
    const val = parseFloat(tempBudget);
    if (!isNaN(val) && val >= 0) {
      setBudget(val);
      setIsEditing(false);
    }
  };

  return (
    <div id="tour-budget-card" className="glass-card relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20">
          <AlertCircle className={cn(isOverBudget ? "text-sky-400" : "text-accent")} size={20} />
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="text-[10px] font-bold uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
        >
          {isEditing ? 'Save' : 'Set Budget'}
        </button>
      </div>
      
      <h4 className="text-muted text-sm font-medium mb-1">{budgetTitle}</h4>
      
      {isEditing ? (
        <input 
          autoFocus
          type="number"
          value={tempBudget}
          onChange={(e) => setTempBudget(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="text-2xl font-mono font-bold bg-transparent border-b border-accent w-full focus:outline-none mb-4"
        />
      ) : (
        <p className="text-2xl font-mono font-bold mb-4">{currency}{budget.toLocaleString()}</p>
      )}

      {budget > 0 || previousBalance > 0 ? (
        <div className="flex flex-col sm:flex-row items-center gap-8 mb-4">
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {donutData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      className={index === 0 ? "drop-shadow-[0_0_8px_var(--accent-glow)]" : ""} 
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={cn(
                "text-2xl font-bold font-mono tracking-tighter",
                isOverBudget ? "text-sky-400" : "text-primary"
              )}>
                {Math.round(clampedPercentage)}%
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-faint">Spent</span>
            </div>
          </div>

          <div className="flex-1 space-y-4 w-full">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[10px] text-muted font-bold uppercase tracking-widest">
                <span>Monthly Target</span>
                <span className="text-primary">{currency}{budget.toLocaleString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[9px] uppercase tracking-widest text-faint font-bold mb-1">Spent</p>
                <p className={cn("text-sm font-mono font-bold", isOverBudget ? "text-sky-400" : "text-primary")}>
                  {currency}{totalExpenses.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-accent/5 border border-accent/20">
                <p className="text-[9px] uppercase tracking-widest text-accent font-black mb-1">Remaining Goal</p>
                <p className="text-sm font-mono font-black text-income">
                  {currency}{Math.max(budget - totalExpenses, 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest">
                <span className="text-faint">Usage Intensity</span>
                <span className={isOverBudget ? "text-sky-400" : "text-accent"}>
                  {isOverBudget ? 'Critical' : percentage > 80 ? 'Heavy' : percentage > 50 ? 'Moderate' : 'Healthy'}
                </span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${clampedPercentage}%` }}
                  className={cn(
                    "h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(76,201,240,0.3)]",
                    isOverBudget ? "bg-sky-500" : "bg-accent"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
          <div className="p-4 rounded-full bg-white/5 mb-4">
            <Target size={32} className="text-faint" />
          </div>
          <p className="text-sm font-bold">Unset Budget</p>
          <p className="text-xs text-muted max-w-[200px]">Set a monthly budget to unlock visual progress tracking</p>
        </div>
      )}

      {isOverBudget && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-3"
            >
              <AlertCircle size={16} className="text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Financial Stretch Alert</p>
                <p className="text-xs text-muted leading-relaxed">You've exceeded your budget by ৳{(totalExpenses - budget).toLocaleString()}. Consider reviewing your "Other" expenses to regain control.</p>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="mt-2 text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
                >
                  Adjust Budget Now →
                </button>
              </div>
            </motion.div>
          )}
    </div>
  );
}

function TransactionForm({ 
  onAdd, 
  transactions = [],
  currency = '৳',
  previousBalance = 0
}: { 
  onAdd: (t: Omit<Transaction, 'id'>) => void;
  transactions?: Transaction[];
  currency?: string;
  previousBalance?: number;
}) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [linkedIncomeIds, setLinkedIncomeIds] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const incomeSourceStats = useMemo(() => {
    const stats: Record<string, { initial: number; remaining: number }> = {
      'PRIOR_SAVINGS': { initial: previousBalance, remaining: previousBalance }
    };
    
    // Initialize with income amounts
    transactions.forEach(t => {
      if (t.type === 'income') {
        stats[t.id] = { initial: t.amount, remaining: t.amount };
      }
    });

    // Subtract expense amounts to find remaining
    transactions.forEach(t => {
      if (t.type === 'expense' && t.linkedIncomeIds && t.linkedIncomeIds.length > 0) {
        const share = t.amount / t.linkedIncomeIds.length;
        t.linkedIncomeIds.forEach(id => {
          if (stats[id]) {
            stats[id].remaining -= share;
          }
        });
      }
    });

    return stats;
  }, [transactions, previousBalance]);

  const incomeTransactions = useMemo(() => 
    transactions
      .filter(t => t.type === 'income')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
    [transactions]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!amount || !category || !date || isNaN(parsedAmount)) return;

    // Check if any selected income gets fully spent
    if (type === 'expense' && linkedIncomeIds.length > 0) {
      const share = parsedAmount / linkedIncomeIds.length;
      const fullySpentIncomes: string[] = [];

      linkedIncomeIds.forEach(id => {
        const stats = incomeSourceStats[id];
        if (stats && stats.remaining - share <= 0.01) { // Floating point safety
          const name = id === 'PRIOR_SAVINGS' ? 'Prior Month Savings' : 
            incomeTransactions.find(inc => inc.id === id)?.description || 'Income';
          fullySpentIncomes.push(name);
        }
      });

      if (fullySpentIncomes.length > 0) {
        setNotification({
          message: `Notice: ${fullySpentIncomes.join(', ')} ${fullySpentIncomes.length > 1 ? 'have' : 'has'} been fully spent!`,
          type: 'warning'
        });
        setTimeout(() => setNotification(null), 5000);
      }
    }

    onAdd({
      amount: parsedAmount,
      category,
      customCategory: category === 'Other' ? customCategory : null,
      date,
      description: description || (category === 'Other' ? customCategory : category),
      type,
      linkedIncomeIds: type === 'expense' ? linkedIncomeIds : null
    });

    setAmount('');
    setCategory('');
    setCustomCategory('');
    setDescription('');
    setLinkedIncomeIds([]);
  };

  const toggleIncomeSource = (id: string) => {
    setLinkedIncomeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex p-1 glass rounded-xl">
        <button 
          type="button"
          onClick={() => setType('expense')}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
            type === 'expense' ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "text-muted hover:text-accent"
          )}
        >
          Expense
        </button>
        <button 
          type="button"
          onClick={() => setType('income')}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
            type === 'income' ? "bg-accent text-bg-deep shadow-lg shadow-accent/20" : "text-muted hover:text-accent"
          )}
        >
          Income
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "col-span-full p-3 rounded-xl flex items-center gap-2 text-xs font-bold",
              notification.type === 'warning' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
            )}
          >
            <AlertCircle size={14} />
            {notification.message}
          </motion.div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Amount ({currency})</label>
          <input 
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary placeholder:text-faint"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Date</label>
          <div className="relative">
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex-1 bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary text-left"
              >
                {date}
              </button>
              <input 
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary"
                required
              />
            </div>
            {showCalendar && (
              <div className="absolute top-full left-0 z-[999] mt-2">
                <CalendarPicker
                  selectedDate={new Date(date)}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d.toISOString().split('T')[0]);
                      setShowCalendar(false);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1 relative">
        <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Category</label>
        <div className="relative">
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 appearance-none pr-10 text-primary"
            required
          >
            <option value="" disabled className="bg-bg-deep">Select Category</option>
            {(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
              <option key={cat} value={cat} className="bg-bg-deep">{cat}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-faint">
            <ChevronRight size={14} className="rotate-90" />
          </div>
        </div>
      </div>

      {category === 'Other' && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-1"
        >
          <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Custom Category Name</label>
          <input 
            type="text"
            placeholder="e.g., Gift, Bonus, etc."
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary placeholder:text-faint"
            required
          />
        </motion.div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Description</label>
        <input 
          type="text"
          placeholder="What was this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary placeholder:text-faint"
        />
      </div>

      {type === 'expense' && (incomeTransactions.length > 0 || previousBalance > 0) && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1 flex justify-between">
            <span>Spent from (Choose multiple)</span>
            {linkedIncomeIds.length > 0 && <span className="text-accent">{linkedIncomeIds.length} selected</span>}
          </label>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {previousBalance > 0 && (() => {
              const stats = incomeSourceStats['PRIOR_SAVINGS'] || { initial: 0, remaining: 0 };
              const isSpent = stats.remaining <= 0;
              const spentAmount = stats.initial - stats.remaining;
              return (
                <button
                  type="button"
                  disabled={isSpent && !linkedIncomeIds.includes('PRIOR_SAVINGS')}
                  onClick={() => toggleIncomeSource('PRIOR_SAVINGS')}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    linkedIncomeIds.includes('PRIOR_SAVINGS')
                      ? "bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(76,201,240,0.1)]"
                      : isSpent ? "bg-white/5 border-white/5 opacity-40 grayscale cursor-not-allowed" : "bg-glass border-glass-border text-muted hover:border-accent/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all",
                      linkedIncomeIds.includes('PRIOR_SAVINGS') ? "bg-accent border-accent" : "border-faint"
                    )}>
                      {linkedIncomeIds.includes('PRIOR_SAVINGS') && <Check size={12} className="text-bg-deep" />}
                      {isSpent && !linkedIncomeIds.includes('PRIOR_SAVINGS') && <X size={10} className="text-white" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">Prior Month Savings</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-70">Spent: {currency}{Math.round(spentAmount).toLocaleString()}</span>
                        {isSpent && <span className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">Fully Spent</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono block">{currency}{Math.max(0, Math.round(stats.remaining)).toLocaleString()}</span>
                    <span className="text-[9px] opacity-40">remaining</span>
                  </div>
                </button>
              );
            })()}
            {incomeTransactions.map(inc => {
              const stats = incomeSourceStats[inc.id] || { initial: 0, remaining: 0 };
              const isSpent = stats.remaining <= 0;
              const spentAmount = stats.initial - stats.remaining;
              return (
                <button
                  key={inc.id}
                  type="button"
                  disabled={isSpent && !linkedIncomeIds.includes(inc.id)}
                  onClick={() => toggleIncomeSource(inc.id)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                    linkedIncomeIds.includes(inc.id)
                      ? "bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(76,201,240,0.1)]"
                      : isSpent ? "bg-white/5 border-white/5 opacity-40 grayscale cursor-not-allowed" : "bg-glass border-glass-border text-muted hover:border-accent/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all",
                      linkedIncomeIds.includes(inc.id) ? "bg-accent border-accent" : "border-faint"
                    )}>
                      {linkedIncomeIds.includes(inc.id) && <Check size={12} className="text-bg-deep" />}
                      {isSpent && !linkedIncomeIds.includes(inc.id) && <X size={10} className="text-white" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate max-w-[150px]">{inc.description}</span>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[10px] opacity-60">{inc.category}</span>
                        <span className="text-[10px] text-sky-400/80 font-medium">Spent: {currency}{Math.round(spentAmount).toLocaleString()}</span>
                        {isSpent && <span className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">Fully Spent</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono block">{currency}{Math.max(0, Math.round(stats.remaining)).toLocaleString()}</span>
                    <span className="text-[9px] opacity-40">remaining</span>
                  </div>
                </button>
              );
            })}
          </div>
          {linkedIncomeIds.length === 0 && (
            <p className="text-[9px] text-faint italic ml-1">* Defaults to General Balance</p>
          )}
        </div>
      )}

                  <button 
                    type="submit"
                    className="w-full bg-accent text-white py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                  >
                    <Plus size={18} /> Add Entry
                  </button>
    </form>
  );
}

function TransactionList({ 
  transactions, 
  onDelete, 
  onEdit,
  compact = false,
  currency = '৳',
  allTransactions = []
}: { 
  transactions: Transaction[]; 
  onDelete: (id: string) => void; 
  onEdit: (t: Transaction) => void;
  compact?: boolean;
  currency?: string;
  allTransactions?: Transaction[];
}) {
  if (transactions.length === 0) {
    return (
              <div className="py-12 text-center text-faint italic">
                No transactions yet.
              </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {transactions.map((t) => (
          <TransactionItem 
            key={t.id} 
            t={t} 
            onDelete={onDelete} 
            onEdit={onEdit} 
            compact={compact} 
            currency={currency} 
            allTransactions={allTransactions}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function TransactionItem({ 
  t, 
  onDelete, 
  onEdit,
  compact,
  currency = '৳',
  allTransactions = []
}: { 
  t: Transaction; 
  onDelete: (id: string) => void; 
  onEdit: (t: Transaction) => void;
  compact: boolean;
  currency?: string;
  allTransactions?: Transaction[];
  key?: string 
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Subtle parallax: move slightly as it passes through the viewport
  const parallaxY = useTransform(scrollYProgress, [0, 1], [15, -15]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.6, 1, 1, 0.6]);

  const displayCategory = t.category === 'Other' ? (t.customCategory || 'Other') : t.category;
  
  const linkedIncomes = useMemo(() => {
    const ids = t.linkedIncomeIds || [];
    return ids.map(id => {
      if (id === 'PRIOR_SAVINGS') return { id, description: 'Prior Month Savings', amount: 0 };
      return allTransactions.find(inc => inc.id === id);
    }).filter(Boolean) as (Transaction | { id: string; description: string; amount: number })[];
  }, [t.linkedIncomeIds, allTransactions]);

  return (
    <motion.div 
      ref={ref}
      style={{ y: parallaxY, opacity }}
      initial={{ opacity: 0, x: t.type === 'income' ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ 
        scale: 1.01,
        boxShadow: t.type === 'income' 
          ? "0 0 25px rgba(76, 201, 240, 0.1)" 
          : "0 0 25px rgba(72, 149, 239, 0.1)",
        borderColor: t.type === 'income'
          ? "rgba(76, 201, 240, 0.2)"
          : "rgba(72, 149, 239, 0.2)"
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group flex items-center justify-between p-3 sm:p-4 glass rounded-2xl border-white/5 transition-colors cursor-default"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className={cn(
          "p-2 sm:p-3 rounded-xl shrink-0",
          t.type === 'income' ? "bg-accent/10 text-accent" : "bg-primary/5 text-muted"
        )}>
          {CATEGORIES[t.category]?.icon || <DollarSign size={18} />}
        </div>
        <div className="min-w-0">
          <h5 className="font-semibold text-sm truncate">{t.description}</h5>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest text-faint font-bold">
              <span className="truncate max-w-[80px] sm:max-w-none">{displayCategory}</span>
              <span>•</span>
              <span className="shrink-0">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
            {linkedIncomes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {linkedIncomes.map((inc, idx) => (
                  <div key={inc.id} className="flex items-center gap-1 text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">
                    {idx === 0 && <LinkIcon size={8} />}
                    <span>{inc.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2">
        <div className={cn(
          "font-mono font-bold text-sm sm:text-base",
          t.type === 'income' ? "text-accent" : "text-primary/80"
        )}>
          {t.type === 'income' ? '+' : '-'}{currency}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
        </div>
        {!compact && (
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-all">
            <button 
              onClick={() => onEdit(t)}
              className="p-2 text-primary/20 hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={() => onDelete(t.id)}
              className="p-2 text-primary/20 hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CategoryChart({ transactions, currency = '৳' }: { transactions: Transaction[]; currency?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const data = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories: Record<string, number> = {};
    
    expenses.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
      color: CATEGORIES[name]?.color || '#64748b'
    })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 5) * cos;
    const sy = cy + (outerRadius + 5) * sin;
    const mx = cx + (outerRadius + 15) * cos;
    const my = cy + (outerRadius + 15) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 15;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill="var(--text-primary)" className="text-sm sm:text-lg font-bold">
          {payload.name}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 4}
          outerRadius={outerRadius + 6}
          fill={fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} textAnchor={textAnchor} fill="var(--text-primary)" className="text-xs font-black">
          {`${currency}${value.toLocaleString()}`}
        </text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey} dy={16} textAnchor={textAnchor} fill="#999" className="text-[10px] font-medium">
          {`(${(percent * 100).toFixed(1)}%)`}
        </text>
      </g>
    );
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 8;
    const x = cx + radius * Math.cos(-RADIAN * midAngle);
    const y = cy + radius * Math.sin(-RADIAN * midAngle);

    return (
      <text 
        x={x} 
        y={y} 
        fill="rgba(255,255,255,0.6)" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-[10px] sm:text-xs font-black uppercase tracking-tight"
      >
        {`${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (data.length === 0) return <div className="h-full flex items-center justify-center text-white/20 italic text-sm">No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
        <Pie
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={55}
          paddingAngle={5}
          dataKey="value"
          stroke="none"
          onMouseEnter={onPieEnter}
          animationBegin={0}
          animationDuration={1500}
          label={renderCustomizedLabel}
          labelLine={{ stroke: 'var(--glass-border)', strokeWidth: 1 }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ display: 'none' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ComparisonBarChart({ transactions, currency = '৳' }: { transactions: Transaction[]; currency?: string }) {
  const data = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories: Record<string, number> = {};
    
    expenses.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    return Object.entries(categories).map(([name, value]) => ({
      name,
      value,
      color: CATEGORIES[name]?.color || '#64748b'
    })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [transactions]);

  if (data.length === 0) return <div className="h-full flex items-center justify-center text-muted italic text-sm">No data</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 10, right: 10, top: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="var(--text-secondary)" 
          fontSize={11}
          fontWeight="bold"
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={70}
        />
        <YAxis hide />
        <Tooltip 
          cursor={{ fill: 'var(--glass)' }}
          contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          formatter={(value: number) => [`${currency}${value.toLocaleString()}`, 'Amount']}
        />
        <Bar 
          dataKey="value" 
          radius={[6, 6, 0, 0]} 
          barSize={30}
          animationBegin={500}
          animationDuration={1500}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ComparisonSummary({ transactions, currency = '৳' }: { transactions: Transaction[]; currency: string }) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const lastMonthRaw = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const thisMonthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthTransactions = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === lastMonthRaw && d.getFullYear() === lastMonthYear;
    });

    const thisMonthExpense = thisMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const lastMonthExpense = lastMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    const diff = thisMonthExpense - lastMonthExpense;
    const percentage = lastMonthExpense === 0 ? 0 : (diff / lastMonthExpense) * 100;

    return {
      thisMonthExpense,
      lastMonthExpense,
      diff,
      percentage
    };
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
      <div className="p-5 glass rounded-2xl border-white/5 bg-white/5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs uppercase tracking-widest text-muted font-black">This Month</p>
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 shadow-sm shadow-sky-500/10">
            <TrendingDown size={16} />
          </div>
        </div>
        <p className="text-2xl font-black tracking-tight">{currency}{stats.thisMonthExpense.toLocaleString()}</p>
        <p className="text-xs text-muted mt-2 font-medium italic opacity-70">Current spending velocity</p>
      </div>

      <div className="p-5 glass rounded-2xl border-white/5 bg-white/5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs uppercase tracking-widest text-muted font-black">Vs Last Month</p>
          <div className={cn(
            "p-2 rounded-lg flex items-center gap-1.5 text-xs font-black shadow-sm",
            stats.diff > 0 ? "bg-sky-500/10 text-sky-400 shadow-sky-500/10" : "bg-accent/10 text-accent shadow-accent/10"
          )}>
            {stats.diff > 0 ? <Plus size={12} /> : <Minus size={12} />}
            {Math.abs(stats.percentage).toFixed(1)}%
          </div>
        </div>
        <p className={cn(
          "text-2xl font-black tracking-tight",
          stats.diff > 0 ? "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.2)]" : "text-accent drop-shadow-[0_0_8px_rgba(76,201,240,0.2)]"
        )}>
          {stats.diff > 0 ? '+' : '-'}{currency}{Math.abs(stats.diff).toLocaleString()}
        </p>
        <p className="text-xs text-muted mt-2 font-medium italic opacity-70">
          {stats.diff > 0 ? "Spending is up" : "Spending is down"} compared to last month
        </p>
      </div>
    </div>
  );
}

function MonthlyComparisonChart({ transactions, currency = '৳' }: { transactions: Transaction[]; currency?: string }) {
  const data = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const lastMonthRaw = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      
      const thisMonthVal = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.type === 'expense';
      }).reduce((acc, t) => acc + t.amount, 0);

      const lastMonthVal = transactions.filter(t => {
        const d = new Date(t.date);
        return d.getDate() === day && d.getMonth() === lastMonthRaw && d.getFullYear() === lastMonthYear && t.type === 'expense';
      }).reduce((acc, t) => acc + t.amount, 0);

      return {
        day,
        thisMonth: thisMonthVal,
        lastMonth: lastMonthVal,
      };
    });
  }, [transactions]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
        <defs>
          <linearGradient id="colorThis" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorLast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="day" 
          stroke="var(--text-secondary)" 
          fontSize={11} 
          fontWeight="bold"
          tickLine={false}
          axisLine={false}
          label={{ value: 'Day', position: 'insideBottom', offset: -10, fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 'bold' }}
        />
        <YAxis 
          stroke="var(--text-secondary)" 
          fontSize={11} 
          fontWeight="bold"
          tickLine={false} 
          axisLine={false}
          tickFormatter={(value) => `${currency}${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          formatter={(value: number) => [`${currency}${value.toLocaleString()}`, '']}
        />
        <Area 
          type="monotone" 
          dataKey="thisMonth" 
          name="Current Month"
          stroke="var(--accent)" 
          fillOpacity={1} 
          fill="url(#colorThis)" 
          strokeWidth={2}
          animationDuration={1500}
        />
        <Area 
          type="monotone" 
          dataKey="lastMonth" 
          name="Previous Month"
          stroke="#94a3b8" 
          fillOpacity={1} 
          fill="url(#colorLast)" 
          strokeWidth={1.5}
          strokeDasharray="4 4"
          animationDuration={2000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ transactions, currency = '৳' }: { transactions: Transaction[]; currency?: string }) {
  const data = useMemo(() => {
    // If we have transactions, determine the range to show
    // Otherwise default to last 7 days
    let dates: string[] = [];
    
    if (transactions.length > 0) {
      // Find the range of dates in the transactions
      const sortedDates = [...transactions].map(t => t.date).sort();
      const firstDate = new Date(sortedDates[0]);
      const lastDate = new Date(sortedDates[sortedDates.length - 1]);
      
      // If the range is small (e.g. within 14 days), show the actual range
      const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && diffDays <= 31) {
        // Show the range from first to last date in transactions
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(firstDate);
          d.setDate(firstDate.getDate() + i);
          dates.push(d.toISOString().split('T')[0]);
        }
      }
    }
    
    // Fallback: Last 7 days from now
    if (dates.length === 0) {
      dates = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();
    }

    return dates.map(date => {
      const dayTransactions = transactions.filter(t => t.date === date);
      const income = dayTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
      
      return {
        date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        income,
        expense
      };
    });
  }, [transactions]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="date" 
          stroke="var(--text-secondary)" 
          fontSize={11} 
          fontWeight="bold"
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="var(--text-secondary)" 
          fontSize={11} 
          fontWeight="bold"
          tickLine={false} 
          axisLine={false}
          tickFormatter={(value) => `${currency}${value}`}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'var(--bg-deep)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)' }}
          itemStyle={{ color: 'var(--text-primary)' }}
          formatter={(value: number) => [`${currency}${value.toLocaleString()}`, '']}
        />
        <Area 
          type="monotone" 
          dataKey="income" 
          stroke="var(--color-income)" 
          fillOpacity={1} 
          fill="url(#colorIncome)" 
          strokeWidth={3}
        />
        <Area 
          type="monotone" 
          dataKey="expense" 
          stroke="var(--color-expense)" 
          fillOpacity={1} 
          fill="url(#colorExpense)" 
          strokeWidth={3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TransactionEditModal({ 
  transaction, 
  onClose, 
  onUpdate,
  transactions = [],
  currency = '৳',
  previousBalance = 0
}: { 
  transaction: Transaction; 
  onClose: () => void; 
  onUpdate: (id: string, data: Omit<Transaction, 'id'>) => void;
  transactions?: Transaction[];
  currency?: string;
  previousBalance?: number;
}) {
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [customCategory, setCustomCategory] = useState(transaction.customCategory || '');
  const [date, setDate] = useState(transaction.date);
  const [description, setDescription] = useState(transaction.description || '');
  const [linkedIncomeIds, setLinkedIncomeIds] = useState<string[]>(transaction.linkedIncomeIds || []);
  const [showCalendar, setShowCalendar] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const incomeSourceStats = useMemo(() => {
    const stats: Record<string, { initial: number; remaining: number }> = {
      'PRIOR_SAVINGS': { initial: previousBalance, remaining: previousBalance }
    };
    
    // Initialize with income amounts
    transactions.forEach(t => {
      if (t.type === 'income') {
        stats[t.id] = { initial: t.amount, remaining: t.amount };
      }
    });

    // Subtract expense amounts
    transactions.forEach(t => {
      if (t.type === 'expense' && t.linkedIncomeIds && t.linkedIncomeIds.length > 0) {
        // Skip current transaction to see "Available" before this transaction's impact
        if (t.id === transaction.id) return;

        const share = t.amount / t.linkedIncomeIds.length;
        t.linkedIncomeIds.forEach(id => {
          if (stats[id]) {
            stats[id].remaining -= share;
          }
        });
      }
    });

    return stats;
  }, [transactions, previousBalance, transaction.id]);

  const incomeTransactions = useMemo(() => 
    transactions
      .filter(t => t.type === 'income' && t.id !== transaction.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
    [transactions, transaction.id]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!amount || !category || !date || isNaN(parsedAmount)) return;

    // Check if any selected income gets fully spent
    if (type === 'expense' && linkedIncomeIds.length > 0) {
      const share = parsedAmount / linkedIncomeIds.length;
      const fullySpentIncomes: string[] = [];

      linkedIncomeIds.forEach(id => {
        const stats = incomeSourceStats[id];
        if (stats && stats.remaining - share <= 0.01) {
          const name = id === 'PRIOR_SAVINGS' ? 'Prior Month Savings' : 
            incomeTransactions.find(inc => inc.id === id)?.description || 'Income';
          fullySpentIncomes.push(name);
        }
      });

      if (fullySpentIncomes.length > 0) {
        setNotification({
          message: `Notice: ${fullySpentIncomes.join(', ')} ${fullySpentIncomes.length > 1 ? 'have' : 'has'} been fully spent!`,
          type: 'warning'
        });
        setTimeout(() => setNotification(null), 5000);
      }
    }

    onUpdate(transaction.id, {
      amount: parsedAmount,
      category,
      customCategory: category === 'Other' ? customCategory : null,
      date,
      description: description || (category === 'Other' ? customCategory : category),
      type,
      linkedIncomeIds: type === 'expense' ? linkedIncomeIds : null
    });
  };

  const toggleIncomeSource = (id: string) => {
    setLinkedIncomeIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Edit Entry</h3>
          <button onClick={onClose} className="text-muted hover:text-accent transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex p-1 glass rounded-xl">
            <button 
              type="button"
              onClick={() => setType('expense')}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                type === 'expense' ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20" : "text-muted hover:text-accent"
              )}
            >
              Expense
            </button>
            <button 
              type="button"
              onClick={() => setType('income')}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                type === 'income' ? "bg-accent text-bg-deep shadow-lg shadow-accent/20" : "text-muted hover:text-accent"
              )}
            >
              Income
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notification && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "col-span-full p-3 rounded-xl flex items-center gap-2 text-xs font-bold",
                  notification.type === 'warning' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                )}
              >
                <AlertCircle size={14} />
                {notification.message}
              </motion.div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Amount ({currency})</label>
              <input 
                type="number" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary placeholder:text-faint"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Date</label>
              <div className="flex gap-2 relative">
                <button 
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="flex-1 bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary text-left"
                >
                  {date}
                </button>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary"
                  required
                />
                {showCalendar && (
                  <div className="absolute top-full left-0 z-[999] mt-2">
                    <CalendarPicker
                      selectedDate={new Date(date)}
                      onSelect={(d) => {
                        if (d) {
                          setDate(d.toISOString().split('T')[0]);
                          setShowCalendar(false);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Category</label>
            <div className="relative">
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 appearance-none pr-10 text-primary"
                required
              >
                <option value="" disabled className="bg-bg-deep">Select Category</option>
                {(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                  <option key={cat} value={cat} className="bg-bg-deep">{cat}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-faint">
                <ChevronRight size={14} className="rotate-90" />
              </div>
            </div>
          </div>

          {category === 'Other' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Custom Category Name</label>
              <input 
                type="text"
                placeholder="e.g., Gift, Bonus, etc."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary placeholder:text-faint"
                required
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Description</label>
            <input 
              type="text"
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 text-primary placeholder:text-faint"
            />
          </div>

          {type === 'expense' && (incomeTransactions.length > 0 || previousBalance > 0) && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1 flex justify-between">
                <span>Spent from (Choose multiple)</span>
                {linkedIncomeIds.length > 0 && <span className="text-accent">{linkedIncomeIds.length} selected</span>}
              </label>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {previousBalance > 0 && (() => {
                  const stats = incomeSourceStats['PRIOR_SAVINGS'] || { initial: 0, remaining: 0 };
                  const isSpent = stats.remaining <= 0;
                  const spentAmount = stats.initial - stats.remaining;
                  return (
                    <button
                      type="button"
                      disabled={isSpent && !linkedIncomeIds.includes('PRIOR_SAVINGS')}
                      onClick={() => toggleIncomeSource('PRIOR_SAVINGS')}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                        linkedIncomeIds.includes('PRIOR_SAVINGS')
                          ? "bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(76,201,240,0.1)]"
                          : isSpent ? "bg-white/5 border-white/5 opacity-40 grayscale cursor-not-allowed" : "bg-glass border-glass-border text-muted hover:border-accent/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          linkedIncomeIds.includes('PRIOR_SAVINGS') ? "bg-accent border-accent" : "border-faint"
                        )}>
                          {linkedIncomeIds.includes('PRIOR_SAVINGS') && <Check size={12} className="text-bg-deep" />}
                          {isSpent && !linkedIncomeIds.includes('PRIOR_SAVINGS') && <X size={10} className="text-white" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">Prior Month Savings</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] opacity-70">Spent: {currency}{Math.round(spentAmount).toLocaleString()}</span>
                            {isSpent && <span className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">Fully Spent</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono block">{currency}{Math.max(0, Math.round(stats.remaining)).toLocaleString()}</span>
                        <span className="text-[9px] opacity-40">remaining</span>
                      </div>
                    </button>
                  );
                })()}
                {incomeTransactions.map(inc => {
                  const stats = incomeSourceStats[inc.id] || { initial: 0, remaining: 0 };
                  const isSpent = stats.remaining <= 0;
                  const spentAmount = stats.initial - stats.remaining;
                  return (
                    <button
                      key={inc.id}
                      type="button"
                      disabled={isSpent && !linkedIncomeIds.includes(inc.id)}
                      onClick={() => toggleIncomeSource(inc.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                        linkedIncomeIds.includes(inc.id)
                          ? "bg-accent/10 border-accent text-accent shadow-[0_0_15px_rgba(76,201,240,0.1)]"
                          : isSpent ? "bg-white/5 border-white/5 opacity-40 grayscale cursor-not-allowed" : "bg-glass border-glass-border text-muted hover:border-accent/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          linkedIncomeIds.includes(inc.id) ? "bg-accent border-accent" : "border-faint"
                        )}>
                          {linkedIncomeIds.includes(inc.id) && <Check size={12} className="text-bg-deep" />}
                          {isSpent && !linkedIncomeIds.includes(inc.id) && <X size={10} className="text-white" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold truncate max-w-[150px]">{inc.description}</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[10px] opacity-60">{inc.category}</span>
                            <span className="text-[10px] text-sky-400/80 font-medium">Spent: {currency}{Math.round(spentAmount).toLocaleString()}</span>
                            {isSpent && <span className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">Fully Spent</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono block">{currency}{Math.max(0, Math.round(stats.remaining)).toLocaleString()}</span>
                        <span className="text-[9px] opacity-40">remaining</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 glass rounded-xl text-sm font-bold hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/80 transition-colors"
            >
              Update Entry
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ConfirmModal({ 
  title, 
  message, 
  onConfirm, 
  onClose,
  isDanger = false
}: { 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onClose: () => void;
  isDanger?: boolean;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass-card w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className={cn("text-xl font-bold", isDanger ? "text-sky-400" : "text-primary")}>{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-accent transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-muted mb-8 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 glass rounded-xl text-sm font-bold hover:bg-accent/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold shadow-lg transition-colors",
              isDanger 
                ? "bg-sky-500 text-white shadow-sky-900/20 hover:bg-sky-600" 
                : "bg-accent text-white shadow-accent/20 hover:bg-accent/80"
            )}
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Onboarding({ onComplete, onSkip, setActiveTab }: { onComplete: () => void; onSkip: () => void; setActiveTab: (tab: any) => void }) {
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

  const steps = [
    {
      title: "Welcome to RR!",
      description: "Welcome back! Let's take a comprehensive tour of your new financial command center. We've added powerful tools to help you master your money.",
      icon: <Rocket size={48} className="text-accent" />,
      tab: 'overview',
      targetId: null
    },
    {
      title: "Tracking Your Wealth",
      description: "Your live balance is always visible here. It updates instantly whenever you record an income or expense.",
      icon: <Wallet size={48} className="text-accent" />,
      tab: 'overview',
      targetId: 'header-balance-info'
    },
    {
      title: "The Golden Ratio",
      description: "Look at your new 'Net Savings' card. It perfectly balances your Total Income against Expenses, so you know exactly how much you're actually keeping.",
      icon: <Scale size={48} className="text-accent" />,
      tab: 'overview',
      targetId: 'sum-card-savings'
    },
    {
      title: "Time-Travel Filtering",
      description: "You're no longer limited to the current week. Select any year or month. In 'Weekly' mode, you can even jump to a specific week of your choosing!",
      icon: <Calendar size={48} className="text-accent" />,
      tab: 'overview',
      targetId: 'dashboard-filter-controls'
    },
    {
      title: "Quick Navigation",
      description: "Use the sidebar to jump between features. Let's try adding a transaction now.",
      icon: <Plus size={48} className="text-accent" />,
      tab: 'overview',
      targetId: 'tour-nav-add'
    },
    {
      title: "Audit-Ready History",
      description: "Every taka recorded. Search by description, filter by category, or export everything to PDF/Excel for your records—instantly.",
      icon: <History size={48} className="text-accent" />,
      tab: 'history',
      targetId: 'tour-nav-history'
    },
    {
      title: "Visual Intelligence",
      description: "Analyze your habits with high-precision charts. See your expense distribution and trends across any timeframe.",
      icon: <TrendingUp size={48} className="text-accent" />,
      tab: 'analytics',
      targetId: 'tour-nav-analytics'
    },
    {
      title: "Budget Mastery",
      description: "Set a healthy spending limit. We'll track your progress and alert you if you're stretching your budget too thin.",
      icon: <Target size={48} className="text-accent" />,
      tab: 'budget',
      targetId: 'tour-nav-budget'
    },
    {
      title: "Ready to Start?",
      description: "You're all set! Start tracking your journey towards financial freedom today.",
      icon: <Rocket size={48} className="text-accent" />,
      tab: 'overview',
      targetId: null
    }
  ];

  useEffect(() => {
    const updateSpotlight = () => {
      const targetId = steps[step].targetId;
      if (targetId) {
        const el = document.getElementById(targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setSpotlightRect({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        }
      } else {
        setSpotlightRect(null);
      }
    };

    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    return () => window.removeEventListener('resize', updateSpotlight);
  }, [step]);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      setActiveTab(steps[step + 1].tab);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* Spotlight Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <motion.rect
                initial={false}
                animate={{
                  x: spotlightRect.x - 10,
                  y: spotlightRect.y - 10,
                  width: spotlightRect.width + 20,
                  height: spotlightRect.height + 20,
                  rx: 16
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <motion.rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(0,0,0,0.85)" 
          mask="url(#spotlight-mask)"
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
        />
      </svg>

      {/* Instruction Card */}
      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
        <motion.div 
          key={step}
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          style={{
            marginTop: spotlightRect ? (spotlightRect.y > (typeof window !== 'undefined' ? window.innerHeight : 800) / 2 ? -spotlightRect.height - 250 : spotlightRect.height + 100) : 0
          }}
          className="glass-card w-full max-w-sm p-8 text-center pointer-events-auto shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
        >
          <div className="mb-6 flex justify-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              className="p-4 rounded-2xl bg-accent/10 border border-accent/20"
            >
              {steps[step].icon}
            </motion.div>
          </div>

          <h3 className="text-xl font-bold mb-3 text-primary">{steps[step].title}</h3>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            {steps[step].description}
          </p>

          <div className="flex gap-3">
            <button 
              onClick={onSkip}
              className="flex-1 py-3 glass rounded-xl text-xs font-bold uppercase tracking-widest text-muted hover:text-primary transition-all"
            >
              Skip
            </button>
            <button 
              onClick={handleNext}
              className="flex-[2] py-3 bg-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-accent/20 hover:bg-accent/80 transition-all flex items-center justify-center gap-2"
            >
              {step === steps.length - 1 ? "Get Started" : "Next Step"} <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex justify-center gap-1.5 mt-8">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === step ? "w-6 bg-accent" : "w-1.5 bg-white/10"
                )} 
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ProfileModal({ 
  type, 
  onClose, 
  userEmail, 
  userDisplayName, 
  setUserDisplayName,
  userPhotoURL,
  setUserPhotoURL,
  userGender,
  setUserGender
}: { 
  type: 'name' | 'password'; 
  onClose: () => void; 
  userEmail: string;
  userDisplayName: string;
  setUserDisplayName: (name: string) => void;
  userPhotoURL: string;
  setUserPhotoURL: (url: string) => void;
  userGender: string;
  setUserGender: (gender: any) => void;
}) {
  const [name, setName] = useState(userDisplayName);
  const [gender, setGender] = useState(userGender);
  const [photoURL, setPhotoURL] = useState(userPhotoURL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit for base64 in firestore
      setError('Image must be less than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadstart = () => setIsUploading(true);
    reader.onloadend = () => {
      setPhotoURL(reader.result as string);
      setIsUploading(false);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (type === 'name' && !name.trim()) {
      setError('Name cannot be empty');
      return;
    }
    if (type === 'password' && !password.trim()) {
      setError('Password cannot be empty');
      return;
    }

    if (!auth.currentUser) return;

    try {
      if (type === 'name') {
        await updateProfile(auth.currentUser, { 
          displayName: name.trim()
        });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
          displayName: name.trim(),
          gender: gender,
          photoURL: photoURL
        });
        setUserDisplayName(name.trim());
        setUserGender(gender);
        setUserPhotoURL(photoURL);
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }
        await updatePassword(auth.currentUser, password);
      }
      onClose();
    } catch (error: any) {
      console.error("Profile Update Error:", error);
      if (error.code === 'auth/requires-recent-login') {
        setError('Please log out and log in again to change sensitive info.');
      } else {
        setError(error.message || 'Failed to update profile.');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="glass-card w-full max-w-md p-6 sm:p-8"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">{type === 'name' ? 'Update Profile' : 'Change Password'}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {type === 'name' ? (
            <>
              <div className="flex flex-col items-center mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-accent/20 bg-glass flex items-center justify-center relative">
                    {photoURL ? (
                      <img src={photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={40} className="text-faint" />
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <RefreshCcw className="animate-spin text-white" size={20} />
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-accent text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                  >
                    <Camera size={14} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-faint mt-3">Profile Picture</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Display Name</label>
                <input 
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">Gender</label>
                <select 
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50 appearance-none"
                >
                  <option value="" disabled className="bg-bg-deep">Select Gender</option>
                  <option value="Male" className="bg-bg-deep">Male</option>
                  <option value="Female" className="bg-bg-deep">Female</option>
                  <option value="Other" className="bg-bg-deep">Other</option>
                </select>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-faint ml-1">New Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent/50"
                autoFocus
              />
            </div>
          )}
          
          {error && <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest ml-1">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 py-3 glass rounded-xl text-sm font-bold hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-accent/80 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NotificationCentre({ 
  isOpen, 
  onClose, 
  notifications, 
  onMarkRead, 
  onClearAll 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  notifications: any[]; 
  onMarkRead: (id: string) => void; 
  onClearAll: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[150] bg-black/20"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
            className="fixed top-24 right-4 sm:right-12 z-[160] w-[calc(100vw-32px)] sm:w-80 glass rounded-3xl overflow-hidden shadow-2xl border border-glass-border"
          >
            <div className="p-5 border-b border-glass-border flex justify-between items-center bg-glass">
              <h3 className="font-bold flex items-center gap-2">
                <Bell size={18} className="text-accent" />
                Notifications
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={onClearAll}
                  className="text-[10px] font-bold uppercase tracking-widest text-faint hover:text-sky-400 transition-colors"
                >
                  Clear All
                </button>
                <button onClick={onClose} className="text-faint hover:text-accent">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 rounded-full bg-glass mb-3">
                    <CheckCircle2 size={32} className="text-faint" />
                  </div>
                  <p className="text-sm text-faint italic">All caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-glass-border">
                  {notifications.map((n: any) => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 transition-colors relative group",
                        n.read ? "bg-transparent" : "bg-accent/5"
                      )}
                    >
                      {!n.read && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,242,255,0.6)]" />
                      )}
                      <div className="flex gap-3">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0 h-fit",
                          n.type === 'warning' ? "bg-sky-500/10 text-sky-400" : 
                          n.type === 'success' ? "bg-accent/10 text-accent" : 
                          "bg-sky-500/10 text-sky-500"
                        )}>
                          {n.type === 'warning' ? <AlertCircle size={16} /> : 
                           n.type === 'success' ? <CheckCircle2 size={16} /> : 
                           <Info size={16} />}
                        </div>
                        <div className="min-w-0 pr-4">
                          <h4 className="text-sm font-bold text-primary mb-0.5">{n.title}</h4>
                          <p className="text-xs text-muted leading-relaxed mb-2">{n.message}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-faint">{n.time}</span>
                            {!n.read && (
                              <button 
                                onClick={() => onMarkRead(n.id)}
                                className="text-[9px] font-bold uppercase tracking-widest text-accent hover:underline"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


