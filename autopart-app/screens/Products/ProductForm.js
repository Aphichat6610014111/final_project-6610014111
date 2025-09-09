import React, { useState, useContext, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator, useWindowDimensions, Modal, Share, Platform } from 'react-native';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import assetsIndex from '../../assets/assetsIndex';

const ProductForm = ({ route, navigation }) => {
  const product = route?.params?.product || {};
  const { user, token } = useContext(AuthContext);
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

  // Note: intentionally minimal helper set — use backend-hosted images only.
  const REVIEW_TITLE_MAX = 1000;
  const REVIEW_BODY_MAX = 5000;
  const REVIEW_IMG_LIMIT = 5;

  // UI state: tabs and image modal for zoomed view
  const [currentTab, setCurrentTab] = useState('description'); // description | specs | shipping | reviews
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);

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
      const message = `${product.name || 'Product'}${product.price ? ` - $${Number(product.price).toFixed(2)}` : ''}\n\n${product.description || ''}`;
      await Share.share({ message });
    } catch (e) {
      console.warn('share failed', e);
    }
  };

  const onAddToCart = () => {
    // navigate to AddToCart screen if available; otherwise simply notify
    try {
      navigation.navigate('AddToCart', { product });
    } catch (e) {
      // fallback: navigate to Transaction with simple cart
      navigation.navigate('Transaction', { cart: [{ productId: product._id || product.id, name: product.name, price: product.price || product.salePrice || 0, quantity }] });
    }
  };

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

  const paymentMethods = [
    { id: 'card', icon: 'credit-card', label: 'บัตรเครดิต / เดบิต' },
    { id: 'bank', icon: 'account-balance', label: 'โอนผ่านธนาคาร' },
    { id: 'cod', icon: 'local-shipping', label: 'ชำระเงินปลายทาง (COD)' },
  ];

  // Responsive layout based on window size
  const { width, height } = useWindowDimensions();
  // reserve space for footer so final content isn't hidden
  const FOOTER_HEIGHT = 68;
  // related products
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const isDesktop = width >= 1100;
  const isTablet = width >= 700 && width < 1100;

  const gridStyle = [{ width: isDesktop ? '90%' : '95%', maxWidth: 1100, marginTop: 20, flexDirection: isDesktop ? 'row' : 'column', alignItems: isDesktop ? 'flex-start' : 'center', paddingHorizontal: isDesktop ? 40 : 20 }];
  const leftColStyle = [{ flex: isDesktop ? 1 : undefined, alignItems: 'center', width: isDesktop ? undefined : Math.min(520, width - 40) }];
  const rightColStyle = [{ width: isDesktop ? 360 : '100%', marginTop: isDesktop ? 0 : 18 }];
  const imageW = isDesktop ? 420 : isTablet ? 360 : Math.min(520, width - 40);
  const imageH = Math.round(imageW * 1.333);

  // fetch related products (best-effort: by category or fallback recent)
  useEffect(() => {
    let cancelled = false;
    const fetchRelated = async () => {
      setLoadingRelated(true);
      try {
        const category = encodeURIComponent(product.category || '');
        // try to fetch by category, limit 6
  const url = `${API_BASE}/api/products?limit=6${category ? `&category=${category}` : ''}`;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(url, { headers });
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
  // use authenticated products endpoint to fetch full product details
  const url = `${API_BASE}/api/products/${product._id || product.id}`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(url, { headers });
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
        <View style={styles.topBar}>
          <View style={styles.breadcrumb}>
              <TouchableOpacity onPress={() => { if (navigation.popToTop) navigation.popToTop(); }}>
                <Text style={styles.breadcrumbLink}>Home</Text>
              </TouchableOpacity>
              <Text style={styles.breadcrumbSep}>/</Text>
              <Text style={styles.breadcrumbCurrent}>{product.name || 'Door Handle'}</Text>
            </View>

          <View style={styles.prevNext}>
            <TouchableOpacity onPress={onPrevProduct} style={styles.prevNextBtn}>
              <Text style={styles.prevNextText}>‹ Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNextProduct} style={styles.prevNextBtn}>
              <Text style={styles.prevNextText}>Next ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Body (scrollable) */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + 20 }}
          showsVerticalScrollIndicator={false}
        >
  <View style={{ paddingHorizontal: 20 }}>
    <View style={styles.centerWrap}>
      <View style={gridStyle}>
        <View style={leftColStyle}>
          <View style={[styles.largeImageContainer, { width: imageW, height: imageH }]}> 
            {mainImage ? (
              <View>
                <TouchableOpacity activeOpacity={1} onPress={() => openImage(mainImage)}>
                  <Image
                    source={getImageSource(mainImage, product)}
                    style={[styles.productImageInner, { width: Math.round(imageW * 0.9), height: Math.round(imageH * 0.9) }]}
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
                {thumbs.slice(0,3).map((u, i) => (
                <TouchableOpacity key={i} activeOpacity={1} onPress={() => setMainImage(u)}>
                  <Image source={getImageSource(u, product)} style={[styles.thumb, makeImageUrl(mainImage) === makeImageUrl(u) ? { borderWidth: 2, borderColor: '#FF3B30' } : {} ]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={rightColStyle}>
          <View style={{ paddingLeft: isDesktop ? 28 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.prodTitle}>{product.name || 'Lamps'}</Text>
              <TouchableOpacity onPress={onShare} style={{ padding: 8 }}>
                <Icon name="share" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.ratingRowTop}>
              <View style={styles.starsRow}>
                {(() => {
                  const r = Number(product.rating || 4.5);
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
              <Text style={styles.ratingTextTop}>{(product.rating || 4.5).toFixed(1)} | {reviews.length} reviews</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {product.price && product.salePrice && product.salePrice < product.price ? (
                <>
                  <Text style={styles.priceOld}>${Number(product.price).toFixed(2)}</Text>
                  <Text style={styles.priceLarge}> ${Number(product.salePrice).toFixed(2)}</Text>
                </>
              ) : (
                <Text style={styles.priceLarge}> ${Number(product.price || product.salePrice || 0).toFixed(2)}</Text>
              )}
            </View>

            <Text style={styles.qtyLabel}>Quantity *</Text>
            <View style={styles.qtyControlsRow}>
              <TouchableOpacity style={styles.qtySmall} onPress={dec}><Text style={styles.qtySmallText}>-</Text></TouchableOpacity>
              <View style={styles.qtyValue}><Text style={styles.qtyValueText}>{quantity}</Text></View>
              <TouchableOpacity style={styles.qtySmall} onPress={inc}><Text style={styles.qtySmallText}>+</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.outlineBtn} onPress={onAddToCart}>
              <Text style={styles.outlineBtnText}>Add to Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => { /* buy now */ }}>
              <Text style={styles.primaryBtnText}>Buy Now</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 12 }}>
              <View style={styles.tabRow}>
                {[
                  { key: 'description', label: 'Description' },
                  { key: 'specs', label: 'Specifications' },
                  { key: 'shipping', label: 'Shipping' },
                  { key: 'reviews', label: 'Reviews' },
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
                {currentTab === 'specs' && (
                  <View>
                    <Text style={[styles.infoText, { marginBottom: 8 }]}>{product.specs || product.features || 'No specifications provided.'}</Text>
                  </View>
                )}
                {currentTab === 'shipping' && (
                  <View>
                    <Text style={styles.infoText}>Shipping: {product.shippingInfo || 'Ships within 3-5 business days.'}</Text>
                  </View>
                )}
                {currentTab === 'reviews' && (
                  <View>
                    <Text style={styles.infoText}>{reviews.length} reviews</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ marginTop: 18 }}>
              <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => {}}>
                <Text style={[styles.infoTitle, { fontSize: 14 }]}>Return and Refund Policy</Text>
                <Icon name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>

    {/* Small reviews summary and link to full Reviews screen */}
    <View style={{ height: 20 }} /> 
    <View style={[styles.reviewsWrap, { paddingHorizontal: 20 }]}>
      <View style={styles.reviewsLeft}>
        <Text style={styles.sectionTitleWhite}>Reviews</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Icon key={i} name={i < Math.round(product.rating || (reviews.length ? (reviews.reduce((s,x)=>s+(x.rating||0),0)/reviews.length) : 4.5)) ? 'star' : 'star-border'} size={16} color={i < Math.round(product.rating || (reviews.length ? (reviews.reduce((s,x)=>s+(x.rating||0),0)/reviews.length) : 4.5)) ? '#FF3B30' : '#332222'} />
            ))}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Reviews', { product })} style={{ marginLeft: 12 }}>
            <Text style={{ color: '#fff', textDecorationLine: 'underline' }}>View all reviews ({reviews.length})</Text>
          </TouchableOpacity>
        </View>
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

      {/* Absolute footer (prevents content from being obscured) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtnOutline} onPress={onAddToCart}>
          <Text style={styles.footerBtnOutlineText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtnPrimary} onPress={() => { /* buy now */ }}>
          <Text style={styles.footerBtnPrimaryText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: '100%', backgroundColor: '#000' },
  topBar: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breadcrumb: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbLink: { color: '#fff', opacity: 0.8 },
  breadcrumbSep: { color: '#fff', opacity: 0.6, marginHorizontal: 8 },
  breadcrumbCurrent: { color: '#fff', fontWeight: '700' },
  prevNext: { flexDirection: 'row', alignItems: 'center' },
  prevNextBtn: { marginLeft: 12 },
  prevNextText: { color: '#ddd' },

  content: { paddingBottom: 60 },
  centerWrap: { alignItems: 'center' },
  grid: { gap: 24 },
  leftCol: { alignItems: 'center' },
  rightCol: { },
  largeImage: { borderRadius: 6, backgroundColor: '#111' },
  largeNoImage: { alignItems: 'center', justifyContent: 'center' },
  largeImageContainer: { alignItems: 'center', justifyContent: 'center' },
  productImageInner: { backgroundColor: 'transparent' },
  shortDescCard: { marginTop: 18 },
  shortDesc: { color: '#ddd', fontSize: 12, lineHeight: 18 },

  prodTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 8 },
  ratingRowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  starsRow: { flexDirection: 'row', marginRight: 8 },
  ratingTextTop: { color: '#ddd', marginLeft: 8, fontSize: 12 },
  priceLarge: { fontSize: 20, color: '#fff', fontWeight: '700', marginVertical: 12 },
  priceOld: { color: '#bbb', textDecorationLine: 'line-through', marginRight: 8, fontSize: 14 },
  qtyLabel: { color: '#ddd', marginTop: 8 },
  qtyControlsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  qtySmall: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#444' },
  qtySmallText: { color: '#fff', fontWeight: '700' },
  qtyValue: { marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#111', borderRadius: 6, borderWidth: 1, borderColor: '#333' },
  qtyValueText: { color: '#fff' },

  outlineBtn: { marginTop: 12, borderWidth: 1, borderColor: '#fff', paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  outlineBtnText: { color: '#fff', fontWeight: '700' },
  primaryBtn: { marginTop: 12, backgroundColor: '#FF3B30', paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },

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
  relatedCard: { width: 220, marginRight: 18, backgroundColor: '#0d0d0d', borderRadius: 6, padding: 10, borderWidth: 1, borderColor: '#222' },
  relatedImage: { width: '100%', height: 220, backgroundColor: '#ddd', borderRadius: 4 },
  relatedName: { color: '#fff', marginTop: 10, fontSize: 12 },
  relatedPrice: { color: '#ccc', fontSize: 12, marginTop: 6 },
  thumbRow: { flexDirection: 'row', marginTop: 14, alignItems: 'center' },
  thumb: { width: 56, height: 56, marginRight: 12 },
  tabRow: { flexDirection: 'row', marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 8 },
  tabBtn: { marginRight: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#FF3B30' },
  tabText: { color: '#ccc' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  tabContent: { marginTop: 12 },
  imagePlaceholderSmall: { width: 64, height: 64, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#444', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  priceOld: { color: '#bbb', textDecorationLine: 'line-through', marginRight: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 68, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.8)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222' },
  footerBtnOutline: { flex: 1, marginRight: 8, borderWidth: 1, borderColor: '#fff', paddingVertical: 12, borderRadius: 24, alignItems: 'center', backgroundColor: 'transparent' },
  footerBtnOutlineText: { color: '#fff', fontWeight: '700' },
  footerBtnPrimary: { flex: 1, marginLeft: 8, backgroundColor: '#FF3B30', paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  footerBtnPrimaryText: { color: '#fff', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseArea: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  modalContent: { width: '100%', flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalImage: { width: '100%', height: '80%' },
  modalCloseButton: { marginTop: 18, backgroundColor: 'rgba(255,59,48,0.9)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 },
});

export default ProductForm;
