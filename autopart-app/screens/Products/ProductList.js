import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Animated,
  Easing,
  Modal,
  Platform,
  Image,
  ScrollView,
  Dimensions,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import assetsIndex from '../../assets/assetsIndex';
import axios from 'axios';
import { apiUrl } from '../../utils/apiConfig';
import AuthContext from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CartContext from '../../context/CartContext';
import { emit } from '../../utils/eventBus';
import { LinearGradient } from 'expo-linear-gradient';

// Currency formatter (frontend only) - display in USD
const formatUSD = (value) => {
  try {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  } catch (e) {
    return `$${value}`;
  }
};

const ProductList = ({ navigation, route }) => {
  const { user, token, logout } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [animating, setAnimating] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [limit] = useState(200);

  // responsive columns for grid (make tiles smaller on wider screens)
  const [columns, setColumns] = useState(2);

  // sorting state
  const [sortOption, setSortOption] = useState('recommended');
  const [showSortModal, setShowSortModal] = useState(false);

  // window size for responsive layout (move sidebar on mobile)
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  // compact Browse By - on mobile we hide the sidebar entirely

  // Category filter states
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showPriceExpand, setShowPriceExpand] = useState(false);
  // price slider defaults and selection
  const PRICE_MIN_DEFAULT = 0;
  const PRICE_MAX_DEFAULT = 9999;
  const [priceMin, setPriceMin] = useState(PRICE_MIN_DEFAULT);
  const [priceMax, setPriceMax] = useState(PRICE_MAX_DEFAULT);
  // the active applied price filter; null means no price filtering
  const [activePriceFilter, setActivePriceFilter] = useState(null);
  // remove debounce; search will run only on submit
  const searchTimeout = useRef(null);
  const listFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [currentPage]); // เพิ่ม currentPage เป็น dependency

  // adjust columns based on window width so product tiles shrink on wide screens
  useEffect(() => {
    const setColsFromWidth = ({ window }) => {
      const w = window?.width || Dimensions.get('window').width;
      if (w >= 1200) setColumns(4);
      else if (w >= 900) setColumns(3);
      else setColumns(2); // minimum 2 columns on narrow screens
    };

    // initialize
    setColsFromWidth({ window: Dimensions.get('window') });

    // subscribe to dimension changes
    if (Dimensions.addEventListener) {
      const sub = Dimensions.addEventListener('change', setColsFromWidth);
      return () => { if (sub && sub.remove) sub.remove(); };
    } else if (Dimensions.addEventListener === undefined && Dimensions.removeEventListener) {
      Dimensions.addEventListener('change', setColsFromWidth);
      return () => Dimensions.removeEventListener('change', setColsFromWidth);
    }
  }, []);

  // Refresh ข้อมูลทุกครั้งที่เข้าหน้า
  useFocusEffect(
    React.useCallback(() => {
      // When the screen is focused, fetch products. If navigation provided a category param,
      // apply it immediately to avoid an initial unfiltered load.
      const cat = route && route.params && route.params.category;
      setCurrentPage(1);
      if (cat) {
        setSelectedCategories([cat]);
        // fetch with the provided category so backend returns filtered results
        fetchProductsWithFilters(1, search, [cat]);
      } else {
        // no category param: clear any prior selection and fetch normally
        setSelectedCategories([]);
        fetchProducts(1);
      }
    }, [route && route.params && route.params.category])
  );

  const fetchProducts = async (page = currentPage) => {
    await fetchProductsWithFilters(page, search, selectedCategories);
  };

  // ฟังก์ชันสำหรับดึงหมวดหมู่ทั้งหมด
  const fetchCategories = async () => {
    try {
  const base = (!user || !token) ? apiUrl('/api/public/products') : apiUrl('/api/products');
  const response = await axios.get(`${base}?limit=100`, (!user || !token) ? {} : { headers: { Authorization: `Bearer ${token}` } });
      const payload = response?.data?.data || response?.data || {};
      const productsList = Array.isArray(payload) ? payload : (payload.products || payload);
      const productsArr = Array.isArray(productsList) ? productsList : [];
      const uniqueCategories = [...new Set(productsArr.map(product => product && product.category).filter(Boolean))].sort();
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPage(1);
    await fetchProducts(1);
    setRefreshing(false);
  };

  // ฟังก์ชันสำหรับค้นหา (debounced)
  const performSearch = async (searchText) => {
    // animation: fade out list
    setAnimating(true);
    const useNative = Platform.OS !== 'web';
    Animated.timing(listFade, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: useNative,
    }).start();

    setLoading(true);
    try {
      const searchParam = searchText ? `&search=${encodeURIComponent(searchText)}` : '';
      const categoryParam = selectedCategories.length > 0 ? `&category=${selectedCategories.join(',')}` : '';
  const base = (!user || !token) ? apiUrl('/api/public/products') : apiUrl('/api/products');
  const response = await axios.get(`${base}?page=1&limit=${limit}${searchParam}${categoryParam}`, (!user || !token) ? {} : { headers: { Authorization: `Bearer ${token}` } });

      const payload = response?.data?.data || response?.data || {};
      const dataProducts = Array.isArray(payload) ? payload : (payload.products || []);
      // small delay so fade-out is noticeable
      setTimeout(() => {
        setProducts(Array.isArray(dataProducts) ? dataProducts : []);
        setTotalPages(payload.totalPages || payload.total_pages || 1);
        setTotalProducts(payload.totalProducts || payload.total || (Array.isArray(dataProducts) ? dataProducts.length : 0));
        // fade in
        Animated.timing(listFade, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: useNative,
        }).start(() => setAnimating(false));
      }, 140);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        await logout();
        return;
      }
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถค้นหาข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // handleSearch updates the input only; actual fetch happens on submit
  const handleSearch = (searchText) => {
    setSearch(searchText);
  };

  const submitSearch = () => {
    setCurrentPage(1);
    performSearch(search);
  };

  // ฟังก์ชันสำหรับจัดการหมวดหมู่
  const toggleCategory = (category) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      
      // ทำการค้นหาใหม่ด้วยหมวดหมู่ที่เลือก
  setCurrentPage(1);
  // call immediately when category toggled
  fetchProductsWithFilters(1, search, newCategories);
      
      return newCategories;
    });
  };

  const clearCategoryFilter = () => {
    setSelectedCategories([]);
    setCurrentPage(1);
    fetchProductsWithFilters(1, search, []);
  };

  // ฟังก์ชันรวมสำหรับค้นหาด้วย filter ทั้งหมด
  const fetchProductsWithFilters = async (page = 1, searchText = search, categories = selectedCategories) => {
    // Defensive: if `categories` is provided as a single string (from navigation), convert to array
    if (categories && typeof categories === 'string') categories = [categories];
    setLoading(true);
    try {
      const searchParam = searchText ? `&search=${encodeURIComponent(searchText)}` : '';
      const categoryParam = categories.length > 0 ? `&category=${categories.join(',')}` : '';
  const base = (!user || !token) ? apiUrl('/api/public/products') : apiUrl('/api/products');
  const response = await axios.get(`${base}?page=${page}&limit=${limit}${searchParam}${categoryParam}`, (!user || !token) ? {} : { headers: { Authorization: `Bearer ${token}` } });
      const payload = response?.data?.data || response?.data || {};
      const dataProducts = Array.isArray(payload) ? payload : (payload.products || []);
      setProducts(Array.isArray(dataProducts) ? dataProducts : []);
      setTotalPages(payload.totalPages || payload.total_pages || 1);
      setTotalProducts(payload.totalProducts || payload.total || (Array.isArray(dataProducts) ? dataProducts.length : 0));
      setCurrentPage(page);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // if unauthorized on protected endpoint, force logout
        try { await logout(); } catch (e) {}
        return;
      }
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถค้นหาข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันสำหรับเปลี่ยนหน้า
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      fetchProducts(page);
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert(
      'ลบสินค้า',
      `คุณต้องการลบสินค้า "${name}" หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(apiUrl(`/api/products/${id}`), {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              await fetchProducts();
              Alert.alert('สำเร็จ', 'ลบสินค้าเรียบร้อยแล้ว');
            } catch (error) {
              if (error.response?.status === 401 || error.response?.status === 403) {
                Alert.alert('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่', [
                  { text: 'ตกลง', onPress: async () => await logout() }
                ]);
                return;
              }
              Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบสินค้าได้');
            }
          },
        },
      ]
    );
  };

  const getStockStatus = (quantity) => {
    if (quantity <= 0) return { text: 'หมด', color: '#FF3B30' };
    if (quantity <= 10) return { text: 'ใกล้หมด', color: '#FF9500' };
    return { text: 'ปกติ', color: '#34C759' };
  };

  // Try to resolve an image from frontend assets first (by imageUrl filename, SKU base, imageFilename, category, or name).
  // If none found, fall back to a placeholder.
  const getImageSource = (item) => {
    if (!item) return { uri: 'https://via.placeholder.com/530x708.png?text=Part' };

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

    // 1) If product has imageUrl that points to /images/<filename>, try that filename
    if (item.imageUrl && typeof item.imageUrl === 'string') {
      const m = item.imageUrl.match(/\/images\/(.+)$/i);
      if (m && m[1]) {
        const fname = m[1].replace(/\.[^/.]+$/, '').toLowerCase();
        const r = tryKey(fname);
        if (r) return r;
      }
    }

    // 2) imageFilename field (if present)
    if (item.imageFilename) {
      const nameNoExt = item.imageFilename.toString().replace(/\.[^/.]+$/, '');
      const r = tryKey(nameNoExt);
      if (r) return r;
    }

    // 3) category name
    if (item.category) {
      const r = tryKey(item.category);
      if (r) return r;
    }

    // 4) SKU base (strip trailing digits)
    if (item.sku) {
      const skuBase = item.sku.toString().toLowerCase().replace(/\d+$/,'');
      const r = tryKey(skuBase);
      if (r) return r;
    }

    // 5) product name (try variants)
    if (item.name) {
      const name = item.name.toString();
      const simple = name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim();
      const r1 = tryKey(simple);
      if (r1) return r1;
      const compact = simple.replace(/\s+/g, '');
      const r2 = tryKey(compact);
      if (r2) return r2;
    }

    // fallback placeholder
    return { uri: 'https://via.placeholder.com/530x708.png?text=Part' };
  };

  // Helper to normalize display name:
  // - Remove occurrences of the word "model" (case-insensitive) and any following numbers
  // - Remove trailing separators like '-' or ':'
  // Example: 'Lamps - Model 638' -> 'Lamps'
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

  // PriceRangeSlider: simple double-thumb slider using PanResponder + Animated
  const PriceRangeSlider = ({ min = PRICE_MIN_DEFAULT, max = PRICE_MAX_DEFAULT, valueMin, valueMax, onChange }) => {
    const trackWidth = useRef(0);
    const leftX = useRef(new Animated.Value(0)).current;
    const rightX = useRef(new Animated.Value(0)).current;
    const leftPan = useRef(null);
    const rightPan = useRef(null);
  const startLeft = useRef(0);
  const startRight = useRef(0);
  const leftPosRef = useRef(0);
  const rightPosRef = useRef(0);
  const leftPointerOffset = useRef(0);
  const rightPointerOffset = useRef(0);
    const MIN_GAP_PX = 12; // minimum pixel gap between thumbs

    // position thumbs when values change or when track width becomes known
    useEffect(() => {
      const w = trackWidth.current || 0;
      if (w <= 0) return;
      const leftPos = ((valueMin - min) / (max - min)) * w;
      const rightPos = ((valueMax - min) / (max - min)) * w;
      leftX.setValue(leftPos);
      rightX.setValue(rightPos);
    }, [valueMin, valueMax, min, max]);

    // keep refs of current animated values for fast reads without calling __getValue all the time
    useEffect(() => {
      const lId = leftX.addListener(({ value }) => { leftPosRef.current = value; });
      const rId = rightX.addListener(({ value }) => { rightPosRef.current = value; });
      return () => {
        leftX.removeListener(lId);
        rightX.removeListener(rId);
      };
    }, []);

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // During dragging we avoid calling parent onChange to prevent costly re-renders.
    // Instead we update local display values (fast) and call onChange once on release.
    const [displayMin, setDisplayMin] = useState(valueMin);
    const [displayMax, setDisplayMax] = useState(valueMax);

    useEffect(() => {
      // keep display values in sync when parent updates values
      setDisplayMin(valueMin);
      setDisplayMax(valueMax);
    }, [valueMin, valueMax]);

    const rafRef = useRef(null);
    const scheduleUpdate = (minV, maxV) => {
      // coalesce UI-only display updates to the next animation frame
      if (rafRef.current) {
        rafRef.current.min = minV;
        rafRef.current.max = maxV;
        return;
      }
      rafRef.current = { min: minV, max: maxV };
      rafRef.current.id = requestAnimationFrame(() => {
        try {
          setDisplayMin(rafRef.current.min);
          setDisplayMax(rafRef.current.max);
        } catch (e) {}
        rafRef.current = null;
      });
    };

    const createPan = (isLeft) => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        // capture starting positions from the animated listeners (safe)
        startLeft.current = leftPosRef.current || 0;
        startRight.current = rightPosRef.current || (trackWidth.current || 0);
        // compute pointer offset so thumb won't jump when user touches anywhere on thumb
        if (e && e.nativeEvent && typeof e.nativeEvent.locationX === 'number') {
          const localX = e.nativeEvent.locationX - 8; // account for left padding
          if (isLeft) {
            leftPointerOffset.current = localX - startLeft.current;
          } else {
            rightPointerOffset.current = localX - startRight.current;
          }
        } else {
          leftPointerOffset.current = 0;
          rightPointerOffset.current = 0;
        }
      },
      onPanResponderMove: (e, gesture) => {
        // Use local pointer position (nativeEvent.locationX) when available so thumb follows finger precisely.
        const w = trackWidth.current || 1;
        let localX = null;
        if (e && e.nativeEvent && typeof e.nativeEvent.locationX === 'number') {
          // locationX is relative to container; subtract left padding 8
          localX = e.nativeEvent.locationX - 8;
        }
        const dx = gesture.dx || 0;

          if (isLeft) {
          let newLeft;
          if (localX !== null) {
            // subtract pointer offset so the thumb follows finger without jumping
            newLeft = clamp(localX - (leftPointerOffset.current || 0), 0, Math.max(0, (rightPosRef.current || startRight.current) - MIN_GAP_PX));
          } else {
            newLeft = clamp(startLeft.current + dx, 0, Math.max(0, startRight.current - MIN_GAP_PX));
          }
          leftX.setValue(newLeft);
          const pct = clamp(newLeft / w, 0, 1);
          const newVal = Math.round(min + pct * (max - min));
          // update local display only (avoids parent re-render on each move)
          scheduleUpdate(Math.min(newVal, valueMax), valueMax);
        } else {
          let newRight;
          if (localX !== null) {
            newRight = clamp(localX - (rightPointerOffset.current || 0), Math.min(w, (leftPosRef.current || startLeft.current) + MIN_GAP_PX), w);
          } else {
            newRight = clamp(startRight.current + dx, Math.min(w, startLeft.current + MIN_GAP_PX), w);
          }
          rightX.setValue(newRight);
          const pct = clamp(newRight / w, 0, 1);
          const newVal = Math.round(min + pct * (max - min));
          // update local display only
          scheduleUpdate(valueMin, Math.max(newVal, valueMin));
        }
      },
      onPanResponderRelease: (e, gesture) => {
        // compute final values based on current Animated values and call onChange once
        const w = trackWidth.current || 1;
        const curLeft = (leftX.__getValue ? leftX.__getValue() : startLeft.current);
        const curRight = (rightX.__getValue ? rightX.__getValue() : startRight.current);
        if (isLeft) {
          const pct = clamp(curLeft / w, 0, 1);
          const newVal = Math.round(min + pct * (max - min));
          // commit final value to parent
          onChange(Math.min(newVal, valueMax), valueMax);
          // ensure display is synced
          setDisplayMin(Math.min(newVal, valueMax));
        } else {
          const pct = clamp(curRight / w, 0, 1);
          const newVal = Math.round(min + pct * (max - min));
          onChange(valueMin, Math.max(newVal, valueMin));
          setDisplayMax(Math.max(newVal, valueMin));
        }
      },
    });

    if (!leftPan.current) leftPan.current = createPan(true);
    if (!rightPan.current) rightPan.current = createPan(false);

    useEffect(() => {
      return () => {
        if (rafRef.current && rafRef.current.id) cancelAnimationFrame(rafRef.current.id);
      };
    }, []);

    return (
      <View style={{ paddingVertical: 12 }}>
        <View
          style={{ height: 36, justifyContent: 'center' }}
          onLayout={(ev) => {
            // compute effective track width (subtract left/right padding = 8+8)
            const layoutW = ev.nativeEvent.layout.width;
            trackWidth.current = Math.max(0, layoutW - 16);
            const w = trackWidth.current;
            if (w > 0) {
              const l = ((valueMin - min) / (max - min)) * w;
              const r = ((valueMax - min) / (max - min)) * w;
              leftX.setValue(l);
              rightX.setValue(r);
            }
          }}
        >
          <View style={styles.sliderTrack} />
          {/* filled track */}
          <Animated.View
            style={[styles.sliderFilled, {
              left: Animated.add(leftX, new Animated.Value(8)),
              width: Animated.subtract(rightX, leftX),
            }]}
          />

          <Animated.View
            {...leftPan.current.panHandlers}
            style={[styles.thumb, { transform: [{ translateX: leftX }] }]}
          />
          <Animated.View
            {...rightPan.current.panHandlers}
            style={[styles.thumb, { transform: [{ translateX: rightX }] }]}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ color: '#fff' }}>{formatUSD(displayMin)}</Text>
          <Text style={{ color: '#fff' }}>{formatUSD(displayMax)}</Text>
        </View>
      </View>
    );
  };

  // pad product list with invisible placeholders so last row keeps same card size
  // apply client-side sort to products before padding
  const applySort = (list = [], option = sortOption) => {
    if (!Array.isArray(list)) return list;
    const copy = [...list];
    switch (option) {
      case 'newest':
        // assume items have a `createdAt` or `_createdAt` field; fall back to _id timestamp
        return copy.sort((a, b) => new Date(b.createdAt || b._createdAt || 0) - new Date(a.createdAt || a._createdAt || 0));
      case 'price_asc':
        return copy.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      case 'price_desc':
        return copy.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
      case 'name_asc':
        return copy.sort((a, b) => (displayName(a.name || a.title || '').localeCompare(displayName(b.name || b.title || ''))));
      case 'name_desc':
        return copy.sort((a, b) => (displayName(b.name || b.title || '').localeCompare(displayName(a.name || a.title || ''))));
      case 'recommended':
      default:
        return copy; // keep server/default order
    }
  };

  // apply active price filter (client-side) before sorting
  const filteredByPrice = activePriceFilter ? products.filter(p => {
    const pval = Number(p.salePrice || p.price || p.originalPrice || 0);
    return pval >= (activePriceFilter.min || PRICE_MIN_DEFAULT) && pval <= (activePriceFilter.max || PRICE_MAX_DEFAULT);
  }) : products;

  const sortedProducts = applySort(filteredByPrice, sortOption);

  const paddedProducts = (() => {
    const cols = Math.max(1, columns || 1);
    const rem = sortedProducts.length % cols;
    const missing = rem === 0 ? 0 : cols - rem;
    if (missing === 0) return sortedProducts;
    const pads = Array.from({ length: missing }).map((_, i) => ({ _id: `__blank_${i}_${cols}`, __empty: true }));
    return [...sortedProducts, ...pads];
  })();

  const cartCtx = useContext(CartContext);

  const renderProduct = ({ item, index }) => {
    // render placeholder invisible card to keep layout
    if (item && item.__empty) {
      return <View style={[styles.gridCard, styles.gridCardEmpty]} />;
    }

    const stockStatus = getStockStatus(item.stock);
    
    return (
      // grid card for Wix-like gallery (dark style)
      <TouchableOpacity 
        style={[
          styles.gridCard,
          styles.gridCardDark,
          isMobile ? [styles.gridCardSingle, styles.gridCardMobile] : {}
        ]}
        onPress={() => navigation.navigate('ProductForm', { product: item })}
        activeOpacity={0.8}
        testID={`product-item-${item && (item._id || item.id) ? (item._id || item.id) : `idx-${index}`}`}
      >
  <View style={[styles.mediaWrap, isMobile ? styles.mediaWrapMobile : {}]}>
          <Image
            source={getImageSource(item)}
            style={isMobile ? styles.gridImageMobile : styles.gridImage}
            resizeMode="contain"
          />
          {item.onSale ? (
            <View style={styles.ribbon}><Text style={styles.ribbonText}>Sale</Text></View>
          ) : null}
        </View>

        <View style={styles.gridBody}>
          <Text style={styles.gridName} numberOfLines={2}>{displayName(item.name)}</Text>

          <View style={styles.gridPriceRow}>
            {item.onSale ? (
              <>
                { (item.originalPrice || item.price) ? (
                  <Text style={styles.originalPrice}>{formatUSD(item.originalPrice || item.price)}</Text>
                ) : null }
                { item.salePrice ? (
                  <Text style={styles.salePrice}>{formatUSD(item.salePrice)}</Text>
                ) : null }
              </>
            ) : (
              // not on sale: show original price (prefer originalPrice then price) with same beautiful font
              (item.originalPrice || item.price) ? (
                <Text style={styles.regularPrice}>{formatUSD(item.originalPrice || item.price)}</Text>
              ) : null
            )}
          </View>

          {/* Sort modal */}
          <Modal
            visible={showSortModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowSortModal(false)}
          >
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
              <View style={styles.modalContent}>
                {[
                  { key: 'recommended', label: 'Recommended' },
                  { key: 'newest', label: 'Newest' },
                  { key: 'price_asc', label: 'Price (low to high)' },
                  { key: 'price_desc', label: 'Price (high to low)' },
                  { key: 'name_asc', label: 'Name A-Z' },
                  { key: 'name_desc', label: 'Name Z-A' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortOptionRow, sortOption === opt.key && styles.sortOptionRowActive]}
                    onPress={() => { setSortOption(opt.key); setShowSortModal(false); }}
                  >
                    <Text style={[styles.sortOptionLabel, sortOption === opt.key && styles.sortOptionLabelActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={[styles.gridMetaRow, { backgroundColor: '#000', paddingTop: 6 }] }>
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon
                  key={i}
                  name={i < Math.round(item.rating || item.avgRating || 0) ? 'star' : 'star-border'}
                  size={14}
                  color="#ff4d36"
                />
              ))}
              <Text style={styles.reviewsText}>{item.reviewsCount ? ` ${item.reviewsCount}` : ''}</Text>
            </View>
              {(!(user && user.role === 'admin')) && (
                <TouchableOpacity
                  style={[styles.addToCart, isMobile ? styles.addToCartMobile : {}]} 
                  onPress={() => { cartCtx.addToCart(item); emit('openQuickCart'); }}
                  testID={`product-add-${item && (item._id || item.id) ? (item._id || item.id) : `idx-${index}`}`}
                >
                  <Text style={[styles.addToCartText, isMobile ? styles.addToCartTextMobile : {}]}>Add to Cart</Text>
                </TouchableOpacity>
              )}
              {/* Admin action buttons: Edit / Delete */}
              {(user && user.role === 'admin') && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('ProductForm', { product: item })}>
                    <Icon name="edit" size={18} color="#111" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item._id || item.id, item.name)}>
                    <Icon name="delete" size={18} color="#b91c1c" />
                  </TouchableOpacity>
                </View>
              )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* subheader: show Add Product for admin */}
      {user && user.role === 'admin' && (
        <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('ProductForm')}>
            <Icon name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* search box removed per request */}

      <View style={[styles.contentWrapper, isMobile ? styles.contentWrapperMobile : {}]}>
        {/* Sidebar (hidden on mobile) */}
        {!isMobile && (
          <View style={[styles.sidebar, isMobile ? styles.sidebarMobile : {}]}>
            <Text style={styles.sidebarTitle}>Browse by</Text>

            <ScrollView style={{ flex: 1 }}>
              <TouchableOpacity
                style={[styles.sidebarOption, selectedCategories.length === 0 && styles.sidebarOptionActive]}
                onPress={() => { clearCategoryFilter(); }}
              >
                <Text style={[styles.sidebarOptionText, selectedCategories.length === 0 && styles.sidebarOptionTextActive]}>All Products</Text>
              </TouchableOpacity>

              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.sidebarOption, selectedCategories.includes(cat) && styles.sidebarOptionActive]}
                  onPress={() => toggleCategory(cat)}
                >
                  <Text style={[styles.sidebarOptionText, selectedCategories.includes(cat) && styles.sidebarOptionTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}

              {/* Desktop/tablet Price filter inside sidebar */}
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#111' }}>
                <Text style={[styles.sidebarTitle, { fontSize: 14, marginBottom: 8 }]}>Price</Text>
                <TouchableOpacity style={[styles.mobileFilterItem, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowPriceExpand(s => !s)}>
                  <Text style={{ color: '#d1d5db' }}>{`${formatUSD(priceMin)} - ${formatUSD(priceMax)}`}</Text>
                  <Icon name={showPriceExpand ? 'remove' : 'add'} size={18} color="#d1d5db" />
                </TouchableOpacity>
                {showPriceExpand ? (
                  <View style={{ paddingVertical: 8 }}>
                    <PriceRangeSlider
                      min={PRICE_MIN_DEFAULT}
                      max={PRICE_MAX_DEFAULT}
                      valueMin={priceMin}
                      valueMax={priceMax}
                      onChange={(minV, maxV) => { setPriceMin(minV); setPriceMax(maxV); }}
                    />
                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                      <TouchableOpacity style={[styles.clearFiltersBtn, { flex: 1, marginRight: 8 }]} onPress={() => { setPriceMin(PRICE_MIN_DEFAULT); setPriceMax(PRICE_MAX_DEFAULT); setActivePriceFilter(null); fetchProductsWithFilters(1, search, selectedCategories); }}>
                        <Text style={styles.clearFiltersBtnText}>Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.applyBtn, { flex: 1 }]} onPress={() => { setActivePriceFilter({ min: priceMin, max: priceMax }); fetchProductsWithFilters(1, search, selectedCategories); }}>
                        <Text style={styles.applyBtnText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        )}

  {/* Main content */}
  <View style={[styles.main, isMobile ? styles.mainMobile : {}]}>
          <View style={styles.heroRow}>
            <Text style={styles.heroTitle}>{selectedCategories.length === 1 ? selectedCategories[0] : (selectedCategories.length > 1 ? 'Multiple categories' : 'All Products')}</Text>
          </View>

          <View style={styles.counterSortRow}>
            <Text style={styles.productsCounter}>{totalProducts} products</Text>
            <View style={styles.sortWrap}>
              {/* On mobile show a compact Filter & Sort link */}
              {isMobile ? (
                <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                  <Text style={styles.mobileFilterLink}>Filter & Sort</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Text style={styles.sortLabel}>Sort by:</Text>
                  <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortModal(true)}>
                    <Text style={styles.sortButtonText}>{
                      sortOption === 'recommended' ? 'Recommended'
                        : sortOption === 'newest' ? 'Newest'
                        : sortOption === 'price_asc' ? 'Price (low to high)'
                        : sortOption === 'price_desc' ? 'Price (high to low)'
                        : sortOption === 'name_asc' ? 'Name A-Z'
                        : sortOption === 'name_desc' ? 'Name Z-A'
                        : 'Recommended'
                    }</Text>
                    <Icon name="arrow-drop-down" size={20} color="#666" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <Animated.View style={{ flex: 1, opacity: listFade }}>
            {loading && !refreshing && (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.inlineLoadingText}>กำลังอัปเดต...</Text>
              </View>
            )}

            <FlatList
              data={paddedProducts}
              keyExtractor={(item) => item._id}
              renderItem={renderProduct}
              // force a remount when columns change to satisfy react-native-web FlatList invariant
              key={`grid-${columns}`}
              numColumns={columns}
              // only pass columnWrapperStyle when we have multiple columns
              columnWrapperStyle={columns > 1 ? styles.columnWrapper : null}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={onRefresh}
                  colors={['#007AFF']}
                  tintColor="#007AFF"
                />
              }
              contentContainerStyle={[styles.gridListContainer, paddedProducts.length === 0 && styles.listEmptyContainer]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainerEnhanced}>
                  <Icon name="inventory" size={72} color="#d1d5db" />
                  <Text style={styles.emptyTitleEnhanced}>
                    {search.length > 0 ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีสินค้าในระบบ'}
                  </Text>
                  <Text style={styles.emptyTextEnhanced}>
                    {search.length > 0 
                      ? 'ลองปรับคำค้นหาหรือหมวดหมู่ แล้วลองใหม่อีกครั้ง'
                      : 'เพิ่มสินค้ารายการแรกเพื่อเริ่มต้นการจัดการสต็อกของคุณ'
                    }
                  </Text>
                  {search.length === 0 && user && user.role === 'admin' && (
                    <TouchableOpacity
                      style={styles.emptyButton}
                      onPress={() => navigation.navigate('ProductForm')}
                    >
                      <Icon name="add" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.emptyButtonText}>เพิ่มสินค้า</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          </Animated.View>
        </View>
      </View>

      

      {/* Mobile Filter & Sort Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)}>
          {/* prevent outer press when interacting with panel */}
          <TouchableOpacity activeOpacity={1} style={styles.mobileFilterModal} onPress={() => {}}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.mobileFilterTitle}>Filter & Sort</Text>
                <Text style={{ color: '#6b7280', marginTop: 2, fontSize: 12 }}>{`(${totalProducts || 0} products)`}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilterModal(false)} style={{ padding: 6 }}>
                <Icon name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 8 }} />

            <Text style={{ color: '#d1d5db', fontWeight: '700', marginBottom: 8 }}>Sort by:</Text>
            {[
              { key: 'recommended', label: 'Recommended' },
              { key: 'newest', label: 'Newest' },
              { key: 'price_asc', label: 'Price (low to high)' },
              { key: 'price_desc', label: 'Price (high to low)' },
              { key: 'name_asc', label: 'Name A-Z' },
              { key: 'name_desc', label: 'Name Z-A' },
            ].map(opt => (
              <TouchableOpacity key={opt.key} style={[styles.mobileFilterItem, sortOption === opt.key && styles.mobileFilterItemActive, { flexDirection: 'row', alignItems: 'center' }]} onPress={() => { setSortOption(opt.key); }}>
                <View style={[styles.radioOuter, sortOption === opt.key && styles.radioOuterActive]}>
                  {sortOption === opt.key ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={[styles.mobileFilterItemText, sortOption === opt.key && styles.mobileFilterItemTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}

            <View style={{ height: 8 }} />
              <TouchableOpacity style={[styles.mobileFilterItem, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowPriceExpand(v => !v)}>
              <Text style={{ color: '#d1d5db' }}>{`Price (${formatUSD(priceMin)} - ${formatUSD(priceMax)})`}</Text>
              <Icon name={showPriceExpand ? 'remove' : 'add'} size={20} color="#d1d5db" />
            </TouchableOpacity>
            {showPriceExpand ? (
              <View style={{ paddingVertical: 8 }}>
                <PriceRangeSlider
                  min={PRICE_MIN_DEFAULT}
                  max={PRICE_MAX_DEFAULT}
                  valueMin={priceMin}
                  valueMax={priceMax}
                  onChange={(minV, maxV) => { setPriceMin(minV); setPriceMax(maxV); }}
                />
              </View>
            ) : null}

            <View style={styles.modalBottomBar}>
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={() => { clearCategoryFilter(); setSortOption('recommended'); setPriceMin(PRICE_MIN_DEFAULT); setPriceMax(PRICE_MAX_DEFAULT); setActivePriceFilter(null); setShowFilterModal(false); }}>
                <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => { setActivePriceFilter({ min: priceMin, max: priceMax }); setShowFilterModal(false); fetchProductsWithFilters(1, search, selectedCategories); }}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Pagination Controls */}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          {/* ปุ่มย้อนกลับ */}
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === 1 && styles.disabledButton]}
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Icon name="chevron-left" size={20} color={currentPage === 1 ? "#ccc" : "#007AFF"} />
          </TouchableOpacity>

          {/* แสดงหมายเลขหน้า */}
          <View style={styles.pageNumbers}>
            {/* หน้าแรก */}
            {currentPage > 3 && (
              <>
                <TouchableOpacity style={styles.pageButton} onPress={() => goToPage(1)}>
                  <Text style={styles.pageText}>1</Text>
                </TouchableOpacity>
                {currentPage > 4 && <Text style={styles.dots}>...</Text>}
              </>
            )}

            {/* หน้าข้างๆ ปัจจุบัน */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }

              if (pageNumber > 0 && pageNumber <= totalPages) {
                return (
                  <TouchableOpacity
                    key={pageNumber}
                    style={[
                      styles.pageButton,
                      pageNumber === currentPage && styles.activePageButton
                    ]}
                    onPress={() => goToPage(pageNumber)}
                  >
                    <Text style={[
                      styles.pageText,
                      pageNumber === currentPage && styles.activePageText
                    ]}>
                      {pageNumber}
                    </Text>
                  </TouchableOpacity>
                );
              }
              return null;
            })}

            {/* หน้าสุดท้าย */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <Text style={styles.dots}>...</Text>}
                <TouchableOpacity style={styles.pageButton} onPress={() => goToPage(totalPages)}>
                  <Text style={styles.pageText}>{totalPages}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ปุ่มถัดไป */}
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === totalPages && styles.disabledButton]}
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Icon name="chevron-right" size={20} color={currentPage === totalPages ? "#ccc" : "#007AFF"} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  headerGradient: { height: 140, justifyContent: 'flex-end', paddingBottom: 10 },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingBottom: 18 },
  title: {
    fontSize: 44,
    fontWeight: '700',
    color: '#fff',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  testButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0b0b',
    marginTop: 28,
    marginHorizontal: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#111',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  statsBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  searchResultText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  listContainer: {
    padding: 15,
    paddingTop: 5,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f3f4',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mobileFilterLink: {
    color: '#fff',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mobileFilterModal: {
    backgroundColor: '#0b0b0b',
    padding: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '70%'
  },
  mobileFilterTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  mobileFilterItem: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  mobileFilterItemActive: { backgroundColor: 'rgba(255,255,255,0.04)' },
  mobileFilterItemText: { color: '#ddd' },
  mobileFilterItemTextActive: { color: '#fff', fontWeight: '700' },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
    lineHeight: 24,
  },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff5f5',
  },
  productInfo: {
    marginBottom: 12,
  },
  productCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  productDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f4',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginLeft: 4,
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Pagination styles
  paginationInfo: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  paginationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
  },
  pageNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  activePageButton: {
    backgroundColor: '#007AFF',
  },
  pageText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  activePageText: {
    color: '#fff',
  },
  dots: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 4,
  },
  // Category Filter Styles
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterToggleText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
    marginRight: 8,
    fontWeight: '500',
  },
  clearFilterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 16,
  },
  clearFilterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryFilterContainer: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 8,
    maxHeight: 80, // จำกัดความสูงสูงสุด
  },
  categoryScrollView: {
    paddingHorizontal: 20,
  },
  categoryScrollContent: {
    paddingVertical: 4,
    paddingHorizontal: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    minHeight: 36, // ความสูงขั้นต่ำ
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  // List and empty state
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
    backgroundColor: '#fff',
  },
  listEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inlineLoadingText: {
    marginLeft: 8,
    color: '#666',
  },
  searchSubmitButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 6,
  },
  emptyContainerEnhanced: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitleEnhanced: {
    fontSize: 18,
    marginTop: 12,
    color: '#111827',
    fontWeight: '700',
  },
  emptyTextEnhanced: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 36,
  },
  // New layout: sidebar + main
  contentWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  // mobile: stack sidebar above main
  contentWrapperMobile: {
    flexDirection: 'column',
  },
  sidebar: {
    width: 220,
    backgroundColor: 'transparent',
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  sidebarMobile: {
    width: '100%',
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 12,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#d1d5db',
  },
  sidebarOption: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
  },
  sidebarOptionActive: {
    backgroundColor: 'transparent',
  },
  sidebarOptionText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  sidebarOptionTextActive: {
    color: '#ff4d36',
  },
  // compact chips for collapsed Browse By
  compactChipsRow: { paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  compactChip: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', marginRight: 8 },
  compactChipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  compactChipText: { color: '#374151' },
  compactChipTextActive: { color: '#fff' },
  collapseToggle: { padding: 6 },
  main: {
    flex: 1,
    padding: 16,
    backgroundColor: 'transparent',
  },
  mainMobile: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  heroRow: {
    paddingVertical: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  counterSortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  productsCounter: {
    color: '#6b7280',
    fontSize: 14,
  },
  sortWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortLabel: {
    color: '#6b7280',
    marginRight: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortButtonText: {
    marginRight: 6,
    color: '#374151',
  },
  // grid list
  gridListContainer: {
    paddingBottom: 120,
  },
  gridListSingleCenter: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    flex: 1,
    marginHorizontal: 6,
    // smaller fixed height so images align but cards are more compact
    minHeight: 260,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  // dark card style like screenshot: light image area, dark footer
  gridCardDark: {
    backgroundColor: '#0b0b0b',
    borderColor: '#111',
  },
  gridCardSingle: {
    maxWidth: 520,
    alignSelf: 'center',
  },
  mediaWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#f3f4f6',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  ribbon: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ribbonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  gridBody: {
    padding: 10,
    backgroundColor: '#000',
  },
  gridName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },

  gridPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  regularPrice: {
    color: '#999',
    marginRight: 8,
  },
  originalPrice: {
    color: '#999',
    marginRight: 8,
    textDecorationLine: 'line-through',
    fontSize: 13,
    fontWeight: '600',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  salePrice: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  gridMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewsText: {
    color: '#6b7280',
    marginLeft: 6,
    fontSize: 11,
  },
  addToCart: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addToCartText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  gridCardPlaceholder: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e9ecef',
  },
  gridCardEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  // mobile-specific grid card tweaks
  gridCardMobile: {
    maxWidth: '100%',
    marginHorizontal: 8,
    minHeight: 220,
    borderRadius: 12,
  },
  mediaWrapMobile: {
    aspectRatio: 1.2,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridImageMobile: {
    width: '60%',
    height: '60%',
    alignSelf: 'center',
  },
  addToCartMobile: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  addToCartTextMobile: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  // compact subheader
  subHeader: {
    height: 72,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  addButtonCompact: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },

  /* Sort modal styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 300,
    backgroundColor: '#0b0b0b',
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  sortOptionRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sortOptionRowActive: {
    backgroundColor: '#111',
  },
  sortOptionLabel: {
    color: '#d1d5db',
  },
  sortOptionLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  radioOuterActive: {
    borderColor: '#ff4d36',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff4d36',
  },
  modalBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  clearFiltersBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearFiltersBtnText: { color: '#fff' },
  applyBtn: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyBtnText: { color: '#000', fontWeight: '700' },
  /* Price slider styles */
  sliderTrack: {
    position: 'absolute',
    height: 2,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  sliderFilled: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#fff',
    top: 0,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    top: -9,
    left: 0,
  },
});

export default ProductList;
