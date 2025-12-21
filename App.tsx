import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import SmartLogger from './components/SmartLogger';
import TransactionList from './components/TransactionList';
import BudgetGoals from './components/BudgetGoals';
import ChatAssistant from './components/ChatAssistant';
import SurvivalTips from './components/SurvivalTips';
import Settings from './components/Settings';
import { Transaction, Budget, SavingsGoal, ViewState, Currency, Category, QuickShortcut } from './types';
import { v4 as uuidv4 } from 'uuid';
import { generateSurvivalGuide } from './services/geminiService';
import { StorageService } from './services/storageService';

// Global Configuration Map
const COUNTRY_CONFIG: Record<string, { currency: Currency; flag: string }> = {
  'Germany': { currency: 'EUR', flag: '🇩🇪' },
  'United States': { currency: 'USD', flag: '🇺🇸' },
  'United Kingdom': { currency: 'GBP', flag: '🇬🇧' },
  'Canada': { currency: 'CAD', flag: '🇨🇦' },
  'Australia': { currency: 'AUD', flag: '🇦🇺' },
  'Japan': { currency: 'JPY', flag: '🇯🇵' },
};

const DEFAULT_CATEGORIES: Category[] = [
    { id: '1', name: 'Food', isDefault: false },
    { id: '2', name: 'Transport', isDefault: false },
    { id: '3', name: 'Rent', isDefault: false },
    { id: '4', name: 'Utilities', isDefault: false },
    { id: '5', name: 'Entertainment', isDefault: false },
    { id: '6', name: 'Education', isDefault: false },
    { id: '7', name: 'Shopping', isDefault: false },
    { id: '8', name: 'Travel', isDefault: false },
    { id: '9', name: 'Health', isDefault: false }
];

