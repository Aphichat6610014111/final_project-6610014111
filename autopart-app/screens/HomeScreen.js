import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import NavMenu from '../components/NavMenu';
import assetsIndex from '../assets/assetsIndex';
import Footer from '../components/Footer';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [topSellers, setTopSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Static categories data
  const categories = [
    'Wheels & Rims',
    'Engine',
    'Vehicle Body Parts', 
    'Accessories',
    'Brakes',
    'Electrical',
  ];

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
    
    // Try direct match first
    const directMatch = assetsIndex.map[key];
    if (directMatch) return directMatch;
    
    // Try lowercase with spaces
    const k = key.toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const spaceMatch = assetsIndex.map[k];
    if (spaceMatch) return spaceMatch;
    
    // Try with underscores
    const underscoreMatch = assetsIndex.map[k.replace(/\s+/g, '_')];
    if (underscoreMatch) return underscoreMatch;
    
    // Try partial matches for categories using exact asset filenames
    const categoryMappings = {
      'wheels': ['alloy', 'steel', 'steering wheel', '4x4'],
      'engine': ['aluminum piston', 'cylinder head combustion', 'cylinder head gasket', 'turbocharger', 'timing belt', 'car engine clutch'],
      'vehicle body parts': ['bumper', 'door handle', 'tie rod for kia mustang 2006'],
      'accessories': ['lamps', 'gps', 'car mats', 'seat cover', 'chrome', 'custom'],
      'brakes': ['brake disc', 'brake pads', 'brake cylinder', 'brake hoses'],
      'electrical': ['power steering pump', 'steering rack']
    };
    
    const lowerKey = key.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryMappings)) {
      if (lowerKey.includes(category) || keywords.some(kw => lowerKey.includes(kw))) {
        for (const keyword of keywords) {
          const match = assetsIndex.map[keyword];
          if (match) return match;
        }
      }
    }
    
    return null;
  };

  const getProductImage = (product) => {
    // Try to get image from imageUrl field first, then fallback to name
    const imageKey = product.imageUrl || product.imageKey || product.name;
    return getAsset(imageKey);
  };

  const formatPrice = (price) => {
    return `฿${price.toLocaleString()}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <NavMenu navigation={navigation} />

      {/* HERO */}
      <LinearGradient
        colors={['#dc2626', '#7f1d1d', '#000000']}
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

      {/* CATEGORIES */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingVertical: 6 }}
          renderItem={({ item }) => {
            const img = getAsset(item);
            return (
              <TouchableOpacity key={item} style={styles.catCardFixed} onPress={() => navigation.navigate('Products', { category: item })}>
                {img ? (
                  <Image source={img} style={styles.catImageFixed} resizeMode="cover" />
                ) : (
                  <View style={styles.catImagePlaceholderFixed} />
                )}
                <Text numberOfLines={2} style={styles.catLabelFixed}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
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
                  <TouchableOpacity style={styles.smallBtn} onPress={() => navigation.navigate('Products')}>
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
        colors={['#000000', '#7f1d1d', '#dc2626']}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  heroWrap: {
    height: Math.min(520, width * 0.6),
    marginBottom: 10,
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
  kicker: { color: '#fef2f2', fontWeight: '700', marginBottom: 8, letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '900', marginBottom: 8 },
  heroSub: { color: '#fecaca', fontSize: 16, marginBottom: 18 },
  heroCtas: { flexDirection: 'row' },
  ctaPrimary: { backgroundColor: '#000000', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginRight: 10 },
  ctaPrimaryText: { color: '#ffffff', fontWeight: '800' },
  ctaOutlined: { borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  ctaOutlinedText: { color: '#fecaca', fontWeight: '700' },

  section: { paddingHorizontal: 20, paddingVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#7f1d1d', marginBottom: 12 },

  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catCard: { width: '48%', backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#fecaca' },
  catImage: { width: '100%', height: 110 },
  catImagePlaceholder: { width: '100%', height: 110, backgroundColor: '#f9fafb' },
  catLabel: { padding: 10, fontWeight: '700', color: '#7f1d1d' },

  // Fixed-size category card to match top sellers
  catCardFixed: { width: 160, marginRight: 12, backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#fecaca' },
  catImageFixed: { width: 160, height: 110 },
  catImagePlaceholderFixed: { width: 160, height: 110, backgroundColor: '#fef2f2' },
  catLabelFixed: { padding: 8, fontWeight: '700', color: '#7f1d1d', width: 160, textAlign: 'left' },

  topCard: { width: 160, marginRight: 12, backgroundColor: '#fff', borderRadius: 8, padding: 10, elevation: 2, borderWidth: 1, borderColor: '#fecaca' },
  topImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8 },
  topImagePlaceholder: { width: '100%', height: 110, backgroundColor: '#fef2f2', borderRadius: 6, marginBottom: 8 },
  topName: { fontWeight: '800', color: '#7f1d1d' },
  topPrice: { marginTop: 6, fontWeight: '900', color: '#dc2626' },
  smallBtn: { marginTop: 8, backgroundColor: '#dc2626', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontWeight: '700' },

  infoStrip: { paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  infoItem: { flex: 1, alignItems: 'center' },
  infoTitle: { color: '#fff', fontWeight: '800', marginTop: 8 },
  infoDesc: { color: '#fecaca', fontSize: 12, marginTop: 4 },
  
  // Loading and error states
  loadingContainer: { alignItems: 'center', paddingVertical: 20 },
  loadingText: { marginTop: 10, color: '#7f1d1d', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 20 },
  errorText: { color: '#dc2626', fontSize: 14, marginBottom: 10, textAlign: 'center' },
  retryButton: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
  originalPrice: { color: '#9ca3af', fontSize: 12, textDecorationLine: 'line-through', marginTop: 2 },
});

export default HomeScreen;
