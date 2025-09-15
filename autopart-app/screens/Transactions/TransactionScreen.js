// หน้าจอจัดการคำสั่งซื้อ / ตะกร้า: แสดงรายการในตะกร้า ปรับจำนวน และส่งทรานแซคชันไปยัง backend
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { Switch } from 'react-native';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, ScrollView, TextInput, Platform, Dimensions, Modal, TouchableWithoutFeedback } from 'react-native';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import CartContext from '../../context/CartContext';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import assetsIndex from '../../assets/assetsIndex';

// Local frontend currency formatter (USD)
const formatUSD = (value) => {
  try {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  } catch (e) {
    return `$${value}`;
  }
};

const TransactionScreen = ({ route, navigation }) => {
  const { user, token } = useContext(AuthContext);

  // derive API base similar to other screens so device/emulator can reach dev server
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  // cart can be passed via route.params.cart (array of { productId/product/_id, name, price, quantity, stock, image })
  const cartCtx = useContext(CartContext);
  const isRouteCart = Boolean((route && (route.params && (route.params.cart || route.params.products))));

  const makeNormalized = (initialArr) => (initialArr || []).map((it) => {
    if (!it) return null;
    const product = (it.product || it.productId || it);
    const id = product._id || product.id || product.productId || product.product_id || product;
    return {
      id,
      name: product.name || product.title || (product.productName || 'Unnamed'),
      price: Number(product.price || product.salePrice || product.unitPrice || 0) || 0,
      quantity: Number(it.quantity || product.quantity || it.qty || product.qty || 1) || 1,
      stock: typeof product.stock !== 'undefined' ? Number(product.stock) : undefined,
      image: product.imageUrl || product.image || product.imageFilename || product.imageKey || null,
    };
  }).filter(Boolean);

  const initial = isRouteCart ? (route?.params?.cart || route?.params?.products || []) : (cartCtx.items || []);
  const [cart, setCart] = useState(() => makeNormalized(initial));
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener?.('change', ({ window }) => setWidth(window.width));
    return () => { try { sub?.remove?.(); } catch (e) {} };
  }, []);
  // Shipping & payment state
  const [address, setAddress] = useState({ fullName: '', line1: '', line2: '', city: '', postalCode: '', country: '' });
  const [paymentMethod, setPaymentMethod] = useState('mastercard');
  const [paymentType, setPaymentType] = useState('card'); // 'card' | 'paypal'
  const [cardBrand, setCardBrand] = useState(null);

  // form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [apt, setApt] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [zip, setZip] = useState('');
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // inline edit handlers will reuse these states: editing/editingId and editingPayment/editingPaymentId

  // payment method state
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [payment, setPayment] = useState(null); // currently selected/summarized payment info for UI
  const [paymentMethods, setPaymentMethods] = useState([]); // list from backend
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);

  // payment form fields
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  // removed saveCard preference state (persisting saved-card preference removed)
  const [cardValid, setCardValid] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);
  // UI state for selected payment method (card / paypal)
  const [method, setMethod] = useState('card');
  // Expiration pickers
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [yearPickerVisible, setYearPickerVisible] = useState(false);
  // delete confirmation modal
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [processingModalVisible, setProcessingModalVisible] = useState(false);

  const months = Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1).padStart(2, '0'), label: String(i + 1).padStart(2, '0') }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => ({ key: String(currentYear + i), label: String(currentYear + i) }));

  const loadAddresses = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setAddresses([]); return;
      }
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/users/shipping`, { headers });
      if (res.ok) {
        const j = await res.json();
        setAddresses(j.data?.addresses || []);
      } else {
        setAddresses([]);
      }
    } catch (err) {
      console.warn('Load addresses failed', err); setAddresses([]);
    } finally { setLoading(false); }
  };

  // helper: detect card brand
  const detectCardBrand = (num) => {
    if (!num) return '';
    const n = num.replace(/\s+/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'MasterCard';
    if (/^3[47]/.test(n)) return 'American Express';
    if (/^6/.test(n)) return 'Discover';
    return '';
  };

  // update selected brand whenever cardNumber changes
  useEffect(() => {
    const b = detectCardBrand(cardNumber); 
    if (b) setSelectedBrand(b);
  }, [cardNumber]);

  // handle card number input: allow only digits, max 16 digits, format with spaces every 4
  const handleCardNumberChange = (txt) => {
    const digits = (txt || '').replace(/\D+/g, '').slice(0, 16); // max 16 digits
    const parts = digits.match(/.{1,4}/g) || [];
    const formatted = parts.join(' ');
    setCardNumber(formatted);
    // No inline Luhn validation while typing — validation occurs on Save
  };

  const cancelPaymentEdit = () => { setEditingPayment(false); setEditingPaymentId(null); };

  const startEditPayment = (p) => {
    if (!p) {
      setEditingPayment(true); setEditingPaymentId(null);
      setCardNumber(''); setExpMonth(''); setExpYear(''); setCvv('');
      return;
    }
    setEditingPayment(true); setEditingPaymentId(p._id || p.id || null);
    // p may contain masked number and exp
    setCardNumber(p.cardNumberMasked ? `•••• ${p.cardNumberMasked}` : (p.cardNumberMasked || p.last4 || ''));
    setExpMonth(p.expMonth || p.exp_month || ''); setExpYear(p.expYear || p.exp_year || ''); setCvv('');
  };

  const startEdit = (a) => {
    if (!a) {
      setEditing(true); setEditingId(null);
      setFirstName(''); setLastName(''); setStreet(''); setApt(''); setDistrict(''); setProvince(''); setZip('');
      return;
    }
    setEditing(true); setEditingId(a._id || a.id || null);
    setFirstName(a.firstName || a.fullName || ''); setLastName(a.lastName || ''); setStreet(a.street || a.line1 || ''); setApt(a.apt || a.line2 || ''); setDistrict(a.district || ''); setProvince(a.province || ''); setZip(a.zip || a.postalCode || '');
  };

  const cancelEdit = () => { setEditing(false); setEditingId(null); };

  const saveAddress = async () => {
    if (!firstName || !street || !district) return Alert.alert('กรุณากรอกข้อมูลที่จำเป็น', 'กรุณากรอกชื่อ ที่อยู่ และอำเภอ/เขต');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return Alert.alert('Not authenticated', 'Please login first');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const body = { firstName, lastName, street, apt, district, province, zip };
      let res;
      if (editingId) {
        res = await fetch(`${API_BASE}/api/users/shipping/${editingId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      } else {
        res = await fetch(`${API_BASE}/api/users/shipping`, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      if (!res.ok) {
        const e = await res.json().catch(()=>({ message: 'Unknown' }));
        return Alert.alert('Failed', e.message || 'Save failed');
      }
      await loadAddresses(); setEditing(false); setEditingId(null); Alert.alert('Saved', 'Address saved');
    } catch (err) { console.error('Save failed', err); Alert.alert('Error', 'Save failed'); }
  };

  // load payment methods (try backend first, fall back to local storage)
  const loadPayment = async () => {
    try {
      setPaymentLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const r = await fetch(`${API_BASE}/api/users/payment-methods`, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const j = await r.json().catch(() => null);
            // server typically returns: { success: true, data: { paymentMethods: [...] } }
            let list = [];
            if (j) {
              if (Array.isArray(j)) list = j;
              else if (j.data && Array.isArray(j.data.paymentMethods)) list = j.data.paymentMethods;
              else if (Array.isArray(j.paymentMethods)) list = j.paymentMethods;
              else if (Array.isArray(j.data?.payment)) list = j.data.payment;
            }
            setPaymentMethods(list || []);
            // try to restore previously selected payment id (or pick first from DB)
            const savedPaymentId = await AsyncStorage.getItem('@payment_method');
            const pick = (savedPaymentId && list && list.find && list.find(p => (p._id || p.id || p.paymentId || '') === savedPaymentId)) || list[0];
            if (pick) {
              const local = { cardBrand: pick.brand || pick.cardBrand || '', cardNumberMasked: pick.last4 || pick.cardNumberMasked || '', expMonth: pick.expMonth || pick.exp_month || expMonth, expYear: pick.expYear || pick.exp_year || expYear };
              setPayment(local);
              setSelectedPaymentId(pick._id || pick.id || pick.paymentId || null);
              return;
            }
          }
        } catch (e) {
          // ignore backend errors and fall back to local
        }
      }
      const raw = await AsyncStorage.getItem('@saved_payment');
      if (raw) {
        const obj = JSON.parse(raw);
        setPayment(obj);
      }
    } catch (e) {
      // ignore
    } finally {
      setPaymentLoading(false);
    }
  };

  // helper: unify payment info for display — prefer backend DB object (single object) as source of truth
  const getPaymentInfo = () => {
    // If backend returned any payment methods, prefer the first (server enforces single object per account)
    if (paymentMethods && paymentMethods.length) {
      const f = paymentMethods[0];
      const brand = f.brand || f.cardBrand || 'local';
      const last4 = (f.last4 || f.cardNumberMasked || '').toString() || '••••';
      const expMonth = f.expMonth || f.exp_month || f.expiryMonth || '';
      const expYear = f.expYear || f.exp_year || f.expiryYear || '';
      return { brand, last4, expMonth, expYear };
    }

    // Fallback to local saved `payment` (used when offline or before saving to DB)
    if (payment) {
      const brand = payment.cardBrand || payment.brand || 'local';
      const last4 = (payment.cardNumberMasked || payment.last4 || '').toString() || '••••';
      const expMonth = payment.expMonth || payment.exp_month || '';
      const expYear = payment.expYear || payment.exp_year || '';
      return { brand, last4, expMonth, expYear };
    }

    return { brand: 'local', last4: '••••', expMonth: '', expYear: '' };
  };

  // select an address from loaded addresses and persist selection
  const selectAddress = async (addr) => {
    try {
      setAddress(addr);
      const id = addr._id || addr.id || addr.addressId || null;
      if (id) setSelectedAddressId(id);
      await AsyncStorage.setItem('@shipping_destination', JSON.stringify(addr));
      // also update form fields
      if (addr.fullName) setFirstName(addr.fullName);
      if (addr.postalCode) setZip(addr.postalCode);
    } catch (e) { console.warn('Select address failed', e); }
  };

  // select a payment method and persist selection (store id in @payment_method)
  const selectPayment = async (pm) => {
    try {
      const id = pm._id || pm.id || pm.paymentId || null;
      setSelectedPaymentId(id);
      const local = { cardBrand: pm.brand || pm.cardBrand || '', cardNumberMasked: pm.last4 || pm.cardNumberMasked || '', expMonth: pm.expMonth || pm.exp_month || expMonth, expYear: pm.expYear || pm.exp_year || expYear };
      setPayment(local);
      if (id) {
        // persist the payment method id (not a UI label) so receipts and order payloads use stable ids
        await AsyncStorage.setItem('@payment_method', String(id));
      } else {
        // store a small local summary when no backend id is available
        await AsyncStorage.setItem('@saved_payment', JSON.stringify(local));
      }
    } catch (e) { console.warn('Select payment failed', e); }
  };

  const savePayment = async () => {
    const digitsOnly = (cardNumber || '').replace(/\s+/g, '');
    // use expMonth/expYear from state
    if (!digitsOnly || !expMonth || !expYear || !cvv) return Alert.alert('กรุณากรอกข้อมูลบัตร', 'กรุณากรอกหมายเลขบัตร วันหมดอายุ และ CVV');
    if (digitsOnly.length !== 16) return Alert.alert('Invalid card number', 'Card number must be exactly 16 digits');
    if (!/^[0-9]{3}$/.test(cvv)) return Alert.alert('Invalid CVV', 'CVV must be exactly 3 digits');
    try {
      setPaymentSaving(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) { setPaymentSaving(false); return Alert.alert('Not authenticated', 'Please login first'); }
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      let res;
      // Determine if we should update an existing payment method or create a new one
      const existingId = editingPaymentId || selectedPaymentId || (paymentMethods && paymentMethods.length ? (paymentMethods[0]._id || paymentMethods[0].id || null) : null);
      // Backend expects tokenized provider data at /api/users/payment-methods
      if (existingId) {
        // update metadata-only fields
        const allowed = { brand: detectCardBrand(cardNumber), last4: digitsOnly.slice(-4), expMonth: Number(expMonth), expYear: Number(expYear) };
        // server ignores unknown fields
        res = await fetch(`${API_BASE}/api/users/payment-methods/${existingId}`, { method: 'PUT', headers, body: JSON.stringify(allowed) });
      } else {
        // create new payment method
        const brandToSend = selectedBrand || detectCardBrand(cardNumber) || 'card';
        const payload = { provider: 'local', token: 'tok_local_123', brand: brandToSend, last4: digitsOnly.slice(-4), expMonth: Number(expMonth), expYear: Number(expYear) };
        res = await fetch(`${API_BASE}/api/users/payment-methods`, { method: 'POST', headers, body: JSON.stringify(payload) });
      }
      if (!res.ok) {
        const e = await res.json().catch(()=>({ message: 'Unknown' }));
        setPaymentSaving(false);
        Alert.alert('Failed', e.message || 'Save failed');
        return false;
      }
      // parse response body to update local selection if backend returned the payment method
      const j = await res.json().catch(() => null);
      // Update local payment state immediately so inputs hide and summary shows like Billing info
      const last4 = digitsOnly.slice(-4);
      const brand = detectCardBrand(cardNumber);
      const localPayment = { cardBrand: brand, cardNumberMasked: last4, expMonth: Number(expMonth), expYear: Number(expYear) };
      setPayment(localPayment);
      // If backend returned a payment method object, set the selected payment id
      const returnedPm = j && (j.data?.paymentMethod || j.data?.paymentMethod || j.data || null);
      if (returnedPm) {
        const idFromResp = returnedPm._id || returnedPm.id || returnedPm.paymentId || null;
        if (idFromResp) setSelectedPaymentId(idFromResp);
      }
      // Clear editing flags
      setEditingPayment(false);
      setEditingPaymentId(null);
      // clear sensitive fields
      setCardNumber(''); setCvv('');
      // try to refresh from backend but don't rely on it for UI
      loadPayment().catch(()=>{});
      setPaymentSaving(false);
      Alert.alert('Saved', 'Payment saved');
      return true;
    } catch (err) { console.error('Save payment failed', err); Alert.alert('Error', 'Save failed'); }
    setPaymentSaving(false);
    return false;
  };

  // show delete confirmation modal
  const handleDeletePayment = (pmId) => {
    if (!pmId) return Alert.alert('Not found', 'No payment method id provided');
    setConfirmDeleteId(pmId);
    setConfirmDeleteVisible(true);
  };

  const performDeletePayment = async () => {
    const pmId = confirmDeleteId;
    setConfirmDeleteVisible(false);
    if (!pmId) return Alert.alert('Not found', 'No payment method id provided');
    try {
      setPaymentLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) { setPaymentLoading(false); return Alert.alert('Not authenticated', 'Please login first'); }
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch(`${API_BASE}/api/users/payment-methods/${pmId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: 'Unknown' }));
        setPaymentLoading(false);
        return Alert.alert('Failed', e.message || 'Delete failed');
      }
      setPayment(null);
      setSelectedPaymentId(null);
      await loadPayment();
      Alert.alert('Deleted', 'Payment method removed');
    } catch (err) {
      console.error('Delete payment failed', err);
      Alert.alert('Error', 'Delete failed');
    } finally {
      setPaymentLoading(false);
      setConfirmDeleteId(null);
    }
  };

  useEffect(() => { loadAddresses(); loadPayment(); }, []);

  // When the screen gains focus (user navigates back from AddressPaymentsScreen), reload addresses and payment
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAddresses();
      loadPayment();
      // reload saved local selections too
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('@shipping_destination');
          if (raw) setAddress(JSON.parse(raw));
          const pm = await AsyncStorage.getItem('@payment_method');
          if (pm) setPaymentMethod(pm);
        } catch (e) { /* ignore */ }
      })();
    });
    return unsubscribe;
  }, [navigation]);

  // Load saved shipping destination on mount
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('@shipping_destination');
        if (raw) {
          setAddress(JSON.parse(raw));
        }
        // The stored @payment_method should be an id string. Restore it to selectedPaymentId
        const pm = await AsyncStorage.getItem('@payment_method');
        if (pm) setSelectedPaymentId(pm);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, []);

  // sync billing when address changes (best-effort) -> populate form fields
  useEffect(() => {
    if (address && address.fullName) setFirstName(address.fullName);
    if (address && address.postalCode) setZip(address.postalCode);
  }, [address]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + (i.price * (i.quantity || 0)), 0), [cart]);
  const isMobile = width < 480;

  const inc = (idx) => {
    setCart(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.min((it.quantity||0) + 1, (it.stock ? it.stock : 999)) } : it));
    // if using context-backed cart, propagate quantity change
    if (!isRouteCart && cart[idx]) {
      try { cartCtx.updateQty && cartCtx.updateQty(cart[idx].id, +1); } catch (e) { }
    }
  };
  const dec = (idx) => {
    setCart(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max((it.quantity||1) - 1, 1) } : it));
    if (!isRouteCart && cart[idx]) {
      try { cartCtx.updateQty && cartCtx.updateQty(cart[idx].id, -1); } catch (e) { }
    }
  };

  // keep local cart in sync with CartContext when not viewing a route-passed cart
  useEffect(() => {
    if (!isRouteCart) {
      setCart(makeNormalized(cartCtx.items || []));
    }
  }, [cartCtx.items, isRouteCart]);

  // Fetch product details for items that lack name/price/image so summary can show real data
  useEffect(() => {
    const toFetch = cart.filter(i => !i.name || i.name === 'Unnamed' || !i.price || Number(i.price) === 0 || !i.image).map(i => i.id);
    if (!toFetch || toFetch.length === 0) return;
    let cancelled = false;
    const fetchDetails = async () => {
      for (const id of toFetch) {
        try {
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          let res = null;

          // If we have a token, try the authenticated endpoint first (it may include more fields)
          if (token) {
            try {
              res = await axios.get(`${API_BASE}/api/products/${encodeURIComponent(id)}`, { headers });
            } catch (e) {
              // If auth endpoint returns 404 or is unavailable, fall back to public
              if (e?.response?.status === 404) {
                try {
                  res = await axios.get(`${API_BASE}/api/public/products/${encodeURIComponent(id)}`);
                } catch (e2) {
                  // give up for this id
                  continue;
                }
              } else {
                // other errors: attempt public endpoint as a best-effort
                try { res = await axios.get(`${API_BASE}/api/public/products/${encodeURIComponent(id)}`); } catch (_) { continue; }
              }
            }
          } else {
            // no token: try public endpoint
            try { res = await axios.get(`${API_BASE}/api/public/products/${encodeURIComponent(id)}`); } catch (e) { continue; }
          }

          const p = res?.data?.product || res?.data;
          if (!p || cancelled) continue;
          setCart(prev => prev.map(it => {
            if (it.id !== id) return it;
            return {
              ...it,
              name: p.name || p.title || it.name,
              price: Number(p.price || p.salePrice || p.unitPrice || it.price) || it.price,
              image: p.imageUrl || p.image || p.imageFilename || it.image,
              stock: typeof p.stock !== 'undefined' ? Number(p.stock) : it.stock,
            };
          }));
        } catch (err) {
          // silently continue; preserve existing cart data
          console.debug('Product detail lookup skipped for', id, err?.response?.status || err.message || err);
        }
      }
    };
    fetchDetails();
    return () => { cancelled = true; };
  }, [cart, API_BASE, token]);

  // Image resolver adapted from ProductForm.getImageSource
  const getImageSource = (u, productItem = null) => {
    // if explicit resource id (require) passed
    if (!u && !productItem) return { uri: `${API_BASE}/images/placeholder.png` };
    // prefer explicit local module id
    if (typeof u === 'number') return u;

    const tryKey = (k) => {
      if (!k) return null;
      const key = k.toString().toLowerCase();
      if (assetsIndex.map[key]) return assetsIndex.map[key];
      const spaced = key.replace(/[_\-\s]+/g, ' ').trim();
      if (assetsIndex.map[spaced]) return assetsIndex.map[spaced];
      const underscored = key.replace(/[_\-\s]+/g, '_').trim();
      if (assetsIndex.map[underscored]) return assetsIndex.map[underscored];
      return null;
    };

    const s = u ? String(u) : null;

    // 1) Absolute URL
    if (s && /^https?:\/\//i.test(s)) return { uri: s };

    // 2) If path like /images/filename.ext -> try map by filename
    if (s && s.match(/\/images\/(.+)$/i)) {
      const fname = s.match(/\/images\/(.+)$/i)[1].replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      // fallback to backend-hosted absolute
      return { uri: `${API_BASE}${s.startsWith('/') ? s : `/${s}`}` };
    }

    // 3) If starts with leading slash (server-relative)
    if (s && s.startsWith('/')) {
      const name = s.replace(/\/.+\//, '').replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(name);
      if (r) return r;
      return { uri: `${API_BASE}${s}` };
    }

    // 4) If productItem provided, try fields (imageFilename, category, sku, name)
    if (productItem) {
      if (productItem.imageUrl && typeof productItem.imageUrl === 'string') {
        const m = productItem.imageUrl.match(/\/images\/(.+)$/i);
        if (m && m[1]) {
          const fname = m[1].replace(/\.[^/.]+$/, '').toLowerCase();
          const r = tryKey(fname);
          if (r) return r;
        }
      }
      if (productItem.imageFilename) {
        const nameNoExt = productItem.imageFilename.toString().replace(/\.[^/.]+$/, '');
        const r = tryKey(nameNoExt);
        if (r) return r;
      }
      if (productItem.category) {
        const r = tryKey(productItem.category);
        if (r) return r;
      }
      if (productItem.sku) {
        const skuBase = productItem.sku.toString().toLowerCase().replace(/\d+$/,'');
        const r = tryKey(skuBase);
        if (r) return r;
      }
      if (productItem.name) {
        const name = productItem.name.toString();
        const simple = name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim();
        const r1 = tryKey(simple);
        if (r1) return r1;
        const compact = simple.replace(/\s+/g, '');
        const r2 = tryKey(compact);
        if (r2) return r2;
      }
    }

    // 5) If given a bare filename (no slashes) try map by filename
    if (s && !s.includes('/')) {
      const fname = s.replace(/\.[^/.]+$/, '').toLowerCase();
      const r = tryKey(fname);
      if (r) return r;
      // fallback to backend /images/<filename>
      return { uri: `${API_BASE}/images/${s}` };
    }

    // final fallback: try to use productItem.imageUrl as absolute or a placeholder
    if (productItem && productItem.imageUrl) {
      const iv = productItem.imageUrl;
      if (typeof iv === 'string') {
        if (/^https?:\/\//i.test(iv)) return { uri: iv };
        if (iv.startsWith('/')) return { uri: `${API_BASE}${iv}` };
        return { uri: `${API_BASE}/images/${iv}` };
      }
    }

    return { uri: `${API_BASE}/images/${s || 'placeholder.png'}` };
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        {item.image ? (
          (() => {
            const src = getImageSource(item.image);
            if (!src) return (
              <View style={[styles.thumb, { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#666' }}>No Image</Text>
              </View>
            );
            return <Image source={src} style={styles.thumb} />;
          })()
        ) : (
          <View style={[styles.thumb, { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#666' }}>No Image</Text>
          </View>
        )}
      </View>
      <View style={styles.itemMain}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
  <Text style={styles.itemPrice}>{formatUSD(item.price)}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => dec(index)}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
          <View style={styles.qtyVal}><Text style={styles.qtyValText}>{item.quantity}</Text></View>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => inc(index)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
          {typeof item.stock !== 'undefined' && (<Text style={styles.stockText}>  จำนวนในคลัง: {item.stock}</Text>)}
        </View>
      </View>
    </View>
  );

  const onCheckout = async () => {
    if (!token) {
      Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนดำเนินการชำระเงิน', [{ text: 'ตกลง', onPress: () => navigation.navigate('Login') }]);
      return;
    }

    if (!cart || cart.length === 0) {
      Alert.alert('ตะกร้าว่าง', 'ไม่มีรายการให้ชำระ');
      return;
    }

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Save shipping destination and payment method locally
      try {
        await AsyncStorage.setItem('@shipping_destination', JSON.stringify(address));
        // persist the selected payment id when available; otherwise persist the UI paymentMethod as a fallback
        if (selectedPaymentId) await AsyncStorage.setItem('@payment_method', String(selectedPaymentId));
        else if (paymentMethod) await AsyncStorage.setItem('@payment_method', String(paymentMethod));
      } catch (e) {
        // ignore storage errors
      }

      // Create an Order (pending) instead of direct transactions; admin will approve
      const orderPayload = {
        items: cart.map(it => ({ productId: it.id, quantity: it.quantity })),
        shipping: address,
        // prefer selectedPaymentId (stable id), else fall back to paymentMethod string or 'card'
        paymentMethod: selectedPaymentId || paymentMethod || payment?.type || 'card',
      };
      const res = await axios.post(`${API_BASE}/api/orders`, orderPayload, { headers });

      try { setCardNumber(''); setCvv(''); } catch (e) {}
      // Show success toast/modal then navigate to Receipt screen with created order
      const createdOrder = (res && res.data && (res.data.order || res.data)) || null;
      // Keep loading visible for 3 seconds so the user sees the activity, then auto-navigate to Receipt
      // Show an immediate confirmation alert
      try { setCardNumber(''); setCvv(''); } catch (e) {}
      Alert.alert('ชำระเงินสำเร็จ', 'การสั่งซื้อถูกสร้างเรียบร้อยแล้ว');
      setTimeout(() => {
        setLoading(false);
        if (createdOrder) {
          navigation.navigate('Receipt', { order: createdOrder });
        } else {
          navigation.navigate('Main', { screen: 'Home' });
        }
      }, 3000);
    } catch (err) {
      setLoading(false);
      console.warn('Checkout failed', err?.response?.data || err.message || err);
      const msg = err?.response?.data?.message || 'ไม่สามารถดำเนินการได้ โปรดลองอีกครั้ง';
      Alert.alert('ข้อผิดพลาด', msg);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.goBack} onPress={() => navigation.goBack()}>
        <Text style={styles.goBackText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Checkout</Text>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={[styles.columns, isMobile && styles.columnsMobile]}>
          <View style={[styles.leftCol, isMobile && styles.leftColMobile]}>
          <View style={styles.panelHeader}><Text style={styles.panelHeaderText}>Payment information</Text></View>

          <View style={styles.box}>
            <Text style={[styles.panelHeaderText, { fontSize: 14 }]}>Billing information</Text>
            <View style={{ marginTop: 8 }}>
              {addresses && addresses.length > 0 ? (
                addresses.map((a) => {
                  const id = a._id || a.id || a.addressId || JSON.stringify(a);
                  const isSel = selectedAddressId ? selectedAddressId === id : (address && (address._id || address.id || address.addressId) === id);
                  return (
                    <TouchableOpacity key={id} onPress={() => selectAddress(a)} style={{ paddingVertical: 8, borderRadius: 6, backgroundColor: isSel ? '#0b0b0b' : 'transparent', borderWidth: isSel ? 1 : 0, borderColor: isSel ? '#FF3B30' : 'transparent', marginBottom: 6 }}>
                      <Text style={{ color: isSel ? '#fff' : '#ccc', fontWeight: isSel ? '800' : '600' }}>{a.fullName || `${a.firstName || ''} ${a.lastName || ''}`}</Text>
                      {a.street || a.line1 ? <Text style={{ color: '#ccc', marginTop: 4 }}>{a.street || a.line1}</Text> : null}
                      {a.apt || a.line2 ? <Text style={{ color: '#ccc' }}>{a.apt || a.line2}</Text> : null}
                      {(a.city || a.district || a.province) ? <Text style={{ color: '#ccc', marginTop: 4 }}>{[a.city, a.district, a.province].filter(Boolean).join(', ')} {a.zip || a.postalCode || ''}</Text> : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                // fallback to address state or no info
                ((address && address.fullName) || firstName) ? (
                  <>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{address.fullName || `${firstName}${lastName ? ` ${lastName}` : ''}`}</Text>
                    {address.line1 ? <Text style={{ color: '#ccc', marginTop: 6 }}>{address.line1}</Text> : null}
                    {address.line2 ? <Text style={{ color: '#ccc' }}>{address.line2}</Text> : null}
                    {(address.city || district || province) ? <Text style={{ color: '#ccc', marginTop: 6 }}>{[address.city, district, province].filter(Boolean).join(', ')}{address.postalCode || zip ? ` ${address.postalCode || zip}` : ''}</Text> : null}
                  </>
                ) : (
                  <Text style={{ color: '#aaa' }}>No billing information</Text>
                )
              )}
            </View>
            <View style={{ position: 'absolute', right: 8, top: 8 }}>
              <TouchableOpacity style={styles.smallEditBtn} onPress={() => startEdit(addresses && addresses[0] ? addresses[0] : address)}><Text style={{ color: '#fff' }}>Edit</Text></TouchableOpacity>
            </View>
            {/* Inline editor for billing */}
            {editing ? (
              <View style={{ marginTop: 12 }}>
                <TextInput value={firstName} onChangeText={setFirstName} placeholder="First name *" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark]} />
                <TextInput value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark, { marginTop: 8 }]} />
                <TextInput value={street} onChangeText={setStreet} placeholder="Address (Street, P.O. box) *" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark, { marginTop: 8 }]} />
                <TextInput value={apt} onChangeText={setApt} placeholder="Address 2 (Apartment, suite, unit)" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark, { marginTop: 8 }]} />
                <TextInput value={district} onChangeText={setDistrict} placeholder="City / District *" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark, { marginTop: 8 }]} />
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <TextInput value={province} onChangeText={setProvince} placeholder="State/Province" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark, { marginRight: 8, flex: 1 }]} />
                  <TextInput value={zip} onChangeText={setZip} placeholder="Postal/Zip code" placeholderTextColor="rgba(255,255,255,0.4)" style={[styles.inputDark, { width: 120 }]} keyboardType="numeric" />
                </View>
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity style={[styles.smallEditBtn, { backgroundColor: '#2f855a' }]} onPress={saveAddress}><Text style={{ color: '#fff' }}>Save billing information</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.smallEditBtn, { marginLeft: 8 }]} onPress={cancelEdit}><Text style={{ color: '#fff' }}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>

          <View style={[styles.box, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.panelHeaderText, { fontSize: 14 }]}>Payment method</Text>
              <TouchableOpacity style={[styles.smallEditBtn, isMobile && styles.smallEditBtnMobile]} onPress={() => startEditPayment(null)}><Text style={{ color: '#fff' }}>Add</Text></TouchableOpacity>
            </View>
            <View style={{ marginTop: 8 }}>
              {/* Render payment methods from backend (list) and allow inline actions */}
              {paymentLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (paymentMethods && paymentMethods.length ? (
                paymentMethods.map((pm) => {
                  const id = pm._id || pm.id || pm.paymentId || '';
                  const brand = pm.brand || pm.cardBrand || 'local';
                  const last4 = pm.last4 || pm.cardNumberMasked || '••••';
                  const expMonthVal = pm.expMonth || pm.exp_month || '';
                  const expYearVal = pm.expYear || pm.exp_year || '';
                  return (
                    <View key={id} style={{ paddingVertical: 8, borderRadius: 6, backgroundColor: '#0b0b0b', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', padding: 12, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#ccc' }}>Credit Card: <Text style={{ color: '#fff', fontWeight: '800' }}>{brand}</Text> ending {last4}</Text>
                          <Text style={{ color: '#ccc', marginTop: 6 }}>expiring {expMonthVal || '--'}/{expYearVal || '--'}</Text>
                        </View>
                        <View style={{ marginLeft: 12, flexDirection: 'row' }}>
                          <TouchableOpacity style={[styles.smallAction, isMobile && styles.smallActionMobile, { marginRight: 8 }]} onPress={() => startEditPayment(pm)}>
                            <Text style={styles.smallActionText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.smallAction, isMobile && styles.smallActionMobile, { borderColor: '#8b0000' }]} onPress={() => handleDeletePayment(id)}>
                            <Text style={[styles.smallActionText, { color: '#ff6b6b' }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.muted}>No payment method saved. Use Add to create one.</Text>
              ))}
            </View>
            {/* Header action cluster removed — per-item Edit/Delete buttons are shown next to each payment method */}
            {/* Inline payment editor */}
            {editingPayment ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Pay with</Text>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={[styles.segmentBtn, method === 'card' ? styles.segmentBtnActive : null]} onPress={() => setMethod('card')}><Text style={[styles.segmentText, method === 'card' ? styles.segmentTextActive : null]}>Credit or debit card</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.segmentBtn, method === 'paypal' ? styles.segmentBtnActive : null]} onPress={() => setMethod('paypal')}><Text style={[styles.segmentText, method === 'paypal' ? styles.segmentTextActive : null]}>PayPal account</Text></TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {method === 'paypal' ? (
                  <View style={{ paddingVertical: 8 }}>
                    <TouchableOpacity style={styles.paypalBtn}><Text style={styles.paypalBtnText}>PayPal</Text></TouchableOpacity>
                    <Text style={styles.muted}>You can switch to PayPal at any time.</Text>
                    <View style={styles.infoBox}><Text style={styles.infoText}> We may place a temporary hold on your payment method to verify its validity. This is not a charge, and it will be released automatically after verification.</Text></View>
                    <View style={{ marginTop: 12 }}><TouchableOpacity style={styles.cancelBtn} onPress={cancelPaymentEdit}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.fieldLabel}>Card Number *</Text>
                    <View style={styles.brandRow}>
                      {[
                        { label: 'MasterCard', key: 'mastercard' },
                        { label: 'China Union Pay', key: 'unionpay' },
                        { label: 'Diners', key: 'diners' },
                        { label: 'American Express', key: 'amex' },
                        { label: 'Discover', key: 'discover' },
                        { label: 'Visa', key: 'visa' },
                      ].map((b) => {
                        const isActive = selectedBrand && (selectedBrand.toLowerCase().includes(b.label.split(' ')[0].toLowerCase()) || (b.label === 'China Union Pay' && selectedBrand.toLowerCase().includes('union')));
                        const img = assetsIndex.map[b.key];
                        return (
                          <TouchableOpacity key={b.key} style={[styles.brandItem, isActive ? styles.brandItemActive : null]} onPress={() => setSelectedBrand(b.label)}>
                            {img ? <Image source={img} style={styles.brandImage} resizeMode="contain" /> : <Text style={styles.brandText}>{b.label}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput value={cardNumber} onChangeText={handleCardNumberChange} placeholder="" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.inputDark} keyboardType="numeric" maxLength={19} />
                    {!cardValid && (
                      <Text style={{ color: '#ff5555', marginTop: 6 }}>Invalid card number (failed Luhn check)</Text>
                    )}

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Expiration Date (YYYY) *</Text>
                        <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                          <TouchableOpacity style={[styles.select, styles.smallSelect]} onPress={() => setMonthPickerVisible(true)}>
                            <Text style={styles.selectText}>{expMonth || '- MM -'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.select, styles.smallSelect, { marginLeft: 8 }]} onPress={() => setYearPickerVisible(true)}>
                            <Text style={styles.selectText}>{expYear || '- YYYY -'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={{ width: 12 }} />

                      <View style={{ width: 172, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fieldLabel}>CVV *</Text>
                          <TextInput
                            value={cvv}
                            onChangeText={(txt) => { const cleaned = (txt || '').replace(/\D+/g, '').slice(0, 3); setCvv(cleaned); }}
                            placeholder=""
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            style={[styles.inputDark, styles.cvvInput]}
                            keyboardType="numeric"
                            maxLength={3}
                          />
                        </View>
                        <View style={{ marginLeft: 8, width: 36, alignItems: 'center' }}>
                          <View style={styles.cvvImgPlaceholder}><Text style={{ fontSize: 10 }}>CVV</Text></View>
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity style={[styles.saveBtn, paymentSaving ? { opacity: 0.6 } : null]} disabled={paymentSaving} onPress={async () => {
                          const ok = await savePayment();
                          if (ok) {
                            // close the inline editor
                            cancelPaymentEdit();
                          }
                        }}><Text style={styles.saveText}>{paymentSaving ? 'Saving...' : 'Save payment information'}</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.cancelBtn, { marginLeft: 8 }]} onPress={cancelPaymentEdit}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.iframePlaceholder} />

                    <View style={styles.infoBox}>
                      <Text style={styles.infoText}> We may place a temporary hold on your payment method to verify its validity. This is not a charge, and it will be released automatically after verification.</Text>
                    </View>
                  </View>
                )}

                {/* Delete confirmation modal (moved down so it shows even when not editingPayment) */}
              </View>
            ) : null}
          </View>
        </View>

        {/* Month picker modal */}
        {/* Global Delete confirmation modal (renders regardless of editingPayment) */}
        <Modal visible={confirmDeleteVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeleteVisible(false)}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback onPress={() => setConfirmDeleteVisible(false)}>
              <View style={styles.modalOverlay} />
            </TouchableWithoutFeedback>
            <View style={[styles.modalContainer, { width: '80%' }]}> 
              <View style={{ padding: 16 }}>
                <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 12 }}>Delete payment method</Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', marginBottom: 18 }}>Are you sure you want to remove this payment method? This cannot be undone.</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity style={[styles.cancelBtn, { marginRight: 8 }]} onPress={() => setConfirmDeleteVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={performDeletePayment}><Text style={styles.saveText}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
        {monthPickerVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView>
                {months.map(m => (
                  <TouchableOpacity key={m.key} style={styles.modalItem} onPress={() => { setExpMonth(m.label); setMonthPickerVisible(false); }}>
                    <Text style={styles.modalItemText}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Year picker modal */}
        {yearPickerVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView>
                {years.map(y => (
                  <TouchableOpacity key={y.key} style={styles.modalItem} onPress={() => { setExpYear(y.label); setYearPickerVisible(false); }}>
                    <Text style={styles.modalItemText}>{y.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

  <View style={[styles.rightCol, isMobile && styles.rightColMobile]}>
          <Text style={styles.summaryTitle}>YOUR CART ({cart.length})</Text>
          <View style={styles.summaryList}>
            {cart.map((it, idx) => (
              <View key={`${it.id || idx}`} style={styles.summaryRow}>
                <Image source={getImageSource(it.image) || require('../../assets/favicon.png')} style={styles.summaryThumb} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.summaryName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.summaryQty}>Qty {it.quantity}</Text>
                </View>
                <Text style={styles.summaryPrice}>{formatUSD(it.price * (it.quantity || 1))}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summaryTotals}>
            <View style={styles.tRow}><Text style={styles.tLabel}>Subtotal</Text><Text style={styles.tValue}>{formatUSD(subtotal)}</Text></View>
            <View style={styles.tRow}><Text style={styles.tLabel}>Local Taxes</Text><Text style={styles.tValue}>Calculated after address entry</Text></View>
            <View style={styles.tRow}><Text style={styles.tLabel}>Shipping</Text><Text style={styles.tValue}>Calculated after address entry</Text></View>
            <View style={[styles.tRow, { marginTop: 12 }]}><Text style={[styles.tLabel, { fontWeight: '800' }]}>TOTAL</Text><Text style={[styles.tValue, { fontWeight: '800' }]}>{formatUSD(subtotal)}</Text></View>
          </View>

          <TouchableOpacity style={styles.returnLink} onPress={() => navigation.navigate('Cart')}><Text style={{ color: '#FF3B30' }}>Return to cart to apply promo code</Text></TouchableOpacity>
          
          {/* Purchase Order CTA */}
          <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={async () => {
            // POST to backend to create an order
            const payload = {
              items: cart.map(it => ({ productId: it.id, quantity: it.quantity })),
              shipping: address || null,
              paymentMethod: selectedPaymentId || paymentMethod || payment?.type || 'card',
            };
            try {
              setProcessingModalVisible(true);
              const headers = { 'Content-Type': 'application/json' };
              if (token) headers.Authorization = `Bearer ${token}`;
              const res = await axios.post(`${API_BASE}/api/orders`, payload, { headers });
              const createdOrder = (res && res.data && (res.data.order || res.data)) || null;
              // keep modal visible for 3 seconds so user sees the message
              await new Promise(resv => setTimeout(resv, 3000));
              setProcessingModalVisible(false);
              if (createdOrder) {
                // After creating order, attempt to decrement stock by creating 'out' transactions per item
                (async () => {
                  try {
                    const txHeaders = { 'Content-Type': 'application/json' };
                    if (token) txHeaders.Authorization = `Bearer ${token}`;
                    const txPromises = (payload.items || []).map(it => axios.post(`${API_BASE}/api/transactions`, { type: 'out', productId: it.productId, quantity: it.quantity }, { headers: txHeaders }));
                    const results = await Promise.allSettled(txPromises);
                    const failed = results.filter(r => r.status !== 'fulfilled');
                    if (failed.length) {
                      console.warn('Some stock transactions failed', failed);
                      // optional: notify the user that stock update partially failed
                      Alert.alert('Notice', 'Order created but some stock updates failed. Contact support.');
                    }
                  } catch (e) {
                    console.warn('Stock update flow failed', e);
                  }
                })();

                try { cartCtx.clearCart && cartCtx.clearCart(); } catch (e) {}
                navigation.navigate('Receipt', { order: createdOrder });
              } else {
                Alert.alert('Notice', 'Order created but no data returned.');
              }
            } catch (err) {
              setProcessingModalVisible(false);
              console.warn('Create order failed', err?.response?.data || err.message || err);
              const msg = err?.response?.data?.message || 'Failed to create order. Try again.';
              Alert.alert('Error', msg);
            }
          }}>
            <Text style={styles.saveText}>Purchase order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

    {/* Processing modal (simple overlay) */}
    <Modal visible={processingModalVisible} transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 8 }}>Setload</Text>
          <Text style={{ color: '#ddd' }}>Creating receipt…</Text>
        </View>
      </View>
    </Modal>
  </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 12 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: '#fff', textAlign: 'center' },
  goBack: { marginBottom: 8 },
  goBackText: { color: '#FF3B30', fontWeight: '700' },
  columns: { flexDirection: 'row' },
  columnsMobile: { flexDirection: 'column' },
  leftCol: { flex: 2, backgroundColor: '#111', padding: 12, borderRadius: 6, maxHeight: '88%' },
  rightCol: { flex: 1, marginLeft: 12, backgroundColor: '#111', padding: 12, borderRadius: 6, minHeight: 400 },
  leftColMobile: { maxHeight: 'auto' },
  rightColMobile: { marginLeft: 0, marginTop: 12 },
  panelHeader: { backgroundColor: '#1a1a1a', padding: 8, borderRadius: 4, marginBottom: 8 },
  panelHeaderText: { color: '#fff', fontWeight: '800' },
  sectionHint: { color: '#aaa', fontSize: 12, marginBottom: 8 },
  sectionLabel: { color: '#ddd', fontWeight: '700', marginTop: 12, marginBottom: 8 },
  formRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  inputDark: { backgroundColor: '#0f0f0f', color: '#fff', paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, borderRadius: 4, borderWidth: 1, borderColor: '#222', marginBottom: 8 },
  paymentRowDark: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  payItemDark: { padding: 6, marginRight: 8, borderRadius: 6, backgroundColor: '#0b0b0b', borderWidth: 1, borderColor: '#222' },
  payItemActiveDark: { borderColor: '#FF3B30', backgroundColor: '#081008' },
  payIconDark: { width: 56, height: 28, resizeMode: 'contain' },
  acceptBtn: { backgroundColor: '#6fe36f', paddingVertical: 12, borderRadius: 4, marginTop: 16, alignItems: 'center' },
  acceptText: { color: '#0b0b0b', fontWeight: '800' },

  // summary
  summaryTitle: { color: '#fff', fontWeight: '800', marginBottom: 12 },
  summaryList: { backgroundColor: '#0b0b0b', padding: 8, borderRadius: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#151515' },
  summaryThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#222' },
  summaryName: { color: '#fff', fontWeight: '700', fontSize: 12 },
  summaryQty: { color: '#999', fontSize: 12 },
  summaryPrice: { color: '#fff', fontWeight: '800' },
  summaryTotals: { marginTop: 12, padding: 8, backgroundColor: '#080808', borderRadius: 6 },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  tLabel: { color: '#999' },
  tValue: { color: '#fff' },
  returnLink: { marginTop: 12 },

  box: { borderWidth: 1, borderColor: '#2a2a2a', padding: 12, borderRadius: 6, position: 'relative' },
  smallEditBtn: { backgroundColor: '#0b0b0b', borderWidth: 1, borderColor: '#333', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },

  // older styles preserved for small elements
  itemRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#111' },
  itemLeft: { width: 88, marginRight: 12 },
  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#111' },
  itemMain: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  itemPrice: { color: '#aaa', marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qtyBtn: { backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  qtyBtnText: { color: '#fff', fontWeight: '700' },
  qtyVal: { marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#111', borderRadius: 6 },
  qtyValText: { fontWeight: '700', color: '#fff' },
  stockText: { color: '#888', marginLeft: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Payment method / inline editor styles
  segmentBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#222', marginRight: 8, backgroundColor: 'transparent' },
  segmentBtnActive: { backgroundColor: '#0b0b0b', borderColor: '#444' },
  segmentText: { color: '#ddd' },
  segmentTextActive: { color: '#fff', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#151515', marginVertical: 12 },
  paypalBtn: { backgroundColor: '#003087', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center' },
  paypalBtnText: { color: '#fff', fontWeight: '700' },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap' },
  brandItem: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#222', backgroundColor: 'transparent', marginRight: 8, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  brandItemActive: { backgroundColor: '#0b0b0b', borderColor: '#444' },
  brandImage: { width: 48, height: 24 },
  brandText: { color: '#ddd', fontSize: 12 },
  select: { borderWidth: 1, borderColor: '#222', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, backgroundColor: '#0b0b0b' },
  selectText: { color: '#ddd' },
  iframePlaceholder: { height: 200, backgroundColor: '#060606', borderRadius: 6, marginTop: 12, borderWidth: 1, borderColor: '#111' },
  infoBox: { marginTop: 12, padding: 12, backgroundColor: '#07213a', borderRadius: 6, borderWidth: 1, borderColor: '#0b547d' },
  infoText: { color: '#cfe8ff' },
  saveBtn: { backgroundColor: '#2f855a', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  cancelText: { color: '#ddd' },
  
  // User-provided panel styles (override/augment existing ones)
  container: { flex: 1, backgroundColor: '#000' },
  pageTitle: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 12 },

  panel: { backgroundColor: '#0b1620', borderRadius: 8, borderWidth: 1, borderColor: '#fff', padding: 14, marginBottom: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  panelTitle: { color: '#fff', fontWeight: '700' },
  panelBody: { marginTop: 4 },

  headerLeft: { flex: 1 },
  headerRight: { justifyContent: 'flex-end', alignItems: 'flex-end' },
  paymentSummary: { marginTop: 6 },
  paymentSummaryText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  editBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  editBtnText: { color: '#fff', fontWeight: '700' },

  bold: { color: '#ffffff', fontWeight: '700', marginBottom: 6 },
  muted: { color: 'rgba(255,255,255,0.75)', marginBottom: 4 },

  smallAction: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  smallActionText: { color: '#fff', fontWeight: '700' },

  ghostAction: { backgroundColor: 'transparent', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  ghostActionText: { color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  input: {
    backgroundColor: '#0b1620',
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)'
  },
  inputFull: { backgroundColor: '#0b1620', color: '#fff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginTop: 8 },

  sectionLabel: { color: 'rgba(255,255,255,0.95)', marginBottom: 8 },
  fieldLabel: { color: '#ffffff', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  segmentRow: { flexDirection: 'row', backgroundColor: 'transparent' },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.02)', marginRight: 8 },
  segmentBtnActive: { backgroundColor: 'rgba(255,255,255,0.06)' },
  segmentText: { color: 'rgba(255,255,255,0.9)' },
  segmentTextActive: { color: '#fff', fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.03)', marginVertical: 12 },
  select: { flex: 1, backgroundColor: '#000', borderRadius: 6, borderWidth: 1, borderColor: '#fff', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: 'rgba(255,255,255,0.95)' },
  smallSelect: { width: 90, paddingVertical: 8, paddingHorizontal: 10 },
  cvvImgPlaceholder: { width: 36, height: 24, backgroundColor: '#fff', borderRadius: 2, justifyContent: 'center', alignItems: 'center' },
  iframePlaceholder: { height: 220, backgroundColor: '#020406', marginTop: 12, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(64,110,156,0.12)', borderRadius: 6, padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(64,110,156,0.2)' },
  infoText: { color: '#e6f4ff', flex: 1, fontSize: 13 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContainer: { maxHeight: '60%', width: '95%', maxWidth: 520, backgroundColor: '#0b1620', alignSelf: 'center', marginTop: 80, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  smallEditBtnMobile: { paddingHorizontal: 14, paddingVertical: 10 },
  smallActionMobile: { paddingVertical: 10, paddingHorizontal: 12 },
  modalItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomColor: 'rgba(255,255,255,0.03)', borderBottomWidth: 1 },
  modalItemText: { color: 'rgba(255,255,255,0.95)' },

  paypalBlock: { paddingVertical: 8 },
  paypalBtn: { backgroundColor: '#0070ba', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 12 },
  paypalBtnText: { color: '#fff', fontWeight: '700' },

  saveBtn: { backgroundColor: '#2f855a', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6 },
  saveText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#1f2937', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 6 },
  cancelText: { color: '#fff', fontWeight: '700' },
  
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8 },
  brandItem: { paddingVertical: 4, paddingHorizontal: 6, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.02)', marginRight: 6 },
  brandItemActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  brandText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  
  brandImage: { width: 44, height: 22 },
  panelBlack: { backgroundColor: '#000', borderColor: '#fff' }
  ,
  cvvInput: { width: Platform.OS === 'ios' ? 84 : 76, height: Platform.OS === 'ios' ? 44 : 40, textAlign: 'center' }
});

export default TransactionScreen;