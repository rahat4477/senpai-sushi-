import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'it';

interface Translations {
  [key: string]: {
    en: string;
    it: string;
  };
}

export const translations: Translations = {
  // Common
  'nav.orders': { en: 'Orders', it: 'Ordini' },
  'nav.menu': { en: 'Menu', it: 'Menu' },
  'nav.tables': { en: 'Tables', it: 'Tavoli' },
  'nav.reports': { en: 'Reports', it: 'Rapporti' },
  'nav.kitchen': { en: 'Kitchen', it: 'Cucina' },
  
  // Kitchen Dashboard
  'kitchen.newOrder': { en: 'New Order', it: 'Nuovo Ordine' },
  'kitchen.preparing': { en: 'Preparing', it: 'In Preparazione' },
  'kitchen.done': { en: 'Done', it: 'Fatto' },
  'kitchen.cancelled': { en: 'Cancelled', it: 'Annullato' },
  'kitchen.pending': { en: 'Pending', it: 'In Attesa' },
  'kitchen.markAsDone': { en: 'Mark as Done', it: 'Segna come Fatto' },
  'kitchen.startPreparing': { en: 'Start Preparing', it: 'Inizia Preparazione' },
  'kitchen.noOrders': { en: 'No active orders', it: 'Nessun ordine attivo' },
  
  // Menu Management
  'menu.addCategory': { en: 'Add Category', it: 'Aggiungi Categoria' },
  'menu.addItem': { en: 'Add New Item', it: 'Aggiungi Nuovo Articolo' },
  'menu.categoryName': { en: 'Category Name', it: 'Nome Categoria' },
  'menu.itemName': { en: 'Item Name', it: 'Nome Articolo' },
  'menu.price': { en: 'Price', it: 'Prezzo' },
  'menu.description': { en: 'Description', it: 'Descrizione' },
  'menu.save': { en: 'Save', it: 'Salva' },
  'menu.cancel': { en: 'Cancel', it: 'Annulla' },
  'menu.edit': { en: 'Edit', it: 'Modifica' },
  'menu.delete': { en: 'Delete', it: 'Elimina' },
  'menu.existingMenus': { en: 'Existing Menus', it: 'Menu Esistenti' },
  'menu.noDishes': { en: 'No dishes yet', it: 'Ancora nessun piatto' },
  'menu.addNewMenu': { en: 'Add New Menu', it: 'Aggiungi Nuovo Menu' },
  'menu.individualPrices': { en: 'Individual Item Prices?', it: 'Prezzi Singoli Articoli?' },
  'menu.entryFee': { en: 'Entry Fee', it: 'Costo d\'ingresso' },
  'menu.popupConditions': { en: 'Popup Conditions?', it: 'Condizioni Popup?' },
  'menu.enterRegulations': { en: 'Enter regulations...', it: 'Inserisci regolamenti...' },
  'menu.popupDisabled': { en: 'Popup disabled', it: 'Popup disabilitato' },
  'menu.availability': { en: 'Availability Scheduling', it: 'Pianificazione Disponibilità' },
  'menu.startTime': { en: 'Start Time', it: 'Ora Inizio' },
  'menu.endTime': { en: 'End Time', it: 'Ora Fine' },
  'menu.availableAllDays': { en: 'Default: Available all days', it: 'Predefinito: Disponibile tutti i giorni' },
  'menu.addNewDish': { en: 'Add New Dish', it: 'Aggiungi Nuovo Piatto' },
  'menu.menuCategories': { en: 'Menu Categories (Multiple)', it: 'Categorie Menu (Multiple)' },
  'menu.dropImage': { en: 'Drop Image', it: 'Rilascia Immagine' },
  'menu.allergyInfo': { en: 'Allergy Info', it: 'Info Allergie' },
  'menu.willCustomization': { en: 'Will there be customization?', it: 'Ci saranno personalizzazioni?' },
  'menu.selectCustomization': { en: 'Select Customization Categories', it: 'Seleziona Categorie Personalizzazione' },
  'menu.availableIngredients': { en: 'Available Ingredients', it: 'Ingredienti Disponibili' },
  'menu.selectAll': { en: 'Select All', it: 'Seleziona Tutto' },
  'menu.deselectAll': { en: 'Deselect All', it: 'Deseleziona Tutto' },
  'menu.noCustomizationsAdded': { en: 'Add customization categories below first', it: 'Aggiungi prima le categorie di personalizzazione sotto' },
  'menu.saveDish': { en: 'Save Dish', it: 'Salva Piatto' },
  'menu.manageAllergies': { en: 'Manage Allergies', it: 'Gestisci Allergie' },
  'menu.noDishesLibrary': { en: 'No dishes in library', it: 'Nessun piatto in libreria' },
  'menu.editDish': { en: 'Edit Dish', it: 'Modifica Piatto' },
  'menu.editMenuSettings': { en: 'Edit Menu Settings', it: 'Modifica Impostazioni Menu' },
  'menu.applyChanges': { en: 'Apply Changes', it: 'Applica Modifiche' },
  'menu.selected': { en: 'selected', it: 'selezionati' },
  'menu.included': { en: 'Included', it: 'Incluso' },
  'menu.confirmDelete': { en: 'Confirm Delete', it: 'Conferma Eliminazione' },
  'menu.deleteWarning': { en: 'Are you sure you want to delete this? This action cannot be undone.', it: 'Sei sicuro di voler eliminare questo elemento? L\'azione non può essere annullata.' },
  'menu.confirmAction': { en: 'Yes, Delete it', it: 'Sì, Elimina' },
  'menu.free': { en: 'Free', it: 'Gratis' },

  // Table Management
  'table.addTable': { en: 'Add New Table', it: 'Aggiungi Nuovo Tavolo' },
  'table.tableName': { en: 'Table Name', it: 'Nome Tavolo' },
  'table.create': { en: 'Create Table', it: 'Crea Tavolo' },
  'table.existing': { en: 'Existing Tables', it: 'Tavoli Esistenti' },
  'table.downloadQr': { en: 'Download QR', it: 'Scarica QR' },
  'table.scanToOrder': { en: 'SCAN TO ORDER', it: 'SCANSIONA PER ORDINARE' },
  'table.statistics': { en: 'Statistics', it: 'Statistiche' },
  'table.totalTables': { en: 'Total Tables', it: 'Tavoli Totali' },
  'table.active': { en: 'Active', it: 'Attivi' },
  'table.ready': { en: 'Ready for Customers', it: 'Pronto per i Clienti' },
  'table.inactive': { en: 'Inactive', it: 'Inattivo' },
  'table.noTables': { en: 'No Tables Registered', it: 'Nessun Tavolo Registrato' },
  'table.addFirst': { en: 'Add your first table to get started', it: 'Aggiungi il tuo primo tavolo per iniziare' },
  'table.table': { en: 'Table', it: 'Tavolo' },
  
  // Customer Menu
  'customer.welcome': { en: 'Welcome', it: 'Benvenuti' },
  'customer.addToCart': { en: 'Add to Cart', it: 'Aggiungi al Carrello' },
  'customer.yourCart': { en: 'Your Cart', it: 'Il Tuo Carrello' },
  'customer.placeOrder': { en: 'Place Order', it: 'Effettua Ordine' },
  'customer.total': { en: 'Total', it: 'Totale' },
  'customer.checkout': { en: 'Checkout', it: 'Cassa' },
  'customer.orderSuccess': { en: 'Order placed successfully!', it: 'Ordine effettuato con successo!' },
  'customer.emptyCart': { en: 'Your cart is empty', it: 'Il tuo carrello è vuoto' },
  'customer.items': { en: 'items', it: 'articoli' },
  'customer.included': { en: 'INCLUDED', it: 'INCLUSO' },
  'customer.understand': { en: 'I Understand', it: 'Ho Capito' },
  'customer.regulations': { en: 'Regulations & Conditions', it: 'Regolamenti e Condizioni' },
  'customer.valid': { en: 'Valid', it: 'Valido' },
  'customer.required': { en: 'Required', it: 'Richiesto' },
  'customer.optional': { en: 'Optional', it: 'Opzionale' },
  'customer.free': { en: 'FREE', it: 'GRATIS' },
  
  // Reports
  'report.performance': { en: 'Sales Performance', it: 'Andamento Vendite' },
  'report.trend': { en: 'Daily revenue trend (Last 7 days)', it: 'Andamento ricavi giornalieri (Ultimi 7 giorni)' },
  'report.distribution': { en: 'Category Distribution', it: 'Distribuzione Categorie' },
  'report.topItems': { en: 'Top Selling Items', it: 'Articoli più Venduti' },
  'report.bigOrders': { en: 'Big Ticket Orders', it: 'Grandi Ordini' },
  'report.revenue': { en: 'Total Revenue', it: 'Entrate Totali' },
  'report.ordersCount': { en: 'Total Orders', it: 'Ordini Totali' },
  'report.avgValue': { en: 'Avg Order Value', it: 'Valore Medio Ordine' },
  'report.activeTables': { en: 'Active Tables', it: 'Tavoli Attivi' },
  'report.sold': { en: 'Sold', it: 'Venduti' },
  'menu.imageLabel': { en: 'Image (Drag & Drop or Click)', it: 'Immagine (Trascina o Clicca)' },
  'order.accept': { en: 'Accept Order', it: 'Accetta Ordine' },
  'order.markDone': { en: 'Mark as Done', it: 'Segna come Completato' },
  'order.waiting': { en: 'Waiting for orders...', it: 'In attesa di ordini...' },
  'order.new': { en: 'New', it: 'Nuovo' },
  'order.activeTickets': { en: 'Active Tickets', it: 'Ticket Attivi' },
  'order.confirmPaid': { en: 'Confirm payment for this table?', it: 'Confermare il pagamento per questo tavolo?' },
  'order.paidSuccess': { en: 'Table marked as paid successfully', it: 'Tavolo segnato come pagato con successo' },
  'order.total': { en: 'Total Amount', it: 'Importo Totale' },
  'order.paid': { en: 'Paid', it: 'Pagato' },
  'order.print': { en: 'Print', it: 'Stampa' },
  'order.todayHistory': { en: "Today's History", it: 'Cronologia Odierna' },
  'system.status': { en: 'System Status', it: 'Stato Sistema' },
  'system.online': { en: 'Online & Syncing', it: 'Online e in Sincronizzazione' },
  'system.log': { en: 'System Event Log', it: 'Log Eventi Sistema' },
  'nav.settings': { en: 'Settings', it: 'Impostazioni' },
  'settings.printer': { en: 'Printer Settings', it: 'Impostazioni Stampante' },
  'settings.staff': { en: 'Staff Management', it: 'Gestione Personale' },
  'settings.system': { en: 'System Update', it: 'Aggiornamento Sistema' },
  'printer.name': { en: 'Printer Name', it: 'Nome Stampante' },
  'printer.ip': { en: 'IP Address', it: 'Indirizzo IP' },
  'printer.port': { en: 'Port', it: 'Porta' },
  'printer.type': { en: 'Printer Type', it: 'Tipo Stampante' },
  'printer.default': { en: 'Default Printer', it: 'Stampante Predefinita' },
  'printer.serialNumber': { en: 'Serial Number', it: 'Numero di Serie' },
  'staff.role': { en: 'Role', it: 'Ruolo' },
  'staff.email': { en: 'Email', it: 'Email' },
  'staff.status': { en: 'Status', it: 'Stato' },
  'system.updateAvailable': { en: 'Update Available', it: 'Aggiornamento Disponibile' },
  'system.checkForUpdates': { en: 'Check for Updates', it: 'Controlla Aggiornamenti' },
  'system.uploadPackage': { en: 'Upload Update Package (.zip / .bin)', it: 'Carica Pacchetto Aggiornamento (.zip / .bin)' },
  'printer.add': { en: 'Add Printer', it: 'Aggiungi Stampante' },
  'staff.add': { en: 'Add Staff', it: 'Aggiungi Personale' },
  'settings.site': { en: 'Site Settings', it: 'Impostazioni Sito' },
  'site.name': { en: 'Site Name', it: 'Nome Sito' },
  'site.logo': { en: 'Site Logo', it: 'Logo Sito' },
  'site.favicon': { en: 'Favicon', it: 'Favicon' },
  'site.email': { en: 'Contact Email', it: 'Email di Contatto' },
  'site.phone': { en: 'Contact Phone', it: 'Telefono di Contatto' },
  'site.address': { en: 'Address', it: 'Indirizzo' },
  'site.footer': { en: 'Footer Text', it: 'Testo Footer' },
  'site.save': { en: 'Save Site Settings', it: 'Salva Impostazioni' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('it');

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
