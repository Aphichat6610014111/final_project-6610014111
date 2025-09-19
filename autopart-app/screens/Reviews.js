import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, Alert, Share } from 'react-native';
import { Modal, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';
import { apiUrl } from '../utils/apiConfig';
import AuthContext from '../context/AuthContext';

export default function Reviews({ route, navigation }) {
  const product = route?.params?.product || {};
  const { user, token } = useContext(AuthContext);
  const [reviews, setReviews] = useState(product.reviews || []);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reviewName, setReviewName] = useState(user?.name || user?.username || '');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  // Filter & sort state
  const [ratingFilter, setRatingFilter] = useState('all'); // 'all' or 5,4,3,2,1
  const [sortBy, setSortBy] = useState('most_relevant');
  const [showRatingMenu, setShowRatingMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Options modal state
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [optionsTargetId, setOptionsTargetId] = useState(null);
  const [optionsPosition, setOptionsPosition] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [deleteModalInfo, setDeleteModalInfo] = useState({});

  // helper to determine ownership in a robust way
  const isOwnerOf = (rev) => {
    if (!rev || !user || !token) return false;
    try {
      // admin always owner
      if (user.role === 'admin') return true;
      const uid = String(user._id || user.id || '').trim();
      const revUid = String(rev.userId || rev.user || '').trim();
      if (uid && revUid && uid === revUid) return true;
      const uname = (user.name || user.username || '').toLowerCase().trim();
      const revAuthor = (rev.author || rev.name || '').toLowerCase().trim();
      if (uname && revAuthor && (uname === revAuthor)) return true;
    } catch (e) { console.warn('isOwnerOf check failed', e); }
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      if (reviews && reviews.length) return;
      if (!(product._id || product.id)) return;
      setLoading(true);
      try {
  const res = await axios.get(apiUrl(`/api/products/${product._id || product.id}/reviews`));
        if (!cancelled) setReviews(res?.data?.reviews || res?.data || []);
      } catch (e) {
        console.warn('Failed to fetch reviews', e?.message || e);
      } finally { if (!cancelled) setLoading(false); }
    };
    fetch();
    return () => { cancelled = true; };
  }, [product._id, product.id]);

  const submitReview = async () => {
    if (!user || !token) {
      Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนส่งรีวิว', [
        { text: 'เข้าสู่ระบบ', onPress: () => navigation.navigate('Login') },
        { text: 'ยกเลิก' }
      ]);
      return;
    }
    if (!reviewComment.trim()) { Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อความรีวิว'); return; }
    try {
      setLoading(true);
      let serverReview = null;
      if (product._id || product.id) {
  const res = await axios.post(apiUrl(`/api/products/${product._id || product.id}/reviews`), {
          name: reviewName.trim() || (user && (user.name || user.username)) || 'ผู้ใช้งาน',
          rating: reviewRating,
          comment: reviewComment.trim()
        }, { headers: { Authorization: `Bearer ${token}` } });
        serverReview = res?.data?.review;
      }
      const newR = serverReview || { _id: String(Date.now()), author: reviewName.trim() || (user && (user.name || user.username)) || 'ผู้ใช้งาน', rating: reviewRating, comment: reviewComment.trim(), createdAt: new Date().toISOString() };
      setReviews(prev => [newR, ...prev]);
      setShowForm(false);
      setReviewComment('');
      Alert.alert('สำเร็จ', 'ขอบคุณสำหรับรีวิวของคุณ');
    } catch (e) {
      console.warn('submit review failed', e?.message || e);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งรีวิวได้');
    } finally { setLoading(false); }
  };

  // Reply to a review
  const submitReply = async (reviewId, replyText, replyName) => {
    if (!replyText || !replyText.trim()) { Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อความตอบกลับ'); return; }
    try {
  const res = await axios.post(apiUrl(`/api/products/${product._id || product.id}/reviews/${reviewId}/replies`), {
        name: replyName || (user && (user.name || user.username)) || 'ผู้ใช้งาน',
        comment: replyText.trim()
      });
      const newReply = res.data.reply;
      setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, replies: [...(r.replies||[]), newReply] } : r));
      Alert.alert('สำเร็จ', 'ตอบกลับเรียบร้อย');
    } catch (e) {
      console.warn('reply failed', e?.message || e);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถส่งตอบกลับได้');
    }
  };

  // Increment helpful count
  const markHelpful = async (reviewId) => {
    try {
      // guard: only call backend for likely ObjectId-like ids
      const id = reviewId || '';
      if (!/^[0-9a-fA-F]{24}$/.test(String(id))) {
        // optimistic update for local-only reviews
        setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, helpfulCount: (r.helpfulCount||0) + 1 } : r));
        return;
      }
  const res = await axios.post(apiUrl(`/api/products/${product._id || product.id}/reviews/${reviewId}/helpful`));
      const helpfulCount = res.data.helpfulCount;
      setReviews(prev => prev.map(r => (r._id === reviewId ? { ...r, helpfulCount } : r)));
    } catch (e) {
      console.warn('helpful failed', e?.message || e);
    }
  };

  const deleteReview = async (reviewId, reviewUserId) => {
    // If this is a local-only review (created client-side with fake id), just remove locally
    if (!/^[0-9a-fA-F]{24}$/.test(String(reviewId))) {
      console.debug('deleteReview: non-ObjectId id detected, removing locally only', { reviewId });
      setReviews(prev => prev.filter(r => r._id !== reviewId));
      Alert.alert('ลบเรียบร้อย', 'รีวิวที่ยังไม่ได้บันทึกบนเซิร์ฟเวอร์ถูกลบแล้ว (local only)');
      return;
    }
    // only attempt delete if we have a token
    if (!token) {
      Alert.alert('ต้องเข้าสู่ระบบ', 'เฉพาะผู้เขียนหรือผู้ดูแลระบบที่เข้าสู่ระบบสามารถลบรีวิวได้');
      console.warn('delete blocked: no token', { reviewId, productId: product._id || product.id });
      return;
    }
    setDeletingReviewId(reviewId);
    try {
      setLoading(true);
      console.debug('Attempting to delete review', { productId: product._id || product.id, reviewId, reviewUserId, hasToken: !!token, userId: user && (user._id || user.id) });
      const res = await axios.delete(apiUrl(`/api/products/${product._id || product.id}/reviews/${reviewId}`), { headers: { Authorization: `Bearer ${token}` } });
      // remove locally
      setReviews(prev => prev.filter(r => r._id !== reviewId));
      Alert.alert('สำเร็จ', 'ลบรีวิวเรียบร้อย');
      console.debug('Delete response', res && res.status, res && res.data);
      // re-fetch reviews to keep in sync with server canonical state
      try {
        const fres = await axios.get(apiUrl(`/api/products/${product._id || product.id}/reviews`));
        setReviews(fres?.data?.reviews || fres?.data || []);
      } catch (re) { console.warn('re-fetch reviews after delete failed', re); }
    } catch (e) {
      console.warn('delete review failed', e);
      const status = e?.response?.status;
      const data = e?.response?.data;
      // log owner vs current user for debugging when 403
      if (status === 403) {
        const rv = reviews.find(r => String(r._id) === String(reviewId));
        console.debug('403 delete details', { reviewId, reviewUserId: rv && (rv.userId || rv.user), reviewAuthor: rv && (rv.author || rv.name), currentUserId: user && (user._id || user.id), currentUserName: user && (user.name || user.username) });
        Alert.alert('ไม่มีสิทธิ์', data?.message || 'คุณไม่มีสิทธิ์ลบรีวิวนี้ (เฉพาะผู้เขียนหรือผู้ดูแลระบบ)');
      } else if (status === 401) {
        Alert.alert('เซสชันหมดอายุ', 'กรุณาเข้าสู่ระบบใหม่', [ { text: 'เข้าสู่ระบบ', onPress: () => navigation.navigate('Login') }, { text: 'ยกเลิก' } ]);
      } else if (status === 404) {
        Alert.alert('ไม่พบรีวิว', 'รีวิวนี้ไม่มีบนเซิร์ฟเวอร์แล้ว — จะรีเฟรชรายการ', [ { text: 'ตกลง' } ]);
        try {
          const fres = await axios.get(apiUrl(`/api/products/${product._id || product.id}/reviews`));
          setReviews(fres?.data?.reviews || fres?.data || []);
        } catch (re) { console.warn('re-fetch after 404 failed', re); }
      } else {
        const msg = status ? `Server returned ${status}: ${JSON.stringify(data)}` : (e?.message || 'Unknown error');
        Alert.alert('ข้อผิดพลาด', `ไม่สามารถลบรีวิวได้: ${msg}`);
      }
    } finally {
      setLoading(false);
      setDeletingReviewId(null);
    }
  };

  // Edit a review (optimistic)
  const editReview = async (reviewId, newComment) => {
    if (!token) {
      Alert.alert('ต้องเข้าสู่ระบบ', 'เฉพาะผู้เขียนหรือผู้ดูแลระบบที่เข้าสู่ระบบสามารถแก้ไขรีวิวได้');
      return;
    }
    if (!newComment || !newComment.trim()) { Alert.alert('ข้อผิดพลาด', 'ข้อความรีวิวต้องไม่ว่าง'); return; }
    const prev = reviews;
    try {
      // optimistic update
      setReviews(prevReviews => prevReviews.map(r => r._id === reviewId ? { ...r, comment: newComment.trim(), isEditing: false } : r));
      // call server
      if (product._id || product.id) {
        await axios.put(apiUrl(`/api/products/${product._id || product.id}/reviews/${reviewId}`), { comment: newComment.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      }
      Alert.alert('สำเร็จ', 'แก้ไขรีวิวเรียบร้อย');
    } catch (e) {
      console.warn('edit review failed', e?.message || e);
      // rollback
      setReviews(prev);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถแก้ไขรีวิวได้');
    }
  };

  const ratingAvg = (reviews.length ? (reviews.reduce((s, r) => s + (Number(r.rating)||0), 0) / reviews.length) : (product.rating || 0));

  const breakdown = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(Number(r.rating)||0) === star).length
  }));

  // responsive layout: adapt to screen width
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const onChange = ({ window }) => setWindowWidth(window.width);
    const sub = Dimensions.addEventListener ? Dimensions.addEventListener('change', onChange) : Dimensions.addEventListener('change', onChange);
    return () => { try { sub?.remove?.(); } catch (e) { /* some RN versions return unsubscribe fn */ } };
  }, []);

  const isMobile = windowWidth < 700; // threshold: small screens
  const numColumns = isMobile ? 1 : 2;
  const cardWidth = Math.floor((windowWidth - (isMobile ? 32 : 48)) / numColumns);

  // helper: map sort key to label
  function sortLabel(key) {
    switch (key) {
      case 'newest': return 'Newest';
      case 'oldest': return 'Oldest';
      case 'most_helpful': return 'Most helpful';
      case 'highest_rated': return 'Highest rated';
      case 'lowest_rated': return 'Lowest rated';
      default: return 'Most Relevant';
    }
  }

  // Apply rating filter and sorting to reviews array
  function filteredSortedReviews(list, ratingFilterVal, sortKey) {
    let out = Array.isArray(list) ? [...list] : [];
    // filter
    if (ratingFilterVal && ratingFilterVal !== 'all') {
      out = out.filter(r => Math.round(Number(r.rating) || 0) === Number(ratingFilterVal));
    }
    // sort
    switch (sortKey) {
      case 'newest':
        out.sort((a,b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
        break;
      case 'oldest':
        out.sort((a,b) => new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0));
        break;
      case 'most_helpful':
        out.sort((a,b) => (Number(b.helpfulCount) || 0) - (Number(a.helpfulCount) || 0));
        break;
      case 'highest_rated':
        out.sort((a,b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
        break;
      case 'lowest_rated':
        out.sort((a,b) => (Number(a.rating) || 0) - (Number(b.rating) || 0));
        break;
      default:
        // most_relevant: keep server order but prefer higher helpful and rating
        out.sort((a,b) => {
          const ha = Number(a.helpfulCount)||0, hb = Number(b.helpfulCount)||0;
          const ra = Number(a.rating)||0, rb = Number(b.rating)||0;
          return (hb - ha) || (rb - ra) || 0;
        });
    }
    return out;
  }

  return (
    <View style={styles.page}>
      {/* In-app delete confirmation modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 320, backgroundColor: '#111', padding: 16, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 8 }}>Confirm delete</Text>
            <Text style={{ color: '#ddd', marginBottom: 12 }}>{`Delete review?\nproductId=${deleteModalInfo.productId || ''}\nreviewId=${deleteModalInfo.reviewId || ''}\nhasToken=${!!deleteModalInfo.hasToken}`}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={{ marginRight: 12 }} onPress={() => { setDeleteModalVisible(false); setDeleteModalTarget(null); setDeleteModalInfo({}); }}><Text style={{ color: '#ccc' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: '#ff6b6b', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }} onPress={async () => {
                const id = deleteModalTarget;
                setDeleteModalVisible(false);
                setDeleteModalTarget(null);
                setDeleteModalInfo({});
                try { await deleteReview(id); } catch (err) { console.warn('delete from modal failed', err); }
              }}><Text style={{ color: '#111', fontWeight: '700' }}>{deletingReviewId === deleteModalTarget ? 'Deleting...' : 'Delete'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Anchored popover menu */}
      {optionsVisible && optionsPosition && (
        <View style={[styles.popoverWrap, { top: optionsPosition.y - 8, left: Math.max(8, optionsPosition.x - 170) }]} pointerEvents="box-none">
          <View style={styles.popoverCard}>
            {(() => {
              const target = reviews.find(r => r._id === optionsTargetId);
              // ownership: admin OR matching userId OR matching author/name to signed-in user
              const isOwner = isOwnerOf(target);
              const onClose = () => { setOptionsVisible(false); setOptionsTargetId(null); setOptionsPosition(null); };
              const copyLink = async () => {
                try {
                  const link = product && (product._id || product.id) ? apiUrl(`/products/${product._id || product.id}`) : '';
                  if (link) await Share.share({ message: link });
                  else Alert.alert('Info', 'No link available');
                } catch (e) { console.warn('share failed', e); }
                onClose();
              };
              return (
                <>
                  <TouchableOpacity style={styles.popoverRow} onPress={copyLink}>
                    <Icon name="link" size={18} color="#333" />
                    <Text style={styles.popoverText}>Copy Link</Text>
                  </TouchableOpacity>
                  {isOwner && (
                    <TouchableOpacity style={styles.popoverRow} onPress={() => { setReviews(prev => prev.map(r => r._id === optionsTargetId ? { ...r, isEditing: true, _editDraft: r.comment || r.body || '' } : r)); onClose(); }}>
                      <Icon name="edit" size={18} color="#333" />
                      <Text style={styles.popoverText}>Edit Review</Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && <View style={styles.popoverDivider} />}
                  {isOwner ? (
                    <TouchableOpacity style={styles.popoverRow} onPress={() => {
                      onClose();
                      setDeleteModalTarget(optionsTargetId);
                      setDeleteModalInfo({ productId: product._id || product.id, reviewId: optionsTargetId, hasToken: !!token });
                      setDeleteModalVisible(true);
                    }}>
                      {deletingReviewId === optionsTargetId ? (
                        <ActivityIndicator size="small" color="#ff6b6b" />
                      ) : (
                        <Icon name="delete" size={18} color="#ff6b6b" />
                      )}
                      <Text style={[styles.popoverText, { color: '#ff6b6b' }]}>{deletingReviewId === optionsTargetId ? 'Deleting...' : 'Delete Review'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.popoverRow} onPress={() => { onClose(); Alert.alert('Report', 'ขอบคุณ เราจะตรวจสอบรีวิวนี้'); }}>
                      <Icon name="report" size={18} color="#333" />
                      <Text style={styles.popoverText}>Report</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      )}
      <View style={[styles.headerRow, isMobile ? styles.headerRowMobile : {}]}>
        <View style={[styles.leftCol, isMobile ? styles.leftColMobile : {}]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}> 
              <Icon name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Reviews</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View style={{ flexDirection: 'row' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon key={i} name={i < Math.round(ratingAvg||0) ? 'star' : 'star-border'} size={18} color={'#FF3B30'} />
              ))}
            </View>
            <Text style={styles.ratingNumber}>{(ratingAvg || 0).toFixed(1)}</Text>
          </View>
          <Text style={styles.subText}>Based on {reviews.length} reviews</Text>
          <TouchableOpacity style={styles.leaveBtn} onPress={() => {
            if (!user || !token) {
              Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเขียนรีวิว', [
                { text: 'เข้าสู่ระบบ', onPress: () => navigation.navigate('Login') },
                { text: 'ยกเลิก' }
              ]);
              return;
            }
            setShowForm(s => !s);
          }}>
            <Text style={styles.leaveBtnText}>{showForm ? 'Cancel' : 'Leave a Review'}</Text>
          </TouchableOpacity>

          {showForm && (
            <View style={styles.formCard}>
              <Text style={{ color: '#ddd', marginBottom: 6 }}>Your name</Text>
              <TextInput value={reviewName} onChangeText={setReviewName} style={styles.formInput} />
              <Text style={{ color: '#ddd', marginTop: 8 }}>Rating</Text>
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                {[1,2,3,4,5].map(i => (
                  <TouchableOpacity key={i} onPress={() => setReviewRating(i)} style={{ marginRight: 8 }}>
                    <Icon name="star" size={20} color={i <= reviewRating ? '#FF3B30' : '#333'} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: '#ddd', marginTop: 8 }}>Comment</Text>
              <TextInput value={reviewComment} onChangeText={setReviewComment} multiline style={styles.formTextarea} />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity style={{ marginRight: 8 }} onPress={() => setShowForm(false)}><Text style={{ color: '#ccc' }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.formSubmit} onPress={submitReview}><Text style={{ color: '#fff' }}>{loading ? '...' : 'Submit'}</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {!isMobile && (
          <View style={styles.rightCol}>
            <Text style={styles.smallTitle}>Rating breakdown</Text>
            <View style={{ marginTop: 8 }}>
              {breakdown.map(b => {
                const total = Math.max(1, reviews.length);
                const pct = Math.round((b.count / total) * 100);
                return (
                  <View key={b.star} style={styles.breakRow}>
                    <Text style={styles.breakLabel}>{b.star} stars</Text>
                    <View style={styles.breakTrack}><View style={[styles.breakFill, { width: `${pct}%` }]} /></View>
                    <Text style={styles.breakCount}>{b.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterBtn} onPress={() => { setShowRatingMenu(s => !s); setShowSortMenu(false); }}>
          <Text style={styles.filterText}>Filter by rating: {ratingFilter === 'all' ? 'All stars' : `${ratingFilter} star${ratingFilter>1?'s':''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={() => { setShowSortMenu(s => !s); setShowRatingMenu(false); }}>
          <Text style={styles.filterText}>Sort by: {sortLabel(sortBy)}</Text>
        </TouchableOpacity>
      </View>

      {/* Rating dropdown menu */}
      {showRatingMenu && (
        <View style={styles.dropdownCard}>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setRatingFilter('all'); setShowRatingMenu(false); }}>
            <Text style={styles.dropdownText}>All stars</Text>
          </TouchableOpacity>
          {[5,4,3,2,1].map(s => (
            <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setRatingFilter(s); setShowRatingMenu(false); }}>
              <Text style={styles.dropdownText}>{s} stars</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Sort dropdown menu */}
      {showSortMenu && (
        <View style={styles.dropdownCard}>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSortBy('most_relevant'); setShowSortMenu(false); }}><Text style={styles.dropdownText}>Most Relevant</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSortBy('newest'); setShowSortMenu(false); }}><Text style={styles.dropdownText}>Newest</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSortBy('oldest'); setShowSortMenu(false); }}><Text style={styles.dropdownText}>Oldest</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSortBy('most_helpful'); setShowSortMenu(false); }}><Text style={styles.dropdownText}>Most helpful</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSortBy('highest_rated'); setShowSortMenu(false); }}><Text style={styles.dropdownText}>Highest rated</Text></TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSortBy('lowest_rated'); setShowSortMenu(false); }}><Text style={styles.dropdownText}>Lowest rated</Text></TouchableOpacity>
        </View>
      )}

      {loading ? <ActivityIndicator size="large" color="#FF3B30" style={{ marginTop: 20 }} /> : (
        <FlatList
          key={`cols-${numColumns}`}
          data={filteredSortedReviews(reviews, ratingFilter, sortBy)}
          keyExtractor={(r, i) => (r.id || r._id || String(i))}
          numColumns={numColumns}
          contentContainerStyle={{ paddingHorizontal: isMobile ? 12 : 16, paddingBottom: 80 }}
          columnWrapperStyle={isMobile ? undefined : { justifyContent: 'space-between', marginBottom: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.reviewCard, { width: cardWidth }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardAuthor}>{item.author || item.name || 'Anonymous'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.cardDate}>{item.date || ''}</Text>
                  {/* Top-right options button (ellipsis) */}
                  <TouchableOpacity
                    style={styles.optionsBtn}
                    onPressIn={(e) => {
                      const { pageX, pageY } = e.nativeEvent || {};
                      setOptionsPosition({ x: pageX, y: pageY });
                    }}
                    onPress={() => { setOptionsTargetId(item._id); setOptionsVisible(true); }}
                  >
                    <Icon name="more-vert" size={18} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name={i < Math.round(item.rating||0) ? 'star' : 'star-border'} size={14} color="#FF3B30" />
                ))}
                <Text style={styles.cardTitleSmall}>{item.title}</Text>
              </View>
              <Text style={styles.cardBody} numberOfLines={4}>{item.comment || item.body || ''}</Text>
              <TouchableOpacity><Text style={styles.showMore}>Show More ▾</Text></TouchableOpacity>
              <View style={styles.cardActions}>
                <Text style={styles.helpful}>Was this helpful?</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={() => markHelpful(item._id || item.id)}><Icon name="thumb-up-off-alt" size={14} color="#ccc" /><Text style={styles.actionText}> {item.helpfulCount || 0} Yes</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => {
                  // open a prompt style reply (simple flow)
                  const replyText = '';
                  // For simplicity we'll navigate to the same screen with a reply UI handled inline
                  // show a quick JS prompt isn't available; instead we'll toggle a reply input per item
                  // We'll use a lightweight approach: add a temporary property to show reply input
                  setReviews(prev => prev.map(r => r._id === item._id ? { ...r, showReply: !(r.showReply) } : r));
                }}><Icon name="reply" size={14} color="#ccc" /><Text style={styles.actionText}> Reply</Text></TouchableOpacity>
                {isOwnerOf(item) && (
                    <TouchableOpacity style={[styles.actionBtn, { marginLeft: 12 }]} onPress={() => {
                    // Open in-app modal confirmation
                    if (!token) { Alert.alert('ต้องเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนลบรีวิว'); console.warn('delete blocked: no token'); return; }
                    setDeleteModalTarget(item._id);
                    setDeleteModalInfo({ productId: product._id || product.id, reviewId: item._id, hasToken: !!token });
                    setDeleteModalVisible(true);
                  }}>
                    {deletingReviewId === item._id ? (
                      <ActivityIndicator size="small" color="#ff6b6b" />
                    ) : (
                      <Icon name="delete" size={14} color="#ff6b6b" />
                    )}
                    <Text style={[styles.actionText, { color: '#ff6b6b' }]}>{deletingReviewId === item._id ? ' Deleting' : ' Delete'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {item.showReply && (
                <View style={{ marginTop: 8 }}>
                  <TextInput placeholder="Write a reply..." placeholderTextColor="#666" style={[styles.formTextarea, { height: 60 }]} onChangeText={text => setReviews(prev => prev.map(r => r._id === item._id ? { ...r, _pendingReply: text } : r))} value={item._pendingReply || ''} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                    <TouchableOpacity style={{ marginRight: 8 }} onPress={() => setReviews(prev => prev.map(r => r._id === item._id ? { ...r, showReply: false, _pendingReply: '' } : r))}><Text style={{ color: '#ccc' }}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.formSubmit} onPress={() => {
                      const rv = reviews.find(r => r._id === item._id);
                      submitReply(item._id, rv._pendingReply, reviewName);
                      setReviews(prev => prev.map(r => r._id === item._id ? { ...r, showReply: false, _pendingReply: '' } : r));
                    }}><Text style={{ color: '#fff' }}>Reply</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              {/* Inline edit UI */}
              {item.isEditing && (
                <View style={{ marginTop: 8 }}>
                  <TextInput placeholder="แก้ไขรีวิว..." placeholderTextColor="#666" style={[styles.formTextarea, { height: 80 }]} onChangeText={text => setReviews(prev => prev.map(r => r._id === item._id ? { ...r, _editDraft: text } : r))} value={item._editDraft || ''} />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
                    <TouchableOpacity style={{ marginRight: 8 }} onPress={() => setReviews(prev => prev.map(r => r._id === item._id ? { ...r, isEditing: false, _editDraft: undefined } : r))}><Text style={{ color: '#ccc' }}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.formSubmit} onPress={() => {
                      const rv = reviews.find(r => r._id === item._id);
                      editReview(item._id, (rv && rv._editDraft) || '');
                    }}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              {/* render replies */}
              {item.replies && item.replies.length > 0 && (
                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#111', paddingTop: 8 }}>
                  {item.replies.map((rep, idx) => (
                    <View key={idx} style={{ marginBottom: 6 }}>
                      <Text style={{ color: '#ccc', fontWeight: '700' }}>{rep.author}</Text>
                      <Text style={{ color: '#bbb' }}>{rep.comment}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* On mobile, render rating breakdown below the list */}
      {isMobile && (
        <View style={[styles.rightCol, styles.rightColMobile, { marginTop: 12 }]}> 
          <Text style={styles.smallTitle}>Rating breakdown</Text>
          <View style={{ marginTop: 8 }}>
            {breakdown.map(b => {
              const total = Math.max(1, reviews.length);
              const pct = Math.round((b.count / total) * 100);
              return (
                <View key={b.star} style={styles.breakRow}>
                  <Text style={styles.breakLabel}>{b.star} stars</Text>
                  <View style={styles.breakTrack}><View style={[styles.breakFill, { width: `${pct}%` }]} /></View>
                  <Text style={styles.breakCount}>{b.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000', paddingTop: 24 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  headerRowMobile: { flexDirection: 'column', paddingHorizontal: 12 },
  leftCol: { flex: 1, paddingRight: 12 },
  leftColMobile: { paddingRight: 0 },
  rightCol: { width: 360, paddingLeft: 12 },
  rightColMobile: { width: '100%', paddingLeft: 0 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  ratingNumber: { color: '#ddd', marginLeft: 10 },
  subText: { color: '#bbb', marginTop: 8 },
  leaveBtn: { marginTop: 12, borderWidth: 1, borderColor: '#fff', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 24, alignSelf: 'flex-start' },
  leaveBtnText: { color: '#fff', fontWeight: '700' },
  smallTitle: { color: '#fff', fontWeight: '700' },
  breakRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  breakLabel: { width: 56, color: '#ccc', fontSize: 12 },
  breakTrack: { flex: 1, height: 8, backgroundColor: '#2b2b2b', borderRadius: 6, marginHorizontal: 8 },
  breakFill: { height: 8, backgroundColor: '#FF3B30', borderRadius: 6 },
  breakCount: { width: 24, color: '#ccc', fontSize: 12, textAlign: 'right' },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#111', borderBottomWidth: 1, borderBottomColor: '#111' },
  filterText: { color: '#ccc' },
  reviewCard: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#222', borderRadius: 8, padding: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAuthor: { color: '#fff', fontWeight: '700' },
  cardDate: { color: '#888', fontSize: 12 },
  cardTitleSmall: { color: '#ddd', marginLeft: 8, fontWeight: '700' },
  cardBody: { color: '#ddd', marginTop: 8 },
  showMore: { color: '#FF3B30', marginTop: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  helpful: { color: '#ccc', marginRight: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  actionText: { color: '#ccc', fontSize: 12 }
  ,formCard: { marginTop: 12, padding: 12, borderWidth: 1, borderColor: '#222', borderRadius: 8 },
  formInput: { backgroundColor: '#0d0d0d', color: '#fff', borderWidth: 1, borderColor: '#333', padding: 8, borderRadius: 6 },
  formTextarea: { backgroundColor: '#0d0d0d', color: '#fff', borderWidth: 1, borderColor: '#333', padding: 8, borderRadius: 6, height: 100, textAlignVertical: 'top' },
  formSubmit: { backgroundColor: '#FF3B30', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }

  ,dropdownCard: { position: 'absolute', right: 16, top: 120, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 6, paddingVertical: 6, width: 220, zIndex: 999 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12 },
  dropdownText: { color: '#ddd' },
  filterBtn: { paddingHorizontal: 6 }
  ,optionsBtn: { marginLeft: 8, padding: 6 }
  ,popoverWrap: { position: 'absolute', zIndex: 9999 }
  ,popoverCard: { width: 220, backgroundColor: '#fff', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 }
  ,popoverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 }
  ,popoverText: { color: '#222', marginLeft: 12 }
  ,popoverDivider: { height: 1, backgroundColor: '#eee', marginVertical: 6 }
});
