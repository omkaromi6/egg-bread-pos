"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from './supabase'; 

// ==========================================
// 1. HARDCODED NETWORK CONFIGURATION
// ==========================================
const OUTLETS = [
  { id: 1, name: 'Outlet 1', pass: 'out1@omkar' },
  { id: 2, name: 'Outlet 2', pass: 'out2@omkar' },
  { id: 3, name: 'Outlet 3', pass: 'out3@omkar' },
  { id: 4, name: 'Outlet 4', pass: 'out4@omkar' },
  { id: 5, name: 'Outlet 5', pass: 'out5@omkar' },
  { id: 6, name: 'Outlet 6', pass: 'out6@omkar' },
];

const PROMOTER_PASS = 'master@omkar';

// Recipes aligned precisely with your menu layout names and your table's eggs metric
const MENU_ITEMS = [
  { name: 'Item 1', type: 'STANDALONE ITEM', price: 10, recipe: { ing1: 2, ing2: 1, ing3: 0, waterbottle: 0, box: 1 } },
  { name: 'Item 2', type: 'STANDALONE ITEM', price: 12, recipe: { ing1: 1, ing2: 2, ing3: 0, waterbottle: 0, box: 1 } },
  { name: 'Item 3', type: 'STANDALONE ITEM', price: 15, recipe: { ing1: 2, ing2: 2, ing3: 0, waterbottle: 0, box: 1 } },
  { name: 'Item 4', type: 'STANDALONE ITEM', price: 18, recipe: { ing1: 3, ing2: 1, ing3: 0, waterbottle: 0, box: 1 } },
  { name: 'Item 5', type: 'STANDALONE ITEM', price: 20, recipe: { ing1: 2, ing2: 3, ing3: 0, waterbottle: 0, box: 1 } },
  { name: 'Item 6', type: 'STANDALONE ITEM', price: 25, recipe: { ing1: 4, ing2: 2, ing3: 0, waterbottle: 0, box: 1 } },
  { name: 'Combo 1', type: 'COMBO VARIANT', price: 35, recipe: { ing1: 4, ing2: 3, ing3: 0, waterbottle: 1, box: 2 } },
  { name: 'Combo 2', type: 'COMBO VARIANT', price: 42, recipe: { ing1: 5, ing2: 4, ing3: 0, waterbottle: 1, box: 2 } },
  { name: 'Combo 3', type: 'COMBO VARIANT', price: 50, recipe: { ing1: 6, ing2: 5, ing3: 0, waterbottle: 2, box: 3 } },
  { name: 'Combo 4', type: 'COMBO VARIANT', price: 60, recipe: { ing1: 8, ing2: 6, ing3: 0, waterbottle: 2, box: 4 } },
];

const RAW_ITEMS = ['ing1', 'ing2', 'ing3', 'waterbottle', 'box'];
const INITIAL_BASE_STOCK: Record<string, number> = {
  ing1: 500,
  ing2: 300,
  ing3: 100,
  waterbottle: 100,
  box: 200
};

const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const getTodayDateString = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const getISODateOnly = (date: Date) => date.toISOString().split('T')[0];

