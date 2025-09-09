import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import axios from 'axios';
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

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      if (reviews && reviews.length) return;
      if (!(product._id || product.id)) return;
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:5000/api/products/${product._id || product.id}/reviews`);
        if (!cancelled) setReviews(res?.data?.reviews || res?.data || []);
      } catch (e) {
        console.warn('Failed to fetch reviews', e?.message || e);
      } finally { if (!cancelled) setLoading(false); }
    };
    fetch();
    return () => { cancelled = true; };
  }, [product._id, product.id]);

  const submitReview = async () => {
    if (!reviewComment.trim()) { Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อความรีวิว'); return; }
    try {
      setLoading(true);
      let serverReview = null;
      if (product._id || product.id) {
        const res = await axios.post(`http://localhost:5000/api/products/${product._id || product.id}/reviews`, {
          name: reviewName.trim() || (user && (user.name || user.username)) || 'ผู้ใช้งาน',
          rating: reviewRating,
          comment: reviewComment.trim()
        });
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
      const res = await axios.post(`http://localhost:5000/api/products/${product._id || product.id}/reviews/${reviewId}/replies`, {
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
      const res = await axios.post(`http://localhost:5000/api/products/${product._id || product.id}/reviews/${reviewId}/helpful`);
      const helpfulCount = res.data.helpfulCount;
      setReviews(prev => prev.map(r => (r._id === reviewId ? { ...r, helpfulCount } : r)));
    } catch (e) {
      console.warn('helpful failed', e?.message || e);
    }
  };

  const deleteReview = async (reviewId, reviewUserId) => {
    // only attempt delete if we have a token
    if (!token) {
      Alert.alert('ต้องเข้าสู่ระบบ', 'เฉพาะผู้เขียนหรือผู้ดูแลระบบที่เข้าสู่ระบบสามารถลบรีวิวได้');
      return;
    }
    try {
      setLoading(true);
      await axios.delete(`http://localhost:5000/api/products/${product._id || product.id}/reviews/${reviewId}`, { headers: { Authorization: `Bearer ${token}` } });
      setReviews(prev => prev.filter(r => r._id !== reviewId));
      Alert.alert('สำเร็จ', 'ลบรีวิวเรียบร้อย');
    } catch (e) {
      console.warn('delete review failed', e?.message || e);
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถลบรีวิวได้');
    } finally { setLoading(false); }
  };

  const ratingAvg = (reviews.length ? (reviews.reduce((s, r) => s + (Number(r.rating)||0), 0) / reviews.length) : (product.rating || 0));

  const breakdown = [5,4,3,2,1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(Number(r.rating)||0) === star).length
  }));

  const numColumns = 2;
  const { width } = Dimensions.get('window');
  const cardWidth = Math.floor((width - 48) / numColumns);

  return (
    <View style={styles.page}>
      <View style={styles.headerRow}>
        <View style={styles.leftCol}>
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
          <TouchableOpacity style={styles.leaveBtn} onPress={() => setShowForm(s => !s)}>
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
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterText}>Filter by rating: All stars</Text>
        <Text style={styles.filterText}>Sort by: Most Relevant</Text>
      </View>

      {loading ? <ActivityIndicator size="large" color="#FF3B30" style={{ marginTop: 20 }} /> : (
        <FlatList
          data={reviews}
          keyExtractor={(r, i) => (r.id || r._id || String(i))}
          numColumns={numColumns}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.reviewCard, { width: cardWidth }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardAuthor}>{item.author || item.name || 'Anonymous'}</Text>
                <Text style={styles.cardDate}>{item.date || ''}</Text>
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
                <TouchableOpacity style={styles.actionBtn} onPress={() => markHelpful(item._1 || item._id || item.id)}><Icon name="thumb-up-off-alt" size={14} color="#ccc" /><Text style={styles.actionText}> {item.helpfulCount || 0} Yes</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => {
                  // open a prompt style reply (simple flow)
                  const replyText = '';
                  // For simplicity we'll navigate to the same screen with a reply UI handled inline
                  // show a quick JS prompt isn't available; instead we'll toggle a reply input per item
                  // We'll use a lightweight approach: add a temporary property to show reply input
                  setReviews(prev => prev.map(r => r._id === item._id ? { ...r, showReply: !(r.showReply) } : r));
                }}><Icon name="reply" size={14} color="#ccc" /><Text style={styles.actionText}> Reply</Text></TouchableOpacity>
                {(token && ((item.userId && user && String(item.userId) === String(user._id)) || (user && user.role === 'admin'))) && (
                  <TouchableOpacity style={[styles.actionBtn, { marginLeft: 12 }]} onPress={() => deleteReview(item._id)}>
                    <Icon name="delete" size={14} color="#ff6b6b" />
                    <Text style={[styles.actionText, { color: '#ff6b6b' }]}> Delete</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000', paddingTop: 24 },
  headerRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  leftCol: { flex: 1, paddingRight: 12 },
  rightCol: { width: 360, paddingLeft: 12 },
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
});
