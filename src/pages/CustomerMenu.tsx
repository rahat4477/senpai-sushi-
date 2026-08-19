import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  db, 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  orderBy, 
  onSnapshot, 
  where, 
  OperationType, 
  handleFirestoreError 
} from '../lib/firebase';
import { MenuItem, Category, CartItem, Allergy, IngredientCategory, Table, MenuGroup, SiteSettings, Order } from '../types';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../constants';
import * as Icons from 'lucide-react';
import { ShoppingCart, Plus, Minus, ChevronRight, Search } from 'lucide-react';
import { useToast } from '../components/ui/Toaster';
import { cn } from '../lib/utils';
import { useLanguage, Language } from '../context/LanguageContext';

export default function CustomerMenu() {
  const { language, setLanguage, t } = useLanguage();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table') || '1';
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [customizationCategories, setCustomizationCategories] = useState<IngredientCategory[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [table, setTable] = useState<Table | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [popupCategory, setPopupCategory] = useState<Category | null>(null);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedCustomizations, setSelectedCustomizations] = useState<{[catId: string]: string[]}>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Real-time listener for current table's active orders (pending or preparing)
    // Querying the collection and filtering on client is robust to type differences (e.g. string '1' vs number 1)
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      const active = allOrders.filter(o => 
        (o.status === 'pending' || o.status === 'preparing') &&
        o.tableNumber?.toString() === tableId.toString()
      );
      setActiveOrders(active);
    }, (error) => {
      console.error("Error listening to table active orders:", error);
    });

    return () => unsubscribe();
  }, [tableId]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        let catSnap = await getDocs(collection(db, 'categories'));
        let itemSnap = await getDocs(collection(db, 'menuItems'));
        let groupSnap = await getDocs(query(collection(db, 'menuGroups'), orderBy('order', 'asc')));
        let allergySnap = await getDocs(collection(db, 'allergies'));
        let customizationSnap = await getDocs(collection(db, 'customizationCategories'));
        let siteSnap = await getDoc(doc(db, 'settings', 'site'));

        // Seed data if empty
        if (catSnap.empty) {
          console.log("Seeding initial data...");
          const catMap: Record<string, string> = {};
          for (const cat of INITIAL_CATEGORIES) {
            const docRef = await addDoc(collection(db, 'categories'), {
              name: cat.name,
              icon: cat.icon,
              fixedPrice: (cat as any).fixedPrice || null,
              isIndividualPricing: cat.name === 'Menu Alla Carta' // Default logic for initial seed
            });
            catMap[cat.name] = docRef.id;
          }
          for (const item of INITIAL_MENU_ITEMS) {
            await addDoc(collection(db, 'menuItems'), {
              ...item,
              categoryId: catMap[item.categoryId] || item.categoryId
            });
          }

          const DEFAULT_ALLERGIES = [
            { name: 'Nuts', icon: '🥜' },
            { name: 'Gluten', icon: '🌾' },
            { name: 'Dairy', icon: '🥛' },
            { name: 'Eggs', icon: '🥚' },
            { name: 'Seafood', icon: '🐟' },
            { name: 'Soy', icon: '🫘' },
          ];

          for (const a of DEFAULT_ALLERGIES) {
            await addDoc(collection(db, 'allergies'), a);
          }

          catSnap = await getDocs(collection(db, 'categories'));
          itemSnap = await getDocs(collection(db, 'menuItems'));
          allergySnap = await getDocs(collection(db, 'allergies'));
          customizationSnap = await getDocs(collection(db, 'customizationCategories'));
          groupSnap = await getDocs(query(collection(db, 'menuGroups'), orderBy('order', 'asc')));
        }

        const cats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        const items = itemSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
        const groups = groupSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuGroup));
        const allgs = allergySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Allergy));
        const custs = customizationSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as IngredientCategory));
        
        setCategories(cats);
        setMenuItems(items);
        setMenuGroups(groups);
        setAllergies(allgs);
        setCustomizationCategories(custs);

        if (siteSnap.exists()) {
            const data = siteSnap.data() as SiteSettings;
            setSiteSettings(data);
            if (data.siteName) document.title = data.siteName;
            if (data.favicon) {
                const link = document.querySelector("link[rel~='icon']") as HTMLLinkDescriptor || document.createElement('link');
                (link as any).rel = 'icon';
                (link as any).href = data.favicon;
                document.getElementsByTagName('head')[0].appendChild(link as any);
            }
        }

        // Fetch Table info
        if (tableId.length > 5) { // Likely a Firestore ID
            const tableDoc = await getDoc(doc(db, 'tables', tableId));
            if (tableDoc.exists()) {
                setTable({ id: tableDoc.id, ...tableDoc.data() } as Table);
            }
        }

        const now = new Date();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const isAvailable = (cat: Category) => {
          if (cat.availableDays && cat.availableDays.length > 0 && !cat.availableDays.includes(currentDay)) return false;
          if (cat.startTime && cat.endTime) {
            if (currentTime < cat.startTime || currentTime > cat.endTime) return false;
          }
          return true;
        };

        const availableCats = cats.filter(isAvailable);
        if (availableCats.length > 0) setSelectedCategory(availableCats[0].id);
      } catch (err) {
        console.error("Fetch Data Error:", err);
        handleFirestoreError(err, OperationType.GET, 'menu-data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      const cat = categories.find(c => c.id === selectedCategory);
      if (cat && cat.showPopup && cat.conditions) {
        const today = new Date().toISOString().split('T')[0];
        const storageKey = `savour-popup-${cat.id}-${today}`;
        if (!localStorage.getItem(storageKey)) {
          setPopupCategory(cat);
          localStorage.setItem(storageKey, 'true');
        }
      }
    }
  }, [selectedCategory, categories]);

  const addToCart = (item: MenuItem, selectedIngs: { id: string, name: string, price: number }[] = []) => {
    const itemCategoryIds = item.categoryIds && item.categoryIds.length > 0 ? item.categoryIds : [item.categoryId];
    const itemCategory = (selectedCategory && itemCategoryIds.includes(selectedCategory)) 
        ? categories.find(c => c.id === selectedCategory)
        : categories.find(c => itemCategoryIds.includes(c.id));

    // Check if item needs customization and it hasn't been provided yet
    if (item.hasCustomization && selectedIngs.length === 0) {
        setCustomizingItem(item);
        setSelectedCustomizations({});
        return;
    }
    
    setCart(prev => {
      let newCart = [...prev];
      
      // Handle Fixed Price Categories (e.g. All You Can Eat)
      if (itemCategory && !itemCategory.isIndividualPricing && itemCategory.fixedPrice) {
        const passId = `pass-${itemCategory.id}`;
        const hasPass = prev.find(i => i.id === passId);
        const hasActivePass = activeOrders?.some(order => 
          order.items?.some(oi => oi.id === passId)
        );
        
        if (!hasPass && !hasActivePass) {
          newCart.push({
            id: passId,
            categoryId: itemCategory.id,
            name: `${itemCategory.name} - Entry Fee`,
            price: itemCategory.fixedPrice,
            description: `Base price for ${itemCategory.name}`,
            imageUrl: '',
            quantity: 1
          });
        }
      }

      // Items with different customizations or from different price-rule categories should be separate
      const customizationKey = selectedIngs.map(i => i.id).sort().join(',');
      const cartItemId = `${item.id}-${itemCategory?.id || 'default'}${customizationKey ? `-${customizationKey}` : ''}`;

      const existing = newCart.find(i => i.id === cartItemId);
      if (existing) {
        return newCart.map(i => i.id === cartItemId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      
      const isIndividuallyPriced = !itemCategory || itemCategory.isIndividualPricing;
      const basePrice = isIndividuallyPriced ? item.price : 0;
      const extraPrice = isIndividuallyPriced ? selectedIngs.reduce((acc, ing) => acc + ing.price, 0) : 0;
      
      return [...newCart, { 
        ...item, 
        id: cartItemId,
        price: basePrice + extraPrice, 
        quantity: 1,
        selectedIngredients: selectedIngs
      }];
    });
    setCustomizingItem(null);
    setSelectedCustomizations({});
    toast(`Added ${item.name} to cart`, 'success');
  };

  const handleConfirmCustomization = () => {
    if (!customizingItem) return;

    // Validation
    for (const catId of (customizingItem.customizationCategories || [])) {
        const cat = customizationCategories.find(c => c.id === catId);
        if (!cat) continue;
        const selectedCount = (selectedCustomizations[catId] || []).length;
        if (selectedCount < cat.minSelection) {
            toast(`Please select at least ${cat.minSelection} ${cat.name}`, 'error');
            return;
        }
    }

    const allSelectedIngs: { id: string, name: string, price: number }[] = [];
    
    Object.values(selectedCustomizations).forEach((ingIds: string[]) => {
        ingIds.forEach(id => {
            // Find ingredient in customizationCategories
            let found = false;
            customizationCategories.forEach(cat => {
                const ing = cat.ingredients.find(i => i.id === id);
                if (ing && !found) {
                    allSelectedIngs.push({ id: ing.id, name: ing.name, price: ing.price });
                    found = true;
                }
            });
        });
    });

    addToCart(customizingItem, allSelectedIngs);
  };

  const toggleCustomization = (catId: string, ingId: string, maxSelection: number) => {
    setSelectedCustomizations(prev => {
        const current = prev[catId] || [];
        if (maxSelection === 1) {
            return { ...prev, [catId]: [ingId] };
        } else {
            const isSelected = current.includes(ingId);
            if (!isSelected && current.length >= maxSelection) {
                toast(`You can only select up to ${maxSelection} items`, 'error');
                return prev;
            }
            const next = isSelected 
                ? current.filter(id => id !== ingId)
                : [...current, ingId];
            return { ...prev, [catId]: next };
        }
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const updated = prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);

      // Clean up empty passes
      const hasPass = updated.some(item => item.id.startsWith('pass-'));
      if (!hasPass) return updated;

      return updated.filter(item => {
        if (!item.id.startsWith('pass-')) return true;
        const catId = item.categoryId;
        return updated.some(other => {
          if (other.id.startsWith('pass-')) return false;
          const otherCategoryIds = other.categoryIds && other.categoryIds.length > 0 ? other.categoryIds : [other.categoryId];
          return otherCategoryIds.includes(catId);
        });
      });
    });
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const orderData = {
        tableNumber: tableId,
        tableName: table?.name || `Table ${tableId}`,
        items: cart.map(i => ({ 
          id: i.id, 
          name: i.name, 
          price: i.price, 
          quantity: i.quantity,
          selectedIngredients: i.selectedIngredients || []
        })),
        total,
        status: 'preparing',
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Call printing API
      try {
        const printRes = await fetch('/api/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: { ...orderData, id: docRef.id } })
        });
        if (printRes.ok) {
          const printData = await printRes.json();
          console.log("[CustomerMenu Print Result]:", printData);
        }
      } catch (printErr) {
        console.warn("[CustomerMenu Print Request]:", printErr);
      }

      setCart([]);
      setIsCartOpen(false);
      toast("Order placed successfully! We're preparing your food.", 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const renderMenuItem = (item: MenuItem) => {
    const itemCategoryIds = item.categoryIds && item.categoryIds.length > 0 ? item.categoryIds : [item.categoryId];
    const itemCategory = (selectedCategory && itemCategoryIds.includes(selectedCategory)) 
        ? categories.find(c => c.id === selectedCategory)
        : categories.find(c => itemCategoryIds.includes(c.id));

    return (
      <div
        key={item.id}
        className="group flex gap-4 p-3 bg-slate-50 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-100"
      >
        <div className="h-20 w-20 overflow-hidden rounded-[1.25rem] bg-slate-200 flex-shrink-0">
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
        </div>
        <div className="flex flex-1 flex-col justify-between py-0.5">
          <div>
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-slate-800 leading-tight">{item.name}</h3>
              <div className="flex gap-1 ml-2">
                   {item.allergies?.map(aId => {
                       const allergy = allergies.find(a => a.id === aId);
                       return allergy ? (
                           <span key={aId} title={allergy.name} className="text-[10px] grayscale group-hover:grayscale-0 transition-all">
                               {allergy.icon}
                           </span>
                       ) : null;
                   })}
              </div>
            </div>
            <p className="line-clamp-2 text-[11px] font-medium text-slate-400 mt-0.5">{item.description}</p>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="font-black text-emerald-600 tracking-tight">
              {(!itemCategory || itemCategory.isIndividualPricing) 
                ? `€${item.price.toFixed(2)}` 
                : <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{t('customer.included')}</span>}
            </span>
            <button 
              onClick={() => addToCart(item)}
              className="rounded-xl bg-slate-900 p-1.5 text-white shadow-md shadow-slate-200 transition-all active:scale-90 hover:bg-slate-800"
            >
              <Plus size={16} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="mx-auto max-w-md pb-24 shadow-sm min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 p-6 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {siteSettings?.logo && (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm">
                <img src={siteSettings.logo} alt="Logo" className="w-full h-full object-contain p-1" />
              </div>
            )}
            <div>
              <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">
                  {table ? table.name : `Table ${tableId.toString().padStart(2, '0')}`}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">
                {siteSettings?.siteName || 'QRSavour'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 rounded-xl p-1 flex items-center shadow-sm">
                {(['en', 'it'] as Language[]).map(lang => (
                <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    language === lang ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-50"
                    )}
                >
                    {lang}
                </button>
                ))}
            </div>
            <button 
                onClick={() => setIsCartOpen(true)}
                className="group relative rounded-2xl bg-slate-100 p-2.5 text-slate-700 transition-all hover:bg-slate-200 active:scale-95"
            >
                <ShoppingCart size={22} strokeWidth={2.5} />
                {cart.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white shadow-xl">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
                )}
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="mt-8 relative group">
          <button 
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-md border border-slate-100 text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Icons.ChevronLeft size={16} strokeWidth={3} />
          </button>

          <div 
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-1 no-scrollbar px-2"
          >
            {categories
              .filter(cat => {
                  const now = new Date();
                  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
                  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                  if (cat.availableDays && cat.availableDays.length > 0 && !cat.availableDays.includes(currentDay)) return false;
                  if (cat.startTime && cat.endTime) {
                      if (currentTime < cat.startTime || currentTime > cat.endTime) return false;
                  }
                  return true;
              })
              .map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                  <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-black transition-all duration-300",
                      isActive 
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" 
                          : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      )}
                  >
                      {cat.name}
                  </button>
                  );
              })}
          </div>

          <button 
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-md border border-slate-100 text-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Icons.ChevronRight size={16} strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Menu Items */}
      <main className="px-6 py-4">
        <h2 className="mb-6 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
          {categories.find(c => c.id === selectedCategory)?.name || 'Menu'}
        </h2>
        <div className="grid gap-8">
            {(() => {
                const itemsInCategory = menuItems.filter(item => {
                    if (item.visible === false) return false;
                    if (!selectedCategory) return true;
                    if (item.categoryIds && item.categoryIds.includes(selectedCategory)) return true;
                    return item.categoryId === selectedCategory;
                });

                const ungroupedItems = itemsInCategory.filter(i => !i.groupId);
                const groupedItemsMap = itemsInCategory.reduce((acc, item) => {
                    if (item.groupId) {
                        if (!acc[item.groupId]) acc[item.groupId] = [];
                        acc[item.groupId].push(item);
                    }
                    return acc;
                }, {} as Record<string, MenuItem[]>);

                return (
                    <>
                        {/* Ungrouped Items */}
                        {ungroupedItems.length > 0 && (
                            <div className="grid gap-5">
                                {ungroupedItems.map(renderMenuItem)}
                            </div>
                        )}

                        {/* Grouped Sections */}
                        {menuGroups.map(group => {
                            const itemsInGroup = groupedItemsMap[group.id];
                            if (!itemsInGroup || itemsInGroup.length === 0) return null;
                            const isExpanded = expandedGroups.includes(group.id);
                            
                            return (
                                <div key={group.id} className="space-y-4">
                                    <button 
                                        onClick={() => toggleGroupExpansion(group.id)}
                                        className="w-full flex items-center justify-between p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black uppercase tracking-widest">{group.name}</span>
                                            <span className="bg-white/10 px-2 py-0.5 rounded-full text-[9px] font-black">{itemsInGroup.length}</span>
                                        </div>
                                        <Icons.ChevronDown size={18} className={cn("transition-transform duration-300", isExpanded && "rotate-180")} />
                                    </button>

                                    {isExpanded && (
                                        <div className="grid gap-5 animate-in fade-in slide-in-from-top-4 duration-300">
                                            {itemsInGroup.map(renderMenuItem)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                );
            })()}
        </div>
      </main>

      {siteSettings && (
        <footer className="px-6 py-12 border-t border-slate-50 mt-12 bg-slate-50/50">
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">{siteSettings.siteName}</h4>
              <p className="text-xs font-medium text-slate-400 leading-relaxed max-w-[240px]">
                {siteSettings.address}
              </p>
            </div>
            {(siteSettings.contactEmail || siteSettings.contactPhone) && (
                <div className="space-y-1.5">
                    {siteSettings.contactEmail && (
                        <a href={`mailto:${siteSettings.contactEmail}`} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-600 transition-colors">
                            <Icons.Mail size={14} />
                            {siteSettings.contactEmail}
                        </a>
                    )}
                    {siteSettings.contactPhone && (
                        <a href={`tel:${siteSettings.contactPhone}`} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-emerald-600 transition-colors">
                            <Icons.Phone size={14} />
                            {siteSettings.contactPhone}
                        </a>
                    )}
                </div>
            )}
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {siteSettings.footerText}
                </p>
                <div className="w-12 h-0.5 bg-slate-200 rounded-full"></div>
            </div>
          </div>
        </footer>
      )}

      {/* Cart Summary Footer */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-6 pointer-events-none">
          <button
            onClick={() => setIsCartOpen(true)}
            className="mx-auto flex w-full max-w-sm pointer-events-auto items-center justify-between rounded-3xl bg-emerald-600 p-5 text-white shadow-2xl shadow-emerald-200"
          >
            <span className="text-sm font-black uppercase tracking-widest">{cart.reduce((a, b) => a + b.quantity, 0)} {t('nav.orders')}</span>
            <span className="flex items-center gap-2 font-black text-sm">
              {t('customer.yourCart')} {total > 0 && <span className="opacity-60">• €{total.toFixed(2)}</span>}
            </span>
          </button>
        </div>
      )}

        {popupCategory && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md">
                <div 
                    className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl space-y-6 text-center"
                >
                    <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto text-emerald-600">
                        <Icons.Info size={32} />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{popupCategory.name}</h3>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">{t('customer.regulations')}</p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-5 text-sm font-medium text-slate-600 text-left max-h-[30vh] overflow-y-auto leading-relaxed">
                        {popupCategory.conditions}
                    </div>
                    <button 
                        onClick={() => setPopupCategory(null)}
                        className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-100 hover:bg-slate-800 transition-all active:scale-[0.98]"
                    >
                        {t('customer.understand')}
                    </button>
                </div>
            </div>
        )}

        {customizingItem && (() => {
            const itemCategoryIds = customizingItem.categoryIds && customizingItem.categoryIds.length > 0 ? customizingItem.categoryIds : [customizingItem.categoryId];
            const itemCategory = (selectedCategory && itemCategoryIds.includes(selectedCategory)) 
                ? categories.find(c => c.id === selectedCategory)
                : categories.find(c => itemCategoryIds.includes(c.id));
            return (
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div 
                    className="bg-white rounded-t-[3rem] p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
                >
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{customizingItem.name}</h3>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">{t('customer.addToCart')}</p>
                        </div>
                        <button onClick={() => setCustomizingItem(null)} className="p-2 bg-slate-100 rounded-2xl text-slate-400">
                            <Icons.X size={20} />
                        </button>
                    </div>

                    <div className="space-y-8">
                        {customizingItem.customizationCategories?.map(catId => {
                            const cat = customizationCategories.find(c => c.id === catId);
                            if (!cat) return null;
                            const selected = selectedCustomizations[catId] || [];
                            return (
                                <div key={catId} className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-widest text-slate-800">{cat.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                                {cat.minSelection > 0 ? `${t('customer.required')}: ${cat.minSelection}` : t('customer.optional')} 
                                                {cat.maxSelection > 1 ? ` (Max: ${cat.maxSelection})` : ""}
                                            </p>
                                        </div>
                                        {selected.length >= cat.minSelection && selected.length <= cat.maxSelection && selected.length > 0 && (
                                            <span className="text-[10px] font-black text-emerald-500 uppercase">{t('customer.valid')}</span>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        {cat.ingredients
                                            .filter(ing => (customizingItem.selectedIngredientIds || []).includes(ing.id))
                                            .map(ing => (
                                                <button
                                                    key={ing.id}
                                                    onClick={() => toggleCustomization(catId, ing.id, cat.maxSelection)}
                                                    className={cn(
                                                        "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                                                        selected.includes(ing.id)
                                                            ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                                                            : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-white"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                                                            selected.includes(ing.id)
                                                                ? "bg-emerald-500 border-emerald-500 text-white"
                                                                : "bg-white border-slate-200 text-transparent"
                                                        )}>
                                                            <Icons.Check size={12} strokeWidth={4} />
                                                        </div>
                                                        <span className="text-sm font-bold">{ing.name}</span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[10px] font-black uppercase tracking-widest",
                                                        selected.includes(ing.id) ? "text-emerald-400" : "text-slate-400"
                                                    )}>
                                                        {(!itemCategory || itemCategory.isIndividualPricing) && ing.price > 0 
                                                            ? `+€${ing.price.toFixed(2)}` 
                                                            : t('customer.included')}
                                                    </span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-50">
                        <button 
                            onClick={handleConfirmCustomization}
                            className="w-full bg-emerald-600 text-white rounded-[2rem] py-5 font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                        >
                            {t('customer.addToCart')}
                        </button>
                    </div>
                </div>
            </div>
            );
        })()}

        {isCartOpen && (
          <>
            <div
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm"
            />
            <div
              className="fixed inset-x-0 bottom-0 z-[60] mx-auto max-w-md rounded-t-[3rem] bg-white p-8 shadow-2xl"
            >
              <div className="mx-auto mb-8 h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="mb-8 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('customer.yourCart')}</h2>
                <button onClick={() => setIsCartOpen(false)} className="rounded-2xl bg-slate-100 p-2.5 text-slate-500 transition-colors hover:bg-slate-200">
                  <Icons.X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
                {cart.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="font-medium text-slate-400">{t('customer.emptyCart')}</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100 flex items-center justify-center">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <Icons.Ticket size={24} className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-slate-800">{item.name}</h4>
                          {item.selectedIngredients && item.selectedIngredients.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {item.selectedIngredients.map(ing => (
                                    <span key={ing.id} className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                        {ing.name}
                                    </span>
                                ))}
                            </div>
                          )}
                          <p className="text-sm font-black text-emerald-600 mt-1">
                            {item.price > 0 
                              ? `€${item.price.toFixed(2)}` 
                              : <span className="text-[9px] uppercase tracking-widest opacity-60">{t('customer.included')}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-1.5 border border-slate-100">
                          <button 
                            onClick={() => updateQuantity(item.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition-all active:scale-90 hover:text-rose-500"
                          >
                            <Minus size={14} strokeWidth={3} />
                          </button>
                          <span className="w-4 text-center text-xs font-black text-slate-800">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition-all active:scale-90 hover:text-emerald-600"
                          >
                            <Plus size={14} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-10 pt-8 border-t border-slate-50">
                {total > 0 && (
                  <div className="mb-6 flex items-center justify-between font-black text-slate-400 uppercase tracking-widest text-[10px]">
                    <span>{t('customer.total')}</span>
                    <span className="text-lg font-black text-emerald-600 tracking-tight">€{total.toFixed(2)}</span>
                  </div>
                )}
                <button
                  disabled={cart.length === 0}
                  onClick={placeOrder}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-emerald-600 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-100 transition-all active:scale-[0.98] hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t('customer.placeOrder')}
                </button>
                <div className="w-32 h-1.5 bg-slate-100 rounded-full mx-auto mt-8"></div>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