export default function OmkarEnterpriseApp() {
  const [session, setSession] = useState<{ type: 'OUTLET' | 'PROMOTER'; id?: number; name: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedOutletId, setSelectedOutletId] = useState<number>(1);
  const [loginError, setLoginError] = useState('');

  const [outletTab, setOutletTab] = useState<'MENU' | 'INVENTORY' | 'RECEIVED' | 'REVENUE'>('MENU');
  const [promoterTab, setPromoterTab] = useState<'OVERVIEW' | 'BRANCH_ITEMS' | 'BRANCH_REVENUE' | 'STOCK_DISPATCH'>('OVERVIEW');

  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [replenishments, setReplenishments] = useState<any[]>([]);

  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [outletDateFrom, setOutletDateFrom] = useState(getISODateOnly(new Date()));
  const [outletDateTo, setOutletDateTo] = useState(getISODateOnly(new Date()));
  
  const [promoterDateFrom, setPromoterDateFrom] = useState(getISODateOnly(new Date(new Date().setDate(new Date().getDate() - 7))));
  const [promoterDateTo, setPromoterDateTo] = useState(getISODateOnly(new Date()));

  const [dispatchOutlet, setDispatchOutlet] = useState<number>(1);
  const [dispatchItem, setDispatchItem] = useState<string>('ing1');
  const [dispatchQty, setDispatchQty] = useState<string>('');
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    fetchData();
    const salesChannel = supabase.channel('sales-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'sales_history' }, () => { fetchData(); }).subscribe();
    const stockChannel = supabase.channel('stock-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_replenishments' }, () => { fetchData(); }).subscribe();
    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(stockChannel);
    };
  }, []);

  const fetchData = async () => {
    const { data: sales } = await supabase.from('sales_history').select('*');
    const { data: reps } = await supabase.from('inventory_replenishments').select('*');
    if (sales) setSalesHistory(sales);
    if (reps) setReplenishments(reps);
  };

  // ==========================================
  // 4. CORE DATA INTERFACES
  // ==========================================
  const handlePunchOrder = async () => {
    if (!session || session.type !== 'OUTLET') return;
    
    const chosenItems = MENU_ITEMS.filter(item => (orderQuantities[item.name] || 0) > 0);
    if (chosenItems.length === 0) {
      alert('Please select quantities for menu items before punching.');
      return;
    }

    setOrderLoading(true);
    const insertions: any[] = [];

    chosenItems.forEach(menuItem => {
      const qty = orderQuantities[menuItem.name] || 0;

      // Aligns precisely with the columns verified from your SQL schema results window
      insertions.push({
        outlet_id: session.id,
        item_name: menuItem.name,
        quantity_sold: qty,
        eggs_consumed: menuItem.recipe.ing1 * qty
      });
    });

    const { error } = await supabase.from('sales_history').insert(insertions);
    setOrderLoading(false);

    if (error) {
      alert(`Order transmission error: ${error.message}`);
    } else {
      setOrderQuantities({});
      alert('Order punched successfully! Real-time screens synchronized.');
      fetchData();
    }
  };

  const handleDispatchStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(dispatchQty);
    if (!qty || qty <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    setDispatchLoading(true);
    const { error } = await supabase.from('inventory_replenishments').insert({
      outlet_id: dispatchOutlet,
      item_name: dispatchItem,
      day_of_month: new Date().getDate(),
      quantity_added: qty
    });
    setDispatchLoading(false);

    if (error) {
      alert(`Dispatch pipeline failed: ${error.message}`);
    } else {
      setDispatchQty('');
      alert(`Successfully dispatched ${qty} units of ${dispatchItem}!`);
      fetchData();
    }
  };

  const handleLogout = () => {
    setSession(null);
    setPasswordInput('');
    setLoginError('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOutletId === 7) {
      if (passwordInput === PROMOTER_PASS) {
        setSession({ type: 'PROMOTER', name: 'Omkar Enterprise Command Center' });
      } else {
        setLoginError('Invalid Administrator Access Password Token.');
      }
    } else {
      const target = OUTLETS.find(o => o.id === selectedOutletId);
      if (target && passwordInput === target.pass) {
        setSession({ type: 'OUTLET', id: target.id, name: target.name });
      } else {
        setLoginError('Terminal Handshake Rejected. Check credentials.');
      }
    }
  };

  // ==========================================
  // 5. CALCULATIONS ENGINE
  // ==========================================
  const calculateMetricsForSet = (filteredSales: any[]) => {
    let revenue = 0;
    let itemsCount = 0;
    const itemVolMap: Record<string, number> = {};
    const itemRevMap: Record<string, number> = {};
    const ordersSet = new Set<string>();

    filteredSales.forEach(row => {
      const menuRef = MENU_ITEMS.find(m => m.name === row.item_name);
      if (menuRef) {
        const itemGross = menuRef.price * row.quantity_sold;
        revenue += itemGross;
        itemsCount += row.quantity_sold;
        
        itemVolMap[row.item_name] = (itemVolMap[row.item_name] || 0) + row.quantity_sold;
        itemRevMap[row.item_name] = (itemRevMap[row.item_name] || 0) + itemGross;
        
        if (row.created_at) {
          ordersSet.add(`${row.outlet_id}-${row.created_at}`);
        }
      }
    });

    let topPerf = 'None';
    let topVol = 0;
    let leastPerf = 'None';
    let leastVol = Infinity;

    let highestRevItem = 'None';
    let highestRevVal = 0;
    let lowestRevItem = 'None';
    let lowestRevVal = Infinity;

    MENU_ITEMS.forEach(m => {
      const v = itemVolMap[m.name] || 0;
      const r = itemRevMap[m.name] || 0;

      if (v > topVol) { topVol = v; topPerf = `${m.name} (${v} units)`; }
      if (v > 0 && v < leastVol) { leastVol = v; leastPerf = `${m.name} (${v} units)`; }

      if (r > highestRevVal) { highestRevVal = r; highestRevItem = `${m.name} (${formatCurrency(r)})`; }
      if (r > 0 && r < lowestRevVal) { lowestRevVal = r; lowestRevItem = `${m.name} (${formatCurrency(r)})`; }
    });

    return {
      revenue,
      orderCount: ordersSet.size,
      itemsCount,
      topPerf,
      leastPerf: leastPerf === 'None' || leastVol === Infinity ? 'None' : leastPerf,
      highestRevItem,
      lowestRevItem: lowestRevItem === 'None' || lowestRevVal === Infinity ? 'None' : lowestRevItem,
      itemVolMap,
      itemRevMap
    };
  };

  const todayISO = getISODateOnly(new Date());
  const todaySalesData = salesHistory.filter(s => getISODateOnly(new Date(s.created_at)) === todayISO);

  const liveNetworkMetrics = calculateMetricsForSet(todaySalesData);
  const liveOutletMetrics = calculateMetricsForSet(todaySalesData.filter(s => s.outlet_id === session?.id));

  const filterByRange = (data: any[], from: string, to: string, outletId?: number) => {
    return data.filter(d => {
      const dStr = getISODateOnly(new Date(d.created_at));
      const matchDate = dStr >= from && dStr <= to;
      return outletId ? matchDate && d.outlet_id === outletId : matchDate;
    });
  };

  // ==========================================
  // 6. DASHBOARD INTERFACE LAYERS
  // ==========================================
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" style={{ fontFamily: 'monospace' }}>
        <div className="w-full max-w-md bg-slate-900 border border-cyan-500/30 rounded-lg p-6 shadow-2xl shadow-cyan-500/10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 uppercase">Omkar Enterprise Gateway</h1>
            <p className="text-xs text-slate-400 mt-2">SECURE PORTAL MANAGEMENT ACCESS NODE</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Select Access Node</label>
              <select value={selectedOutletId} onChange={(e) => setSelectedOutletId(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500">
                {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name} Retail Desk</option>)}
                <option value={7}>👑 Promoter Operations Command Center</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Security Authorization Lock</label>
              <input type="password" placeholder="••••••••" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-700"/>
            </div>

            {loginError && <p className="text-xs text-rose-500 font-bold bg-rose-950/30 border border-rose-500/40 rounded p-2 text-center">{loginError}</p>}

            <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-bold uppercase py-2.5 rounded tracking-widest shadow-lg transition">Establish Uplink</button>
          </form>
        </div>
      </div>
    );
  }

  if (session.type === 'OUTLET') {
    const outletSalesRaw = salesHistory.filter(s => s.outlet_id === session.id);
    const outletReps = replenishments.filter(r => r.outlet_id === session.id);

    const computedInventory = RAW_ITEMS.map(itemName => {
      const base = INITIAL_BASE_STOCK[itemName] || 0;
      const sent = outletReps.filter(r => r.item_name === itemName).reduce((acc, curr) => acc + Number(curr.quantity_added), 0);
      
      let used = 0;
      outletSalesRaw.forEach(row => {
        if (itemName === 'ing1') used += Number(row.eggs_consumed || 0);
        // Fallbacks for simulated secondary items inside the client application view wrapper
        if (itemName === 'ing2') used += Number(row.quantity_sold * 1 || 0);
        if (itemName === 'box') used += Number(row.quantity_sold * 1 || 0);
      });

      return { itemName, available: base + sent - used };
    });

    const rangeOutletSales = filterByRange(salesHistory, outletDateFrom, outletDateTo, session.id);
    const rangeOutletMetrics = calculateMetricsForSet(rangeOutletSales);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" style={{ fontFamily: 'monospace' }}>
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <h2 className="text-lg font-bold tracking-wider text-slate-200 uppercase">{session.name} Live Terminal</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{getTodayDateString()}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full md:w-auto text-center">
              <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Today Revenue</p>
                <p className="text-sm font-bold text-emerald-400">{formatCurrency(liveOutletMetrics.revenue)}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Today Top Performer</p>
                <p className="text-sm font-bold text-amber-400 truncate max-w-[140px]">{liveOutletMetrics.topPerf.split(' (')[0]}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Order Count</p>
                <p className="text-sm font-bold text-cyan-400">{liveOutletMetrics.orderCount} checks</p>
              </div>
              <button onClick={handleLogout} className="col-span-2 sm:col-span-1 border border-rose-500/30 bg-rose-950/20 text-rose-400 hover:bg-rose-500 hover:text-white px-4 py-2 rounded text-xs font-bold uppercase transition tracking-wider self-center">Logout</button>
            </div>
          </div>
        </header>

        <div className="bg-slate-900 border-b border-slate-800 px-4">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: 'MENU', label: 'Menu To Sell / Punch Order' },
              { id: 'INVENTORY', label: 'Live Inventory Blueprint' },
              { id: 'RECEIVED', label: 'Received Stock History' },
              { id: 'REVENUE', label: 'Revenue & Item Breakdown' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setOutletTab(tab.id as any)} className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 whitespace-nowrap transition ${outletTab === tab.id ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{tab.label}</button>
            ))}
          </div>
        </div>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4">
          {outletTab === 'MENU' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Interactive Menu Dissection Matrix</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MENU_ITEMS.map(item => (
                    <div key={item.name} className="bg-slate-950 border border-slate-800 rounded p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5 tracking-wider">{item.type}</p>
                        <p className="text-xs font-bold text-cyan-400 mt-1">{formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded p-1">
                        <button onClick={() => setOrderQuantities(p => ({ ...p, [item.name]: Math.max(0, (p[item.name] || 0) - 1) }))} className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-300">-</button>
                        <span className="w-8 text-center text-sm font-bold text-slate-200">{orderQuantities[item.name] || 0}</span>
                        <button onClick={() => setOrderQuantities(p => ({ ...p, [item.name]: (p[item.name] || 0) + 1 }))} className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-300">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handlePunchOrder} disabled={orderLoading} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold tracking-widest text-sm uppercase px-8 py-3 rounded-lg shadow-xl transition disabled:opacity-50">{orderLoading ? 'TRANSMITTING ORDER...' : '⚡ Punch Order Check'}</button>
              </div>
            </div>
          )}

          {outletTab === 'INVENTORY' && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-hidden">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">View-Only Fluid Material Stock Balanced Logs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-950/40">
                      <th className="p-3">Raw Material Item Variant</th>
                      <th className="p-3">Calculation Mechanics Formula</th>
                      <th className="p-3 text-right">Available Stock Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {computedInventory.map(row => (
                      <tr key={row.itemName} className="hover:bg-slate-950/20">
                        <td className="p-3 font-bold text-slate-300">{row.itemName}</td>
                        <td className="p-3 text-xs text-slate-500">Initial Base Stock + Dispatched Supplies (From Promoter Dashboard) - Ingredient Usage Log</td>
                        <td className={`p-3 text-right font-bold ${row.available < 50 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>{row.available.toLocaleString()} units</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {outletTab === 'RECEIVED' && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Automated Received Stock Supply History Ledger</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-950/40">
                      <th className="p-3">Date / Timestamp Log</th>
                      <th className="p-3">Item Variant Name</th>
                      <th className="p-3 text-right">Volume Dispatched Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {outletReps.length === 0 ? (
                      <tr><td colSpan={3} className="p-4 text-center text-xs text-slate-500">No incoming supply dispatches recorded from the Promoter yet.</td></tr>
                    ) : (
                      [...outletReps].reverse().map(rep => (
                        <tr key={rep.id} className="hover:bg-slate-950/20">
                          <td className="p-3 text-xs text-slate-400">{new Date(rep.created_at).toLocaleString()}</td>
                          <td className="p-3 font-bold text-slate-300">{rep.item_name}</td>
                          <td className="p-3 text-right font-bold text-cyan-400">+{rep.quantity_added} units</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {outletTab === 'REVENUE' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Custom Date Boundaries Scope</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Recalculates financials and volumes independently for this period</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={outletDateFrom} onChange={(e) => setOutletDateFrom(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none"/>
                  <span className="text-xs text-slate-500 font-bold">TO</span>
                  <input type="date" value={outletDateTo} onChange={(e) => setOutletDateTo(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none"/>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Period Total Revenue</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(rangeOutletMetrics.revenue)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">🏆 Top Performer For Selected Period</p>
                  <p className="text-sm font-bold text-amber-400 mt-2">{rangeOutletMetrics.topPerf}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Period Order Volume Count</p>
                  <p className="text-2xl font-bold text-cyan-400">{rangeOutletMetrics.orderCount} checks</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Itemized Sales Dissection Sheet</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-950/40">
                        <th className="p-3">Product Menu Variant</th>
                        <th className="p-3">Structure Classification</th>
                        <th className="p-3">Price Tag</th>
                        <th className="p-3 text-center">Units Sold Volume</th>
                        <th className="p-3 text-right">Total Earned Gross Cash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {MENU_ITEMS.map(item => {
                        const volume = rangeOutletMetrics.itemVolMap[item.name] || 0;
                        const totalGross = rangeOutletMetrics.itemRevMap[item.name] || 0;
                        return (
                          <tr key={item.name} className="hover:bg-slate-950/20">
                            <td className="p-3 font-bold text-slate-300">{item.name}</td>
                            <td className="p-3 text-xs text-slate-500 font-bold tracking-wider">{item.type}</td>
                            <td className="p-3 text-xs text-slate-400 font-bold">{formatCurrency(item.price)}</td>
                            <td className="p-3 text-center text-slate-200 font-bold">{volume} units</td>
                            <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(totalGross)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (session.type === 'PROMOTER') {
    const rangeNetworkSales = filterByRange(salesHistory, promoterDateFrom, promoterDateTo);
    const rangeNetworkMetrics = calculateMetricsForSet(rangeNetworkSales);

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col" style={{ fontFamily: 'monospace' }}>
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-lg font-bold tracking-widest text-orange-500 uppercase flex items-center gap-2">👑 Omkar Enterprise Command Dashboard</h1>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5">GLOBAL REAL-TIME INTEGRATED NETWORK HUB</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto text-center">
              <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
                <p className="text-[9px] text-slate-500 uppercase font-bold">Today Revenue (All 6)</p>
                <p className="text-sm font-bold text-emerald-400">{formatCurrency(liveNetworkMetrics.revenue)}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
                <p className="text-[9px] text-slate-500 uppercase font-bold">Top Performer Today</p>
                <p className="text-sm font-bold text-amber-400 truncate max-w-[140px]">{liveNetworkMetrics.topPerf.split(' (')[0]}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5">
                <p className="text-[9px] text-slate-500 uppercase font-bold">Order Count (All 6)</p>
                <p className="text-sm font-bold text-cyan-400">{liveNetworkMetrics.orderCount} checks</p>
              </div>
              <button onClick={handleLogout} className="border border-rose-500/30 bg-rose-950/20 text-rose-400 hover:bg-rose-500 hover:text-white px-4 py-1.5 rounded text-xs font-bold uppercase transition tracking-wider self-center">Logout</button>
            </div>
          </div>
        </header>

        <div className="bg-slate-900 border-b border-slate-800 px-4">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: 'OVERVIEW', label: '📊 Network Overview' },
              { id: 'BRANCH_ITEMS', label: '📦 Branch-by-Branch Matrix (Items)' },
              { id: 'BRANCH_REVENUE', label: '💰 Revenue Matrix (Financials)' },
              { id: 'STOCK_DISPATCH', label: '🚀 Stock Dispatched' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setPromoterTab(tab.id as any)} className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 whitespace-nowrap transition ${promoterTab === tab.id ? 'border-orange-500 text-orange-400 bg-orange-950/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>{tab.label}</button>
            ))}
          </div>
        </div>

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-6">
          {promoterTab !== 'STOCK_DISPATCH' && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">Network Analytics Audit Filter</h3>
                <p className="text-[11px] text-slate-500 mt-1">Controls calculations across global network sheets simultaneously</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="date" value={promoterDateFrom} onChange={(e) => setPromoterDateFrom(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none"/>
                <span className="text-xs text-slate-500 font-bold">TO</span>
                <input type="date" value={promoterDateTo} onChange={(e) => setPromoterDateTo(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:outline-none"/>
              </div>
            </div>
          )}

          {promoterTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Combined Period Network Revenue</p>
                  <p className="text-2xl font-bold text-emerald-400">{formatCurrency(rangeNetworkMetrics.revenue)}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Combined Period Network Orders</p>
                  <p className="text-2xl font-bold text-cyan-400">{rangeNetworkMetrics.orderCount} checks done</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Combined Period Network Units Sold</p>
                  <p className="text-2xl font-bold text-orange-400">{rangeNetworkMetrics.itemsCount} units</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Global Menu & Combo Dissection Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-950/40">
                        <th className="p-3">Product Menu Variant</th>
                        <th className="p-3">Structure Classification</th>
                        <th className="p-3">Price Tag</th>
                        <th className="p-3 text-center">Network Combined Sales Volume</th>
                        <th className="p-3 text-right">Network Total Earned Gross</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {MENU_ITEMS.map(item => {
                        const volume = rangeNetworkMetrics.itemVolMap[item.name] || 0;
                        const totalGross = rangeNetworkMetrics.itemRevMap[item.name] || 0;
                        return (
                          <tr key={item.name} className="hover:bg-slate-950/20">
                            <td className="p-3 font-bold text-slate-300">{item.name}</td>
                            <td className="p-3 text-xs text-slate-500 font-bold tracking-wider">{item.type}</td>
                            <td className="p-3 text-xs text-slate-400 font-bold">{formatCurrency(item.price)}</td>
                            <td className="p-3 text-center text-slate-200 font-bold">{volume} units</td>
                            <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(totalGross)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {promoterTab === 'BRANCH_ITEMS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {OUTLETS.map(outlet => {
                const outletSales = filterByRange(salesHistory, promoterDateFrom, promoterDateTo, outlet.id);
                const metrics = calculateMetricsForSet(outletSales);
                return (
                  <div key={outlet.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <div className="border-b border-slate-800 pb-2 mb-3 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-200 uppercase">{outlet.name} Item Quantities</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-400">{metrics.orderCount} checks</span>
                      </div>
                      <div className="bg-slate-950 border border-slate-800/60 rounded p-2 mb-3 space-y-1 text-[11px]">
                        <p className="text-slate-400 font-bold truncate">🏆 Top Volume: <span className="text-amber-400">{metrics.topPerf}</span></p>
                        <p className="text-slate-400 font-bold truncate">📉 Least Volume: <span className="text-rose-400">{metrics.leastPerf}</span></p>
                      </div>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {MENU_ITEMS.map(item => (
                          <div key={item.name} className="flex justify-between items-center text-xs bg-slate-950/40 p-1.5 border border-slate-800/40 rounded">
                            <span className="text-slate-400">{item.name}</span>
                            <span className="font-bold text-slate-200">{metrics.itemVolMap[item.name] || 0} units</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {promoterTab === 'BRANCH_REVENUE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {OUTLETS.map(outlet => {
                const outletSales = filterByRange(salesHistory, promoterDateFrom, promoterDateTo, outlet.id);
                const metrics = calculateMetricsForSet(outletSales);
                return (
                  <div key={outlet.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                    <div>
                      <div className="border-b border-slate-800 pb-2 mb-3 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase">{outlet.name} Revenue Matrix</h3>
                        <span className="text-sm font-bold text-emerald-400">{formatCurrency(metrics.revenue)}</span>
                      </div>
                      <div className="bg-slate-950 border border-slate-800/60 rounded p-2 mb-3 space-y-1 text-[11px]">
                        <p className="text-slate-400 font-bold truncate">💰 Highest Cash: <span className="text-emerald-400">{metrics.highestRevItem}</span></p>
                        <p className="text-slate-400 font-bold truncate">📉 Lowest Cash: <span className="text-rose-400">{metrics.lowestRevItem}</span></p>
                      </div>
                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                        {MENU_ITEMS.map(item => (
                          <div key={item.name} className="flex justify-between items-center text-xs bg-slate-950/40 p-1.5 border border-slate-800/40 rounded">
                            <span className="text-slate-400">{item.name}</span>
                            <span className="font-bold text-emerald-400">{formatCurrency(metrics.itemRevMap[item.name] || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {promoterTab === 'STOCK_DISPATCH' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 h-fit">
                <h3 className="text-xs font-bold uppercase text-orange-400 tracking-widest mb-4">Material Supply Dispatch Desk</h3>
                <form onSubmit={handleDispatchStock} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Target Destination Link</label>
                    <select value={dispatchOutlet} onChange={(e) => setDispatchOutlet(parseInt(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500">
                      {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Raw Material Selection</label>
                    <select value={dispatchItem} onChange={(e) => setDispatchItem(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500">
                      {RAW_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Quantitative Dispatch Amount</label>
                    <input type="number" placeholder="Enter mass units" value={dispatchQty} onChange={(e) => setDispatchQty(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"/>
                  </div>
                  <button type="submit" disabled={dispatchLoading} className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold py-2.5 rounded text-xs uppercase tracking-widest shadow-lg transition disabled:opacity-50">
                    {dispatchLoading ? 'DISPATCHING CARGO BALANCES...' : '🚀 Dispatch Stock'}
                  </button>
                </form>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-4">Stock Dispatched Master Balance Log Spreadsheet</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-950/40">
                        <th className="p-3">Dispatch Timestamp</th>
                        <th className="p-3">Destination Node</th>
                        <th className="p-3">Material Variant</th>
                        <th className="p-3 text-right">Volume Dispatched Sent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {replenishments.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-slate-500">No central supply chains dispatched in database archives.</td></tr>
                      ) : (
                        [...replenishments].reverse().map(rep => {
                          const targetOutlet = OUTLETS.find(o => o.id === rep.outlet_id);
                          return (
                            <tr key={rep.id} className="hover:bg-slate-950/20">
                              <td className="p-3 text-slate-400">{new Date(rep.created_at).toLocaleString()}</td>
                              <td className="p-3 font-bold text-slate-300 uppercase">{targetOutlet ? targetOutlet.name : `Outlet ${rep.outlet_id}`}</td>
                              <td className="p-3 font-bold text-slate-300">{rep.item_name}</td>
                              <td className="p-3 text-right font-bold text-orange-400">+{rep.quantity_added} units</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }
}