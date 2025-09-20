import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ImageBackground,
  ScrollView,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HeaderHero from '../components/HeaderHero';
import axios from 'axios';
import { apiUrl } from '../utils/apiConfig';
// NavMenu removed per request - using simple header with logo
import assetsIndex from '../assets/assetsIndex';
import Footer from '../components/Footer';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CartContext from '../context/CartContext';
import { emit } from '../utils/eventBus';

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
  // Carousel state/ref for narrow-screen categories: keep hooks at top-level to preserve hook order
  const flatRef = useRef(null);
  const [catIndex, setCatIndex] = useState(0);

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
      
  console.log('Attempting to fetch from:', apiUrl('/api/public/products/top-sellers'));
      
  // Use helper for backend URL
  const response = await axios.get(apiUrl('/api/public/products/top-sellers'), {
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

  // background asset for body
  const bgAsset = getAsset('car-body');

  // Responsive layout: change mid-section layout based on window width
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isNarrow = windowWidth < 860; // stack on narrower screens
  const imageWidth = isNarrow ? Math.min(windowWidth - 48, 520) : Math.min(520, Math.round(windowWidth * 0.5));
  const imageHeight = Math.round(imageWidth * 0.72);
  // Increase hero/mid-section typography scale to make left column more prominent
  // Also cap/reduce sizes on very narrow screens so the forced 2-line heading fits
  const titleSizeBase = isNarrow ? 30 : 56;
  const heroTitleSizeBase = isNarrow ? 40 : 96;
  // If the window is very narrow, reduce proportionally to avoid wrapping to a 3rd line
  const titleSize = windowWidth < 500 ? Math.max(20, Math.round(windowWidth / 14)) : titleSizeBase;
  const heroTitleSize = windowWidth < 700 ? Math.max(28, Math.round(windowWidth / 10)) : heroTitleSizeBase;
  const paraSize = isNarrow ? 14 : 18;
  const midInnerStyle = { flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center' };
  // add some left padding on wide screens so the title breathes from the left edge
  const midLeftStyle = isNarrow ? { paddingRight: 0, paddingBottom: 18 } : { paddingRight: 28, maxWidth: 920, paddingLeft: 40 };
  // hero title responsive size (computed above as `heroTitleSize`)
  // conditional mid-section styles: full viewport height on wide screens, compact on mobile
  const midSectionStyle = !isNarrow ? { height: windowHeight, justifyContent: 'center' } : { paddingVertical: 24 };
  const imageBgStyle = !isNarrow ? { height: windowHeight } : {};

  // Handlers for narrow-screen category pager. Defined here (component scope) so they don't create
  // conditional hooks and so they can use the top-level flatRef and catIndex state.
  const onPrev = () => {
    const CARD_WIDTH = Math.round(windowWidth);
    const next = Math.max(0, catIndex - 1);
    flatRef.current?.scrollToOffset({ offset: next * CARD_WIDTH, animated: true });
    setCatIndex(next);
  };
  const onNext = () => {
    const CARD_WIDTH = Math.round(windowWidth);
    const next = Math.min(categories.length - 1, catIndex + 1);
    flatRef.current?.scrollToOffset({ offset: next * CARD_WIDTH, animated: true });
    setCatIndex(next);
  };

  const formatPrice = (price) => {
    try {
      const num = Number(price) || 0;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
    } catch (e) {
      return `$${price}`;
    }
  };

  const cartCtx = useContext(CartContext);

  // Compute Top Sellers card width so they fill the available row without awkward gaps
  const TOP_GAP = 24;
  const SIDE_PADDING = 48; // total left+right
  const visibleCount = isNarrow ? 1 : Math.min(5, Math.max(1, topSellers.length || 5));
  const computedCardWidth = Math.floor((windowWidth - SIDE_PADDING - TOP_GAP * (visibleCount - 1)) / visibleCount);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

  {/* HERO - HeaderHero now can optionally fill one viewport when fullPage is true */}
  <HeaderHero navigation={navigation} fullPage={true} />

  {/* BODY - image background only for body (use solid black background) */}
  <View style={styles.bodyBg}>
  <View style={styles.bodyOverlay}>

      {/* CATEGORIES - single full-width row with 4 boxes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shop by Category</Text>
        {/* compute card sizes so 4 fit across the available width */}
        {(() => {
          // On wide screens show 4 cards in one row. On narrow screens use paged carousel with buttons.
          if (!isNarrow) {
            const GAP = 24;
            const SIDE_PADDING = 48; // left+right total
            const visible = Math.min(4, categories.length);
            const CARD_WIDTH = Math.floor((windowWidth - SIDE_PADDING - GAP * (visible - 1)) / visible);
            const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.05);

            return (
              <View style={{ flexDirection: 'row', paddingHorizontal: 24, justifyContent: 'space-between' }}>
                {categories.slice(0,4).map((item, idx) => {
                  const imgKey = categoryImageMap[item] || item;
                  const img = getAsset(imgKey);
                  return (
                    <CategoryCard
                      key={item}
                      image={img}
                      label={item}
                      onPress={() => navigation.navigate('Products', { category: item })}
                      style={{ width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: idx < 3 ? GAP : 0 }}
                    />
                  );
                })}
              </View>
            );
          }

          // fallback: narrow screen paged carousel
          const CARD_WIDTH = Math.round(windowWidth);
          const CARD_HEIGHT = Math.round(windowHeight * 0.78);
          // Use top-level flatRef and catIndex/setCatIndex declared at component scope to
          // avoid conditional Hooks. Handlers onPrev/onNext are also defined at component scope.

          return (
            <View style={{ position: 'relative' }}>
              <FlatList
                data={categories}
                horizontal
                pagingEnabled
                ref={flatRef}
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item}
                renderItem={({ item, index }) => {
                  const imgKey = categoryImageMap[item] || item;
                  const img = getAsset(imgKey);
                  return (
                    <View style={{ width: CARD_WIDTH, paddingHorizontal: 0 }}>
                      <CategoryCard
                        key={item}
                        image={img}
                        label={item}
                        onPress={() => navigation.navigate('Products', { category: item })}
                        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                      />
                    </View>
                  );
                }}
                onMomentumScrollEnd={e => {
                  const newIndex = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                  setCatIndex(newIndex);
                }}
              />

              {/* Prev / Next buttons - narrow screens only */}
              {categories.length > 1 && (
                <>
                  <TouchableOpacity style={styles.pageBtnLeft} onPress={onPrev}>
                    <Text style={styles.pageBtnText}>{'‹'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.pageBtnRight} onPress={onNext}>
                    <Text style={styles.pageBtnText}>{'›'}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })()}
      </View>

      {/* MIDDLE HERO / BODY (use car image as full-width background) */}
      <View style={[styles.midSectionContainer, midSectionStyle]}>
        {bgAsset ? (
          <ImageBackground source={bgAsset} style={[styles.midSectionBg, imageBgStyle]} imageStyle={styles.midSectionImage}>
            {/* optional dark overlay for readability */}
            <LinearGradient colors={[ 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.25)' ]} style={{ ...StyleSheet.absoluteFillObject }} />

            <View style={[styles.midInner, midInnerStyle]}>
              <View style={[styles.midLeft, midLeftStyle]}>
                <Text numberOfLines={2} ellipsizeMode={'tail'} style={[styles.midTitle, { fontSize: heroTitleSize, lineHeight: Math.round(heroTitleSize * 1.02) }]}>
                  {`The One-Stop Shop\nfor Automotive Enthusiasts`}
                </Text>
                <Text style={[styles.midPara, { fontSize: paraSize }]}>I'm a paragraph. Click here to add your own text and edit me. I'm a great place for you to tell a story and let your users know a little more about you.</Text>

                <View style={styles.featuresBox}>
                  <View style={styles.featureRow}>
                    <View style={[styles.featureItem, { borderRightWidth: 1, borderBottomWidth: 1 }]}>
                      <Text style={styles.featureText}>Free in-store{"\n"}or curbside pickup</Text>
                    </View>
                    <View style={[styles.featureItem, { borderBottomWidth: 1 }]}>
                      <Text style={styles.featureText}>Personalized care including{"\n"}battery testing and installation</Text>
                    </View>
                  </View>
                  <View style={styles.featureRow}>
                    <View style={[styles.featureItem, { borderRightWidth: 1 }]}>
                      <Text style={styles.featureText}>Certified{"\n"}technicians only</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Text style={styles.featureText}>Get points for every purchase.{"\n"}Redeem points for rewards</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.learnBtn} onPress={() => navigation.navigate('Products')}>
                  <Text style={styles.learnBtnText}>Learn More</Text>
                </TouchableOpacity>
              </View>

              {/* keep a right column for layout balance on wide screens (empty - background supplies imagery) */}
              <View style={[styles.midRight, isNarrow ? { width: '100%', alignItems: 'center' } : { width: imageWidth }]} />
            </View>
          </ImageBackground>
        ) : (
          <View style={[styles.midSection, midSectionStyle]}>
            <View style={[styles.midInner, midInnerStyle]}>
              <View style={[styles.midLeft, midLeftStyle]}>
                <Text numberOfLines={2} ellipsizeMode={'tail'} style={[styles.midTitle, { fontSize: titleSize, lineHeight: Math.round(titleSize * 1.12) }]}>
                  {`The One-Stop Shop\nfor Automotive Enthusiasts`}
                </Text>
                <Text style={[styles.midPara, { fontSize: paraSize }]}>I'm a paragraph. Click here to add your own text and edit me. I'm a great place for you to tell a story and let your users know a little more about you.</Text>
              </View>
            </View>
          </View>
        )}
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
            contentContainerStyle={{ paddingHorizontal: SIDE_PADDING / 2, paddingVertical: isNarrow ? 12 : 0 }}
            renderItem={({ item, index }) => {
              const productImage = getProductImage(item);
              // On narrow screens we want extra vertical spacing and a consistent horizontal gap
              const itemMarginRight = isNarrow ? TOP_GAP : (index < visibleCount - 1 ? TOP_GAP : 0);
              const itemMarginVertical = isNarrow ? 8 : 0;
              return (
                <View style={[styles.topCard, { width: computedCardWidth, marginRight: itemMarginRight, marginVertical: itemMarginVertical }]}>
                  <View style={styles.topImageWrap}>
                    <View style={styles.badge}><Text style={styles.badgeText}>Best Seller</Text></View>
                    <TouchableOpacity activeOpacity={0.85} style={styles.topImageTouchable} onPress={() => navigation.navigate('ProductForm', { product: item })}>
                      {productImage ? (
                        // cover so the image fills the rounded image area like the mock
                        <Image source={productImage} style={styles.topImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.topImagePlaceholder} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.topInfo}>
                    <Text numberOfLines={2} style={styles.topName}>{displayName(item.name)}</Text>
                    <Text style={styles.topPrice}>{formatPrice(item.price)}</Text>

                    {/* rating: default to 0.0 (0) when missing */}
                    {(() => {
                      const ratingVal = item && typeof item.rating !== 'undefined' && item.rating !== null ? Number(item.rating) : 0;
                      const reviewsCount = item && typeof item.reviews !== 'undefined' && item.reviews !== null ? item.reviews : 0;
                      return (
                        <View style={styles.ratingRow}>
                          {[1,2,3,4,5].map(i => (
                            <Icon key={i} name="star" size={14} color={i <= Math.round(ratingVal) ? '#ff3b30' : '#444'} />
                          ))}
                          <Text style={styles.ratingText}>{` ${ratingVal.toFixed(1)} (${reviewsCount})`}</Text>
                        </View>
                      );
                    })()}

                    <TouchableOpacity style={styles.topOutlineBtn} onPress={() => { cartCtx.addToCart(item); emit('openQuickCart'); }}>
                      <Text style={styles.topOutlineBtnText}>Add to Cart</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>

      {/* BRANDS WE TRUST - horizontal row of partner logos */}
      <View style={[styles.section, { paddingTop: 6 }]}>
        <Text style={[styles.sectionTitle, { marginBottom: 18 }]}>Brands We Trust</Text>
        <View style={styles.brandsRow}>
          {[
            'drivilux',
            'autopartse',
            'wheelbu',
            'motorks',
            'drivery',
          ].map((key, idx) => {
            // try to get asset by key, fallback to autoparts-logo
            const asset = getAsset(key) || getAsset('autoparts-logo');
            return (
              <View key={key} style={styles.brandCard}>
                {asset ? (
                  <Image source={asset} style={styles.brandImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.brandPlaceholder}>Brand</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* WHY US */}
  <View style={[styles.infoStrip, { flexDirection: isNarrow ? 'column' : 'row', paddingHorizontal: isNarrow ? 12 : 24 }] }>
        <View style={styles.infoItemRow}>
          <View style={styles.infoIconWrap}>
            <Icon name="local-shipping" size={18} color="#fff" />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.infoTitle}>Free Shipping</Text>
            <Text style={styles.infoDesc}>On all orders over 75$</Text>
          </View>
        </View>

  {!isNarrow && <View style={styles.vertDivider} />}

        <View style={styles.infoItemRow}>
          <View style={styles.infoIconWrap}>
            <Icon name="verified" size={18} color="#fff" />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.infoTitle}>Tested & Proven</Text>
            <Text style={styles.infoDesc}>Highest quality testing standards</Text>
          </View>
        </View>

  {!isNarrow && <View style={styles.vertDivider} />}

        <View style={styles.infoItemRow}>
          <View style={styles.infoIconWrap}>
            <Icon name="support-agent" size={18} color="#fff" />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.infoTitle}>Customer Service</Text>
            <Text style={styles.infoDesc}>Available 24/7</Text>
          </View>
        </View>
      </View>

      <Footer navigation={navigation} />

      </View>
  </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollTransparent: { backgroundColor: 'transparent', flex: 1 },
  heroWrap: {
    height: Math.max(width * 0.5, 560), // make hero tall; on desktop fills more of viewport
    minHeight: 520,
    // extra breathing room below the hero so following sections don't butt up against it
    marginBottom: 80,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#000',
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
  kicker: { color: '#fef2f2', fontWeight: '400', marginBottom: 8, letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '400', marginBottom: 8 },
  heroSub: { color: '#fecaca', fontSize: 16, marginBottom: 18, fontWeight: '400' },
  heroCtas: { flexDirection: 'row' },
  ctaPrimary: { backgroundColor: '#000000', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginRight: 10 },
  ctaPrimaryText: { color: '#ffffff', fontWeight: '800' },
  ctaOutlined: { borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  ctaOutlinedText: { color: '#fecaca', fontWeight: '700' },

  section: { paddingHorizontal: 12, paddingVertical: 20, marginBottom: 18, marginTop: 24 },
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

  topCard: { width: 280, marginRight: 24, backgroundColor: 'transparent', borderRadius: 8, padding: 0, elevation: 0 },
  topImageWrap: { backgroundColor: '#e9e9e9', height: 360, borderRadius: 8, overflow: 'hidden', position: 'relative', marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
  // make the image fill the wrapper fully so it appears like the mock
  topImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  topImagePlaceholder: { width: '100%', height: 360, backgroundColor: '#e9e9e9', borderRadius: 8 },
  topImageTouchable: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  topName: { fontWeight: '800', color: '#ffffff' },
  topPrice: { marginTop: 6, fontWeight: '900', color: '#ff6b6b' },
  topInfo: { paddingHorizontal: 6, paddingBottom: 8, backgroundColor: 'transparent' },
  badge: { position: 'absolute', left: 12, top: 12, backgroundColor: '#ff4630', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 2, zIndex: 10 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  ratingText: { color: '#ddd', marginLeft: 8, fontSize: 12 },
  topOutlineBtn: { marginTop: 12, borderWidth: 2, borderColor: '#fff', paddingVertical: 12, borderRadius: 24, alignItems: 'center', backgroundColor: 'transparent' },
  topOutlineBtnText: { color: '#fff', fontWeight: '700' },
  smallBtn: { marginTop: 0, backgroundColor: '#dc2626', paddingVertical: 8, borderRadius: 6, alignItems: 'center', alignSelf: 'stretch' },
  smallBtnText: { color: '#fff', fontWeight: '700' },

  infoStrip: { paddingVertical: 28, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#000000' },
  infoItemRow: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingVertical: 6 },
  vertDivider: { width: 1, backgroundColor: 'rgba(255,77,54,0.18)', marginHorizontal: 20, height: 48, alignSelf: 'center' },
  infoItem: { flex: 1, alignItems: 'flex-start', flexDirection: 'row' },
  infoIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  infoTitle: { color: '#fff', fontWeight: '700', marginLeft: 12 },
  infoDesc: { color: '#fecaca', fontSize: 12, marginLeft: 12, marginTop: 4 },
  
  // Loading and error states
  loadingContainer: { alignItems: 'center', paddingVertical: 20 },
  loadingText: { marginTop: 10, color: '#ffffff', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 20 },
  errorText: { color: '#dc2626', fontSize: 14, marginBottom: 10, textAlign: 'center' },
  retryButton: { backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
  originalPrice: { color: '#9ca3af', fontSize: 12, textDecorationLine: 'line-through', marginTop: 2 },
  bodyBg: { paddingBottom: 20, backgroundColor: '#000000' },
  bodyOverlay: {},
  midSectionContainer: { marginBottom: 18 },
  midSection: { paddingHorizontal: 24, paddingVertical: 28 },
  midSectionBg: { width: '100%', paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },
  midSectionImage: { resizeMode: 'cover' },
  midInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  midLeft: { flex: 1, paddingRight: 20, maxWidth: 780 },
  midRight: { alignItems: 'flex-end' },
  midTitle: { color: '#fff', fontSize: 40, fontWeight: '400', lineHeight: 46, marginBottom: 12 },
  midPara: { color: '#ddd', fontSize: 14, marginBottom: 18 },
  featuresBox: { 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.14)', 
    marginBottom: 24,
    padding: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  featureRow: { flexDirection: 'row' },
  featureItem: { flex: 1, padding: 30, borderColor: 'rgba(255,255,255,0.08)' },
  featureText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '600' },
  learnBtn: { backgroundColor: '#ff4d36', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 28, alignSelf: 'flex-start' },
  learnBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  midImage: { borderRadius: 8 },
  midImagePlaceholder: { backgroundColor: '#150909', borderRadius: 8 },
  brandsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24 },
  brandCard: { flex: 1, height: 160, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  brandImage: { width: '70%', height: 70, opacity: 0.95 },
  brandPlaceholder: { color: '#fff', opacity: 0.85 },
  pageBtnLeft: { position: 'absolute', left: 12, top: '45%', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  pageBtnRight: { position: 'absolute', right: 12, top: '45%', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  pageBtnText: { color: '#fff', fontSize: 30, fontWeight: '700' },
});

export default HomeScreen;
