import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
// NavMenu removed per request - using simple header with logo
import assetsIndex from '../assets/assetsIndex';
import Footer from '../components/Footer';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

// Animated category card to provide hover (web) and press (mobile) zoom-in-on-hover effect
const CategoryCard = ({ image, label, onPress, style }) => {
  // animate image scale independently so container stays fixed (overflow hidden)
  const imageScale = useRef(new Animated.Value(1)).current;
  const elev = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(imageScale, { toValue: 1.06, useNativeDriver: true, tension: 200, friction: 12 }),
      Animated.timing(elev, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };
  const animateOut = () => {
    Animated.parallel([
      Animated.spring(imageScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 14 }),
      Animated.timing(elev, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const onPressIn = () => {
    Animated.spring(imageScale, { toValue: 0.98, useNativeDriver: true, tension: 300, friction: 12 }).start();
  };
  const onPressOut = () => {
    Animated.spring(imageScale, { toValue: 1.06, useNativeDriver: true, tension: 220, friction: 12 }).start();
  };

  // shadow / zIndex style when elevated (web may not support elevation)
  const containerElevation = elev.interpolate({ inputRange: [0,1], outputRange: [0,8] });

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      onHoverIn={Platform.OS === 'web' ? animateIn : undefined}
      onHoverOut={Platform.OS === 'web' ? animateOut : undefined}
      onPressIn={Platform.OS !== 'web' ? onPressIn : undefined}
      onPressOut={Platform.OS !== 'web' ? onPressOut : undefined}
    >
      <Animated.View style={[styles.catCardBig, { elevation: containerElevation, zIndex: containerElevation }, style]}>
        <View style={styles.catImageInner}>
          {image ? (
            <Animated.Image source={image} style={[styles.catImageBig, { transform: [{ scale: imageScale }] }]} resizeMode="cover" />
          ) : (
            <View style={styles.catImagePlaceholderBig} />
          )}
        </View>

        {/* bottom overlay similar to gallery-item-common-info */}
        <LinearGradient colors={[ 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.6)' ]} style={styles.catOverlay} start={{ x:0, y:0 }} end={{ x:0, y:1 }}>
          <View style={styles.catLabelWrap}> 
            <Text numberOfLines={2} style={styles.catLabelBig}>{label}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

const HomeScreen = ({ navigation }) => {
  const [topSellers, setTopSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Static categories data (limited to requested four)
  const categories = [
    'Wheels & Rims',
    'Engine',
    'Vehicle Body Parts',
    'Accessories',
  ];

  // Map categories to specific uploaded asset keys (match filenames in assetsIndex)
  const categoryImageMap = {
  // use normalized keys that match assetsIndex.map (lowercased, without extension)
  // use 'alloy' asset to avoid ampersand (&) in filename URL which breaks the packager
  'Wheels & Rims': 'wheels and rims', //
  'Engine': 'engine', // Engine.jpg
  'Vehicle Body Parts': 'vehicle body parts', // Vehicle Body Parts.jpg
  'Accessories': 'accessories', // Accessories.jpg
  };

  // Fetch top selling products from API
  useEffect(() => {
    fetchTopSellers();
  }, []);

  const fetchTopSellers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Attempting to fetch from: http://localhost:5000/api/public/products/top-sellers');
      
      // Updated URL to match the backend server running on port 5000
      const response = await axios.get('http://localhost:5000/api/public/products/top-sellers', {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        setTopSellers(response.data.data);
      } else {
        setError('Failed to load products');
      }
    } catch (err) {
      console.error('Error fetching top sellers:', err);
      setError('Unable to connect to server');
      
      // Fallback to demo data if API fails - using real product names from database
      setTopSellers([
        { _id: 'demo1', name: 'Lamps - Model 638', price: 339, imageUrl: 'lamps' },
        { _id: 'demo2', name: 'Door Handle - Model 526', price: 809, imageUrl: 'door handle' },
        { _id: 'demo3', name: 'GPS - Model 606', price: 319, imageUrl: 'gps' },
        { _id: 'demo4', name: 'Car Mats - Model 693', price: 794, imageUrl: 'car mats' },
        { _id: 'demo5', name: 'Steering Wheel Cover', price: 628, imageUrl: 'steering wheel' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getAsset = key => {
    if (!key) return null;
    
    // Try direct match first (exact key)
    const directMatch = assetsIndex.map[key];
    if (directMatch) return directMatch;

  // Strip path and extension if present, then normalize
  const raw = String(key);
  const basename = raw.split(/[\/]/).pop(); // grab filename from possible path
  const withoutExt = basename.replace(/\.[^/.]+$/, '');
  const lower = withoutExt.toLowerCase().trim();
  if (assetsIndex.map[lower]) return assetsIndex.map[lower];

  // Normalize non-alphanum to spaces (compress), then try
  const norm = lower.replace(/[^a-z0-9]+/g, ' ').trim();
    if (assetsIndex.map[norm]) return assetsIndex.map[norm];

    // Underscore variant
    const underscored = norm.replace(/\s+/g, '_');
    if (assetsIndex.map[underscored]) return assetsIndex.map[underscored];

    // Token inclusion heuristic: compare against normalized asset keys
    const tokens = norm.match(/\w+/g) || [];
    if (tokens.length) {
      const assetKeys = Object.keys(assetsIndex.map);
      // try exact normalized equality first
      for (const assetKey of assetKeys) {
        const akNorm = assetKey.replace(/[^a-z0-9]+/g, ' ').trim();
        if (akNorm === norm) return assetsIndex.map[assetKey];
      }

      // then try token inclusion against normalized keys
      for (const assetKey of assetKeys) {
        const akNorm = assetKey.replace(/[^a-z0-9]+/g, ' ').trim();
        let all = true;
        for (const t of tokens) {
          if (!akNorm.includes(t)) { all = false; break; }
        }
        if (all) return assetsIndex.map[assetKey];
      }
    }

  // Not found - log for debugging so we can trace missing assets
  console.warn(`[getAsset] missing asset for key: ${key} (norm: ${norm}). available keys: ${Object.keys(assetsIndex.map).join(', ')}`);
  return null;
  };

  const getProductImage = (product) => {
    // Try to get image from imageUrl field first, then fallback to name
    const imageKey = product.imageUrl || product.imageKey || product.name;
    return getAsset(imageKey);
  };

  // background asset for body
  const bgAsset = getAsset('car-body');

  const formatPrice = (price) => {
    return `฿${price.toLocaleString()}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AUTOPARTS MARKET</Text>
      </View>

    {/* HERO */}
  <LinearGradient
      colors={['#000000', '#2b0000', '#3d0c0c']}
      style={styles.heroWrap}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.heroContent}>
        <Text style={styles.kicker}>AUTOPARTS MARKET</Text>
        <Text style={styles.heroTitle}>Find the Right Part for Your Ride</Text>
        <Text style={styles.heroSub}>คุณภาพสูง ราคายุติธรรม ส่งไวทั่วประเทศ</Text>

        <View style={styles.heroCtas}>
          <TouchableOpacity style={styles.ctaPrimary} onPress={() => navigation.navigate('Products')}>
            <Text style={styles.ctaPrimaryText}>Shop Parts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaOutlined} onPress={() => navigation.navigate('Products')}>
            <Text style={styles.ctaOutlinedText}>View Categories</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>

    {/* BODY - image background only for body */}
      {/* BODY - replaced image background with a subtle black -> dark-red gradient */}
      <LinearGradient
        colors={["#000000", "#2b0000", "#3d0c0c"]}
        style={styles.bodyBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
      <View style={styles.bodyOverlay}>

      {/* CATEGORIES - single full-width row with 4 boxes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        {/* compute card sizes so 4 fit across the available width */}
        {(() => {
          const GAP = 20; // gap between cards (increased for better spacing)
          const H_PADDING = 24; // section horizontal padding total (left+right) - increased slightly
          const cols = 4;
          const avail = Math.max(0, width - H_PADDING - GAP * (cols - 1));
          // keep cards large (cap width so they don't shrink too much)
          // compute exact width so 4 cards fill the available width (no horizontal scroll)
          // try to fit 4 across when possible, but allow scrolling if viewport smaller
          const desired = Math.floor(avail / cols);
          const MAX_WIDTH = 360; // increased card size
          const CARD_WIDTH = Math.min(MAX_WIDTH, desired);
          const CARD_HEIGHT = Math.min(560, Math.round(CARD_WIDTH * 1.62)); // increased max height too

          return (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'flex-start' }}
            >
              <View style={[styles.categoryRow, { paddingHorizontal: 0 }]}> 
                {categories.map((item, idx) => {
                  const imgKey = categoryImageMap[item] || item;
                  const img = getAsset(imgKey);
                  // set right margin for spacing except last item
                  const marginRight = idx < categories.length - 1 ? 20 : 0;
                  return (
                    <CategoryCard
                      key={item}
                      image={img}
                      label={item}
                      onPress={() => navigation.navigate('Products', { category: item })}
                      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, marginRight }}
                    />
                  );
                })}
              </View>
            </ScrollView>
          );
        })()}
      </View>

      {/* TOP SELLERS */}
      <View style={[styles.section, { paddingTop: 6 }]}>
        <Text style={styles.sectionTitle}>Top Sellers</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#dc2626" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTopSellers}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={topSellers}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item._id || item.id}
            renderItem={({ item }) => {
              const productImage = getProductImage(item);
              return (
                <View style={styles.topCard}>
                  {productImage ? (
                    <Image source={productImage} style={styles.topImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.topImagePlaceholder} />
                  )}
                  <Text numberOfLines={2} style={styles.topName}>{item.name}</Text>
                  <Text style={styles.topPrice}>{formatPrice(item.price)}</Text>
                  {item.onSale && item.originalPrice && (
                    <Text style={styles.originalPrice}>฿{item.originalPrice.toLocaleString()}</Text>
                  )}
                  <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('ProductForm', { product: item })}>
                    <Text style={styles.smallBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* WHY US */}
      <LinearGradient
        colors={['#000000', '#2b0000', '#3d0c0c']}
        style={styles.infoStrip}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.infoItem}>
          <Icon name="local-shipping" size={24} color="#fff" />
          <Text style={styles.infoTitle}>Fast Delivery</Text>
          <Text style={styles.infoDesc}>ส่งด่วนทั่วประเทศ</Text>
        </View>
        <View style={styles.infoItem}>
          <Icon name="verified" size={24} color="#fff" />
          <Text style={styles.infoTitle}>Quality Parts</Text>
          <Text style={styles.infoDesc}>ชิ้นส่วนได้มาตรฐาน</Text>
        </View>
        <View style={styles.infoItem}>
          <Icon name="support-agent" size={24} color="#fff" />
          <Text style={styles.infoTitle}>Support</Text>
          <Text style={styles.infoDesc}>บริการหลังการขาย</Text>
        </View>
      </LinearGradient>

      <Footer navigation={navigation} />

      </View>
    </LinearGradient>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollTransparent: { backgroundColor: 'transparent', flex: 1 },
  heroWrap: {
  height: Math.min(520, width * 0.6),
  marginBottom: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    opacity: 0.12,
  },
  heroContent: {
    paddingHorizontal: 28,
    maxWidth: 900,
  },
  header: { height: 64, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: 'transparent' },
  headerTitle: {
    color: '#ffffff',
    fontSize: Platform.OS === 'ios' ? 20 : 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  kicker: { color: '#fef2f2', fontWeight: '700', marginBottom: 8, letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 8 },
  heroSub: { color: '#fecaca', fontSize: 16, marginBottom: 18 },
  heroCtas: { flexDirection: 'row' },
  ctaPrimary: { backgroundColor: '#000000', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginRight: 10 },
  ctaPrimaryText: { color: '#ffffff', fontWeight: '800' },
  ctaOutlined: { borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  ctaOutlinedText: { color: '#fecaca', fontWeight: '700' },

  section: { paddingHorizontal: 12, paddingVertical: 20, marginBottom: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 16 },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catCard: { width: '48%', backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#fecaca' },
  catImage: { width: '100%', height: 110 },
  catImagePlaceholder: { width: '100%', height: 110, backgroundColor: '#f9fafb' },
  catLabel: { padding: 10, fontWeight: '700', color: '#7f1d1d' },

  // Fixed-size category card to match top sellers
  catCardFixed: { width: 160, marginRight: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  catImageFixed: { width: 160, height: 110 },
  catImagePlaceholderFixed: { width: 160, height: 110, backgroundColor: 'rgba(255,255,255,0.03)' },
  catLabelFixed: { padding: 8, fontWeight: '700', color: '#ffffff', width: 160, textAlign: 'left' },

  // Big horizontal category card (screenshot style)
  catCardBig: { width: Math.min(320, Math.round(width * 0.28)), height: Math.round(Math.min(520, width * 0.5)), backgroundColor: 'transparent', borderRadius: 8, overflow: 'hidden', borderWidth: 0, marginRight: 12 },
  catImageBig: { width: '100%', height: '100%' },
  catImagePlaceholderBig: { width: '100%', height: '100%', backgroundColor: '#111' },
  catImageInner: { width: '100%', height: '100%', overflow: 'hidden' },
  catOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, justifyContent: 'flex-end' },
  catLabelWrap: { position: 'absolute', left: 18, bottom: 18 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, alignItems: 'flex-start' },
  catLabelBig: { color: '#fff', fontWeight: '900', fontSize: 18, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, maxWidth: Math.min(320, Math.round(width * 0.28)) - 36 },

  topCard: { width: 160, marginRight: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 12, elevation: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', justifyContent: 'space-between', height: 260 },
  topImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8 },
  topImagePlaceholder: { width: '100%', height: 110, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 8 },
  topName: { fontWeight: '800', color: '#ffffff' },
  topPrice: { marginTop: 6, fontWeight: '900', color: '#ff6b6b' },
  smallBtn: { marginTop: 0, backgroundColor: '#dc2626', paddingVertical: 8, borderRadius: 6, alignItems: 'center', alignSelf: 'stretch' },
  smallBtnText: { color: '#fff', fontWeight: '700' },

  infoStrip: { paddingVertical: 22, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoTitle: { color: '#fff', fontWeight: '800', marginTop: 8 },
  infoDesc: { color: '#fecaca', fontSize: 12, marginTop: 4 },
  
  // Loading and error states
  loadingContainer: { alignItems: 'center', paddingVertical: 20 },
  loadingText: { marginTop: 10, color: '#ffffff', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 20 },
  errorText: { color: '#dc2626', fontSize: 14, marginBottom: 10, textAlign: 'center' },
  retryButton: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
  originalPrice: { color: '#9ca3af', fontSize: 12, textDecorationLine: 'line-through', marginTop: 2 },
  bodyBg: { paddingBottom: 20 },
  bodyOverlay: {},
});

export default HomeScreen;
