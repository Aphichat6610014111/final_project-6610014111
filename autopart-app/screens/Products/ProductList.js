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
  Platform,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import assetsIndex from '../../assets/assetsIndex';
import axios from 'axios';
import AuthContext from '../../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ProductList = ({ navigation }) => {
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

  // Category filter states
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
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
      else if (w >= 600) setColumns(2);
      else setColumns(1);
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
      setCurrentPage(1); // รีเซ็ตไป page 1
      fetchProducts(1);
    }, [])
  );

  const fetchProducts = async (page = currentPage) => {
    await fetchProductsWithFilters(page, search, selectedCategories);
  };

  // ฟังก์ชันสำหรับดึงหมวดหมู่ทั้งหมด
  const fetchCategories = async () => {
    if (!user || !token) return;

    try {
      const response = await axios.get('http://localhost:5000/api/products', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const products = response.data.data.products || [];
      const uniqueCategories = [...new Set(products.map(product => product.category))].sort();
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
    if (!user || !token) return;

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
      const response = await axios.get(`http://localhost:5000/api/products?page=1&limit=${limit}${searchParam}${categoryParam}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = response.data.data;
      // small delay so fade-out is noticeable
      setTimeout(() => {
        setProducts(data.products || []);
        setTotalPages(data.totalPages || 1);
        setTotalProducts(data.totalProducts || 0);
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
    if (!user || !token) return;

    setLoading(true);
    try {
      const searchParam = searchText ? `&search=${encodeURIComponent(searchText)}` : '';
      const categoryParam = categories.length > 0 ? `&category=${categories.join(',')}` : '';
      const response = await axios.get(`http://localhost:5000/api/products?page=${page}&limit=${limit}${searchParam}${categoryParam}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const data = response.data.data;
      setProducts(data.products || []);
      setTotalPages(data.totalPages || 1);
      setTotalProducts(data.totalProducts || 0);
      setCurrentPage(page);
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
              await axios.delete(`http://localhost:5000/api/products/${id}`, {
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

  // pad product list with invisible placeholders so last row keeps same card size
  const paddedProducts = (() => {
    const cols = Math.max(1, columns || 1);
    const rem = products.length % cols;
    const missing = rem === 0 ? 0 : cols - rem;
    if (missing === 0) return products;
    const pads = Array.from({ length: missing }).map((_, i) => ({ _id: `__blank_${i}_${cols}`, __empty: true }));
    return [...products, ...pads];
  })();

  const renderProduct = ({ item }) => {
    // render placeholder invisible card to keep layout
    if (item && item.__empty) {
      return <View style={[styles.gridCard, styles.gridCardPlaceholder]} />;
    }

    const stockStatus = getStockStatus(item.stock);
    
    return (
      // grid card for Wix-like gallery
      <View style={styles.gridCard}>
        <View style={styles.mediaWrap}>
          <Image
            source={getImageSource(item)}
            style={styles.gridImage}
            resizeMode="cover"
          />
          {item.onSale || (item.salePrice && item.salePrice < item.price) ? (
            <View style={styles.ribbon}><Text style={styles.ribbonText}>Sale</Text></View>
          ) : null}
        </View>

        <View style={styles.gridBody}>
          <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>

          <View style={styles.gridPriceRow}>
            {item.originalPrice || item.price ? (
              <Text style={styles.regularPrice}>฿{(item.originalPrice || item.price)?.toLocaleString()}</Text>
            ) : null}
            {item.salePrice ? (
              <Text style={styles.salePrice}>฿{item.salePrice?.toLocaleString()}</Text>
            ) : null}
          </View>

          <View style={styles.gridMetaRow}>
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon
                  key={i}
                  name={i < Math.round(item.rating || item.avgRating || 0) ? 'star' : 'star-border'}
                  size={14}
                  color="#f59e0b"
                />
              ))}
              <Text style={styles.reviewsText}>{item.reviewsCount ? ` ${item.reviewsCount}` : ''}</Text>
            </View>

            <TouchableOpacity style={styles.addToCart} onPress={() => Alert.alert('Add to cart', `${item.name} ถูกเพิ่มลงตะกร้า (placeholder)`)}>
              <Text style={styles.addToCartText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
      <View style={styles.header}>
        <Text style={styles.title}>สินค้าของร้าน</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('ProductForm')}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาสินค้า..."
          value={search}
          onChangeText={handleSearch}
          onSubmitEditing={submitSearch}
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={submitSearch} style={styles.searchSubmitButton}>
          <Icon name="search" size={18} color="#007AFF" />
        </TouchableOpacity>
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <Icon name="clear" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.contentWrapper}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
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
          </ScrollView>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          <View style={styles.heroRow}>
            <Text style={styles.heroTitle}>{selectedCategories.length === 1 ? selectedCategories[0] : (selectedCategories.length > 1 ? 'Multiple categories' : 'All Products')}</Text>
          </View>

          <View style={styles.counterSortRow}>
            <Text style={styles.productsCounter}>{totalProducts} products</Text>
            <View style={styles.sortWrap}>
              <Text style={styles.sortLabel}>Sort by:</Text>
              <TouchableOpacity style={styles.sortButton} onPress={() => { /* simple placeholder sort toggle */ fetchProducts(1); }}>
                <Text style={styles.sortButtonText}>Recommended</Text>
                <Icon name="arrow-drop-down" size={20} color="#666" />
              </TouchableOpacity>
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
                  {search.length === 0 && (
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
    backgroundColor: '#f8f9fa',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
  sidebar: {
    width: 220,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  sidebarOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  sidebarOptionActive: {
    backgroundColor: '#007AFF',
  },
  sidebarOptionText: {
    color: '#374151',
    fontSize: 14,
  },
  sidebarOptionTextActive: {
    color: '#fff',
  },
  main: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  heroRow: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
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
  },
  gridName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },

  gridPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  regularPrice: {
    color: '#6b7280',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  salePrice: {
    color: '#111827',
    fontWeight: '700',
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
});

export default ProductList;
