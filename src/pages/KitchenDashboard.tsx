import { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { 
  db, 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  orderBy, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  setDoc, 
  OperationType, 
  handleFirestoreError 
} from '../lib/firebase';
import { Order, OrderStatus, Category, MenuItem, Allergy, IngredientCategory, CustomizationLabel, Table, Printer, Staff, SystemSettings, SiteSettings, MenuGroup } from '../types';
import { Clock, CheckCircle2, ChevronRight, UtensilsCrossed, AlertCircle, LayoutDashboard, Utensils, Plus, Image as ImageIcon, QrCode, Settings, Printer as PrinterIcon, Users, RefreshCcw, Trash2 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import * as Icons from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../lib/utils';
import { useToast } from '../components/ui/Toaster';
import { useLanguage, Language } from '../context/LanguageContext';

export default function KitchenDashboard() {
  const { language, setLanguage, t } = useLanguage();
  const [view, setView] = useState<'orders' | 'menu' | 'tables' | 'reports' | 'settings' | 'reservations'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [customizationCategories, setCustomizationCategories] = useState<IngredientCategory[]>([]);
  const [customizationLabels, setCustomizationLabels] = useState<CustomizationLabel[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    siteName: 'Smart Menu',
    logo: '',
    favicon: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    footerText: 'Powered by Smart Menu'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // For Adding Items
  const [selectedManageCategory, setSelectedManageCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingCustomization, setEditingCustomization] = useState<IngredientCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'menu' | 'dish' | 'allergy' | 'customization' | 'label' } | null>(null);
  const [paidConfirm, setPaidConfirm] = useState<{ tableName: string, orders: Order[] } | null>(null);
  const [hasCustomization, setHasCustomization] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([]);

  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    categoryIds: [] as string[],
    groupId: '',
    allergies: [] as string[],
    customizationCategories: [] as string[]
  });

  const [newAllergy, setNewAllergy] = useState({
    name: '',
    description: '',
    icon: ''
  });

  const [newCustomization, setNewCustomization] = useState({
    name: '',
    minSelection: 0,
    maxSelection: 1,
    ingredients: [] as { id: string, name: string, price: number, available: boolean }[]
  });

  const [newIngredient, setNewIngredient] = useState({
    name: '',
    price: ''
  });

  const [newCustomizationLabel, setNewCustomizationLabel] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: 'Utensils',
    fixedPrice: '',
    isIndividualPricing: true,
    conditions: '',
    showPopup: false,
    availableDays: [] as string[],
    startTime: '00:00',
    endTime: '23:59'
  });

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    // Orders Listener
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(newOrders);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Menu Data Listeners (Real-time)
    const unsubscribeCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubscribeMenuItems = onSnapshot(collection(db, 'menuItems'), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'menuItems'));

    const unsubscribeGroups = onSnapshot(query(collection(db, 'menuGroups'), orderBy('order', 'asc')), (snapshot) => {
      setMenuGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuGroup)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'menuGroups'));

    const unsubscribeAllergies = onSnapshot(collection(db, 'allergies'), (snapshot) => {
      setAllergies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Allergy)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'allergies'));

    const unsubscribeCustomizations = onSnapshot(collection(db, 'customizationCategories'), (snapshot) => {
      setCustomizationCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IngredientCategory)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customizationCategories'));

    const unsubscribeLabels = onSnapshot(collection(db, 'customizationLabels'), (snapshot) => {
      setCustomizationLabels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomizationLabel)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customizationLabels'));

    const unsubscribeTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tables'));

    const unsubscribePrinters = onSnapshot(collection(db, 'printers'), (snapshot) => {
      setPrinters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Printer)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'printers'));

    const unsubscribeStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaffMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'staff'));

    const unsubscribeSystem = onSnapshot(collection(db, 'systemSettings'), (snapshot) => {
      if (!snapshot.empty) {
        setSystemSettings({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'systemSettings'));

    const unsubscribeSite = onSnapshot(doc(db, 'settings', 'site'), (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as SiteSettings;
            setSiteSettings({ id: snapshot.id, ...data } as SiteSettings);
            if (data.siteName) document.title = `${data.siteName} - Admin`;
            if (data.favicon) {
                const link = document.querySelector("link[rel~='icon']") as HTMLLinkDescriptor || document.createElement('link');
                (link as any).rel = 'icon';
                (link as any).href = data.favicon;
                document.getElementsByTagName('head')[0].appendChild(link as any);
            }
        }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/site'));

    return () => {
      unsubscribeOrders();
      unsubscribeCategories();
      unsubscribeMenuItems();
      unsubscribeGroups();
      unsubscribeAllergies();
      unsubscribeCustomizations();
      unsubscribeLabels();
      unsubscribeTables();
      unsubscribePrinters();
      unsubscribeStaff();
      unsubscribeSystem();
      unsubscribeSite();
    };
  }, []);

  const toggleCategoryExpansion = (id: string) => {
    setExpandedCategories(prev => 
        prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const toggleIngredientSelection = (id: string, catId: string, isEditing = false) => {
    let nextIds = [...(isEditing ? selectedIngredientIds : selectedIngredientIds)]; // Both use the same state selectedIngredientIds
    if (nextIds.includes(id)) {
        nextIds = nextIds.filter(iid => iid !== id);
    } else {
        nextIds.push(id);
    }
    setSelectedIngredientIds(nextIds);

    const catIngredients = customizationCategories.find(c => c.id === catId)?.ingredients || [];
    const selectedFromThisCat = nextIds.filter(iid => catIngredients.some(ing => ing.id === iid));
    
    if (isEditing && editingItem) {
        let nextCatIds = [...(editingItem.customizationCategories || [])];
        if (selectedFromThisCat.length > 0 && !nextCatIds.includes(catId)) {
            nextCatIds.push(catId);
        } else if (selectedFromThisCat.length === 0 && nextCatIds.includes(catId)) {
            nextCatIds = nextCatIds.filter(cid => cid !== catId);
        }
        setEditingItem({...editingItem, customizationCategories: nextCatIds});
    } else {
        let nextCatIds = [...newItem.customizationCategories];
        if (selectedFromThisCat.length > 0 && !nextCatIds.includes(catId)) {
            nextCatIds.push(catId);
        } else if (selectedFromThisCat.length === 0 && nextCatIds.includes(catId)) {
            nextCatIds = nextCatIds.filter(cid => cid !== catId);
        }
        setNewItem(prev => ({...prev, customizationCategories: nextCatIds}));
    }
  };

  const selectAllIngredientsInCat = (catId: string, isEditing = false) => {
    const cat = customizationCategories.find(c => c.id === catId);
    if (!cat) return;
    
    const ingIds = cat.ingredients.map(i => i.id);
    let nextIds = [...selectedIngredientIds];
    
    ingIds.forEach(id => {
        if (!nextIds.includes(id)) nextIds.push(id);
    });
    
    setSelectedIngredientIds(nextIds);
    
    if (isEditing && editingItem) {
        const currentCats = editingItem.customizationCategories || [];
        if (!currentCats.includes(catId)) {
            setEditingItem({...editingItem, customizationCategories: [...currentCats, catId]});
        }
    } else {
        if (!newItem.customizationCategories.includes(catId)) {
            setNewItem(prev => ({...prev, customizationCategories: [...prev.customizationCategories, catId]}));
        }
    }
  };

  const deselectAllIngredientsInCat = (catId: string, isEditing = false) => {
    const cat = customizationCategories.find(c => c.id === catId);
    if (!cat) return;
    
    const ingIds = cat.ingredients.map(i => i.id);
    const nextIds = selectedIngredientIds.filter(id => !ingIds.includes(id));
    
    setSelectedIngredientIds(nextIds);
    
    if (isEditing && editingItem) {
        setEditingItem({...editingItem, customizationCategories: (editingItem.customizationCategories || []).filter(cid => cid !== catId)});
    } else {
        setNewItem(prev => ({...prev, customizationCategories: prev.customizationCategories.filter(cid => cid !== catId)}));
    }
  };

  const [newTable, setNewTable] = useState({ name: '' });
  const [editingTable, setEditingTable] = useState<Table | null>(null);

  const [newPrinter, setNewPrinter] = useState({ 
    name: 'Main Kitchen', 
    ip: '', 
    port: '9100', 
    type: 'thermal' as const, 
    serialNumber: 'N411228B00919', 
    macAddress: '000EE21A956E',
    cloudId: '1387db15-e611-4186-b4e3-9ad88fd10d6f',
    isDefault: true 
  });
  const [newStaff, setNewStaff] = useState({ name: '', role: 'kitchen' as const, email: '', active: true });

  const handleAddTable = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTable.name.trim() || submitting) {
        toast("Enter table name", 'error');
        return;
    }
    setSubmitting(true);
    try {
        const payload = {
            name: newTable.name,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'tables'), payload);
        setNewTable({ name: '' });
        toast("Table added", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tables');
    } finally {
        setSubmitting(false);
    }
  };

  const handleUpdateTable = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    try {
        const { id, ...data } = editingTable;
        await updateDoc(doc(db, 'tables', id), data);
        setEditingTable(null);
        toast("Table updated", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tables/${editingTable.id}`);
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;
    try {
        await deleteDoc(doc(db, 'tables', id));
        toast("Table deleted", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tables/${id}`);
    }
  };

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault();
    const finalCategoryIds = newItem.categoryIds.length > 0 ? newItem.categoryIds : (newItem.categoryId ? [newItem.categoryId] : []);
    
    if (finalCategoryIds.length === 0 || !newItem.name || !newItem.price || submitting) {
        toast("Please fill required fields", 'error');
        return;
    }
    setSubmitting(true);
    try {
        const payload = {
            ...newItem,
            categoryId: finalCategoryIds[0], // Keep for legacy
            categoryIds: finalCategoryIds,
            groupId: newItem.groupId || '', // Add groupId
            price: parseFloat(newItem.price),
            visible: true,
            allergies: newItem.allergies,
            customizationCategories: hasCustomization ? newItem.customizationCategories : [],
            selectedIngredientIds: hasCustomization ? selectedIngredientIds : [],
            hasCustomization
        };
        await addDoc(collection(db, 'menuItems'), payload);
        setNewItem({ name: '', price: '', description: '', imageUrl: '', categoryId: '', categoryIds: [], groupId: '', allergies: [], customizationCategories: [] });
        setHasCustomization(false);
        setSelectedIngredientIds([]);
        setExpandedCategories([]);
        toast("Item added to menu", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'menuItems');
    } finally {
        setSubmitting(false);
    }
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategory.name || submitting) return;
    setSubmitting(true);
    try {
        const payload = {
            ...newCategory,
            fixedPrice: !newCategory.isIndividualPricing && newCategory.fixedPrice ? parseFloat(newCategory.fixedPrice) : null,
            availableDays: newCategory.availableDays.length > 0 ? newCategory.availableDays : DAYS
        };
        await addDoc(collection(db, 'categories'), payload);
        setNewCategory({ 
            name: '', 
            icon: 'Utensils', 
            fixedPrice: '', 
            isIndividualPricing: true,
            conditions: '',
            showPopup: false,
            availableDays: [],
            startTime: '00:00',
            endTime: '23:59'
        });
        toast("Category added", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'categories');
    } finally {
        setSubmitting(false);
    }
  };

  const handleDeleteItem = (id: string) => {
    setDeleteConfirm({ id, type: 'dish' });
  };

  const toggleItemVisibility = async (item: MenuItem) => {
    try {
        const newVisibleStatus = item.visible === false ? true : false;
        await updateDoc(doc(db, 'menuItems', item.id), { visible: newVisibleStatus });
        setMenuItems(prev => prev.map(i => i.id === item.id ? { ...i, visible: newVisibleStatus } : i));
        toast(`Item ${newVisibleStatus ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `menuItems/${item.id}`);
    }
  };

  const handleImageUpload = (file: File, isEditing = false) => {
    if (!file.type.startsWith('image/')) {
        toast("Please upload an image file", 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (isEditing && editingItem) {
            setEditingItem({ ...editingItem, imageUrl: dataUrl });
        } else {
            setNewItem({ ...newItem, imageUrl: dataUrl });
        }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCategory = (id: string) => {
    setDeleteConfirm({ id, type: 'menu' });
  };

  const handleAddAllergy = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAllergy.name || !newAllergy.icon || submitting) return;
    setSubmitting(true);
    try {
        await addDoc(collection(db, 'allergies'), newAllergy);
        setNewAllergy({ name: '', description: '', icon: '' });
        toast("Allergy added", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'allergies');
    } finally {
        setSubmitting(false);
    }
  };

  const handleAddGroup = async (name: string) => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const nextOrder = menuGroups.length > 0 ? Math.max(...menuGroups.map(g => g.order || 0)) + 1 : 0;
      const payload = { name: name.trim(), order: nextOrder };
      await addDoc(collection(db, 'menuGroups'), payload);
      setNewGroupName('');
      toast("Group added", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'menuGroups');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReorderGroups = async (groupId: string, direction: 'up' | 'down') => {
    const idx = menuGroups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === menuGroups.length - 1) return;

    const currentGroups = [...menuGroups];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [currentGroups[idx], currentGroups[targetIdx]] = [currentGroups[targetIdx], currentGroups[idx]];

    try {
        const updates = currentGroups.map((g, i) => updateDoc(doc(db, 'menuGroups', g.id), { order: i }));
        await Promise.all(updates);
    } catch (err) {
        toast("Failed to reorder", 'error');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      await deleteDoc(doc(db, 'menuGroups', id));
      toast("Group deleted", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `menuGroups/${id}`);
    }
  };

  const handleDeleteAllergy = (id: string) => {
    setDeleteConfirm({ id, type: 'allergy' });
  };

  const handleAddCustomization = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCustomization.name || newCustomization.ingredients.length === 0 || submitting) {
        toast("Please add name and at least one ingredient", 'error');
        return;
    }
    setSubmitting(true);
    const existingCat = customizationCategories.find(c => c.name === newCustomization.name);
    try {
        if (existingCat) {
            const mergedIngredients = [...existingCat.ingredients];
            newCustomization.ingredients.forEach(newIng => {
                const alreadyExists = mergedIngredients.some(ing => ing.name.toLowerCase() === newIng.name.toLowerCase());
                if (!alreadyExists) {
                    mergedIngredients.push(newIng);
                }
            });
            
            const updatedCat = {
                ...existingCat,
                minSelection: newCustomization.minSelection,
                maxSelection: newCustomization.maxSelection,
                ingredients: mergedIngredients
            };
            
            const { id, ...dataToSave } = updatedCat;
            await updateDoc(doc(db, 'customizationCategories', id), dataToSave);
            toast("Customization category updated", 'success');
        } else {
            await addDoc(collection(db, 'customizationCategories'), newCustomization);
            toast("Customization category added", 'success');
        }
        setNewCustomization({ name: '', minSelection: 0, maxSelection: 1, ingredients: [] });
    } catch (err) {
        handleFirestoreError(err, existingCat ? OperationType.UPDATE : OperationType.CREATE, 'customizationCategories');
    } finally {
        setSubmitting(false);
    }
  };

  const handleDeleteCustomization = (id: string) => {
    setDeleteConfirm({ id, type: 'customization' });
  };

  const handleDeleteIngredientFromCategory = async (catId: string, ingredientId: string) => {
    const cat = customizationCategories.find(c => c.id === catId);
    if (!cat) return;
    
    const updatedIngredients = cat.ingredients.filter(ing => ing.id !== ingredientId);
    try {
        const { id, ...dataToSave } = { ...cat, ingredients: updatedIngredients };
        await updateDoc(doc(db, 'customizationCategories', catId), dataToSave);
        setCustomizationCategories(prev => prev.map(c => c.id === catId ? { ...c, ingredients: updatedIngredients } : c));
        toast("Ingredient removed", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'customizationCategories');
    }
  };

  const handleAddCustomizationLabel = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCustomizationLabel.trim() || submitting) {
        toast("Please enter a label name", 'error');
        return;
    }
    setSubmitting(true);
    try {
        await addDoc(collection(db, 'customizationLabels'), { name: newCustomizationLabel.trim() });
        setNewCustomizationLabel('');
        toast("Label added", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'customizationLabels');
    } finally {
        setSubmitting(false);
    }
  };

  const handleDeleteCustomizationLabel = (id: string) => {
    setDeleteConfirm({ id, type: 'label' });
  };

  const addIngredientToNewCategory = () => {
    if (!newIngredient.name.trim()) {
        toast("Enter ingredient name", 'error');
        return;
    }
    let priceNum = 0;
    if (newIngredient.price !== '') {
        priceNum = parseFloat(newIngredient.price);
        if (isNaN(priceNum)) {
            toast("Invalid price", 'error');
            return;
        }
    }

    const ingredient = {
        id: Math.random().toString(36).substr(2, 9),
        name: newIngredient.name.trim(),
        price: priceNum,
        available: true
    };
    setNewCustomization(prev => ({
        ...prev,
        ingredients: [...prev.ingredients, ingredient]
    }));
    setNewIngredient({ name: '', price: '' });
  };

  const processDelete = async () => {
    if (!deleteConfirm) return;
    try {
        if (deleteConfirm.type === 'menu') {
            await deleteDoc(doc(db, 'categories', deleteConfirm.id));
            setCategories(prev => prev.filter(c => c.id !== deleteConfirm.id));
            if (selectedManageCategory === deleteConfirm.id) setSelectedManageCategory(null);
            toast("Menu deleted", 'success');
        } else if (deleteConfirm.type === 'allergy') {
            await deleteDoc(doc(db, 'allergies', deleteConfirm.id));
            setAllergies(prev => prev.filter(a => a.id !== deleteConfirm.id));
            toast("Allergy deleted", 'success');
        } else if (deleteConfirm.type === 'customization') {
            await deleteDoc(doc(db, 'customizationCategories', deleteConfirm.id));
            setCustomizationCategories(prev => prev.filter(c => c.id !== deleteConfirm.id));
            toast("Customization category deleted", 'success');
        } else if (deleteConfirm.type === 'label') {
            await deleteDoc(doc(db, 'customizationLabels', deleteConfirm.id));
            setCustomizationLabels(prev => prev.filter(l => l.id !== deleteConfirm.id));
            toast("Label deleted", 'success');
        } else {
            await deleteDoc(doc(db, 'menuItems', deleteConfirm.id));
            setMenuItems(prev => prev.filter(i => i.id !== deleteConfirm.id));
            toast("Dish deleted", 'success');
        }
        setDeleteConfirm(null);
    } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${deleteConfirm.type === 'menu' ? 'categories' : deleteConfirm.type === 'allergy' ? 'allergies' : deleteConfirm.type === 'customization' ? 'customizationCategories' : deleteConfirm.type === 'label' ? 'customizationLabels' : 'menuItems'}/${deleteConfirm.id}`);
    }
  };

  const startEditingItem = (item: MenuItem) => {
    setEditingItem(item);
    setHasCustomization(!!(item as any).hasCustomization);
    setSelectedIngredientIds((item as any).selectedIngredientIds || []);
    // Auto-expand categories that have selected ingredients
    const catIds = item.customizationCategories || [];
    setExpandedCategories(catIds);
  };

  const handleUpdateItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
        const { id, ...data } = editingItem;
        const payload = {
            ...data,
            hasCustomization,
            selectedIngredientIds: hasCustomization ? selectedIngredientIds : [],
            customizationCategories: hasCustomization ? (editingItem.customizationCategories || []) : [],
            groupId: editingItem.groupId || ''
        };
        await updateDoc(doc(db, 'menuItems', id), payload as any);
        setMenuItems(prev => prev.map(i => i.id === id ? { ...editingItem, ...payload } : i));
        setEditingItem(null);
        setHasCustomization(false);
        setSelectedIngredientIds([]);
        setExpandedCategories([]);
        toast("Item updated successfully", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `menuItems/${editingItem.id}`);
    }
  };

  const handleUpdateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
        const { id, ...data } = editingCategory;
        const payload = {
            ...data,
            fixedPrice: !editingCategory.isIndividualPricing && editingCategory.fixedPrice ? parseFloat(editingCategory.fixedPrice as any) : null,
            availableDays: editingCategory.availableDays && editingCategory.availableDays.length > 0 ? editingCategory.availableDays : DAYS
        };
        await updateDoc(doc(db, 'categories', id), payload as any);
        setCategories(prev => prev.map(c => c.id === id ? { id, ...payload } as any : c));
        setEditingCategory(null);
        toast("Menu updated successfully", 'success');
    } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `categories/${editingCategory.id}`);
    }
  };

  const toggleDay = (day: string, isEditing = false) => {
    if (isEditing && editingCategory) {
        const current = editingCategory.availableDays || [];
        const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        setEditingCategory({...editingCategory, availableDays: next});
    } else {
        const current = newCategory.availableDays;
        const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        setNewCategory({...newCategory, availableDays: next});
    }
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      toast(`Order updated to ${newStatus}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleAddPrinter = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPrinter.name || submitting) {
      toast("Please enter a printer name", 'error');
      return;
    }
    if (!newPrinter.ip && !newPrinter.serialNumber) {
      toast("Please enter IP or Serial Number", 'error');
      return;
    }

    setSubmitting(true);
    try {
      const printerData = {
        name: newPrinter.name,
        type: newPrinter.type,
        isDefault: newPrinter.isDefault,
        createdAt: new Date().toISOString()
      };

      if (newPrinter.ip) {
        Object.assign(printerData, { 
          ip: newPrinter.ip, 
          port: parseInt(newPrinter.port) || 9100 
        });
      }

      if (newPrinter.serialNumber) {
        Object.assign(printerData, { serialNumber: newPrinter.serialNumber });
      }

      if (newPrinter.macAddress) {
        Object.assign(printerData, { macAddress: newPrinter.macAddress });
      }

      if (newPrinter.cloudId) {
        Object.assign(printerData, { cloudId: newPrinter.cloudId });
      }

      await addDoc(collection(db, 'printers'), printerData);
      setNewPrinter({ name: '', ip: '', port: '9100', type: 'thermal', serialNumber: '', macAddress: '', cloudId: '', isDefault: false });
      toast("Printer added successfully", 'success');
    } catch (err) {
      console.error("Error adding printer:", err);
      handleFirestoreError(err, OperationType.CREATE, 'printers');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'printers', id));
      toast("Printer deleted", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `printers/${id}`);
    }
  };

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email || submitting) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'staff'), newStaff);
      setNewStaff({ name: '', role: 'kitchen', email: '', active: true });
      toast("Staff member added", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'staff');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'staff', id));
      toast("Staff deleted", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `staff/${id}`);
    }
  };

  const handleSaveSiteSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { id, ...dataToSave } = siteSettings as any;
      await setDoc(doc(db, 'settings', 'site'), dataToSave);
      toast("Site settings saved", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/site');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTakeawayCategory = (categoryId: string) => {
    setSiteSettings(prev => {
      const current = prev.takeawayCategories || [];
      const updated = current.includes(categoryId)
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId];
      return { ...prev, takeawayCategories: updated };
    });
  };

  const toggleTakeawayItem = (itemId: string) => {
    setSiteSettings(prev => {
      const current = prev.takeawayItems || [];
      const updated = current.includes(itemId)
        ? current.filter(id => id !== itemId)
        : [...current, itemId];
      return { ...prev, takeawayItems: updated };
    });
  };

  const handleSiteImageUpload = (file: File, type: 'logo' | 'favicon') => {
    if (!file.type.startsWith('image/')) {
        toast("Please upload an image file", 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setSiteSettings(prev => ({ ...prev, [type]: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateVersion = async () => {
    try {
      const newVersion = systemSettings ? (parseFloat(systemSettings.version) + 0.1).toFixed(1) : "1.0";
      const payload = {
        version: newVersion,
        lastUpdate: new Date().toISOString()
      };
      
      if (systemSettings) {
        await updateDoc(doc(db, 'systemSettings', (systemSettings as any).id), payload);
      } else {
        await addDoc(collection(db, 'systemSettings'), payload);
      }
      toast(`System updated to v${newVersion}`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'systemSettings');
    }
  };

  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const handleUSBPrint = (order: Order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
      setPrintingOrder(null);
    }, 500);
  };

  const reprintOrder = async (order: Order) => {
    const defaultPrinter = printers.find(p => p.isDefault) || printers[0];
    
    if (defaultPrinter?.type === 'usb') {
      handleUSBPrint(order);
      return;
    }

    toast(`Reprinting Order #${order.id.slice(-4)}...`, 'info');
    try {
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
      const data = await res.json();
      if (data.success) {
        toast(data.message, 'success');
      } else {
        toast(`Print failed: ${data.error}`, 'error');
      }
    } catch (err) {
      console.error("Print request error:", err);
      toast("Could not connect to printer server", 'error');
    }
  };

  const testPrinter = async (printer: Printer) => {
    toast(`Testing printer: ${printer.name}...`, 'info');
    // For test print, we send a dummy order
    const dummyOrder = {
      id: 'TEST-ORDER',
      tableName: 'TEST TABLE',
      tableNumber: '00',
      items: [{ name: 'Test Item', quantity: 1, price: 0 }],
      total: 0,
      createdAt: new Date().toISOString()
    };
    
    try {
      // If we want to target a specific printer, we'd need to modify the server API.
      // For now, the server prints to the default printer.
      // But we can simulate a direct target or just warn the user.
      const res = await fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: dummyOrder })
      });
      const data = await res.json();
      if (data.success) {
        toast("Test print signal sent successfully", 'success');
      } else {
        toast(`Test failed: ${data.error}`, 'error');
      }
    } catch (err) {
        toast("Test failed: Server unreachable", 'error');
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'preparing': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'done': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const handlePaidTable = (tableName: string, tableOrders: Order[]) => {
    if (!tableOrders || tableOrders.length === 0) return;
    setPaidConfirm({ tableName, orders: tableOrders });
  };

  const confirmPaidTable = async () => {
    if (!paidConfirm || submitting) return;
    const { tableName, orders: tableOrders } = paidConfirm;

    setSubmitting(true);
    try {
      const promises = tableOrders.map(order => 
        updateDoc(doc(db, 'orders', order.id), { status: 'done' })
      );
      await Promise.all(promises);
      toast(t('order.paidSuccess', `Table ${tableName} marked as paid`), 'success');
      setExpandedTicketId(null);
      setPaidConfirm(null);
    } catch (err) {
      console.error("Payment failed:", err);
      toast("Error marking table as paid", 'error');
      handleFirestoreError(err, OperationType.UPDATE, `orders/bulk-paid`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading Orders...</p>
      </div>
    </div>
  );

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const finishedOrders = orders.filter(o => o.status === 'done');

  // Group pending orders by table
  const tableGroups = pendingOrders.reduce((acc, order) => {
    const tableKey = order.tableName || `Table ${order.tableNumber}`;
    if (!acc[tableKey]) {
      acc[tableKey] = {
        orders: [],
        total: 0,
        tableName: tableKey,
        tableNumber: order.tableNumber
      };
    }
    acc[tableKey].orders.push(order);
    return acc;
  }, {} as Record<string, { orders: Order[], total: number, tableName: string, tableNumber: string | number }>);

  // Calculate table groups total with entry-fee deduplication (passes are charged only once per table session)
  Object.keys(tableGroups).forEach(tableKey => {
    const group = tableGroups[tableKey];
    let totalValue = 0;
    const addedPasses = new Set<string>();

    group.orders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          if (item.id && item.id.startsWith('pass-')) {
            if (!addedPasses.has(item.id)) {
              addedPasses.add(item.id);
              totalValue += (item.price * item.quantity);
            }
          } else {
            totalValue += (item.price * item.quantity);
          }
        });
      } else {
        totalValue += (order.total || 0);
      }
    });

    group.total = totalValue;
  });

  const tableGroupList = Object.values(tableGroups);

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b-2 border-slate-200 pb-8">
        <div className="flex items-center gap-6">
          {siteSettings.logo && (
            <div className="w-16 h-16 bg-white rounded-2xl border-2 border-slate-200 p-2 shadow-sm shrink-0">
              <img src={siteSettings.logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full leading-none">
                {siteSettings.siteName}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Dashboard</span>
            </div>
            <h1 className="text-4xl font-[900] tracking-tighter text-slate-900 leading-none uppercase">
              {view === 'orders' ? t('nav.orders') : view === 'menu' ? t('nav.menu') : view === 'tables' ? t('nav.tables') : view === 'reports' ? t('nav.reports') : t('nav.settings')}
            </h1>
            <div className="flex items-center gap-4 mt-4 overflow-x-auto no-scrollbar pb-2">
              <button 
                onClick={() => setView('orders')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all shrink-0",
                  view === 'orders' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "bg-white text-slate-400 hover:bg-slate-50"
                )}
              >
                <LayoutDashboard size={14} strokeWidth={3} /> {t('nav.orders')}
              </button>
              <button 
                onClick={() => setView('menu')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all shrink-0",
                  view === 'menu' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "bg-white text-slate-400 hover:bg-slate-50"
                )}
              >
                <Utensils size={14} strokeWidth={3} /> {t('nav.menu')}
              </button>
              <button 
                onClick={() => setView('tables')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all shrink-0",
                  view === 'tables' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "bg-white text-slate-400 hover:bg-slate-50"
                )}
              >
                <Icons.Table size={14} strokeWidth={3} /> {t('nav.tables')}
              </button>
              <button 
                onClick={() => setView('reports')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all shrink-0",
                  view === 'reports' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "bg-white text-slate-400 hover:bg-slate-50"
                )}
              >
                <Icons.LineChart size={14} strokeWidth={3} /> {t('nav.reports')}
              </button>
              <button 
                onClick={() => setView('settings')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all shrink-0",
                  view === 'settings' ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "bg-white text-slate-400 hover:bg-slate-50"
                )}
              >
                <Settings size={14} strokeWidth={3} /> {t('nav.settings')}
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-xl p-1 border border-slate-200 flex items-center shadow-sm">
            {(['en', 'it'] as Language[]).map(lang => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  language === lang ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
                )}
              >
                {lang}
              </button>
            ))}
          </div>
          <div className="rounded-2xl bg-white px-5 py-3 border border-slate-200 flex items-center gap-4 shadow-sm">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t('system.status')}</div>
              <div className="text-xs font-bold text-slate-800">{t('system.online')}</div>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-xl">
              🛰️
            </div>
          </div>
          <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white text-xs font-black flex items-center gap-2 shadow-xl shadow-slate-200">
            <Clock size={16} strokeWidth={3} />
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      {view === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 font-sans">
          {/* Active Orders Section */}
          <section className="lg:col-span-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                {t('order.activeTickets')}
              </h2>
              <span className="rounded-full bg-slate-900 text-white px-3 py-1 text-[10px] font-black">{tableGroupList.length} {t('nav.tables')}</span>
            </div>
            
            <div className="grid gap-16 sm:grid-cols-2">
              {tableGroupList.map((group) => (
                <div key={group.tableName} className="flex flex-col gap-6">
                  {/* Table Header/Summary */}
                  <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">
                        {group.tableName}
                      </h3>
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        {t('order.total')}: €{group.total.toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => handlePaidTable(group.tableName, group.orders)}
                      disabled={submitting}
                      className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {t('order.paid', 'Paid')}
                    </button>
                  </div>

                  {/* Stacked Tickets Container */}
                  <div className="relative h-[600px] w-full">
                    {/* Background overlay to collapse expanded ticket */}
                    {expandedTicketId && group.orders.some(o => o.id === expandedTicketId) && (
                      <div 
                        className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[2px]"
                        onClick={() => setExpandedTicketId(null)}
                      />
                    )}

                    {group.orders.slice().reverse().map((order, index) => {
                      const isExpanded = expandedTicketId === order.id;
                      const stackIndex = index;
                      
                      return (
                        <div
                          key={order.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTicketId(isExpanded ? null : order.id);
                          }}
                          style={{
                            zIndex: isExpanded ? 50 : 10 + stackIndex,
                            transform: isExpanded 
                              ? 'translate(0, 0) scale(1)' 
                              : `translate(0px, ${stackIndex * 50}px) scale(${1 - stackIndex * 0.02})`,
                            transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
                          }}
                          className={cn(
                            "absolute top-0 left-0 w-full cursor-pointer overflow-hidden rounded-[2.5rem] bg-white shadow-2xl transition-all border border-slate-100 flex flex-col",
                            isExpanded ? "h-[500px] shadow-slate-900/20 ring-4 ring-slate-900/5" : "h-[350px] shadow-slate-200/50 hover:-translate-y-2"
                          )}
                        >
                          {order.status === 'pending' && (
                            <div className="absolute top-0 right-0 p-6 pointer-events-none">
                              <div className="w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 flex items-end justify-start p-3 text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                                {t('order.new')}
                              </div>
                            </div>
                          )}

                          <div className={cn("p-8 h-full flex flex-col", !isExpanded && "pointer-events-none")}>
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="text-[14px] font-black text-slate-900 tracking-tight">
                                #{order.id.slice(-4).toUpperCase()}
                              </h4>
                              <div className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto border-y border-dashed border-slate-100 py-4 space-y-4 scrollbar-hide">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-slate-700">
                                      <span className="font-black text-slate-900">{item.quantity}x</span> {item.name}
                                    </span>
                                    {(item as any).selectedIngredients && (item as any).selectedIngredients.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                          {(item as any).selectedIngredients.map((ing: any) => (
                                              <span key={ing.id} className="text-[8px] font-black text-emerald-600 border border-emerald-50/50 bg-emerald-50/30 px-1.5 py-0.5 rounded uppercase tracking-widest">
                                                  + {ing.name}
                                              </span>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {isExpanded && (
                              <div className="mt-6 flex justify-between items-center pointer-events-auto">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    reprintOrder(order);
                                  }}
                                  className="flex items-center gap-2 px-4 py-3 bg-slate-50 text-slate-400 rounded-xl transition-all hover:bg-slate-100 hover:text-slate-700 text-[10px] font-black uppercase tracking-widest"
                                >
                                  <Icons.Printer size={14} strokeWidth={3} />
                                  {t('order.print', 'Print')}
                                </button>
                                
                                {order.status === 'pending' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStatus(order.id, 'preparing');
                                    }}
                                    className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                                  >
                                    {t('order.accept')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {tableGroupList.length === 0 && (
                <div className="col-span-full py-24 bg-slate-50/50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400">
                  <UtensilsCrossed size={48} className="mb-4 opacity-10" />
                  <p className="text-sm font-bold uppercase tracking-[0.2em]">{t('order.waiting')}</p>
                </div>
              )}
            </div>
            
            {/* Logs Terminal */}
            <div className="mt-12">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{t('system.log')}</div>
               <div className="bg-slate-900 rounded-3xl p-6 font-mono text-[11px] text-emerald-400 shadow-2xl leading-relaxed">
                  <p>[{new Date().toLocaleTimeString()}] BRIDGE: Real-time listener initialized...</p>
                  <p>[{new Date().toLocaleTimeString()}] DB: Connection established... Success</p>
                  {pendingOrders.length > 0 && (
                    <p className="text-white">[{new Date().toLocaleTimeString()}] WEBSOCKET: Incoming payload from Table {pendingOrders[0].tableNumber}</p>
                  )}
               </div>
            </div>
          </section>

          {/* History Section */}
          <section className="lg:col-span-4 self-start rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
            <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
              {t('order.todayHistory')}
            </h2>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 no-scrollbar">
              {finishedOrders.slice(0, 15).map((order) => (
                <div key={order.id} className="group relative rounded-2xl bg-slate-50 p-5 transition-all hover:bg-slate-100 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Table {order.tableNumber}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); reprintOrder(order); }}
                        className="p-1 px-2 bg-white rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm border border-slate-100"
                        title="Reprint"
                      >
                         <Icons.Printer size={10} />
                      </button>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex flex-col">
                        <span className="text-[12px] font-medium text-slate-500">
                          <span className="font-bold text-slate-700">{item.quantity}x</span> {item.name}
                        </span>
                        {(item as any).selectedIngredients && (item as any).selectedIngredients.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                              {(item as any).selectedIngredients.map((ing: any) => (
                                  <span key={ing.id} className="text-[7px] font-black text-slate-400 border border-slate-100 bg-white px-1 py-0.5 rounded uppercase tracking-widest leading-none">
                                      + {ing.name}
                                  </span>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {finishedOrders.length === 0 && (
                 <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">History Empty</p>
                 </div>
              )}
            </div>
          </section>
        </div>
      )}

      {view === 'menu' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 font-sans">
            {/* Menu Management Sidebar */}
          <section className="lg:col-span-12 space-y-8">
            {/* Existing Menus List */}
            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h2 className="mb-6 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                    {t('menu.existingMenus')}
                </h2>
                <div className="space-y-4">
                    {categories.map(cat => (
                        <div key={cat.id} className="space-y-2">
                            <div 
                                onClick={() => setSelectedManageCategory(cat.id === selectedManageCategory ? null : cat.id)}
                                className={cn(
                                    "group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer",
                                    selectedManageCategory === cat.id 
                                        ? "bg-slate-900 border-slate-900 shadow-lg" 
                                        : "bg-slate-50 border-slate-100 hover:bg-white hover:shadow-md"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 rounded-xl flex items-center justify-center",
                                        selectedManageCategory === cat.id ? "bg-white/10 text-white" : "bg-white text-slate-400 shadow-sm"
                                    )}>
                                       <Utensils size={14} />
                                    </div>
                                    <div className="text-left">
                                        <p className={cn("text-[10px] font-black uppercase tracking-widest leading-tight", selectedManageCategory === cat.id ? "text-white" : "text-slate-800")}>
                                            {cat.name}
                                        </p>
                                        {!cat.isIndividualPricing && (
                                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{t('menu.entryFee')}: €{cat.fixedPrice}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Icons.ChevronDown size={14} className={cn("transition-transform", selectedManageCategory === cat.id ? "text-white rotate-180" : "text-slate-300")} />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); }}
                                        className={cn("p-1 transition-all", selectedManageCategory === cat.id ? "text-white/50 hover:text-white" : "text-slate-300 hover:text-emerald-500 opacity-0 group-hover:opacity-100")}
                                    >
                                        <Icons.Edit3 size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                                        className={cn("p-1 transition-all", selectedManageCategory === cat.id ? "text-rose-300 hover:text-rose-100" : "text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100")}
                                    >
                                        <Icons.Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            
                            {selectedManageCategory === cat.id && (
                                <div className="mt-4 overflow-hidden pl-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500 pb-2">
                                    {menuItems.filter(i => (i.categoryIds || [i.categoryId]).includes(cat.id)).length > 0 ? (
                                        menuItems.filter(i => (i.categoryIds || [i.categoryId]).includes(cat.id)).map(item => {
                                            const itemCatIds = item.categoryIds && item.categoryIds.length > 0 ? item.categoryIds : [item.categoryId];
                                            const itemCats = categories.filter(c => itemCatIds.includes(c.id));
                                            return (
                                                <div key={item.id} className={cn(
                                                    "flex gap-4 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm group relative transition-all hover:border-emerald-200 hover:shadow-md",
                                                    item.visible === false && "grayscale opacity-60"
                                                )}>
                                                    <div className="h-16 w-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 shadow-inner">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-110" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                <Icons.Image size={20} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-center min-w-0">
                                                        <div className="flex flex-wrap gap-1 mb-1">
                                                            {itemCats.map(c => (
                                                                <span key={c.id} className="text-[7px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                                                    {c.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <h3 className="text-[11px] font-black text-slate-800 leading-tight pr-8 uppercase tracking-tight truncate">{item.name}</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="text-[10px] font-black text-slate-500">
                                                                {itemCats[0]?.isIndividualPricing ? `€${item.price.toFixed(2)}` : t('menu.included')}
                                                            </div>
                                                            {item.allergies && item.allergies.length > 0 && (
                                                                <div className="flex gap-1.5">
                                                                    {item.allergies.map(aId => {
                                                                        const allergy = allergies.find(a => a.id === aId);
                                                                        return allergy ? (
                                                                            <span key={aId} title={allergy.name} className="text-[11px]">
                                                                                {allergy.icon}
                                                                            </span>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); startEditingItem(item); }}
                                                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all shadow-sm bg-white"
                                                        >
                                                            <Icons.Edit3 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); toggleItemVisibility(item); }}
                                                            className={cn(
                                                                "p-2 rounded-xl transition-all shadow-sm bg-white",
                                                                item.visible === false 
                                                                    ? "text-rose-400 hover:bg-rose-50" 
                                                                    : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                                                            )}
                                                        >
                                                            {item.visible === false ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                                            className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-all shadow-sm bg-white"
                                                        >
                                                            <Icons.Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl py-8 text-center px-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('menu.noDishes')}</p>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setNewItem({...newItem, categoryIds: [cat.id]}); }}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-black text-emerald-600 shadow-sm hover:shadow-md transition-all uppercase tracking-widest"
                                            >
                                                <Icons.Plus size={12} /> {t('menu.addNewDish')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {categories.length === 0 && (
                        <p className="text-center py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">No menus found</p>
                    )}
                </div>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                {t('menu.addNewMenu')}
                </h2>
                <form onSubmit={handleAddCategory} className="space-y-4">
                    <input 
                        type="text" 
                        value={newCategory.name}
                        onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                        placeholder={t('menu.categoryName')} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />

                    <div className="flex items-center gap-3 px-1 py-4 border-y border-slate-50">
                        <input 
                            type="checkbox" 
                            id="isIndividual" 
                            checked={newCategory.isIndividualPricing}
                            onChange={e => setNewCategory({...newCategory, isIndividualPricing: e.target.checked})}
                            className="w-5 h-5 accent-emerald-600 rounded-lg"
                        />
                        <label htmlFor="isIndividual" className="text-xs font-black text-slate-800 uppercase tracking-widest cursor-pointer">
                            {t('menu.individualPrices')}
                        </label>
                    </div>

                    {!newCategory.isIndividualPricing && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.entryFee')} (€)</label>
                             <input 
                                type="number" 
                                step="0.01"
                                value={newCategory.fixedPrice}
                                onChange={e => setNewCategory({...newCategory, fixedPrice: e.target.value})}
                                placeholder="e.g. 10.00" 
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('menu.popupConditions')}</label>
                            <button 
                                type="button"
                                onClick={() => setNewCategory({...newCategory, showPopup: !newCategory.showPopup})}
                                className={cn(
                                    "w-10 h-5 rounded-full transition-all relative",
                                    newCategory.showPopup ? "bg-emerald-500" : "bg-slate-200"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                    newCategory.showPopup ? "left-6" : "left-1"
                                )} />
                            </button>
                        </div>
                        
                        <textarea 
                            value={newCategory.conditions}
                            onChange={e => setNewCategory({...newCategory, conditions: e.target.value})}
                            disabled={!newCategory.showPopup}
                            placeholder={newCategory.showPopup ? t('menu.enterRegulations') : t('menu.popupDisabled')}
                            rows={3}
                            className={cn(
                                "w-full border border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none transition-all resize-none",
                                newCategory.showPopup ? "bg-slate-50 focus:ring-2 focus:ring-emerald-500" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.availability')}</label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDay(day)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                                        newCategory.availableDays.includes(day)
                                            ? "bg-slate-900 border-slate-900 text-white"
                                            : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                    )}
                                >
                                    {day.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.startTime')}</label>
                                <input 
                                    type="time" 
                                    value={newCategory.startTime}
                                    onChange={e => setNewCategory({...newCategory, startTime: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-[10px] font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.endTime')}</label>
                                <input 
                                    type="time" 
                                    value={newCategory.endTime}
                                    onChange={e => setNewCategory({...newCategory, endTime: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-[10px] font-bold outline-none"
                                />
                            </div>
                        </div>
                        {newCategory.availableDays.length === 0 && (
                            <p className="text-[8px] font-bold text-amber-500 text-right uppercase tracking-[0.1em]">{t('menu.availableAllDays')}</p>
                        )}
                    </div>

                    <button 
                        type="submit"
                        className="w-full bg-slate-900 text-white rounded-2xl py-3 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                        {t('menu.save')}
                    </button>
                </form>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                {t('menu.addNewDish')}
                </h2>
                <form onSubmit={handleAddItem} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.menuCategories')}</label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    const next = newItem.categoryIds.includes(c.id) 
                                        ? newItem.categoryIds.filter(id => id !== c.id) 
                                        : [...newItem.categoryIds, c.id];
                                    setNewItem({...newItem, categoryIds: next});
                                }}
                                className={cn(
                                    "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                    newItem.categoryIds.includes(c.id)
                                        ? "bg-slate-900 border-slate-900 text-white"
                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                )}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Image (Drag & Drop or Click)</label>
                    <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file) handleImageUpload(file);
                        }}
                        onClick={() => document.getElementById('itemImageInput')?.click()}
                        className={cn(
                            "group relative h-32 w-full bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-emerald-500 hover:bg-emerald-50/10 overflow-hidden",
                            newItem.imageUrl && "border-none"
                        )}
                    >
                        {newItem.imageUrl ? (
                            <>
                                <img src={newItem.imageUrl} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Icons.RefreshCw size={24} className="text-white animate-spin-slow" />
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <Plus size={24} className="text-slate-300 mx-auto mb-1 group-hover:text-emerald-500 transition-colors" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('menu.dropImage')}</p>
                            </div>
                        )}
                        <input 
                            id="itemImageInput"
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                            }}
                        />
                    </div>
                    {newItem.imageUrl && (
                        <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={newItem.imageUrl}
                                readOnly
                                className="flex-1 bg-slate-100 border border-slate-200 rounded-xl p-2 text-[10px] font-mono text-slate-400 overflow-hidden text-ellipsis"
                            />
                            <button 
                                type="button"
                                onClick={() => setNewItem({...newItem, imageUrl: ''})}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            >
                                <Icons.Trash2 size={14} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.itemName')}</label>
                        <input 
                        type="text" 
                        value={newItem.name}
                        onChange={e => setNewItem({...newItem, name: e.target.value})}
                        placeholder={t('menu.itemName')} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.price')} (€)</label>
                        <input 
                        type="number" 
                        step="0.01"
                        value={newItem.price}
                        onChange={e => setNewItem({...newItem, price: e.target.value})}
                        placeholder="0.00" 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.description')}</label>
                    <textarea 
                    value={newItem.description}
                    onChange={e => setNewItem({...newItem, description: e.target.value})}
                    rows={2} 
                    placeholder="Short description..." 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dish Group (e.g. Antipasto, Hot Plate)</label>
                    <div className="flex gap-2">
                        <select 
                            value={newItem.groupId}
                            onChange={e => setNewItem({...newItem, groupId: e.target.value})}
                            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                        >
                            <option value="">No Group</option>
                            {menuGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <div className="flex gap-1">
                            <input 
                                type="text"
                                placeholder="New Group..."
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                className="w-32 bg-slate-50 border border-slate-100 rounded-xl px-3 text-xs font-bold outline-none"
                            />
                            <button 
                                type="button"
                                onClick={() => handleAddGroup(newGroupName)}
                                className="bg-slate-900 text-white rounded-xl px-3 flex items-center justify-center hover:bg-slate-800"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.allergyInfo')}</label>
                    <div className="flex flex-wrap gap-2">
                        {allergies.map(allergy => (
                            <button
                                key={allergy.id}
                                type="button"
                                onClick={() => {
                                    const next = newItem.allergies.includes(allergy.id) 
                                        ? newItem.allergies.filter(id => id !== allergy.id) 
                                        : [...newItem.allergies, allergy.id];
                                    setNewItem({...newItem, allergies: next});
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black transition-all border",
                                    newItem.allergies.includes(allergy.id)
                                        ? "bg-slate-900 border-slate-900 text-white"
                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                )}
                            >
                                <span>{allergy.icon}</span>
                                <span className="uppercase tracking-widest">{allergy.name}</span>
                                {newItem.allergies.includes(allergy.id) && <Icons.Check size={10} className="text-emerald-400" />}
                            </button>
                        ))}
                        {allergies.length === 0 && <p className="text-[8px] font-bold text-slate-300 uppercase italic">Add allergies in the left panel first</p>}
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Will there be customization?</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => setHasCustomization(true)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    hasCustomization ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                                )}
                            >
                                Yes
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setHasCustomization(false);
                                    setSelectedIngredientIds([]);
                                    setNewItem(prev => ({...prev, customizationCategories: []}));
                                }}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    !hasCustomization ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                                )}
                            >
                                No
                            </button>
                        </div>
                    </div>

                    {hasCustomization && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.selectCustomization')}</label>
                            <div className="space-y-2">
                                {customizationCategories.map(cat => {
                                    const isExpanded = expandedCategories.includes(cat.id);
                                    const selectedFromThisCat = cat.ingredients.filter(ing => selectedIngredientIds.includes(ing.id));
                                    const allSelected = selectedFromThisCat.length === cat.ingredients.length && cat.ingredients.length > 0;

                                    return (
                                        <div key={cat.id} className="border border-slate-100 rounded-[1.5rem] overflow-hidden bg-slate-50/50">
                                            <div 
                                                onClick={() => toggleCategoryExpansion(cat.id)}
                                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                        selectedFromThisCat.length > 0 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                                                    )}>
                                                        {selectedFromThisCat.length > 0 ? <Icons.Check size={12} strokeWidth={4} /> : <Icons.Menu size={12} />}
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">{cat.name}</span>
                                                    {selectedFromThisCat.length > 0 && (
                                                        <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[8px] font-black">
                                                            {selectedFromThisCat.length} {t('menu.selected')}
                                                        </span>
                                                    )}
                                                </div>
                                                <Icons.ChevronDown size={14} className={cn("text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                                            </div>

                                            {isExpanded && (
                                                <div className="p-4 pt-0 border-t border-slate-100 bg-white">
                                                    <div className="flex justify-between items-center py-3">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('menu.availableIngredients')}</span>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                allSelected ? deselectAllIngredientsInCat(cat.id) : selectAllIngredientsInCat(cat.id);
                                                            }}
                                                            className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                                                        >
                                                            {allSelected ? t('menu.deselectAll') : t('menu.selectAll')}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {cat.ingredients.map(ing => (
                                                            <button
                                                                key={ing.id}
                                                                type="button"
                                                                onClick={() => toggleIngredientSelection(ing.id, cat.id)}
                                                                className={cn(
                                                                    "flex items-center gap-2 p-2 rounded-xl border text-left transition-all",
                                                                    selectedIngredientIds.includes(ing.id)
                                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                                    selectedIngredientIds.includes(ing.id) ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200"
                                                                )}>
                                                                    {selectedIngredientIds.includes(ing.id) && <Icons.Check size={10} strokeWidth={4} />}
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase truncate">{ing.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {customizationCategories.length === 0 && (
                                    <p className="text-[9px] font-bold text-slate-300 uppercase italic py-4 text-center">Add customization categories below first</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    type="submit"
                    className="w-full bg-emerald-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98]"
                >
                    {t('menu.saveDish')}
                </button>
                </form>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 mt-8">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                        {t('menu.manageAllergies')}
                    </h2>
                </div>
                <form onSubmit={handleAddAllergy} className="space-y-4 mb-8">
                    <div className="grid grid-cols-2 gap-4">
                        <input 
                            type="text" 
                            value={newAllergy.name}
                            onChange={e => setNewAllergy({...newAllergy, name: e.target.value})}
                            placeholder="Name (e.g. Nuts)" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <input 
                            type="text" 
                            value={newAllergy.icon}
                            onChange={e => setNewAllergy({...newAllergy, icon: e.target.value})}
                            placeholder="Icon (Emoji 🥜)" 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <textarea 
                        value={newAllergy.description}
                        onChange={e => setNewAllergy({...newAllergy, description: e.target.value})}
                        placeholder="Description (Optional)" 
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                    <button 
                        type="submit"
                        className="w-full bg-slate-900 text-white rounded-2xl py-3 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all"
                    >
                        Add Allergy
                    </button>
                </form>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Existing Allergies</label>
                    <div className="grid grid-cols-2 gap-3">
                        {allergies.map(allergy => (
                            <div key={allergy.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{allergy.icon}</span>
                                    <div className="leading-none">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">{allergy.name}</p>
                                        {allergy.description && <p className="text-[8px] font-medium text-slate-400 mt-0.5 truncate max-w-[80px]">{allergy.description}</p>}
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => handleDeleteAllergy(allergy.id)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                    <Icons.Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {allergies.length === 0 && (
                            <p className="col-span-full text-center py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">No allergies added</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 mt-8">
                <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                    Customization Category Names
                </h2>
                <form onSubmit={handleAddCustomizationLabel} className="space-y-4 mb-6">
                    <div className="flex gap-3">
                        <input 
                            type="text" 
                            value={newCustomizationLabel}
                            onChange={e => setNewCustomizationLabel(e.target.value)}
                            placeholder="e.g. Toppings, Breads, Proteins" 
                            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button 
                            type="submit"
                            className="bg-slate-900 text-white rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all font-sans"
                        >
                            Add Label
                        </button>
                    </div>
                </form>

                <div className="flex flex-wrap gap-2">
                    {customizationLabels.map(label => (
                        <div key={label.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl group transition-all hover:bg-white hover:border-slate-200">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 font-sans">{label.name}</span>
                            <button 
                                onClick={() => handleDeleteCustomizationLabel(label.id)}
                                className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                                <Icons.X size={12} />
                            </button>
                        </div>
                    ))}
                    {customizationLabels.length === 0 && (
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest py-2 font-sans">No custom labels added</p>
                    )}
                </div>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 mt-8">
                <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                    Manage Ingredients (Customizations)
                </h2>
                <form onSubmit={handleAddCustomization} className="space-y-6 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Category Name</label>
                             <select 
                                value={newCustomization.name}
                                onChange={e => setNewCustomization({...newCustomization, name: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                             >
                                <option value="">Select Category Name</option>
                                <optgroup label="Your Custom Labels">
                                    {customizationLabels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </optgroup>
                             </select>
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Min Select</label>
                             <input 
                                type="number" 
                                min="0"
                                value={newCustomization.minSelection}
                                onChange={e => setNewCustomization({...newCustomization, minSelection: parseInt(e.target.value) || 0})}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                             />
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Max Select</label>
                             <input 
                                type="number" 
                                min="1"
                                value={newCustomization.maxSelection}
                                onChange={e => setNewCustomization({...newCustomization, maxSelection: parseInt(e.target.value) || 1})}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                             />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Add Ingredients to Category</label>
                        <div className="grid grid-cols-12 gap-3">
                            <input 
                                type="text" 
                                value={newIngredient.name}
                                onChange={e => setNewIngredient({...newIngredient, name: e.target.value})}
                                placeholder="Ingredient Name" 
                                className="col-span-6 bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none"
                            />
                            <input 
                                type="number" 
                                step="0.01"
                                value={newIngredient.price}
                                onChange={e => setNewIngredient({...newIngredient, price: e.target.value})}
                                placeholder="Price" 
                                className="col-span-4 bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none"
                            />
                            <button 
                                type="button"
                                onClick={addIngredientToNewCategory}
                                className="col-span-2 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            {newCustomization.ingredients.map((ing, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {ing.name} {ing.price > 0 ? `(+€${ing.price})` : '(Free)'}
                                    </span>
                                    <button 
                                        type="button"
                                        onClick={() => setNewCustomization(prev => ({...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx)}))}
                                        className="hover:scale-110 transition-transform"
                                    >
                                        <Icons.X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button 
                        type="submit"
                        className="w-full bg-slate-900 text-white rounded-2xl py-3 font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all"
                    >
                        Create Ingredients
                    </button>
                </form>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Existing Customization Categories</label>
                    <div className="space-y-3">
                        {customizationCategories.map(cat => (
                            <div key={cat.id} className="bg-slate-50 border border-slate-100 p-4 rounded-3xl">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400">
                                            <Icons.Settings size={14} />
                                        </div>
                                        <div className="leading-none">
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-800">{cat.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">
                                                Min: {cat.minSelection} / Max: {cat.maxSelection}
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => handleDeleteCustomization(cat.id)}
                                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                    >
                                        <Icons.Trash2 size={12} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {cat.ingredients.map(ing => (
                                        <div key={ing.id} className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase bg-white px-2 py-1 rounded-md border border-slate-100">
                                            <span>{ing.name} ({ing.price > 0 ? `€${ing.price}` : t('menu.free')})</span>
                                            <button 
                                                onClick={() => handleDeleteIngredientFromCategory(cat.id, ing.id)}
                                                className="hover:text-rose-500 transition-colors"
                                            >
                                                <Icons.X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {customizationCategories.length === 0 && (
                            <p className="text-center py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">No customizations added</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 mt-8">
                <h2 className="mb-6 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                    Manage Dish Groups (Sorting & Reordering)
                </h2>
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <input 
                            type="text" 
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            placeholder="Add New Group Name..." 
                            className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button 
                            type="button"
                            onClick={() => handleAddGroup(newGroupName)}
                            className="bg-slate-900 text-white rounded-2xl px-8 font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-800 transition-all font-sans"
                        >
                            Add Group
                        </button>
                    </div>

                    <div className="space-y-2">
                        {menuGroups.map((group, idx) => (
                            <div key={group.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-4 rounded-2xl group hover:bg-white transition-all">
                                <div className="flex items-center gap-4">
                                    <span className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100 italic">
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight font-sans">{group.name}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        type="button"
                                        onClick={() => handleReorderGroups(group.id, 'up')}
                                        disabled={idx === 0}
                                        className="p-2 text-slate-400 hover:text-emerald-500 disabled:opacity-30"
                                    >
                                        <Icons.ChevronUp size={18} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => handleReorderGroups(group.id, 'down')}
                                        disabled={idx === menuGroups.length - 1}
                                        className="p-2 text-slate-400 hover:text-emerald-500 disabled:opacity-30"
                                    >
                                        <Icons.ChevronDown size={18} />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => handleDeleteGroup(group.id)}
                                        className="p-2 text-slate-400 hover:text-rose-500"
                                    >
                                        <Icons.Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {menuGroups.length === 0 && (
                            <p className="text-center py-6 text-[10px] font-black text-slate-300 uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-3xl mt-4 italic font-sans">No groups created yet</p>
                        )}
                    </div>
                </div>
            </div>

          </section>

        </div>
      )}

      {view === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 font-sans">
          {/* Table Management Sidebar */}
          <section className="lg:col-span-4 space-y-8">
            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                  {t('table.addTable')}
                </h2>
                <form onSubmit={handleAddTable} className="space-y-4">
                    <input 
                        type="text" 
                        value={newTable.name}
                        onChange={e => setNewTable({...newTable, name: e.target.value})}
                        placeholder={t('table.tableName') + " (e.g. Table 01)"} 
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <button 
                        type="submit"
                        className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all"
                    >
                        {t('table.create')}
                    </button>
                </form>
            </div>

            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-slate-200/50 border border-slate-100">
                <h2 className="mb-6 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                  {t('table.statistics')}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{t('table.totalTables')}</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{tables.length}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-2">{t('table.active')}</p>
                    <p className="text-2xl font-black text-emerald-700 leading-none">{tables.filter(t => t.isActive).length}</p>
                  </div>
                </div>
            </div>
          </section>

          {/* Table List & QR Codes */}
          <section className="lg:col-span-8">
            <h2 className="mb-8 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
              {t('table.existing')}
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
                {tables.map(table => (
                    <div key={table.id} data-table-id={table.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center text-center gap-6 group hover:border-emerald-200 transition-all">
                        <div className="relative">
                          <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-0 group-hover:opacity-10 transition-opacity" />
                          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 relative bg-white flex flex-col items-center gap-4">
                            <div className="w-[140px] h-[140px] bg-white rounded-xl flex items-center justify-center p-2 border border-slate-100 shadow-inner">
                              <QRCodeSVG 
                                value={`${window.location.origin}/menu?table=${table.id}`}
                                size={124}
                                level="H"
                                includeMargin={false}
                                imageSettings={{
                                  src: "/favicon.ico",
                                  x: undefined,
                                  y: undefined,
                                  height: 24,
                                  width: 24,
                                  excavate: true,
                                }}
                              />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                                {t('table.table')} {table.name}
                            </div>
                          </div>
                        </div>

                        <div>
                          {editingTable?.id === table.id ? (
                            <form onSubmit={handleUpdateTable} className="space-y-4">
                              <input 
                                type="text"
                                value={editingTable.name}
                                onChange={e => setEditingTable({...editingTable, name: e.target.value})}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-emerald-500 text-white p-2 rounded-xl text-xs font-bold uppercase tracking-widest">{t('menu.save')}</button>
                                <button type="button" onClick={() => setEditingTable(null)} className="flex-1 bg-slate-100 text-slate-400 p-2 rounded-xl text-xs font-bold uppercase tracking-widest">{t('menu.cancel')}</button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <h3 className="text-xl font-black text-slate-900 mb-1">{table.name}</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                {table.isActive ? t('table.ready') : t('table.inactive')}
                              </p>
                              
                              <div className="flex items-center justify-center gap-3">
                                  <button 
                                      onClick={() => setEditingTable(table)}
                                      className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-all shadow-sm"
                                  >
                                      <Icons.Edit3 size={16} />
                                  </button>
                                  <button 
                                      onClick={() => {
                                        const svgElement = document.querySelector(`div[data-table-id="${table.id}"] svg`) as SVGSVGElement;
                                        if (svgElement) {
                                          const size = 140;
                                          const padding = 60;
                                          const totalHeight = size + padding;
                                          
                                          const combinedSvg = `
                                            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${totalHeight}" viewBox="0 0 ${size} ${totalHeight}">
                                              <rect width="100%" height="100%" fill="white" />
                                              <g transform="translate(0, 10)">
                                                ${svgElement.innerHTML}
                                              </g>
                                              <text 
                                                x="50%" 
                                                y="${size + 35}" 
                                                text-anchor="middle" 
                                                font-family="system-ui, -apple-system, sans-serif" 
                                                font-size="14" 
                                                font-weight="900" 
                                                fill="#1e293b"
                                                style="text-transform: uppercase; letter-spacing: 0.1em;"
                                              >
                                                ${table.name}
                                              </text>
                                              <text 
                                                x="50%" 
                                                y="${size + 50}" 
                                                text-anchor="middle" 
                                                font-family="system-ui, -apple-system, sans-serif" 
                                                font-size="8" 
                                                font-weight="bold" 
                                                fill="#94a3b8"
                                                style="text-transform: uppercase; letter-spacing: 0.05em;"
                                              >
                                                SCAN TO ORDER
                                              </text>
                                            </svg>
                                          `.trim();

                                          const svgBlob = new Blob([combinedSvg], { type: 'image/svg+xml;charset=utf-8' });
                                          const url = URL.createObjectURL(svgBlob);
                                          const link = document.createElement('a');
                                          link.href = url;
                                          link.download = `QR_${table.name.replace(/\s+/g, '_')}.svg`;
                                          link.click();
                                          URL.revokeObjectURL(url);
                                        }
                                      }}
                                      className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-all shadow-sm"
                                      title="Download QR"
                                  >
                                      <Icons.Download size={16} />
                                  </button>
                                  <button 
                                      onClick={() => handleDeleteTable(table.id)}
                                      className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm"
                                  >
                                      <Icons.Trash2 size={16} />
                                  </button>
                              </div>
                            </>
                          )}
                        </div>
                    </div>
                ))}
                {tables.length === 0 && (
                    <div className="col-span-full py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mb-4">
                           <Icons.Table size={32} />
                        </div>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">{t('table.noTables')}</h3>
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-2">{t('table.addFirst')}</p>
                    </div>
                )}
            </div>
          </section>
        </div>
      )}


      {view === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 font-sans">
          {/* Printer Management */}
          <section className="lg:col-span-6 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-slate-900 text-white rounded-2xl">
                  <PrinterIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Printers</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connect your Custom P3 printer</p>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-2xl p-4 mb-8 border border-emerald-100">
                <div className="flex gap-3">
                  <AlertCircle size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-emerald-800">Custom P3 Connection Guide:</p>
                    <ol className="text-[10px] text-emerald-700 space-y-1 list-decimal ml-4">
                      <li>For LAN: Connect Ethernet cable to the ETH port.</li>
                      <li>Find IP: Hold <span className="font-black">FEED</span> then turn <span className="font-black">ON</span>. IP is on the paper.</li>
                      <li>For Cloud: Enter the <span className="font-black">Serial Number</span>.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddPrinter} className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('printer.name')}</label>
                    <input 
                      type="text" 
                      value={newPrinter.name}
                      onChange={e => setNewPrinter({...newPrinter, name: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="Kitchen Printer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">IP Address (LAN)</label>
                    <input 
                      type="text" 
                      value={newPrinter.ip}
                      onChange={e => setNewPrinter({...newPrinter, ip: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Port</label>
                    <input 
                      type="text" 
                      value={newPrinter.port}
                      onChange={e => setNewPrinter({...newPrinter, port: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Serial Number</label>
                    <input 
                      type="text" 
                      value={newPrinter.serialNumber}
                      onChange={e => setNewPrinter({...newPrinter, serialNumber: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="e.g. N411228B00919"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">MAC Address</label>
                    <input 
                      type="text" 
                      value={newPrinter.macAddress}
                      onChange={e => setNewPrinter({...newPrinter, macAddress: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="e.g. 000EE21A956E"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cloud ID</label>
                    <input 
                      type="text" 
                      value={newPrinter.cloudId}
                      onChange={e => setNewPrinter({...newPrinter, cloudId: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="e.g. 1387db15-..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('printer.type')}</label>
                    <select 
                      value={newPrinter.type}
                      onChange={e => setNewPrinter({...newPrinter, type: e.target.value as any})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="thermal">Thermal</option>
                      <option value="dotmatrix">Dot Matrix</option>
                      <option value="usb">USB (Browser Printing)</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white rounded-2xl py-4 text-xs font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">
                  Add Printer
                </button>
              </form>

              <div className="space-y-3">
                {printers.map(printer => (
                  <div key={printer.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                        <PrinterIcon size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{printer.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {printer.ip ? `${printer.ip}:${printer.port}` : 'Cloud Printer'} • {printer.type.toUpperCase()}
                          {printer.serialNumber && ` • SN: ${printer.serialNumber}`}
                          {printer.macAddress && ` • MAC: ${printer.macAddress}`}
                          {printer.cloudId && ` • ID: ${printer.cloudId}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => testPrinter(printer)}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Test Print"
                      >
                         <RefreshCcw size={16} />
                      </button>
                      <button onClick={() => handleDeletePrinter(printer.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Staff & Site Management */}
          <section className="lg:col-span-6 space-y-8">
            {/* Site Settings */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-slate-900 text-white rounded-2xl">
                  <LayoutDashboard size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('settings.site')}</h2>
              </div>

              <form onSubmit={handleSaveSiteSettings} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.name')}</label>
                    <input 
                      type="text" 
                      value={siteSettings.siteName}
                      onChange={e => setSiteSettings({...siteSettings, siteName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>

                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.logo')}</label>
                    <div className="relative group">
                      <div className="w-full h-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative">
                        {siteSettings.logo ? (
                          <img src={siteSettings.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                        ) : (
                          <Icons.Image size={24} className="text-slate-300" />
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => e.target.files?.[0] && handleSiteImageUpload(e.target.files[0], 'logo')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      {siteSettings.logo && (
                        <button 
                          type="button" 
                          onClick={() => setSiteSettings({...siteSettings, logo: ''})}
                          className="absolute -top-2 -right-2 p-1 bg-white shadow-md rounded-full text-rose-500 hover:scale-110 transition-transform"
                        >
                          <Icons.X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Favicon Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.favicon')}</label>
                    <div className="relative group">
                      <div className="w-full h-24 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative">
                        {siteSettings.favicon ? (
                          <img src={siteSettings.favicon} alt="Favicon" className="w-full h-full object-contain p-4" />
                        ) : (
                          <Icons.FileCode size={24} className="text-slate-300" />
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => e.target.files?.[0] && handleSiteImageUpload(e.target.files[0], 'favicon')}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      {siteSettings.favicon && (
                        <button 
                          type="button" 
                          onClick={() => setSiteSettings({...siteSettings, favicon: ''})}
                          className="absolute -top-2 -right-2 p-1 bg-white shadow-md rounded-full text-rose-500 hover:scale-110 transition-transform"
                        >
                          <Icons.X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.email')}</label>
                    <input 
                      type="email" 
                      value={siteSettings.contactEmail}
                      onChange={e => setSiteSettings({...siteSettings, contactEmail: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.phone')}</label>
                    <input 
                      type="tel" 
                      value={siteSettings.contactPhone}
                      onChange={e => setSiteSettings({...siteSettings, contactPhone: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.address')}</label>
                    <input 
                      type="text" 
                      value={siteSettings.address}
                      onChange={e => setSiteSettings({...siteSettings, address: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('site.footer')}</label>
                    <input 
                      type="text" 
                      value={siteSettings.footerText}
                      onChange={e => setSiteSettings({...siteSettings, footerText: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-slate-900 text-white rounded-2xl py-3 text-xs font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {submitting ? <RefreshCcw className="animate-spin mx-auto" size={16} /> : t('site.save')}
                </button>
              </form>
            </div>


            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-slate-900 text-white rounded-2xl">
                  <Users size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('settings.staff')}</h2>
              </div>

              <form onSubmit={handleAddStaff} className="space-y-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.itemName')}</label>
                    <input 
                      type="text" 
                      value={newStaff.name}
                      onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('staff.email')}</label>
                    <input 
                      type="email" 
                      value={newStaff.email}
                      onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('staff.role')}</label>
                    <select 
                      value={newStaff.role}
                      onChange={e => setNewStaff({...newStaff, role: e.target.value as any})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    >
                      <option value="admin">Admin</option>
                      <option value="kitchen">Kitchen Staff</option>
                      <option value="waiter">Waiter</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white rounded-2xl py-3 text-xs font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">
                  {t('staff.add')}
                </button>
              </form>

              <div className="space-y-3">
                {staffMembers.map(staff => (
                  <div key={staff.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm uppercase font-black text-xs">
                        {staff.role[0]}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{staff.name}</p>
                        <p className="text-[10px] font-bold text-slate-400">{staff.email} • {staff.role.toUpperCase()}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteStaff(staff.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl">
                  <RefreshCcw size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('settings.system')}</h2>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('system.version')}</p>
                    <p className="text-2xl font-black text-slate-800">v{systemSettings?.version || '1.0'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Update</p>
                    <p className="text-xs font-bold text-slate-600">
                      {systemSettings?.lastUpdate ? new Date(systemSettings.lastUpdate).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('system.uploadPackage')}</label>
                  <label className="group h-24 w-full bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-emerald-500 overflow-hidden">
                    <Icons.Upload size={24} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{t('menu.dropImage')}</span>
                    <input type="file" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) handleUpdateVersion();
                    }} />
                  </label>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 border-dashed flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm">
                    <Icons.ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">{t('system.updateAvailable')}</p>
                    <p className="text-[10px] font-medium text-emerald-600">Bug fixes and performance improvements</p>
                  </div>
                </div>

                <button 
                  onClick={handleUpdateVersion}
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  <RefreshCcw size={16} />
                  {t('system.checkForUpdates')}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'reports' && (
        <div className="space-y-10 font-sans">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: t('report.revenue'), value: `€${orders.reduce((sum, o) => sum + o.total, 0).toLocaleString()}`, icon: Icons.Coins, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: t('report.ordersCount'), value: orders.length, icon: Icons.PackageCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: t('report.avgValue'), value: `€${(orders.length > 0 ? (orders.reduce((sum, o) => sum + o.total, 0) / orders.length) : 0).toFixed(2)}`, icon: Icons.TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: t('report.activeTables'), value: tables.filter(t => t.isActive).length, icon: Icons.Table, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-6">
                <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center", stat.bg)}>
                  <stat.icon size={32} className={stat.color} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <p className="text-2xl font-black text-slate-900 leading-none mt-1">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sales Trend */}
            <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{t('report.performance')}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('report.trend')}</p>
                </div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={Array.from({ length: 7 }, (_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - i));
                      const dateStr = d.toLocaleDateString();
                      const daySales = orders
                        .filter(o => new Date(o.createdAt).toLocaleDateString() === dateStr)
                        .reduce((sum, o) => sum + o.total, 0);
                      return { name: d.toLocaleDateString([], { weekday: 'short' }), sales: daySales };
                    })}
                  >
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                      itemStyle={{ fontWeight: 900, color: '#10b981' }}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales by Category */}
            <div className="lg:col-span-4 bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">{t('report.distribution')}</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories.map(cat => ({
                        name: cat.name,
                        value: orders.reduce((sum, o) => {
                          const catItemsInOrder = o.items.filter(item => {
                            const menuItem = menuItems.find(mi => mi.id === item.id);
                            return menuItem?.categoryIds?.includes(cat.id) || menuItem?.categoryId === cat.id;
                          });
                          return sum + catItemsInOrder.reduce((isum, ii) => isum + (ii.price * ii.quantity), 0);
                        }, 0)
                      })).filter(c => c.value > 0)}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categories.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-4">
                {categories.map(cat => {
                  const val = orders.reduce((sum, o) => {
                    const catItemsInOrder = o.items.filter(item => {
                      const menuItem = menuItems.find(mi => mi.id === item.id);
                      return menuItem?.categoryIds?.includes(cat.id) || menuItem?.categoryId === cat.id;
                    });
                    return sum + catItemsInOrder.reduce((isum, ii) => isum + (ii.price * ii.quantity), 0);
                  }, 0);
                  if (val === 0) return null;
                  return (
                    <div key={cat.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'][categories.indexOf(cat) % 5] }} />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{cat.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">€{val.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Top Selling Items */}
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
               <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">{t('report.topItems')}</h3>
               <div className="space-y-6">
                 {(() => {
                    const itemStats = orders.reduce((acc, o) => {
                      o.items.forEach(item => {
                        acc[item.name] = (acc[item.name] || 0) + item.quantity;
                      });
                      return acc;
                    }, {} as Record<string, number>);
                    
                    const sortedItems = (Object.entries(itemStats) as [string, number][])
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5);
                    
                    const maxQty = Math.max(...(Object.values(itemStats) as number[]), 1);

                    return sortedItems.map(([name, qty], i) => (
                      <div key={name} className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">0{i+1}</span>
                        <div className="flex-1">
                            <p className="text-sm font-black text-slate-800">{name}</p>
                            <div className="w-full h-1.5 bg-slate-50 rounded-full mt-2">
                               <div 
                                className="h-full bg-emerald-500 rounded-full" 
                                style={{ width: `${(qty / maxQty) * 100}%` }} 
                               />
                            </div>
                        </div>
                        <span className="text-sm font-black text-slate-900">{qty} {t('report.sold')}</span>
                      </div>
                    ));
                 })()}
               </div>
            </div>

            {/* Recent Large Orders */}
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
               <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">{t('report.bigOrders')}</h3>
               <div className="space-y-4">
                 {orders
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 5)
                  .map(order => (
                    <div key={order.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{order.tableName || `Table ${order.tableNumber}`}</p>
                          <p className="text-sm font-bold text-slate-700">{order.items.length} {t('customer.items')}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">€{order.total.toLocaleString()}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(order.createdAt).toLocaleDateString()}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dish Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-6 my-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{t('menu.editDish')}</h2>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <Icons.X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateItem} className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.menuCategories')}</label>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                    const current = editingItem.categoryIds || (editingItem.categoryId ? [editingItem.categoryId] : []);
                                    const next = current.includes(c.id) 
                                        ? current.filter(id => id !== c.id) 
                                        : [...current, c.id].filter(Boolean);
                                    // Handle legacy categoryId as first element
                                    setEditingItem({...editingItem, categoryIds: next as string[], categoryId: next[0] as string || ''});
                                }}
                                className={cn(
                                    "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                    (editingItem.categoryIds || [editingItem.categoryId]).includes(c.id)
                                        ? "bg-slate-900 border-slate-900 text-white"
                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                )}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.imageLabel')}</label>
                    <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files[0];
                            if (file) handleImageUpload(file, true);
                        }}
                        onClick={() => document.getElementById('editItemImageInput')?.click()}
                        className="group relative h-32 w-full bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all hover:border-emerald-500 overflow-hidden"
                    >
                        {editingItem.imageUrl && <img src={editingItem.imageUrl} className="h-full w-full object-cover" />}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Icons.RefreshCw size={24} className="text-white animate-spin-slow" />
                        </div>
                        <input 
                            id="editItemImageInput"
                            type="file" 
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, true);
                            }}
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.itemName')}</label>
                        <input 
                        type="text" 
                        value={editingItem.name}
                        onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.price')} (€)</label>
                        <input 
                        type="number" 
                        step="0.01"
                        value={editingItem.price}
                        onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.description')}</label>
                    <textarea 
                      value={editingItem.description}
                      onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dish Group</label>
                        <select 
                            value={editingItem.groupId}
                            onChange={e => setEditingItem({...editingItem, groupId: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                        >
                            <option value="">No Group</option>
                            {menuGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>

                  <div className="space-y-2 pt-2 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.allergyInfo')}</label>
                    <div className="flex flex-wrap gap-2">
                        {allergies.map(allergy => (
                            <button
                                key={allergy.id}
                                type="button"
                                onClick={() => {
                                    const current = editingItem.allergies || [];
                                    const next = current.includes(allergy.id) 
                                        ? current.filter(id => id !== allergy.id) 
                                        : [...current, allergy.id];
                                    setEditingItem({...editingItem, allergies: next});
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black transition-all border",
                                    (editingItem.allergies || []).includes(allergy.id)
                                        ? "bg-slate-900 border-slate-900 text-white"
                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                )}
                            >
                                <span>{allergy.icon}</span>
                                <span className="uppercase tracking-widest">{allergy.name}</span>
                            </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.willCustomization')}</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => setHasCustomization(true)}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    hasCustomization ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                                )}
                            >
                                {t('customer.valid')}
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setHasCustomization(false);
                                    setSelectedIngredientIds([]);
                                    setEditingItem({...editingItem, customizationCategories: []});
                                }}
                                className={cn(
                                    "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                    !hasCustomization ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                                )}
                            >
                                {t('menu.cancel')}
                            </button>
                        </div>
                    </div>

                    {hasCustomization && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.selectCustomization')}</label>
                            <div className="space-y-2">
                                {customizationCategories.map(cat => {
                                    const isExpanded = expandedCategories.includes(cat.id);
                                    const selectedFromThisCat = cat.ingredients.filter(ing => selectedIngredientIds.includes(ing.id));
                                    const allSelected = selectedFromThisCat.length === cat.ingredients.length && cat.ingredients.length > 0;

                                    return (
                                        <div key={cat.id} className="border border-slate-100 rounded-[1.5rem] overflow-hidden bg-slate-50/50">
                                            <div 
                                                onClick={() => toggleCategoryExpansion(cat.id)}
                                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                        selectedFromThisCat.length > 0 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"
                                                    )}>
                                                        {selectedFromThisCat.length > 0 ? <Icons.Check size={12} strokeWidth={4} /> : <Icons.Menu size={12} />}
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-700">{cat.name}</span>
                                                    {selectedFromThisCat.length > 0 && (
                                                        <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[8px] font-black">
                                                            {selectedFromThisCat.length} selected
                                                        </span>
                                                    )}
                                                </div>
                                                <Icons.ChevronDown size={14} className={cn("text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                                            </div>

                                            {isExpanded && (
                                                <div className="p-4 pt-0 border-t border-slate-100 bg-white">
                                                    <div className="flex justify-between items-center py-3">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('menu.availableIngredients')}</span>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                allSelected ? deselectAllIngredientsInCat(cat.id, true) : selectAllIngredientsInCat(cat.id, true);
                                                            }}
                                                            className="text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                                                        >
                                                            {allSelected ? t('menu.deselectAll') : t('menu.selectAll')}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {cat.ingredients.map(ing => (
                                                            <button
                                                                key={ing.id}
                                                                type="button"
                                                                onClick={() => toggleIngredientSelection(ing.id, cat.id, true)}
                                                                className={cn(
                                                                    "flex items-center gap-2 p-2 rounded-xl border text-left transition-all",
                                                                    selectedIngredientIds.includes(ing.id)
                                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                                        : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                                                )}
                                                            >
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                                    selectedIngredientIds.includes(ing.id) ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-200"
                                                                )}>
                                                                    {selectedIngredientIds.includes(ing.id) && <Icons.Check size={10} strokeWidth={4} />}
                                                                </div>
                                                                <span className="text-[10px] font-bold uppercase truncate">{ing.name}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  Apply Changes
                </button>
              </form>
            </div>
          </div>
        )}

      {/* Edit Category Modal */}
        {editingCategory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl space-y-6 my-auto">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{t('menu.editMenuSettings')}</h2>
                <button onClick={() => setEditingCategory(null)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <Icons.X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateCategory} className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.categoryName')}</label>
                    <input 
                      type="text" 
                      value={editingCategory.name}
                      onChange={e => setEditingCategory({...editingCategory, name: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3 px-1 py-4 border-y border-slate-50">
                        <input 
                            type="checkbox" 
                            id="isIndividualEdit" 
                            checked={editingCategory.isIndividualPricing}
                            onChange={e => setEditingCategory({...editingCategory, isIndividualPricing: e.target.checked})}
                            className="w-5 h-5 accent-emerald-600 rounded-lg"
                        />
                        <label htmlFor="isIndividualEdit" className="text-xs font-black text-slate-800 uppercase tracking-widest cursor-pointer">
                            {t('menu.individualPrices')}
                        </label>
                    </div>

                    {!editingCategory.isIndividualPricing && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.entryFee')} (€)</label>
                             <input 
                                type="number" 
                                step="0.01"
                                value={editingCategory.fixedPrice || ''}
                                onChange={e => setEditingCategory({...editingCategory, fixedPrice: e.target.value ? parseFloat(e.target.value) : 0})}
                                placeholder="e.g. 10.00" 
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('menu.popupConditions')}</label>
                            <button 
                                type="button"
                                onClick={() => setEditingCategory({...editingCategory, showPopup: !editingCategory.showPopup})}
                                className={cn(
                                    "w-10 h-5 rounded-full transition-all relative",
                                    editingCategory.showPopup ? "bg-emerald-500" : "bg-slate-200"
                                )}
                            >
                                <div className={cn(
                                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                                    editingCategory.showPopup ? "left-6" : "left-1"
                                )} />
                            </button>
                        </div>
                        
                        <textarea 
                            value={editingCategory.conditions || ''}
                            onChange={e => setEditingCategory({...editingCategory, conditions: e.target.value})}
                            disabled={!editingCategory.showPopup}
                            placeholder={editingCategory.showPopup ? t('menu.enterRegulations') : t('menu.popupDisabled')}
                            rows={3}
                            className={cn(
                                "w-full border border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none transition-all resize-none",
                                editingCategory.showPopup ? "bg-slate-50 focus:ring-2 focus:ring-emerald-500" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                        />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.availability')}</label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDay(day, true)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                                        (editingCategory.availableDays || []).includes(day)
                                            ? "bg-slate-900 border-slate-900 text-white"
                                            : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-white"
                                    )}
                                >
                                    {day.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.startTime')}</label>
                                <input 
                                    type="time" 
                                    value={editingCategory.startTime || '00:00'}
                                    onChange={e => setEditingCategory({...editingCategory, startTime: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-[10px] font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('menu.endTime')}</label>
                                <input 
                                    type="time" 
                                    value={editingCategory.endTime || '23:59'}
                                    onChange={e => setEditingCategory({...editingCategory, endTime: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-2 text-[10px] font-bold outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  {t('menu.applyChanges')}
                </button>
              </form>
            </div>
          </div>
        )}

      {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center space-y-6">
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto text-rose-500">
                <Icons.AlertTriangle size={40} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t('menu.confirmDelete')}</h3>
                <p className="text-sm font-medium text-slate-400">
                  {t('menu.deleteWarning')}
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={processDelete}
                  className="w-full bg-rose-500 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-rose-100 hover:bg-rose-600 transition-all active:scale-[0.98]"
                >
                  {t('menu.confirmAction')}
                </button>
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full bg-slate-100 text-slate-500 rounded-2xl py-4 font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all active:scale-[0.98]"
                >
                  {t('menu.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Table Payment Confirmation Modal */}
        {paidConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto text-emerald-500">
                <Icons.CreditCard size={40} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                  {t('order.paid', 'Paid')}
                </h3>
                <p className="text-sm font-medium text-slate-400">
                  {t('order.confirmPaid', 'Confirm payment for this table?')}
                  <strong className="text-slate-700 text-lg font-black block mt-2">{paidConfirm.tableName}</strong>
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={confirmPaidTable}
                  disabled={submitting}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Icons.RefreshCcw size={16} className="animate-spin" /> : t('menu.confirmAction', 'Confirm')}
                </button>
                <button 
                  onClick={() => setPaidConfirm(null)}
                  disabled={submitting}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl py-4 font-black uppercase tracking-widest text-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {t('menu.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Hidden Print Receipt Template */}
        {printingOrder && (
          <div className="fixed inset-0 bg-white z-[9999] p-8 font-mono text-sm print:block hidden">
            <div className="max-w-[300px] mx-auto text-center space-y-4">
              <h2 className="text-xl font-bold uppercase">{siteSettings.siteName}</h2>
              <div className="border-t border-b border-black py-2 my-2 text-left">
                <p>Table: {printingOrder.tableName || printingOrder.tableNumber}</p>
                <p>Order ID: {printingOrder.id.slice(-8).toUpperCase()}</p>
                <p>Date: {new Date(printingOrder.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-left space-y-1">
                {printingOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.name} x{item.quantity}</span>
                    <span>€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-black pt-2 font-bold flex justify-between">
                <span>TOTAL</span>
                <span>€{printingOrder.total.toFixed(2)}</span>
              </div>
              <div className="mt-8 text-[10px]">
                <p>Thank you for your visit!</p>
                <p>{siteSettings.address}</p>
              </div>
            </div>
          </div>
        )}
        <style>{`
          @media print {
            body > *:not(.fixed.inset-0.bg-white.z-\\[9999\\]) { 
              display: none !important; 
            }
            .fixed.inset-0.bg-white.z-\\[9999\\] {
              position: static !important;
              display: block !important;
              background: white !important;
              padding: 0 !important;
            }
            @page { margin: 0; }
          }
        `}</style>
    </div>
  );
}
