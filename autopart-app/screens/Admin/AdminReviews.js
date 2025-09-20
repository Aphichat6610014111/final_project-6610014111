import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, RefreshControl, Image } from 'react-native';
import AuthContext from '../../context/AuthContext';
import Constants from 'expo-constants';
import axios from 'axios';

const AdminReviews = ({ navigation }) => {
  const { user, token } = useContext(AuthContext);
  const debuggerHost = (Constants.manifest && (Constants.manifest.debuggerHost || Constants.manifest.packagerOpts?.host)) || '';
  const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
  const API_BASE = `http://${devHost}:5000`;

  const [reviews, setReviews] = useState([]);
  const [adminProfiles, setAdminProfiles] = useState({}); // cache admin profiles by id
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all'); // 'all' or number
  const [repliedFilter, setRepliedFilter] = useState('all'); // 'all' | 'replied' | 'unreplied'

  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== 'admin') return;
    fetchReviews();
  }, [token, user]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE}/api/admin/reviews`, { headers });
      const data = res && res.data && res.data.data && res.data.data.reviews;
      const list = Array.isArray(data) ? data : [];
      setReviews(list);
      // collect authorId values from replies to fetch current admin profiles
      const ids = new Set();
      list.forEach(r => {
        if (Array.isArray(r.replies)) {
          r.replies.forEach(rp => {
            if (rp.authorId) ids.add(rp.authorId);
          });
        }
      });
      if (ids.size > 0) fetchAdminProfiles(Array.from(ids));
    } catch (err) {
      console.warn('Failed to fetch admin reviews', err?.response?.data || err.message || err);
      Alert.alert('Error', 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminProfiles = async (ids) => {
    // ids: array of user ids
    const toFetch = ids.filter(id => !adminProfiles[id]);
    if (toFetch.length === 0) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const fetched = {};
      for (const id of toFetch) {
        try {
          const res = await axios.get(`${API_BASE}/api/users/${id}`, { headers });
          if (res && res.data && res.data.user) fetched[id] = res.data.user;
        } catch (e) {
          console.warn('Failed to fetch admin profile', id, e?.response?.data || e.message || e);
        }
      }
      if (Object.keys(fetched).length > 0) setAdminProfiles(prev => ({ ...prev, ...fetched }));
    } catch (err) {
      console.warn('Failed to fetch admin profiles', err?.response?.data || err.message || err);
    }
  };

  const onRefresh = async () => {
    await fetchReviews();
  };

  const openReply = (review) => {
    setReplyingTo(review);
    setReplyText('');
  };

  const submitReply = async () => {
    if (!replyingTo) return;
    setActionLoading(replyingTo._id);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${API_BASE}/api/admin/reviews/${replyingTo._id}/replies`, { comment: replyText }, { headers });
      if (res && res.data && res.data.success) {
        const reply = res.data.reply;
        setReviews(prev => prev.map(r => r._id === replyingTo._id ? { ...r, replies: [...(r.replies||[]), reply] } : r));
        setReplyingTo(null);
        setReplyText('');
        Alert.alert('Success', 'Reply added');
      } else {
        Alert.alert('Error', 'Reply failed');
      }
    } catch (err) {
      console.warn('Reply failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Reply failed');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDeleteReply = (reviewId, replyId) => {
    Alert.alert('Confirm', 'Delete this reply?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReply(reviewId, replyId) }
    ]);
  };

  const deleteReply = async (reviewId, replyId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const idStr = String(replyId);
      // Prefer JSON-body delete endpoint to avoid URL-encoding/format issues
      let res;
      try {
        res = await axios.post(`${API_BASE}/api/admin/replies/delete`, { reviewId, replyId: idStr }, { headers });
      } catch (e) {
        // fallback to legacy DELETE URL endpoint
        res = await axios.delete(`${API_BASE}/api/admin/reviews/${reviewId}/replies/${encodeURIComponent(idStr)}`, { headers });
      }
      if (res && res.data && res.data.success) {
        const reviewIdStr = String(reviewId);
        setReviews(prev => prev.map(r => {
          if (String(r._id) !== reviewIdStr) return r;
          return { ...r, replies: (r.replies || []).filter(rp => {
            const rpId = rp._id ? String(rp._id) : (rp.createdAt ? String(rp.createdAt) : '');
            return rpId !== idStr;
          }) };
        }));
        Alert.alert('Deleted', 'Reply removed');
      } else {
        Alert.alert('Error', 'Failed to delete reply');
      }
    } catch (err) {
      console.warn('Delete reply failed', err?.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to delete reply');
    }
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.item}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.author || 'Anonymous'} <Text style={styles.meta}>({item.productId && item.productId.name ? item.productId.name : (item.productId || '')})</Text></Text>
          <Text style={styles.meta}>Rating: {item.rating}</Text>
          <Text style={styles.meta}>{item.comment}</Text>
          {Array.isArray(item.replies) && item.replies.length > 0 && (
            <View style={styles.replies}>
              {item.replies.map((rp) => {
                const profile = rp.authorId ? adminProfiles[rp.authorId] : null;
                const authorName = profile ? (profile.name || profile.displayName || profile.username) : (rp.author || 'Admin');
                const avatarUri = profile && profile.avatar && profile.avatar.location ? profile.avatar.location : null;
                return (
                  <View key={rp._id || rp.createdAt} style={styles.replyItem}>
                    <View style={styles.replyRow}>
                      {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.replyAvatar} /> : <View style={styles.replyAvatarPlaceholder} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.replyAuthor}>{authorName}</Text>
                        <Text style={styles.replyText}>{rp.comment}</Text>
                      </View>
                        {/* Delete reply button removed as requested */}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <View style={{ width: 100, alignItems: 'flex-end' }}>
          <TouchableOpacity style={styles.replyBtn} onPress={() => openReply(item)}>
            <Text style={styles.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // apply client-side filters
  const filteredReviews = reviews.filter(r => {
    // search term matches author, comment, or product name
    const q = (searchQuery || '').toString().toLowerCase().trim();
    if (q) {
      const hay = ((r.author||'') + ' ' + (r.comment||'') + ' ' + ((r.productId && r.productId.name) || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (ratingFilter !== 'all') {
      if (Number(r.rating) !== Number(ratingFilter)) return false;
    }
    if (repliedFilter === 'replied' && (!r.replies || r.replies.length === 0)) return false;
    if (repliedFilter === 'unreplied' && (r.replies && r.replies.length > 0)) return false;
    return true;
  });

  if (!token || !user) return <View style={styles.container}><Text style={styles.empty}>Please login as admin</Text></View>;
  if (user.role !== 'admin') return <View style={styles.container}><Text style={styles.empty}>Access denied. Admins only.</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Reviews</Text>
      <View style={styles.filterRow}>
        <TextInput placeholder="Search author, product or comment" value={searchQuery} onChangeText={setSearchQuery} style={styles.searchInput} />
        <View style={styles.filterChips}>
          <TouchableOpacity style={[styles.chip, ratingFilter === 'all' && styles.chipActive]} onPress={() => setRatingFilter('all')}><Text style={styles.chipText}>All</Text></TouchableOpacity>
          {[5,4,3,2,1].map(s => (
            <TouchableOpacity key={s} style={[styles.chip, ratingFilter === s && styles.chipActive]} onPress={() => setRatingFilter(ratingFilter === s ? 'all' : s)}><Text style={styles.chipText}>{s}★</Text></TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <TouchableOpacity style={[styles.smallBtn, repliedFilter === 'all' && styles.smallBtnActive]} onPress={() => setRepliedFilter('all')}><Text style={styles.smallBtnText}>All</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, repliedFilter === 'replied' && styles.smallBtnActive]} onPress={() => setRepliedFilter('replied')}><Text style={styles.smallBtnText}>Replied</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, repliedFilter === 'unreplied' && styles.smallBtnActive]} onPress={() => setRepliedFilter('unreplied')}><Text style={styles.smallBtnText}>Unreplied</Text></TouchableOpacity>
        </View>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : (
    <FlatList data={filteredReviews} keyExtractor={r => String(r._id)} renderItem={renderItem} ListEmptyComponent={<Text style={styles.empty}>No reviews</Text>} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />} />
      )}

      <Modal visible={!!replyingTo} transparent animationType="slide">
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 8 }}>Reply to review</Text>
            <Text style={{ color: '#ccc', marginBottom: 8 }}>{replyingTo && (replyingTo.comment || '')}</Text>
            <TextInput value={replyText} onChangeText={setReplyText} multiline placeholder="Type your reply" style={styles.replyInput} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity style={{ marginRight: 8 }} onPress={() => setReplyingTo(null)}><Text style={{ color: '#ccc' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.formSubmit} onPress={submitReply}><Text style={{ color: '#fff' }}>{actionLoading ? '...' : 'Send'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#0a0a0a' },
  header: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 12 },
  item: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row' },
  title: { color: '#fff', fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  empty: { color: '#999', textAlign: 'center', marginTop: 20 },
  replyBtn: { backgroundColor: '#0B7A3E', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  replyBtnText: { color: '#fff', fontWeight: '700' },
  replies: { marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#222' },
  replyItem: { marginBottom: 6 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start' },
  replyAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: '#222' },
  replyAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: 8, backgroundColor: '#333' },
  replyAuthor: { color: '#fff', fontWeight: '700' },
  replyText: { color: '#ccc' },
  deleteReplyBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  deleteReplyText: { color: '#ff6b6b', fontWeight: '700' },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: 520, maxWidth: '95%', backgroundColor: '#111', padding: 16, borderRadius: 8 },
  replyInput: { minHeight: 80, backgroundColor: '#222', color: '#fff', padding: 8, borderRadius: 6 },
  formSubmit: { backgroundColor: '#0B7A3E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 }
  ,
  filterRow: { marginBottom: 12 },
  searchInput: { backgroundColor: '#222', color: '#fff', padding: 8, borderRadius: 6, marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 6, marginRight: 8, borderRadius: 6, marginBottom: 8 },
  chipActive: { backgroundColor: '#0B7A3E' },
  chipText: { color: '#fff' },
  smallBtn: { backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
  smallBtnActive: { backgroundColor: '#0B7A3E' },
  smallBtnText: { color: '#fff' }
});

export default AdminReviews;
