import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, useWindowDimensions, Modal, Share, Platform } from 'react-native';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import CartContext from '../../context/CartContext';
import QuickCartSidebar from '../../components/QuickCartSidebar';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import assetsIndex from '../../assets/assetsIndex';

const ProductForm = ({ route, navigation }) => {
  const product = route?.params?.product || {};
  const { user, token } = useContext(AuthContext);
  const cartCtx = useContext(CartContext);
  const [quantity, setQuantity] = useState(1);
  // main image and thumbnails (may be loaded from API if not passed in route)
  const [mainImage, setMainImage] = useState(product.imageUrl || (product.images && product.images[0]) || null);
  const [thumbs, setThumbs] = useState(product.images || product.gallery || (product.imageUrl ? [product.imageUrl] : []));

  // build API base dynamically so device/emulator can reach the dev server
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  // origin only (protocol + host + port) for resolving relative image paths
  const BASE_URL = API_BASE.replace(/^(https?:\/\/[^/]+).*/, '$1');

  // DEBUG: log runtime network base and incoming product image info
  try {
    console.debug && console.debug('DEBUG ProductForm API_BASE=', API_BASE, 'product.images=', product.images, 'product.imageUrl=', product.imageUrl);
  } catch (e) {
    // no-op
  }

  const makeImageUrl = (u) => {
    if (!u) return null;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    // relative path -> prepend API host
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${API_BASE}${path}`;
  };

  // Try to resolve an image from frontend assets first (by imageUrl filename, SKU base, imageFilename, category, or name).
  // If none found, fall back to backend-hosted URL (absolute or relative) or a placeholder.
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

  // Helper to normalize display name (remove 'Model' suffixes like ' - Model 638')
  const displayName = (name) => {
    if (!name) return '';
    let s = name.toString();
    // remove 'model' followed by optional separators and numbers, e.g. 'Model 638', 'model-638', 'Model:638'
    s = s.replace(/\bmodel\b[:\-\s]*\d+/ig, '');
    // also remove any standalone 'model' words (no numbers) with separators
    s = s.replace(/[:\-\s]*\bmodel\b[:\-\s]*/ig, '');
    // remove trailing separators like '-' or ':' and trim spaces
    s = s.replace(/[\-:\s]+$/g, '').trim();
    // if result contains a dash-separated name like 'Lamps - 638', remove trailing numeric segment
    s = s.replace(/\s*[-–—]\s*\d+$/g, '').trim();
    return s;
  };

  // Note: intentionally minimal helper set — use backend-hosted images only.
  const REVIEW_TITLE_MAX = 1000;
  const REVIEW_BODY_MAX = 5000;
  const REVIEW_IMG_LIMIT = 5;

  // UI state: tabs and image modal for zoomed view
  const [currentTab, setCurrentTab] = useState('description'); // description | specs | shipping | reviews
  // Ensure currentTab stays valid after removing some tabs
  useEffect(() => {
    if (currentTab === 'specs' || currentTab === 'reviews') {
      setCurrentTab('description');
    }
  }, [currentTab]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  // Mobile sidebar state (slide-in panel)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Admin form state
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState(product.name || '');
  const [formCategory, setFormCategory] = useState(product.category || '');
  const [formPrice, setFormPrice] = useState(String(product.price || product.salePrice || '0'));
  const [formStock, setFormStock] = useState(String(product.stock ?? product.quantity ?? 0));
  const [formDescription, setFormDescription] = useState(product.description || '');

  const inc = () => setQuantity(q => Math.min((q || 0) + 1, 999));
  const dec = () => setQuantity(q => Math.max((q || 1) - 1, 1));

  const openImage = (u) => {
    const src = getImageSource(u, product) || getImageSource(mainImage, product);
    setModalImage(src);
    setShowImageModal(true);
  };
  const closeImage = () => { setShowImageModal(false); setModalImage(null); };

  const onShare = async () => {
    try {
      const message = `${displayName(product.name) || 'Product'}${product.price ? ` - $${Number(product.price).toFixed(2)}` : ''}\n\n${product.description || ''}`;
      await Share.share({ message });
    } catch (e) {
      console.warn('share failed', e);
    }
  };

  // open quick actions (sidebar) for Add to Cart CTA — allow anonymous users to build a cart locally
  const onAddToCart = () => {
    try {
      const item = {
        _id: product._id || product.id,
        name: product.name,
        price: Number(product.salePrice || product.price || 0),
        imageUrl: product.imageUrl || (product.images && product.images[0]) || null,
        qty: quantity,
      };
      cartCtx.addToCart(item);
      // show quick cart sidebar so the user sees the added item
      setShowMobileSidebar(true);

      // If user is not logged in, offer a gentle nudge to sign in before checkout
      if (!user || !token) {
        // non-blocking alert with option to login
        Alert.alert(
          'เพิ่มลงตะกร้าแล้ว',
          'สินค้าได้ถูกเพิ่มไปยังตะกร้าของคุณแล้ว หากต้องการชำระเงิน โปรดเข้าสู่ระบบ',
          [
            { text: 'ปิด', style: 'cancel' },
            { text: 'เข้าสู่ระบบ', onPress: () => navigation.navigate('Login') }
          ]
        );
      }
    } catch (e) {
      console.warn('onAddToCart add failed', e);
      setShowMobileSidebar(true);
    }
  };

  // Called from the mobile sidebar when user confirms Add to Cart
  const onAddToCartConfirm = () => {
    try {
      // add item to shared cart context
      const item = {
        _id: product._id || product.id,
        name: product.name,
        price: Number(product.salePrice || product.price || 0),
        imageUrl: product.imageUrl || (product.images && product.images[0]) || null,
        qty: quantity,
      };
      cartCtx.addToCart(item);
      // keep quick cart open so user sees the added item
      setShowMobileSidebar(true);
    } catch (e) {
      console.warn('onAddToCartConfirm failed', e);
    }
  };

  const onBuyNow = () => {
    // require authentication before buy-now flow
    if (!user || !token) {
      Alert.alert(
        'กรุณาเข้าสู่ระบบ',
        'คุณต้องเข้าสู่ระบบก่อนจึงจะสามารถชำระเงินได้',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'เข้าสู่ระบบ', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }
    // Add the single item to the shared cart and navigate to the Cart screen for checkout
    try {
      const item = {
        _id: product._id || product.id,
        name: product.name,
        price: Number(product.salePrice || product.price || 0),
        imageUrl: product.imageUrl || (product.images && product.images[0]) || null,
        qty: quantity,
      };

      // Add to cart (cart context should handle merging/incrementing)
      cartCtx.addToCart(item);

      // Navigate to Cart screen where the user can proceed to checkout
      try {
        navigation.navigate('Cart');
      } catch (e) {
        // fallback: navigate to Transaction directly if Cart route missing
        try {
          navigation.navigate('Transaction', { cart: [{ productId: item._id, name: item.name, price: item.price, quantity: item.qty }] });
        } catch (err) {
          console.warn('onBuyNow navigation fallback failed', err);
        }
      }
    } catch (e) {
      console.warn('onBuyNow failed', e);
    }
  };

  const toggleMobileSidebar = () => setShowMobileSidebar(s => !s);


  // Navigate to the next product. Prefer `relatedProducts` if available; otherwise fetch a public product list and pick the next one.
  const onNextProduct = async () => {
    try {
      // try relatedProducts first
      if (relatedProducts && relatedProducts.length > 0) {
        const key = product._id || product.id;
        const idx = relatedProducts.findIndex(p => (p._id || p.id) === key);
        let next = null;
        if (idx !== -1) {
          if (idx < relatedProducts.length - 1) next = relatedProducts[idx + 1];
          else next = relatedProducts[0];
        } else {
          // if current product not in related list, pick first different one
          next = relatedProducts.find(p => (p._id || p.id) !== key) || null;
        }
        if (next) {
          // replace current route with next product to keep back stack tidy
          navigation.replace('ProductForm', { product: next });
          return;
        }
      }

      // fallback: fetch public products and pick the next (or any different) product
      const res = await axios.get(`${API_BASE}/api/public/products?limit=100`);
      const productsList = (res?.data && (res.data.data?.products || res.data.products)) || [];
      const key = product._id || product.id;
      let next = null;
      if (productsList.length > 0) {
        const idx = productsList.findIndex(p => (p._id || p.id) === key);
        if (idx !== -1) {
          next = idx < productsList.length - 1 ? productsList[idx + 1] : productsList[0];
        } else {
          next = productsList.find(p => (p._id || p.id) !== key) || null;
        }
      }
      if (next) {
        navigation.replace('ProductForm', { product: next });
        return;
      }

      Alert.alert('ไม่มีสินค้าถัดไป', 'ไม่พบสินค้าชิ้นถัดไป');
    } catch (err) {
      console.warn('onNextProduct failed', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดสินค้าถัดไปได้');
    }
  };

  // Navigate to the previous product (mirror of onNextProduct)
  const onPrevProduct = async () => {
    try {
      if (relatedProducts && relatedProducts.length > 0) {
        const key = product._id || product.id;
        const idx = relatedProducts.findIndex(p => (p._id || p.id) === key);
        let prev = null;
        if (idx !== -1) {
          if (idx > 0) prev = relatedProducts[idx - 1];
          else prev = relatedProducts[relatedProducts.length - 1];
        } else {
          prev = relatedProducts.find(p => (p._id || p.id) !== key) || null;
        }
        if (prev) { navigation.replace('ProductForm', { product: prev }); return; }
      }

      const res = await axios.get(`${API_BASE}/api/public/products?limit=100`);
      const productsList = (res?.data && (res.data.data?.products || res.data.products)) || [];
      const key = product._id || product.id;
      let prev = null;
      if (productsList.length > 0) {
        const idx = productsList.findIndex(p => (p._id || p.id) === key);
        if (idx !== -1) {
          prev = idx > 0 ? productsList[idx - 1] : productsList[productsList.length - 1];
        } else {
          prev = productsList.find(p => (p._1 || p._id || p.id) !== key) || null;
        }
      }
      if (prev) { navigation.replace('ProductForm', { product: prev }); return; }

      Alert.alert('ไม่มีสินค้าก่อนหน้า', 'ไม่พบสินค้าชิ้นก่อนหน้า');
    } catch (err) {
      console.warn('onPrevProduct failed', err);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดสินค้าก่อนหน้าได้');
    }
  };

  // Use product-provided reviews (if any). Detailed review interface moved to separate Reviews screen.
  const reviews = product.reviews || [];
  // If the product object doesn't include reviews array, fetch the product summary to get reviewsCount
  const [reviewsCount, setReviewsCount] = useState(Array.isArray(reviews) ? reviews.length : (product.reviewsCount || product.reviewCount || 0));

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        // If we already have reviews array, prefer its length. If reviewsCount present on product, prefer it.
        if (Array.isArray(reviews) && reviews.length) return;
        if (product.reviewsCount || product.reviewCount) {
          setReviewsCount(product.reviewsCount || product.reviewCount || 0);
          return;
        }
        if (!(product._id || product.id)) return;
        const res = await axios.get(`${API_BASE}/api/products/${product._id || product.id}`);
        if (cancelled) return;
        const p = res?.data?.product || res?.data || {};
        setReviewsCount(p.reviewsCount || p.reviewCount || (Array.isArray(p.reviews) ? p.reviews.length : 0));
      } catch (err) {
        // non-fatal: leave count as-is
        console.warn('fetch reviewsCount failed', err?.message || err);
      }
    };

    fetchCount();
    return () => { cancelled = true; };
  }, [product._id, product.id]);

  const paymentMethods = [
    { id: 'card', icon: 'credit-card', label: 'บัตรเครดิต / เดบิต' },
    { id: 'bank', icon: 'account-balance', label: 'โอนผ่านธนาคาร' },
    { id: 'cod', icon: 'local-shipping', label: 'ชำระเงินปลายทาง (COD)' },
  ];

  // Responsive layout based on window size
  const { width, height } = useWindowDimensions();
    // no footer: no reserved bottom space
    const FOOTER_HEIGHT = 0;
  // related products
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [topSellers, setTopSellers] = useState([]);
  const isDesktop = width >= 1100;
  const isTablet = width >= 700 && width < 1100;
  const isMobile = width < 600;
  const isWeb = Platform.OS === 'web';

  // For mobile (narrow) screens, render image area above details by stacking columns (column flexDirection)
  const gridStyle = [{ width: isDesktop ? '90%' : '95%', maxWidth: 1100, marginTop: 20, flexDirection: isDesktop ? 'row' : 'column', alignItems: isDesktop ? 'flex-start' : 'center', paddingHorizontal: isDesktop ? 40 : 20 }];
  const leftColStyle = [{ flex: isDesktop ? 1 : undefined, alignItems: 'center', width: isDesktop ? undefined : (isMobile ? '100%' : Math.min(520, width - 40)) }];
  const rightColStyle = [{ width: isDesktop ? 360 : '100%', marginTop: isDesktop ? 0 : 18 }];
  const imageW = isDesktop ? 420 : isTablet ? 360 : (isMobile ? Math.min(width - 40, 800) : Math.min(520, width - 40));
  const imageH = Math.round(imageW * 1.333);
  // responsive sizes for related cards and badges
  const relatedCardWidth = isDesktop ? 220 : isTablet ? 180 : Math.min(160, Math.floor((width - 80) / 2));
  const relatedImageHeight = Math.round(relatedCardWidth * 1.0);
  const badgeWidth = isDesktop ? 64 : isTablet ? 54 : 48;
  const badgeHeight = Math.round(badgeWidth * 0.5);

  // Scroll-to-top: ref and visibility state
  const scrollViewRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // fetch related products (best-effort: by category or fallback recent)
  useEffect(() => {
    let cancelled = false;
    const fetchRelated = async () => {
      setLoadingRelated(true);
      try {
        const category = encodeURIComponent(product.category || '');
        // try public endpoint first (no auth required)
        const publicUrl = `${API_BASE}/api/public/products?limit=6${category ? `&category=${category}` : ''}`;
        let res = null;
        try {
          res = await axios.get(publicUrl);
        } catch (errPublic) {
          // if public endpoint not available or fails, and we have a token, try authenticated products endpoint
          if (token) {
            const authUrl = `${API_BASE}/api/products?limit=6${category ? `&category=${category}` : ''}`;
            const headers = { Authorization: `Bearer ${token}` };
            res = await axios.get(authUrl, { headers });
          } else {
            // no token and public failed — skip related
            throw errPublic;
          }
        }
        if (!cancelled && res?.data) {
          // assume API returns array in res.data
          const list = Array.isArray(res.data) ? res.data : (res.data.products || []);
          // exclude current product
          setRelatedProducts(list.filter(p => (p._id || p.id) !== (product._id || product.id)).slice(0,6));
        }
      } catch (err) {
        // handle unauthorized separately to avoid noisy logs
        if (err?.response?.status === 401) {
          // unauthorized: backend requires auth for this endpoint; silently skip recommendations
          console.warn('fetchRelated: unauthorized (401) - skipping related products');
        } else {
          console.warn('fetchRelated error', err?.message || err);
        }
      } finally {
        if (!cancelled) setLoadingRelated(false);
      }
    };

    fetchRelated();
    // also fetch top sellers (public endpoint)
    (async () => {
      try {
  const res = await axios.get(`${API_BASE}/api/public/products/top-sellers`);
        const list = res?.data?.data || res?.data || [];
        if (!cancelled && Array.isArray(list)) setTopSellers(list.filter(p => (p._id || p.id) !== (product._id || product.id)).slice(0,6));
      } catch (e) {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [product._id, product.id, product.category]);

  // If route product doesn't include images, try to fetch full product details from API
  useEffect(() => {
    let cancelled = false;
    const fetchFull = async () => {
      try {
        if (!(product._id || product.id)) return;
        // already have images?
        if ((product.images && product.images.length > 0) || product.imageUrl) return;
        // product detail is public on the backend; prefer public GET to avoid 401
        const publicUrl = `${API_BASE}/api/products/${product._id || product.id}`;
        let res = null;
        try {
          res = await axios.get(publicUrl);
        } catch (errPublic) {
          // if public fails and we have a token, try the authenticated path
          if (token) {
            const authUrl = `${API_BASE}/api/products/${product._id || product.id}`;
            const headers = { Authorization: `Bearer ${token}` };
            res = await axios.get(authUrl, { headers });
          } else {
            throw errPublic;
          }
        }
        const data = res?.data?.product || res?.data || {};
        // images in DB may come as absolute URLs, server-relative paths, or filenames.
        const rawImgs = data.images || data.gallery || (data.imageUrl ? [data.imageUrl] : []);
        const normalized = (rawImgs || []).map(item => {
          if (!item) return null;
          // string cases
          if (typeof item === 'string') {
            const s = item;
            if (s.startsWith('http')) return s;
            if (s.startsWith('/')) return `${API_BASE}${s}`;
            // filename only
            return `${API_BASE}/images/${s}`;
          }
          // object cases
          if (item.url) return item.url;
          if (item.path) return item.path.startsWith('http') ? item.path : `${API_BASE}${item.path.startsWith('/') ? item.path : `/${item.path}`}`;
          if (item.src) return item.src;
          if (item.filename) return `${API_BASE}/images/${item.filename}`;
          return null;
        }).filter(Boolean);

        if (!cancelled) {
          setThumbs(normalized);
          // prefer data.imageUrl if present, otherwise first normalized image
          let main = null;
          if (data.imageUrl) {
            main = (typeof data.imageUrl === 'string' ? (data.imageUrl.startsWith('http') ? data.imageUrl : (data.imageUrl.startsWith('/') ? `${API_BASE}${data.imageUrl}` : `${API_BASE}/images/${data.imageUrl}`)) : null);
          }
          setMainImage(main || normalized[0] || mainImage);
        }
      } catch (err) {
        console.warn('fetchFull product error', err?.message || err);
      }
    };

    fetchFull();
    return () => { cancelled = true; };
  }, [product._id, product.id, token]);

  // derive a friendly stock count from common product fields
  const stockCount = (product && (product.stock ?? product.quantity ?? product.qty ?? product.inventory ?? product.inventoryCount ?? product.stockCount ?? product.inStock ?? product.stock_level));

  // Determine referrer/origin info from route params or navigation state
  // route.params may include: from: 'Home'|'Category'|'Search'|'ProductList', refCategory, refSearch
  const origin = (route && route.params && (route.params.from || route.params.referrer)) || null;
  const originCategory = route?.params?.refCategory || route?.params?.category || null;
  const originSearch = route?.params?.refSearch || route?.params?.search || null;

  const goBackToOrigin = () => {
    try {
      if (!origin) {
        // default: pop one
  if (navigation.goBack) return navigation.goBack();
  if (navigation.pop) return navigation.pop();
  // Home is inside the Main tab navigator, navigate to Main and request the Home tab
  return navigation.navigate('Main', { screen: 'Home' });
      }

      // If origin is ProductList or Category, navigate back to ProductList with filters
      if (origin === 'Category' || origin === 'ProductList' || origin === 'Browse') {
        return navigation.navigate('ProductList', { category: originCategory || undefined });
      }

      if (origin === 'Search') {
        return navigation.navigate('ProductList', { search: originSearch || undefined });
      }

      if (origin === 'Home') return navigation.navigate('Home');

      // fallback: goBack
      if (navigation.goBack) return navigation.goBack();
      if (navigation.pop) return navigation.pop();
      return navigation.navigate('Home');
    } catch (e) {
      console.warn('goBackToOrigin failed', e);
      if (navigation.goBack) return navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["transparent", "rgba(12,6,6,0.6)", "rgba(255,59,48,0.16)"]}
        start={[0,0]}
        end={[1,0]}
        style={styles.rightGradientFake}
        pointerEvents="none"
      />
      {/* Header */}
      <View style={styles.headerBar}>
          <View style={[styles.topBar, { paddingHorizontal: isDesktop ? 40 : 16 }] }>
          <View style={styles.breadcrumb}>
            {/* Breadcrumb: Home / All Products / Product (match design) */}
            <TouchableOpacity onPress={() => { navigation.navigate('Main', { screen: 'Home' }); }}>
              <Text style={styles.breadcrumbLink}>Home</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSep}>/</Text>

            <TouchableOpacity onPress={() => { navigation.navigate('Main', { screen: 'Products', params: { category: originCategory || undefined } }); }}>
              <Text style={styles.breadcrumbLink}>All Products</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSep}>/</Text>

            <Text style={styles.breadcrumbCurrent}>{displayName(product.name) || 'Product'}</Text>
          </View>

          <View style={styles.prevNext}>
            <TouchableOpacity onPress={onPrevProduct} style={styles.prevNextBtn} accessibilityLabel="Prev">
              <Icon name="chevron-left" size={16} color="#ccc" />
              <Text style={styles.prevNextText}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNextProduct} style={styles.prevNextBtn} accessibilityLabel="Next">
              <Text style={styles.prevNextText}>Next</Text>
              <Icon name="chevron-right" size={16} color="#ccc" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Body (scrollable) */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          // reserve extra bottom space so last content can scroll fully above the footer
          // reduced mobile padding to avoid long empty gap while still keeping content above the footer
          contentContainerStyle={{ paddingBottom: (isMobile ? 84 : 28) }}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const y = nativeEvent?.contentOffset?.y || 0;
            setShowScrollTop(y > 520);
          }}
          scrollEventThrottle={16}
        >
  <View style={{ paddingHorizontal: 20 }}>
    <View style={styles.centerWrap}>
      <View style={gridStyle}>
        <View style={leftColStyle}>
    <View style={[styles.largeImageContainer, isMobile ? styles.largeImageContainerMobile : {}, { width: imageW, height: imageH }]}> 
            {mainImage ? (
              <View>
                <TouchableOpacity activeOpacity={1} onPress={() => openImage(mainImage)}>
                  <Image
                    source={getImageSource(mainImage, product)}
                    style={[styles.productImageInner, isMobile ? styles.productImageInnerMobile : {}, { width: Math.round(imageW), height: Math.round(imageH) }]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                {/* back overlay removed to keep UI minimal */}
              </View>
            ) : (
              <View style={[styles.largeNoImage, { width: imageW, height: imageH }]}>
                <Icon name="image" size={Math.min(80, Math.round(imageW / 5))} color="#333" />
              </View>
            )}
          </View>

          <View style={[styles.shortDescCard, { width: imageW }]}>
            <Text style={styles.shortDesc}>
              {product.description || "I'm a product description. This is a great place to add more information about your product."}
            </Text>
          </View>
          {thumbs && thumbs.length > 0 && (
            <View style={styles.thumbRow}>
                {thumbs.slice(0,3).map((u, i) => {
                  const selected = makeImageUrl(mainImage) === makeImageUrl(u);
                  const thumbSize = isDesktop ? 56 : 64;
                  return (
                    <TouchableOpacity key={i} activeOpacity={1} onPress={() => setMainImage(u)}>
                      <Image source={getImageSource(u, product)} style={[styles.thumb, { width: thumbSize, height: thumbSize, marginRight: 12, borderRadius: 6 }, selected ? { borderWidth: 2, borderColor: '#FF3B30' } : {} ]} />
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}
        </View>

        <View style={rightColStyle}>
          <View style={{ paddingLeft: isDesktop ? 28 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[styles.prodTitle, { fontSize: isDesktop ? 20 : isTablet ? 22 : 24 }]}>{displayName(product.name) || 'Lamps'}</Text>
              <TouchableOpacity onPress={onShare} style={{ padding: 8 }}>
                <Icon name="share" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Rating stars and count: show with graceful defaults (0 reviews) and always render a link to Reviews screen */}
            <View style={styles.ratingRowTop}>
              <View style={styles.starsRow}>
                {(() => {
                  // compute average rating from product.rating or fallback to average of reviews
                  const rv = Array.isArray(reviews) ? reviews : [];
                  const avgFromReviews = rv.length ? (rv.reduce((s, x) => s + (x.rating || 0), 0) / rv.length) : 0;
                  const avg = Number(product.rating || avgFromReviews || 0);
                  const r = Number(isNaN(avg) ? 0 : avg);
                  const full = Math.floor(r);
                  const half = r - full >= 0.25 && r - full < 0.75;
                  const stars = [];
                  for (let i = 1; i <= 5; i++) {
                    if (i <= full) stars.push(<Icon key={i} name="star" size={18} color={'#FF3B30'} />);
                    else if (i === full + 1 && half) stars.push(<Icon key={i} name="star-half" size={18} color={'#FF3B30'} />);
                    else stars.push(<Icon key={i} name="star" size={18} color={'#332222'} />);
                  }
                  return stars;
                })()}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.ratingTextTop}>{Number(product.rating || (Array.isArray(reviews) && reviews.length ? (reviews.reduce((s, x) => s + (x.rating || 0), 0) / reviews.length) : 0)).toFixed(1)} | {(Array.isArray(reviews) && reviews.length ? reviews.length : reviewsCount || 0)} reviews</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Reviews', { product })} style={{ marginLeft: 12 }}>
                  <Text style={{ color: '#fff', textDecorationLine: 'underline' }}>View all reviews</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {product.price && product.salePrice && product.salePrice < product.price ? (
                <>
                  <Text style={styles.priceOld}>${Number(product.price).toFixed(2)}</Text>
                  <Text style={[styles.priceLarge, { fontSize: isDesktop ? 20 : 26 }]}> ${Number(product.salePrice).toFixed(2)}</Text>
                </>
              ) : (
                <Text style={[styles.priceLarge, { fontSize: isDesktop ? 20 : 26 }]}> ${Number(product.price || product.salePrice || 0).toFixed(2)}</Text>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.qtyLabel}>Quantity *</Text>
              { (stockCount !== undefined && stockCount !== null) && (
                <Text style={styles.stockText}>จำนวนในคลัง: {String(stockCount)}</Text>
              ) }
            </View>
            <View style={styles.qtyControlsRow}>
              <TouchableOpacity style={[styles.qtySmall, { paddingHorizontal: isDesktop ? 8 : 12, paddingVertical: isDesktop ? 6 : 10 }]} onPress={dec}><Text style={[styles.qtySmallText, { fontSize: isDesktop ? 14 : 16 }]}>-</Text></TouchableOpacity>
              <View style={[styles.qtyValue, { paddingHorizontal: isDesktop ? 12 : 16, paddingVertical: isDesktop ? 6 : 10 }]}><Text style={[styles.qtyValueText, { fontSize: isDesktop ? 14 : 16 }]}>{quantity}</Text></View>
              <TouchableOpacity style={[styles.qtySmall, { paddingHorizontal: isDesktop ? 8 : 12, paddingVertical: isDesktop ? 6 : 10 }]} onPress={inc}><Text style={[styles.qtySmallText, { fontSize: isDesktop ? 14 : 16 }]}>+</Text></TouchableOpacity>
            </View>

            <View style={styles.ctaWrap}>
              {(!(user && user.role === 'admin')) && (
                <>
                  <TouchableOpacity style={styles.outlineBtn} onPress={onAddToCart}>
                    <Text style={styles.outlineBtnText}>Add to Cart</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.primaryBtn} onPress={onBuyNow}>
                    <Text style={styles.primaryBtnText}>Buy Now</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Admin edit form CTA */}
              {(user && user.role === 'admin') && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: '#fff', marginBottom: 8, fontWeight: '700' }}>Admin: Edit product</Text>
                  <TextInput value={formName} onChangeText={setFormName} placeholder="Name" style={styles.input} placeholderTextColor="#999" />
                  <TextInput value={formCategory} onChangeText={setFormCategory} placeholder="Category" style={styles.input} placeholderTextColor="#999" />
                  <TextInput value={formPrice} onChangeText={setFormPrice} placeholder="Price" keyboardType="numeric" style={styles.input} placeholderTextColor="#999" />
                  <TextInput value={formStock} onChangeText={setFormStock} placeholder="Stock" keyboardType="numeric" style={styles.input} placeholderTextColor="#999" />
                  <TextInput value={formDescription} onChangeText={setFormDescription} placeholder="Description" style={[styles.input, { height: 100 }]} multiline placeholderTextColor="#999" />

                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginRight: 8 }]} onPress={async () => {
                      // Save (create or update)
                      setIsSaving(true);
                      try {
                        const payload = {
                          name: formName,
                          category: formCategory,
                          price: Number(formPrice) || 0,
                          stock: Number(formStock) || 0,
                          description: formDescription,
                        };
                        const headers = { Authorization: `Bearer ${token}` };
                        if (product && (product._id || product.id)) {
                          // update
                          const id = product._id || product.id;
                          await axios.put(`${API_BASE}/api/products/${id}`, payload, { headers });
                        } else {
                          // create
                          await axios.post(`${API_BASE}/api/products`, payload, { headers });
                        }
                        Alert.alert('สำเร็จ', 'บันทึกสินค้าเรียบร้อยแล้ว', [{ text: 'ตกลง', onPress: () => navigation.navigate('ProductList') }]);
                      } catch (err) {
                        console.warn('save product failed', err);
                        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถบันทึกสินค้าได้');
                      } finally {
                        setIsSaving(false);
                      }
                    }}>
                      {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save</Text>}
                    </TouchableOpacity>

                    {product && (product._id || product.id) && (
                      <TouchableOpacity style={[styles.deleteButton, { flex: 0.4, justifyContent: 'center' }]} onPress={async () => {
                        // delete
                        Alert.alert('ลบสินค้า', 'คุณต้องการลบสินค้านี้หรือไม่?', [
                          { text: 'ยกเลิก', style: 'cancel' },
                          { text: 'ลบ', style: 'destructive', onPress: async () => {
                            try {
                              const id = product._id || product.id;
                              await axios.delete(`${API_BASE}/api/products/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                              Alert.alert('สำเร็จ', 'ลบสินค้าเรียบร้อยแล้ว', [{ text: 'ตกลง', onPress: () => navigation.navigate('ProductList') }]);
                            } catch (err) {
                              console.warn('delete product failed', err);
                              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบสินค้าได้');
                            }
                          } }]
                        );
                      }}>
                        <Text style={{ color: '#b91c1c', fontWeight: '700' }}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            <View style={{ marginTop: 12 }}>
              <View style={styles.tabRow}>
                {[
                  { key: 'description', label: 'Description' },
                  { key: 'shipping', label: 'Shipping' },
                  { key: 'returns', label: 'Return & Refund Policy' },
                ].map(t => (
                  <TouchableOpacity key={t.key} onPress={() => setCurrentTab(t.key)} style={[styles.tabBtn, currentTab === t.key ? styles.tabBtnActive : {}]}>
                    <Text style={[styles.tabText, currentTab === t.key ? styles.tabTextActive : {}]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.tabContent}>
                {currentTab === 'description' && (
                  <Text style={styles.infoText}>{product.description || "No description available."}</Text>
                )}
                {/* specifications tab removed */}
                {currentTab === 'shipping' && (
                  <View>
                    <Text style={styles.infoText}>Shipping: {product.shippingInfo || 'Ships within 3-5 business days.'}</Text>
                  </View>
                )}
                {currentTab === 'returns' && (
                  <View>
                    <Text style={styles.infoText}>{product.returnPolicy || product.returnAndRefund || 'Return and refund policy is not provided for this product. Typically items can be returned within 14 days in original condition.'}</Text>
                  </View>
                )}
                    {currentTab === 'reviews' && (
                  <View>
                    {/* reviews tab removed */}
                  </View>
                )}
              </View>
            </View>

            {/* Return & Refund Policy moved into the tabs above (no duplicate here) */}
          </View>
        </View>
      </View>
    </View>

    {/* Reviews summary removed per design request */}
    {/* Related products "You Might Also Like" (centered, below reviews summary) */}
    <View style={{ marginTop: 28, width: '100%', alignItems: 'center' }}>
      <Text style={[styles.sectionTitleWhite, { alignSelf: 'flex-start', marginLeft: 20, marginBottom: 12 }]}>You Might Also Like</Text>
      {(() => {
        const relatedList = (topSellers && topSellers.length > 0) ? topSellers : relatedProducts;
        const list = (relatedList || []).slice(0, 5);
        if (!list || list.length === 0) return (<Text style={[styles.infoText, { marginLeft: 20 }]}>No recommendations found.</Text>);
        // Web: use overflow auto with horizontal row and fixed card widths
        if (isWeb) {
          const onWheel = (e) => {
            try {
              const dx = Math.abs(e.deltaX || 0);
              const dy = Math.abs(e.deltaY || 0);
              if (dx > dy) e.stopPropagation();
            } catch (err) { /* ignore */ }
          };
          return (
            <View style={{ width: '100%', paddingHorizontal: 20 }}>
              <View onWheel={onWheel} style={styles.swiperRow}>
                {list.map((p, i) => {
                  const onSale = (p.salePrice && Number(p.salePrice) < Number(p.price || p.salePrice || 0));
                  return (
                    <View key={p._id || p.id || i} style={[styles.swiperCard, { width: 432, marginRight: i < list.length - 1 ? 30 : 0 }]}>
                      {onSale && (<View style={styles.saleRibbon}><Text style={styles.saleRibbonText}>Sale</Text></View>)}
                      <TouchableOpacity onPress={() => navigation.replace('ProductForm', { product: p })}>
                        <Image source={getImageSource(p.imageUrl || (p.images && p.images[0]) || p.image)} style={[styles.relatedImage, { height: relatedImageHeight }]} />
                        <Text style={styles.relatedName} numberOfLines={2}>{displayName(p.name)}</Text>
                        <Text style={styles.relatedPrice}>${Number(p.price || p.salePrice || 0).toFixed(2)}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        }

        // Mobile/native: horizontal ScrollView with same card widths and gaps (increase gap on small screens)
        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: (isMobile ? 84 : 28), alignItems: 'flex-start' }}
          >
            {list.map((p, i) => {
              const onSale = (p.salePrice && Number(p.salePrice) < Number(p.price || p.salePrice || 0));
              const gap = isMobile ? 40 : 30; // larger gap on mobile
              return (
                <View key={p._id || p.id || i} style={[styles.swiperCard, { width: 320, marginRight: i < list.length - 1 ? gap : 0 }]}>
                  {onSale && (<View style={styles.saleRibbon}><Text style={styles.saleRibbonText}>Sale</Text></View>)}
                  <TouchableOpacity onPress={() => navigation.replace('ProductForm', { product: p })}>
                    <Image source={getImageSource(p.imageUrl || (p.images && p.images[0]) || p.image)} style={[styles.relatedImage, { height: relatedImageHeight }]} />
                    <Text style={styles.relatedName} numberOfLines={2}>{displayName(p.name)}</Text>
                    <Text style={styles.relatedPrice}>${Number(p.price || p.salePrice || 0).toFixed(2)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        );
      })()}
    </View>
    {/* Payment methods block (centered, below related products) */}
    <View style={{ marginTop: 28, width: '100%', alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 12 }}>Payment Methods</Text>
      <View style={styles.paymentMethodsRow}>
        {(() => {
          // Render in the order shown in design: Mastercard, UnionPay, Diners, Amex, Discover, Visa
          const keys = ['mastercard', 'unionpay', 'diners', 'amex', 'discover', 'visa'];
          return keys.map((k) => {
            const img = assetsIndex.map[k] || assetsIndex.map[{
              'mastercard': 'Master Card.avif',
              'unionpay': 'China Union Pay.avif',
              'diners': 'Diners.avif',
              'amex': 'American Express.avif',
              'discover': 'Discover.avif',
              'visa': 'Visa.avif'
            }[k]];
            if (img) return (<Image key={k} source={img} style={[styles.payBadgeImage, { width: badgeWidth, height: badgeHeight }]} />);
            // fallback small text badge
            const label = k === 'mastercard' ? 'MC' : (k === 'unionpay' ? 'UP' : k.toUpperCase());
            return (<View key={k} style={styles.payBadge}><Text style={styles.payBadgeText}>{label}</Text></View>);
          });
        })()}
      </View>
    </View>
  </View>
</ScrollView>


      </View>

      {/* Image modal for zoom */}
  <Modal visible={showImageModal} transparent animationType="none" onRequestClose={closeImage}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={styles.modalCloseArea} onPress={closeImage} />
          <View style={styles.modalContent}>
            {modalImage ? (
              <Image source={modalImage} style={styles.modalImage} resizeMode="contain" />
            ) : (
              <ActivityIndicator size="large" color="#fff" />
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeImage}><Text style={{ color: '#fff' }}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Footer removed */}
      {/* Quick Cart Sidebar (shared component) */}
      <QuickCartSidebar visible={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} />

      {/* Floating Mobile Toggle Button (only visible on small screens) */}
      {isMobile && (
        <TouchableOpacity style={styles.mobileToggle} onPress={toggleMobileSidebar} accessibilityLabel="Open quick actions">
          <Icon name="menu" size={22} color="#fff" />
        </TouchableOpacity>
      )}
      {showScrollTop && (
        <TouchableOpacity
          accessible
          accessibilityLabel="top of page"
          accessibilityRole="button"
          nativeID="SCROLL_TO_TOP"
          style={styles.scrollTopBtn}
          onPress={() => {
            try { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); } catch (e) { /* ignore */ }
          }}
        >
          <Text style={styles.scrollTopText}>↑</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100%', backgroundColor: '#000' },
  topBar: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbLink: { color: '#fff', opacity: 0.9, fontSize: 12 },
  breadcrumbSep: { color: '#fff', opacity: 0.6, marginHorizontal: 8, fontSize: 12 },
  breadcrumbCurrent: { color: '#fff', fontWeight: '700', fontSize: 12 },
  prevNext: { flexDirection: 'row', alignItems: 'center' },
  prevNextBtn: { marginLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  prevNextText: { color: '#ddd', fontSize: 12 },

  content: { paddingBottom: 60 },
  centerWrap: { alignItems: 'center' },
  grid: { gap: 24 },
  leftCol: { alignItems: 'center' },
  rightCol: { },
  largeImage: { borderRadius: 6, backgroundColor: '#111' },
  largeNoImage: { alignItems: 'center', justifyContent: 'center' },
  largeImageContainer: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f2', padding: 24, borderRadius: 8 },
  largeImageContainerMobile: { width: '100%', alignItems: 'center', justifyContent: 'center', padding: 16 },
  productImageInner: { backgroundColor: 'transparent', width: '100%', height: '100%' },
  productImageInnerMobile: { width: '100%' },
  shortDescCard: { marginTop: 18 },
  shortDesc: { color: '#ddd', fontSize: 12, lineHeight: 18, maxWidth: 520 },

  prodTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  ratingRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  starsRow: { flexDirection: 'row', marginRight: 8 },
  ratingTextTop: { color: '#ddd', marginLeft: 8, fontSize: 12 },
  priceLarge: { fontSize: 20, color: '#fff', fontWeight: '700', marginVertical: 12 },
  priceOld: { color: '#bbb', textDecorationLine: 'line-through', marginRight: 8, fontSize: 14 },
  qtyLabel: { color: '#ddd', marginTop: 8 },
  stockText: { color: '#ccc', fontSize: 12 },
  qtyControlsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  qtySmall: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#444' },
  qtySmallText: { color: '#fff', fontWeight: '700' },
  qtyValue: { marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#111', borderRadius: 6, borderWidth: 1, borderColor: '#333' },
  qtyValueText: { color: '#fff' },

  outlineBtn: { marginTop: 12, borderWidth: 1, borderColor: '#fff', paddingVertical: 12, borderRadius: 24, alignItems: 'center', width: '100%', maxWidth: 320, backgroundColor: 'transparent' },
  outlineBtnText: { color: '#fff', fontWeight: '700' },
  primaryBtn: { marginTop: 12, backgroundColor: '#FF3B30', paddingVertical: 12, borderRadius: 24, alignItems: 'center', width: '100%', maxWidth: 320 },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

  ctaWrap: { marginTop: 12, width: '100%', maxWidth: 320, alignItems: 'center', justifyContent: 'center' },

  infoSections: { marginTop: 18, color: '#ddd' },
  infoTitle: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  infoText: { color: '#ddd', lineHeight: 18 },

  statsRow: { flexDirection: 'row', marginTop: 14, alignItems: 'flex-start' },
  ratingSummaryLeft: { width: 140, alignItems: 'flex-start' },
  summaryLabel: { color: '#fff', fontWeight: '700' },
  summaryScore: { color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 6 },
  summaryCount: { color: '#ccc', fontSize: 12 },

  ratingBars: { flex: 1, paddingLeft: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel: { width: 48, color: '#ccc', fontSize: 12 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#2b2b2b', borderRadius: 6, marginHorizontal: 8 },
  barFill: { height: 8, backgroundColor: '#FF3B30', borderRadius: 6 },
  barCount: { width: 24, color: '#ccc', fontSize: 12, textAlign: 'right' },
  sectionTitleWhite: { color: '#fff', fontWeight: '700', fontSize: 16 },
  leaveReviewBtn: { borderWidth: 1, borderColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  leaveReviewText: { color: '#fff' },
  reviewFormCard: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#333', borderRadius: 8, backgroundColor: 'transparent' },
  formLabel: { color: '#ddd', marginBottom: 6 },
  formInput: { backgroundColor: '#0d0d0d', color: '#fff', borderWidth: 1, borderColor: '#333', padding: 10, borderRadius: 6 },
  charCounter: { color: '#888', fontSize: 12, alignSelf: 'flex-end', marginTop: 4 },
  reviewInput: { backgroundColor: '#0d0d0d', color: '#fff', borderWidth: 1, borderColor: '#333', padding: 10, borderRadius: 6, textAlignVertical: 'top' },
  imagesRow: { flexDirection: 'row', marginTop: 8 },
  imagePlaceholder: { width: 72, height: 72, borderWidth: 1, borderStyle: 'dashed', borderColor: '#444', borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  formCancelBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'transparent', borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#666' },
  formCancelText: { color: '#ddd' },
  formSubmitBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FF3B30', borderRadius: 8 },
  formSubmitText: { color: '#fff', fontWeight: '700' },

  reviewCard: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#222', borderRadius: 8, backgroundColor: 'transparent' },
  reviewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthorWhite: { color: '#fff', fontWeight: '700' },
  reviewDate: { color: '#888', fontSize: 12 },
  reviewCardText: { color: '#ddd', marginTop: 8 },
  reviewsWrap: { marginTop: 28, width: '100%', flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20 },
  reviewsLeft: { flex: 1, paddingRight: 20 },
  reviewsRight: { width: 360 },
  reviewGrid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  headerBar: { borderBottomWidth: 1, borderBottomColor: '#1a1a1a', paddingBottom: 8, backgroundColor: 'transparent' },
  rightGradientFake: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '55%' },
  // footer styles removed
  relatedWrap: { marginTop: 28, width: '100%', alignItems: 'center' },
  relatedTitle: { color: '#fff', fontWeight: '700', alignSelf: 'flex-start', marginLeft: '5%', marginBottom: 12 },
  relatedScroll: { paddingHorizontal: '5%' },
  relatedCard: { marginRight: 18, backgroundColor: '#0d0d0d', borderRadius: 6, padding: 10, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
  relatedImage: { width: '100%', backgroundColor: '#ddd', borderRadius: 4 },
  relatedName: { color: '#fff', marginTop: 10, fontSize: 12 },
  relatedPrice: { color: '#ccc', fontSize: 12, marginTop: 6 },
  bestSellerBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, zIndex: 10 },
  bestSellerText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  thumbRow: { flexDirection: 'row', marginTop: 14, alignItems: 'center' },
  thumb: { width: 56, height: 56, marginRight: 12 },
  paymentMethodsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', maxWidth: '100%' },
  payBadge: { width: 52, height: 28, borderRadius: 6, backgroundColor: '#111', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  payBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  payBadgeImage: { width: 64, height: 32, marginHorizontal: 8, resizeMode: 'contain', maxWidth: 64 },
  tabRow: { flexDirection: 'row', marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 8 },
  tabBtn: { marginRight: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#FF3B30' },
  tabText: { color: '#ccc' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  tabContent: { marginTop: 12 },
  swiperRow: { flexDirection: 'row', overflow: 'auto', alignItems: 'flex-start', paddingVertical: 6 },
  swiperCard: { backgroundColor: 'transparent', borderRadius: 6, overflow: 'hidden' },
  saleRibbon: { position: 'absolute', left: 8, top: 8, backgroundColor: '#FF3B30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, zIndex: 5 },
  saleRibbonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  imagePlaceholderSmall: { width: 64, height: 64, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#444', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  priceOld: { color: '#bbb', textDecorationLine: 'line-through', marginRight: 8 },
  /* footer styles removed */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseArea: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  modalContent: { width: '100%', flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalImage: { width: '100%', height: '80%' },
  modalCloseButton: { marginTop: 18, backgroundColor: 'rgba(255,59,48,0.9)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
  scrollTopBtn: { position: 'absolute', right: 18, bottom: 90, width: 52, height: 52, borderRadius: 26, backgroundColor: '#ff4d36', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  scrollTopText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  /* Mobile sidebar styles */
  sidebarOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  mobileSidebar: { position: 'absolute', right: -320, top: 0, bottom: 0, width: 320, backgroundColor: '#0b0b0b', borderLeftWidth: 1, borderLeftColor: '#222', padding: 16, zIndex: 60, shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 20, transitionProperty: 'right' },
  mobileSidebarOpen: { right: 0 },
  sidebarHandleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sidebarTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  sidebarBody: { paddingTop: 6 },
  paymentChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8, backgroundColor: 'transparent' },
  mobileToggle: { position: 'absolute', right: 18, bottom: 150, width: 56, height: 56, borderRadius: 28, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', zIndex: 70, elevation: 12 },
});

export default ProductForm;
