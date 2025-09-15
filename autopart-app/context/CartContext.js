import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  count: 0,
});

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  // Load persisted cart on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('@cart_items');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (mounted && Array.isArray(parsed)) setItems(parsed);
      } catch (e) {
        // ignore load errors
        console.warn('CartProvider load error', e);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Persist cart whenever items change
  useEffect(() => {
    const save = async () => {
      try {
        await AsyncStorage.setItem('@cart_items', JSON.stringify(items || []));
      } catch (e) {
        console.warn('CartProvider save error', e);
      }
    };
    save();
  }, [items]);

  const addToCart = (product) => {
    // add: if item exists increment qty, else push
    setItems(prev => {
      const idx = prev.findIndex(i => i._id === product._id);
      const addQty = (product.qty && Number(product.qty)) ? Number(product.qty) : 1;
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: (copy[idx].qty || 1) + addQty };
        return copy;
      }
      return [{ ...product, qty: addQty }, ...prev];
    });
  };

  const updateQty = (id, delta) => {
    setItems(prev => {
      const copy = prev.map(i => ({ ...i }));
      const idx = copy.findIndex(i => i._id === id);
      if (idx === -1) return prev;
      const newQty = (copy[idx].qty || 1) + delta;
      if (newQty <= 0) {
        return copy.filter((_, ii) => ii !== idx);
      }
      copy[idx].qty = newQty;
      return copy;
    });
  };

  const removeFromCart = (id) => {
    setItems(prev => prev.filter(i => i._id !== id));
  };

  const clearCart = () => setItems([]);

  // total quantity across all items
  const totalCount = items.reduce((s, it) => s + (it.qty || 1), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, updateQty, removeFromCart, clearCart, count: totalCount }}>
      {children}
    </CartContext.Provider>
  );
};

export default CartContext;