const DEFAULT_SHORTCUTS: QuickShortcut[] = [
    { id: '1', label: 'Coffee', prompt: 'Coffee 5' },
    { id: '2', label: 'Groceries', prompt: 'Groceries' },
    { id: '3', label: 'Transport', prompt: 'Transport' }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  
  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  
  // Settings State
  const [country, setCountry] = useState<string>('Germany');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>(DEFAULT_SHORTCUTS);

  // App Loading State
  const [isLoaded, setIsLoaded] = useState(false);

  // Preloaded Data State
  const [survivalGuide, setSurvivalGuide] = useState<{ shoppingGuide: string; survivalTips: string } | null>(null);
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  const [guideCache, setGuideCache] = useState<Record<string, { shoppingGuide: string; survivalTips: string }>>({});

  // 1. Initial Data Load from API
  useEffect(() => {
    const initApp = async () => {
      try {
        const [txs, bgs, gls, cats, scts, cache] = await Promise.all([
          StorageService.getTransactions(),
          StorageService.getBudgets(),
          StorageService.getGoals(),
          StorageService.getCategories(DEFAULT_CATEGORIES),
          StorageService.getShortcuts(DEFAULT_SHORTCUTS),
          StorageService.getGuideCache()
        ]);

        setTransactions(txs);
        setBudgets(bgs);
        setGoals(gls);
        setCategories(cats);
        setShortcuts(scts);
        setGuideCache(cache);

        const savedCountry = await StorageService.getCountry();
        if (savedCountry && COUNTRY_CONFIG[savedCountry]) {
          setCountry(savedCountry);
          setCurrency(COUNTRY_CONFIG[savedCountry].currency);
        }
        
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to initialize app data from API", error);
        // Fallback or empty state
        setIsLoaded(true); 
      }
    };

    initApp();
  }, []);

  // Removed all useEffect persistence hooks (e.g., saveTransactions) 
  // because we now save to DB on specific actions.
  
  // Handle Country Change
  const handleCountryChange = (newCountry: string) => {
    if (COUNTRY_CONFIG[newCountry]) {
      setCountry(newCountry);
      setCurrency(COUNTRY_CONFIG[newCountry].currency);
      StorageService.saveCountry(newCountry);
    }
  };

  // Preload Survival Guide when country changes
  useEffect(() => {
    const preloadGuide = async () => {
      if (!isLoaded) return;
      
      if (guideCache[country]) {
        setSurvivalGuide(guideCache[country]);
        setIsGuideLoading(false);
        return;
      }

      setIsGuideLoading(true);
      setSurvivalGuide(null); 
      
      const data = await generateSurvivalGuide(country);
      
      setSurvivalGuide(data);
      const newCache = { ...guideCache, [country]: data };
      setGuideCache(newCache);
      StorageService.saveGuideCache(newCache); // Keep this local
      setIsGuideLoading(false);
    };

    preloadGuide();
  }, [country, guideCache, isLoaded]);


  // --- Actions with API calls ---

  const handleAddTransaction = async (t: Transaction) => {
    try {
        // Optimistic update
        setTransactions(prev => [...prev, t]);
        
        // API Call
        const exists = categories.find(c => c.name.toLowerCase() === t.category.toLowerCase());
        if (!exists) {
            const newCat: Category = { id: uuidv4(), name: t.category, isDefault: false };
            await StorageService.addCategory(newCat);
            setCategories(prev => [...prev, newCat]);
        }
        await StorageService.addTransaction(t);
    } catch (e) {
        console.error("Failed to add transaction", e);
        // Revert on fail? For simplicity in this demo, we log.
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
        setTransactions(prev => prev.filter(t => t.id !== id));
        await StorageService.deleteTransaction(id);
    } catch (e) {
        console.error("Failed to delete", e);
    }
  };

  const handleUpdateTransaction = async (updatedT: Transaction) => {
      try {
        setTransactions(prev => prev.map(t => t.id === updatedT.id ? updatedT : t));
        await StorageService.updateTransaction(updatedT);
      } catch (e) { console.error("Update failed", e); }
  };

  const handleAddCategory = async (c: Category) => {
      try {
        setCategories(prev => [...prev, c]);
        await StorageService.addCategory(c);
      } catch (e) { console.error(e); }
  };

  const handleUpdateCategory = async (id: string, newName: string) => {
      const categoryToUpdate = categories.find(c => c.id === id);
      if (!categoryToUpdate || !newName.trim()) return;
      
      const oldName = categoryToUpdate.name;
      if (oldName === newName) return;

      try {
          // Update Local
          setCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName.trim() } : c));
          setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: newName.trim() } : t));
          setBudgets(prev => prev.map(b => b.category === oldName ? { ...b, category: newName.trim() } : b));
          
          // Update DB
          await StorageService.updateCategory(id, newName.trim());
      } catch (e) { console.error(e); }
  };

  const handleDeleteCategory = async (id: string, migrateToCategoryName?: string) => {
      const categoryToDelete = categories.find(c => c.id === id);
      if (!categoryToDelete) return;

      try {
        let finalTarget = migrateToCategoryName;

        if (migrateToCategoryName) {
            if (migrateToCategoryName === 'Others') {
                const othersExists = categories.find(c => c.name === 'Others');
                if (!othersExists) {
                    const othersCat = { id: uuidv4(), name: 'Others', isDefault: false };
                    // Optimistic add
                    setCategories(prev => [...prev, othersCat]);
                    await StorageService.addCategory(othersCat);
                }
            }
            
            // Optimistic Transaction Migration
            setTransactions(prev => prev.map(t => 
                t.category === categoryToDelete.name ? { ...t, category: finalTarget! } : t
            ));

            // Optimistic Budget Migration (optional but good for consistency)
            setBudgets(prev => prev.map(b => 
                 b.category === categoryToDelete.name ? { ...b, category: finalTarget! } : b
            ));
        }

        setCategories(prev => prev.filter(c => c.id !== id));
        await StorageService.deleteCategory(id, categoryToDelete.name, finalTarget);
      } catch (e) { console.error(e); }
  };

  const handleAddShortcut = async (s: QuickShortcut) => {
      setShortcuts(prev => [...prev, s]);
      await StorageService.addShortcut(s);
  };

  const handleDeleteShortcut = async (id: string) => {
      setShortcuts(prev => prev.filter(s => s.id !== id));
      await StorageService.deleteShortcut(id);
  };

  const handleUpdateShortcut = async (updatedS: QuickShortcut) => {
    setShortcuts(prev => prev.map(s => s.id === updatedS.id ? updatedS : s));
    await StorageService.updateShortcut(updatedS);
  };
  
  const handleAddBudget = async (b: Budget) => {
      setBudgets(prev => [...prev, b]);
      await StorageService.addBudget(b);
  };
  
  const handleAddGoal = async (g: SavingsGoal) => {
      setGoals(prev => [...prev, g]);
      await StorageService.addGoal(g);
  };
  
  const handleDeleteGoal = async (id: string) => {
      setGoals(prev => prev.filter(g => g.id !== id));
      await StorageService.deleteGoal(id);
  };

  // View Routing
  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forest"></div>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return (
          <>
            <SmartLogger 
                onAddTransaction={handleAddTransaction} 
                currency={currency} 
                shortcuts={shortcuts}
                categories={categories}
            />
            <Dashboard 
                transactions={transactions} 
                budgets={budgets} 
                currency={currency} 
                onViewChange={setCurrentView}
            />
          </>
        );
      case 'transactions':
        return (
          <div className="space-y-6">
            <SmartLogger 
                onAddTransaction={handleAddTransaction} 
                currency={currency} 
                shortcuts={shortcuts}
                categories={categories}
            />
            <TransactionList 
                transactions={transactions} 
                currency={currency} 
                categories={categories}
                onDelete={handleDeleteTransaction}
                onUpdate={handleUpdateTransaction}
            />
          </div>
        );
      case 'budget':
        return (
           <BudgetGoals 
              budgets={budgets} 
              goals={goals} 
              currency={currency}
              categories={categories}
              transactions={transactions}
              onAddBudget={handleAddBudget}
              onAddGoal={handleAddGoal}
              onDeleteGoal={handleDeleteGoal}
           />
        );
      case 'tips':
        return <SurvivalTips country={country} guide={survivalGuide} loading={isGuideLoading} />;
      case 'chat':
        return <ChatAssistant transactions={transactions} budgets={budgets} goals={goals} country={country} />;
      case 'settings':
        return <Settings 
                categories={categories} 
                shortcuts={shortcuts}
                transactions={transactions}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                onAddShortcut={handleAddShortcut}
                onDeleteShortcut={handleDeleteShortcut}
                onUpdateShortcut={handleUpdateShortcut}
               />;
      default:
        return <Dashboard transactions={transactions} budgets={budgets} currency={currency} onViewChange={setCurrentView} />;
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      setView={setCurrentView}
      country={country}
      setCountry={handleCountryChange}
      availableCountries={Object.keys(COUNTRY_CONFIG)}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;